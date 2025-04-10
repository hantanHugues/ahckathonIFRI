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
    refetchInterval: 60000,
  });

  const { data: pulseData = [] } = useQuery({
    queryKey: [`/api/devices/${deviceIdStr}/sensor-data`, { sensorType: 'pulse', duration: '-1h' }],
    enabled: !!deviceIdStr,
    refetchInterval: 60000,
  });

  const { data: creatinineData = [] } = useQuery({
    queryKey: [`/api/devices/${deviceIdStr}/sensor-data`, { sensorType: 'creatinine', duration: '-1h' }],
    enabled: !!deviceIdStr,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (initialData) {
      setLatestData(initialData);
    }
  }, [initialData]);

  const [authError, setAuthError] = useState<string | undefined>(undefined);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  useEffect(() => {
    if (!device?.mqttTopic) return;

    mqttClient.connect('mqtt://broker.hivemq.com');

    const unsubscribe = mqttClient.addMessageHandler('patient/esp32-c40a24/data', (data) => {
      setLatestData({
        ...data,
        timestamp: new Date().toISOString(),
        deviceId: deviceIdStr
      });
    });

    return () => unsubscribe();
  }, [device?.mqttTopic, deviceIdStr]);

  const connectToBroker = useCallback((credentials?: { username: string, password: string }) => {
    if (!device?.mqttTopic) return;
    const options = credentials ? { ...credentials } : {};
    if (!mqttClient.getConnectionStatus()) {
      mqttClient.connect('mqtt://broker.hivemq.com', options);
    }
  }, [device?.mqttTopic]);

  useEffect(() => {
    if (!device?.mqttTopic) return;

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
    if (isConnected && device.mqttTopic) {
      unsubscribeMessage = mqttClient.addMessageHandler(device.mqttTopic, (data) => {
        setLatestData((prev) => ({ ...prev, ...data, timestamp: new Date().toISOString() }));
      });
    }

    return () => {
      unsubscribeConnection();
      unsubscribeMessage();
    };
  }, [device?.mqttTopic, isConnected, connectToBroker]);

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