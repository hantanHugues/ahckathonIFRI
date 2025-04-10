import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SensorData, SensorSetting } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { mqttClient } from '@/lib/mqtt-client';
import { getSensorData } from '@/lib/influxdb-client';
import { useToast } from '@/hooks/use-toast';

interface UseSensorsResult {
  latestData: SensorData | null;
  historicalData: {
    temperature: any[];
    pulse: any[];
    creatinine: any[];
  };
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
  refreshData: () => void;
  sensorSettings: SensorSetting[] | null;
  authError?: string;
  showAuthDialog: boolean;
  setShowAuthDialog: (show: boolean) => void;
  connectWithCredentials: (credentials: { username: string, password: string }) => void;
}

export function useSensors(deviceId: string | number) {
  const [isConnected, setIsConnected] = useState(false);
  const [latestData, setLatestData] = useState<SensorData | null>(null);
  const deviceIdStr = typeof deviceId === 'number' ? deviceId.toString() : deviceId;

  const { data: device } = useQuery({
    queryKey: [`/api/devices/${deviceId}`],
    enabled: !!deviceId,
  });

  const { data: sensorSettings } = useQuery({
    queryKey: [`/api/devices/${deviceId}/sensor-settings`],
    enabled: !!deviceId,
  });

  const { 
    data: initialData, 
    isLoading,
    error,
    refetch 
  } = useQuery({
    queryKey: [`/api/devices/${deviceIdStr}/latest-data`],
    enabled: !!deviceIdStr,
  });

  const { data: temperatureData = [] } = useQuery({
    queryKey: [`/api/devices/${deviceIdStr}/sensor-data`, { sensorType: 'temperature', duration: '-1h' }],
    enabled: !!deviceIdStr,
    // Rafraîchir toutes les 5 secondes pour une mise à jour en temps réel
    refetchInterval: 5000,
  });

  const { data: pulseData = [] } = useQuery({
    queryKey: [`/api/devices/${deviceIdStr}/sensor-data`, { sensorType: 'pulse', duration: '-1h' }],
    enabled: !!deviceIdStr,
    // Rafraîchir toutes les 5 secondes pour une mise à jour en temps réel
    refetchInterval: 5000,
  });

  const { data: creatinineData = [] } = useQuery({
    queryKey: [`/api/devices/${deviceIdStr}/sensor-data`, { sensorType: 'creatinine', duration: '-1h' }],
    enabled: !!deviceIdStr,
    // Rafraîchir toutes les 5 secondes pour une mise à jour en temps réel
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (initialData) {
      setLatestData(initialData);
    }
  }, [initialData]);

  const [authError, setAuthError] = useState<string | undefined>(undefined);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  useEffect(() => {
    // Utiliser un topic par défaut si le device n'a pas de topic MQTT
    const topic = 'patient/esp32-c40a24/data';

    // Utiliser websocket pour la connexion MQTT dans le navigateur
    mqttClient.connect('ws://broker.hivemq.com:8000/mqtt');

    const unsubscribe = mqttClient.addMessageHandler(topic, (data) => {
      setLatestData({
        ...data,
        timestamp: new Date().toISOString(),
        deviceId: deviceIdStr
      });
    });

    return () => unsubscribe();
  }, [deviceIdStr]);

  const connectToBroker = useCallback((credentials?: { username: string, password: string }) => {
    const options = credentials ? { ...credentials } : {};
    if (!mqttClient.getConnectionStatus()) {
      mqttClient.connect('ws://broker.hivemq.com:8000/mqtt', options);
    }
  }, []);

  useEffect(() => {
    const topic = 'patient/esp32-c40a24/data';

    const unsubscribeConnection = mqttClient.onConnectionChange((connected, errorType) => {
      setIsConnected(connected);
      setAuthError(errorType);
      if (errorType === 'auth_required') {
        setShowAuthDialog(true);
      }
    });

    if (!mqttClient.getConnectionStatus()) {
      connectToBroker();
    }

    let unsubscribeMessage = () => {};
    if (isConnected) {
      unsubscribeMessage = mqttClient.addMessageHandler(topic, (data) => {
        setLatestData((prev) => ({ 
          ...prev, 
          ...data, 
          timestamp: new Date().toISOString(),
          deviceId: deviceIdStr 
        }));
      });
    }

    return () => {
      unsubscribeConnection();
      unsubscribeMessage();
    };
  }, [isConnected, connectToBroker, deviceIdStr]);

  const refreshData = useCallback(() => {
    refetch();
  }, [refetch]);

  const { toast } = useToast();

  const connectWithCredentials = useCallback((credentials: { username: string, password: string }) => {
    if (!credentials.username || !credentials.password) {
      toast({
        title: "Informations manquantes",
        description: "Veuillez saisir un nom d'utilisateur et un mot de passe.",
        variant: "destructive",
      });
      return;
    }

    connectToBroker(credentials);
    setShowAuthDialog(false);

    toast({
      title: "Tentative de connexion",
      description: "Tentative de connexion au broker MQTT avec les identifiants fournis...",
    });
  }, [connectToBroker, toast]);

  return {
    latestData,
    historicalData: {
      temperature: temperatureData,
      pulse: pulseData,
      creatinine: creatinineData
    },
    isConnected,
    isLoading,
    error,
    refreshData,
    sensorSettings,
    authError,
    showAuthDialog,
    setShowAuthDialog,
    connectWithCredentials
  };
}