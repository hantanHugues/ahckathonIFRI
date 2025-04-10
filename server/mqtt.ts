import * as mqtt from 'mqtt';
import { storeSensorData } from './influxdb';
import { storage } from './storage';
import { SensorData } from '@shared/schema';

// Configurer la connexion MQTT vers HiveMQ
const brokerUrl = 'mqtt://broker.hivemq.com:1883';
const defaultTopic = 'patient/esp32-c40a24/data';
const mqttOptions = {
  clientId: `sensmed_backend_${Math.random().toString(16).substring(2, 10)}`,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000
};

let mqttClient: mqtt.MqttClient;
let isConnected = false;
let activeTopic = defaultTopic;
const activeDevices = new Map<string, string>();

export function initializeMqtt() {
  mqttClient = mqtt.connect(brokerUrl, mqttOptions);

  mqttClient.on('connect', () => {
    console.log('Connecté au broker MQTT:', brokerUrl);
    isConnected = true;
    subscribeTopic(defaultTopic);
    loadActiveDevices();
  });

  mqttClient.on('error', (error) => {
    console.error('Erreur de connexion MQTT:', error);
    isConnected = false;
  });

  mqttClient.on('message', async (topic, payload) => {
    try {
      console.log(`Message reçu sur ${topic}:`, payload.toString());
      const data = JSON.parse(payload.toString()) as SensorData;

      let deviceId = getDeviceIdFromTopic(topic);

      if (data && (data.temperature !== undefined || data.pulse !== undefined || data.creatinine !== undefined)) {
        await storeSensorData(deviceId, data);
        checkAlertThresholds(deviceId, data);
      }
    } catch (error) {
      console.error('Erreur lors du traitement du message MQTT:', error);
    }
  });

  return {
    client: mqttClient,
    isConnected: () => isConnected,
    subscribeTopic,
    unsubscribeTopic,
    publishMessage,
    getActiveTopic: () => activeTopic
  };
}

export function subscribeTopic(topic: string) {
  if (isConnected) {
    console.log('Abonnement au topic:', topic);
    mqttClient.subscribe(topic, (err) => {
      if (err) {
        console.error('Erreur lors de l\'abonnement au topic:', err);
      } else {
        activeTopic = topic;
      }
    });
  } else {
    console.error('Client MQTT non connecté. Impossible de s\'abonner au topic.');
  }
}

export function unsubscribeTopic(topic: string) {
  if (isConnected) {
    mqttClient.unsubscribe(topic, (err) => {
      if (err) {
        console.error('Erreur lors du désabonnement du topic:', err);
      }
    });
  }
}

export function publishMessage(topic: string, message: string) {
  if (isConnected) {
    mqttClient.publish(topic, message, { qos: 0, retain: false }, (err) => {
      if (err) {
        console.error('Erreur lors de la publication du message:', err);
      }
    });
  } else {
    console.error('Client MQTT non connecté. Impossible de publier le message.');
  }
}

export async function registerDeviceTopic(deviceId: string, topic: string) {
  const device = await storage.getDeviceByDeviceId(deviceId);

  if (device) {
    await storage.updateDevice(device.id, { mqttTopic: topic });
    subscribeTopic(topic);
    activeDevices.set(deviceId, topic);
    return true;
  }

  return false;
}

async function loadActiveDevices() {
  try {
    const devices = await storage.getDevices();

    devices.forEach(device => {
      if (device.status === 'active' && device.mqttTopic) {
        activeDevices.set(device.deviceId, device.mqttTopic);
        subscribeTopic(device.mqttTopic);
      }
    });
  } catch (error) {
    console.error('Erreur lors du chargement des dispositifs actifs:', error);
  }
}

function getDeviceIdFromTopic(topic: string): string {
  for (const [deviceId, deviceTopic] of activeDevices.entries()) {
    if (deviceTopic === topic) {
      return deviceId;
    }
  }

  const matches = topic.match(/patient\/([^\/]+)\/data/);
  if (matches && matches[1]) {
    return matches[1];
  }

  return 'unknown-device';
}

async function checkAlertThresholds(deviceId: string, data: SensorData) {
  try {
    const device = await storage.getDeviceByDeviceId(deviceId);
    if (!device) return;

    const sensorTypes = ['temperature', 'pulse', 'creatinine'];
    for (const sensorType of sensorTypes) {
      const value = data[sensorType as keyof SensorData] as number | undefined;
      if (value === undefined) continue;

      const sensorSetting = await storage.getSensorSettingByType(device.id, sensorType);
      if (!sensorSetting || !sensorSetting.alarmEnabled) continue;

      if (sensorSetting.minThreshold !== null && value < sensorSetting.minThreshold) {
        await storage.createAlert({
          deviceId: device.id,
          sensorType,
          level: 'warning',
          message: `Valeur de ${sensorType} trop basse: ${value} ${sensorSetting.unit}`,
          value,
          threshold: sensorSetting.minThreshold
        });
      } else if (sensorSetting.maxThreshold !== null && value > sensorSetting.maxThreshold) {
        await storage.createAlert({
          deviceId: device.id,
          sensorType,
          level: 'danger',
          message: `Valeur de ${sensorType} trop élevée: ${value} ${sensorSetting.unit}`,
          value,
          threshold: sensorSetting.maxThreshold
        });
      }
    }
  } catch (error) {
    console.error('Erreur lors de la vérification des seuils d\'alerte:', error);
  }
}