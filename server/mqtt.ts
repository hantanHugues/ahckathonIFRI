import * as mqtt from 'mqtt';
import { storeSensorData } from './influxdb';
import { storage } from './storage';
import { SensorData } from '@shared/schema';

// Mode production - pas de simulation
const SIMULATE_MQTT = false;

// Configurer la connexion MQTT vers HiveMQ
const brokerUrl = 'mqtt://broker.hivemq.com';
const defaultTopic = 'patient/esp32-c40a24/data';
const mqttOptions = {
  clientId: `sensmed_backend_${Math.random().toString(16).substring(2, 10)}`,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000,
};

// Fonction pour générer des données simulées
function generateMockSensorData(): SensorData {
  return {
    temperature: 36.5 + (Math.random() * 2 - 1), // Entre 35.5 et 37.5
    pulse: Math.floor(70 + (Math.random() * 30 - 15)), // Entre 55 et 85
    creatinine: 0.8 + (Math.random() * 0.4 - 0.2), // Entre 0.6 et 1.0
    timestamp: new Date().toISOString(),
    deviceId: 'esp32-c40a24'
  };
}

let mqttClient: mqtt.MqttClient;
let isConnected = false;
let activeTopic = defaultTopic;
const activeDevices = new Map<string, string>(); // deviceId -> topic

export function initializeMqtt() {
  // Mode simulation activé
  if (SIMULATE_MQTT) {
    console.log('Mode simulation MQTT activé - aucune connexion au broker ne sera établie');
    isConnected = true; // Simuler une connexion réussie
    activeTopic = defaultTopic;
    
    // Simuler la réception de messages MQTT périodiquement
    setInterval(async () => {
      try {
        const mockData = generateMockSensorData();
        const topic = defaultTopic;
        console.log(`[SIMULATION] Message reçu sur ${topic}:`, JSON.stringify(mockData));
        
        // Extraire deviceId du topic simulé
        const deviceId = getDeviceIdFromTopic(topic);
        
        // Stocker dans InfluxDB comme si c'était un vrai message
        await storeSensorData(deviceId, mockData);
        
        // Vérifier les seuils d'alerte
        await checkAlertThresholds(deviceId, mockData);
      } catch (error) {
        console.error('Erreur lors du traitement du message MQTT simulé:', error);
      }
    }, 5000); // Générer des données toutes les 5 secondes
    
    return {
      client: null as any, // Cela ne sera pas utilisé en mode simulation
      isConnected: () => true, // Toujours connecté en simulation
      subscribeTopic: (topic: string) => { activeTopic = topic; }, // Simuler l'abonnement
      unsubscribeTopic: () => {}, // Ne rien faire
      publishMessage: () => {}, // Ne rien faire
      getActiveTopic: () => activeTopic,
    };
  }
  
  // Mode réel (connexion au broker MQTT)
  mqttClient = mqtt.connect(brokerUrl, mqttOptions);
  
  mqttClient.on('connect', () => {
    console.log('Connecté au broker MQTT:', brokerUrl);
    isConnected = true;
    
    // S'abonner au topic par défaut
    subscribeTopic(defaultTopic);
    
    // Récupérer tous les dispositifs pour s'abonner à leurs topics
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
      
      // Trouver le deviceId correspondant au topic
      let deviceId = getDeviceIdFromTopic(topic);
      
      // Si le message contient des données valides de capteur
      if (data && (data.temperature !== undefined || data.pulse !== undefined || data.creatinine !== undefined)) {
        // Stocker les données dans InfluxDB
        await storeSensorData(deviceId, data);
        
        // Vérifier les seuils d'alerte pour chaque type de capteur
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
    getActiveTopic: () => activeTopic,
  };
}

// S'abonner à un topic
export function subscribeTopic(topic: string) {
  if (SIMULATE_MQTT) {
    console.log('[SIMULATION] Abonnement au topic:', topic);
    activeTopic = topic;
    return;
  }
  
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

// Se désabonner d'un topic
export function unsubscribeTopic(topic: string) {
  if (SIMULATE_MQTT) {
    console.log('[SIMULATION] Désabonnement du topic:', topic);
    return;
  }
  
  if (isConnected) {
    mqttClient.unsubscribe(topic, (err) => {
      if (err) {
        console.error('Erreur lors du désabonnement du topic:', err);
      }
    });
  }
}

// Publier un message sur un topic
export function publishMessage(topic: string, message: string) {
  if (SIMULATE_MQTT) {
    console.log(`[SIMULATION] Publication sur le topic ${topic}:`, message);
    return;
  }
  
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

// Associer un dispositif à un topic
export async function registerDeviceTopic(deviceId: string, topic: string) {
  const device = await storage.getDeviceByDeviceId(deviceId);
  
  if (device) {
    // Mettre à jour le topic du device
    await storage.updateDevice(device.id, { mqttTopic: topic });
    
    // S'abonner au nouveau topic
    subscribeTopic(topic);
    
    // Mettre à jour la liste des dispositifs actifs
    activeDevices.set(deviceId, topic);
    
    return true;
  }
  
  return false;
}

// Charger tous les dispositifs actifs depuis le stockage
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

// Trouver le deviceId associé à un topic
function getDeviceIdFromTopic(topic: string): string {
  // Chercher dans la map des dispositifs actifs
  for (const [deviceId, deviceTopic] of activeDevices.entries()) {
    if (deviceTopic === topic) {
      return deviceId;
    }
  }
  
  // Si aucun dispositif trouvé, extraire un ID du topic (par exemple: patient/esp32-c40a24/data -> esp32-c40a24)
  const matches = topic.match(/patient\/([^\/]+)\/data/);
  if (matches && matches[1]) {
    return matches[1];
  }
  
  // Si impossible d'extraire, utiliser un identifiant générique
  return 'unknown-device';
}

// Vérifier les seuils d'alerte pour les données du capteur
async function checkAlertThresholds(deviceId: string, data: SensorData) {
  try {
    // Trouver le device correspondant
    const device = await storage.getDeviceByDeviceId(deviceId);
    if (!device) return;
    
    // Pour chaque type de capteur
    const sensorTypes = ['temperature', 'pulse', 'creatinine'];
    for (const sensorType of sensorTypes) {
      const value = data[sensorType as keyof SensorData] as number | undefined;
      if (value === undefined) continue;
      
      // Récupérer les paramètres du capteur
      const sensorSetting = await storage.getSensorSettingByType(device.id, sensorType);
      if (!sensorSetting || !sensorSetting.alarmEnabled) continue;
      
      // Vérifier si la valeur est hors des seuils
      if (sensorSetting.minThreshold !== null && value < sensorSetting.minThreshold) {
        // Créer une alerte pour valeur trop basse
        await storage.createAlert({
          deviceId: device.id,
          sensorType,
          level: 'warning',
          message: `Valeur de ${sensorType} trop basse: ${value} ${sensorSetting.unit}`,
          value,
          threshold: sensorSetting.minThreshold
        });
      } else if (sensorSetting.maxThreshold !== null && value > sensorSetting.maxThreshold) {
        // Créer une alerte pour valeur trop haute
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
