import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { SensorCard } from "@/components/ui/sensor-card";
import { SensorChart } from "@/components/charts";
import { DataTable } from "@/components/ui/data-table";
import { MqttStatus } from "@/components/mqtt-status";
import { useDevice } from "@/hooks/use-device";
import { useSensors } from "@/hooks/use-sensors";
import { downloadSensorDataCsv } from "@/lib/influxdb-client";
import { formatDate, formatTime, getSensorStatus } from "@/lib/utils";
import { Loader2, RefreshCw } from "lucide-react";
import { DeviceCard } from "@/components/ui/device-card";
import { SensorData } from "@shared/schema";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("-1h");

  // Récupérer tous les dispositifs
  const { devices, isLoading: isLoadingDevices } = useDevice();

  // Utiliser le premier dispositif par défaut s'il n'y a pas de dispositif actif
  useEffect(() => {
    if (devices && devices.length > 0 && !activeDeviceId) {
      setActiveDeviceId(devices[0].deviceId);
    }
  }, [devices, activeDeviceId]);

  // Récupérer les données des capteurs pour le dispositif actif
  const {
    latestData,
    historicalData,
    isConnected,
    isLoading: isLoadingSensors,
    refreshData,
    sensorSettings
  } = useSensors(activeDeviceId || "");

  // Récupérer les alertes pour afficher dans le tableau
  const { data: alerts = [] } = useQuery({
    queryKey: ['/api/alerts', { resolved: false }],
    refetchInterval: 30000
  });

  // Préparer les données pour le tableau d'historique
  const [sensorHistory, setSensorHistory] = useState<any[]>([]);

  useEffect(() => {
    if (latestData) {
      // Ajouter les nouvelles données au début du tableau d'historique
      const newEntry = {
        timestamp: new Date(),
        temperature: latestData.temperature,
        pulse: latestData.pulse,
        creatinine: latestData.creatinine
      };
      
      setSensorHistory(prev => {
        // Limiter l'historique à 100 entrées pour éviter de surcharger la mémoire
        const newHistory = [newEntry, ...prev];
        if (newHistory.length > 100) {
          return newHistory.slice(0, 100);
        }
        return newHistory;
      });
    }
  }, [latestData]);

  // Gérer le changement de plage de temps pour les graphiques
  const handleTimeRangeChange = (range: string) => {
    let influxRange = "-1h";
    
    switch (range) {
      case "1h":
        influxRange = "-1h";
        break;
      case "6h":
        influxRange = "-6h";
        break;
      case "24h":
        influxRange = "-24h";
        break;
      case "7d":
        influxRange = "-7d";
        break;
    }
    
    setTimeRange(influxRange);
  };

  // Trouver les paramètres des capteurs pour le dispositif actif
  const getSettingForSensor = (sensorType: string) => {
    if (!sensorSettings) return { minThreshold: null, maxThreshold: null, unit: "" };
    
    const setting = sensorSettings.find(s => s.sensorType === sensorType);
    
    if (!setting) {
      switch (sensorType) {
        case "temperature":
          return { minThreshold: 35, maxThreshold: 38.5, unit: "°C" };
        case "pulse":
          return { minThreshold: 50, maxThreshold: 120, unit: "BPM" };
        case "creatinine":
          return { minThreshold: 0.5, maxThreshold: 1.5, unit: "mg/dL" };
        default:
          return { minThreshold: null, maxThreshold: null, unit: "" };
      }
    }
    
    return {
      minThreshold: setting.minThreshold,
      maxThreshold: setting.maxThreshold,
      unit: setting.unit || ""
    };
  };

  // Exporter les données au format CSV
  const handleExportCsv = () => {
    if (activeDeviceId) {
      downloadSensorDataCsv(activeDeviceId, timeRange, "now()");
    }
  };

  // Déterminer le statut d'une entrée de données
  const getDataStatus = (item: any) => {
    // Vérifier si toutes les valeurs sont dans les limites normales
    const tempSettings = getSettingForSensor("temperature");
    const pulseSettings = getSettingForSensor("pulse");
    const creatinineSettings = getSettingForSensor("creatinine");
    
    const tempStatus = getSensorStatus(item.temperature, tempSettings.minThreshold, tempSettings.maxThreshold);
    const pulseStatus = getSensorStatus(item.pulse, pulseSettings.minThreshold, pulseSettings.maxThreshold);
    const creatinineStatus = getSensorStatus(item.creatinine, creatinineSettings.minThreshold, creatinineSettings.maxThreshold);
    
    // Le statut global est le plus critique
    if (tempStatus === "danger" || pulseStatus === "danger" || creatinineStatus === "danger") {
      return { text: "Critique", status: "danger" as const };
    }
    
    if (tempStatus === "warning" || pulseStatus === "warning" || creatinineStatus === "warning") {
      return { text: "Attention", status: "warning" as const };
    }
    
    return { text: "Normal", status: "normal" as const };
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* En-tête du tableau de bord */}
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-darkest">Tableau de bord</h1>
            <p className="text-neutral-dark">Suivi des capteurs et données médicales en temps réel</p>
          </div>
          <div className="flex items-center space-x-2 mt-4 md:mt-0">
            <span className="text-sm text-neutral-dark">Dernière mise à jour: </span>
            <span className="text-sm font-medium">
              {latestData?.timestamp 
                ? new Date(latestData.timestamp).toLocaleString('fr-FR') 
                : new Date().toLocaleString('fr-FR')}
            </span>
            <Button 
              variant="outline" 
              size="icon" 
              className="h-8 w-8" 
              onClick={refreshData}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Cartes d'aperçu des capteurs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SensorCard
            type="temperature"
            value={latestData?.temperature}
            {...getSettingForSensor("temperature")}
            description="Corps"
          />
          
          <SensorCard
            type="pulse"
            value={latestData?.pulse}
            {...getSettingForSensor("pulse")}
            description="Pouls"
          />
          
          <SensorCard
            type="creatinine"
            value={latestData?.creatinine}
            {...getSettingForSensor("creatinine")}
            description="Fonction rénale"
          />
        </div>
        
        {/* Graphiques des tendances */}
        <SensorChart
          temperatureData={historicalData.temperature}
          pulseData={historicalData.pulse}
          creatinineData={historicalData.creatinine}
          isLoading={isLoadingSensors}
          onTimeRangeChange={handleTimeRangeChange}
        />
        
        {/* Tableau des données récentes */}
        <DataTable
          data={sensorHistory}
          columns={[
            {
              key: "timestamp" as keyof any,
              header: "Date",
              render: (value) => formatDate(value)
            },
            {
              key: "timestamp" as keyof any,
              header: "Heure",
              render: (value) => formatTime(value)
            },
            {
              key: "temperature" as keyof any,
              header: "Température (°C)"
            },
            {
              key: "pulse" as keyof any,
              header: "Pouls (BPM)"
            },
            {
              key: "creatinine" as keyof any,
              header: "Créatinine (mg/dL)"
            },
            {
              key: "status" as keyof any,
              header: "État"
            }
          ]}
          pagination={true}
          pageSize={5}
          onExport={handleExportCsv}
          statusFn={getDataStatus}
        />
        
        {/* Section des matelas connectés */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-4 border border-neutral-light">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-lg text-neutral-darkest">Matelas Connectés</h3>
                
                <Button variant="default" size="sm">
                  <i className="fas fa-plus mr-1"></i>
                  <span>Ajouter</span>
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isLoadingDevices ? (
                  <div className="col-span-2 flex justify-center py-8">
                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                  </div>
                ) : devices && devices.length > 0 ? (
                  devices.slice(0, 4).map((device) => (
                    <DeviceCard
                      key={device.id}
                      device={device}
                      sensorsCount={{ total: 3, active: device.status === "active" ? 3 : 0 }}
                      onRefresh={() => refreshData()}
                    />
                  ))
                ) : (
                  <div className="col-span-2 text-center py-8 text-neutral-dark">
                    Aucun matelas connecté disponible
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div>
            <MqttStatus />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
