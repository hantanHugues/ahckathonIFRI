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
  
  // Convertir deviceId en string si ce n'est pas déjà le cas
  const deviceIdStr = typeof deviceId === 'number' ? deviceId.toString() : deviceId;
  
  // Récupérer les informations sur le dispositif
  const { data: device } = useQuery({
    queryKey: [`/api/devices/${deviceId}`],
    enabled: !!deviceId,
  });
  
  // Récupérer les paramètres des capteurs
  const { data: sensorSettings } = useQuery({
    queryKey: [`/api/devices/${deviceId}/sensor-settings`],
    enabled: !!deviceId,
  });
  
  // Récupérer les dernières données du capteur depuis l'API
  const { 
    data: initialData, 
    isLoading,
    error,
    refetch 
  } = useQuery({
    queryKey: [`/api/devices/${deviceIdStr}/latest-data`],
    enabled: !!deviceIdStr,
  });
  
  // Récupérer les données historiques pour les graphiques
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
  
  // Initialiser les données les plus récentes
  useEffect(() => {
    if (initialData) {
      setLatestData(initialData);
    }
  }, [initialData]);
  
  // Gérer les erreurs d'authentification MQTT
  const [authError, setAuthError] = useState<string | undefined>(undefined);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  
  // Écouter les données réelles MQTT
  useEffect(() => {
    if (!device?.mqttTopic) return;
    
    // Se connecter au broker MQTT
    mqttClient.connect('mqtt://broker.hivemq.com');
    
    // S'abonner au topic du dispositif
    const unsubscribe = mqttClient.addMessageHandler('patient/esp32-c40a24/data', (data) => {
      setLatestData({
        ...data,
        timestamp: new Date().toISOString(),
        deviceId: deviceIdStr
      });
    });
    
    });
    
    setLatestData(prev => ({
      ...prev,
      temperature,
      pulse,
      creatinine,
      timestamp: new Date().toISOString()
    }));
      
      console.log('Simulation: Nouvelles données de capteurs générées', { temperature, pulse, creatinine });
    }, 5000); // Mise à jour toutes les 5 secondes
    
    return () => clearInterval(interval);
  }, [deviceIdStr]);
  
  // Fonction pour se connecter au broker MQTT
  const connectToBroker = useCallback((credentials?: { username: string, password: string }) => {
    // Si aucun topic n'est défini, ne pas se connecter
    if (!device?.mqttTopic) return;
    
    // Préparer les options de connexion
    const options = credentials ? { ...credentials } : {};
    
    // Se connecter au broker MQTT
    if (!mqttClient.getConnectionStatus()) {
      mqttClient.connect('mqtt://broker.hivemq.com', options);
    }
  }, [device?.mqttTopic]);
  
  // Se connecter au broker MQTT et écouter les mises à jour
  useEffect(() => {
    if (!device?.mqttTopic) return;
    
    // Gérer les changements d'état de connexion
    const unsubscribeConnection = mqttClient.onConnectionChange((connected, errorType) => {
      setIsConnected(connected);
      setAuthError(errorType);
      
      // Afficher la boîte de dialogue si l'authentification est requise
      if (errorType === 'auth_required') {
        setShowAuthDialog(true);
      }
    });
    
    // Essayer de se connecter si pas déjà connecté
    if (!mqttClient.getConnectionStatus()) {
      connectToBroker();
    }
    
    // S'abonner au topic du dispositif seulement si connecté
    let unsubscribeMessage = () => {};
    if (isConnected && device.mqttTopic) {
      unsubscribeMessage = mqttClient.addMessageHandler(device.mqttTopic, (data) => {
        // Mettre à jour les données en temps réel
        setLatestData((prev) => ({ ...prev, ...data, timestamp: new Date().toISOString() }));
      });
    }
    
    return () => {
      unsubscribeConnection();
      unsubscribeMessage();
    };
  }, [device?.mqttTopic, isConnected, connectToBroker]);
  
  // Fonction pour actualiser manuellement les données
  const refreshData = useCallback(() => {
    refetch();
  }, [refetch]);
  
  // Récupérer le toast
  const { toast } = useToast();
  
  // Fonction pour se connecter avec des identifiants
  const connectWithCredentials = useCallback((credentials: { username: string, password: string }) => {
    if (!credentials.username || !credentials.password) {
      toast({
        title: "Informations manquantes",
        description: "Veuillez saisir un nom d'utilisateur et un mot de passe.",
        variant: "destructive",
      });
      return;
    }
    
    // Tenter de se connecter avec les identifiants fournis
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
