import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { useDevice } from "@/hooks/use-device";
import { useSensors } from "@/hooks/use-sensors";
import { SensorCard } from "@/components/ui/sensor-card";
import { SensorChart } from "@/components/charts";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { downloadSensorDataCsv } from "@/lib/influxdb-client";
import { formatDate, formatTime, getSensorStatus } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  Loader2, 
  RefreshCw, 
  AlertTriangle, 
  Bell, 
  Download,
  Settings,
  Lock
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function DeviceDetails() {
  const [, params] = useRoute("/devices/:id");
  const deviceId = params?.id ? parseInt(params.id) : undefined;
  const [timeRange, setTimeRange] = useState("-1h");
  const [activeTab, setActiveTab] = useState("overview");
  
  // Récupérer les informations sur le dispositif
  const { device, alerts, isLoading: isLoadingDevice, updateDevice, updateSensorSetting, resolveAlert } = useDevice(deviceId);

  // Récupérer les données des capteurs
  const {
    latestData,
    historicalData,
    isConnected,
    isLoading: isLoadingSensors,
    refreshData,
    sensorSettings,
    authError,
    showAuthDialog,
    setShowAuthDialog,
    connectWithCredentials
  } = useSensors(deviceId || 0);
  
  // État de mise à jour pour forcer l'actualisation du graphique
  const [chartUpdateTrigger, setChartUpdateTrigger] = useState<number>(Date.now());
  
  const { toast } = useToast();

  // Rafraîchissement automatique forcé de la page toutes les 10 secondes
  useEffect(() => {
    // Fonction de rafraîchissement complet
    const refreshAllData = () => {
      // 1. Invalider toutes les requêtes
      queryClient.invalidateQueries();
      
      // 2. Forcer le rafraîchissement des données des capteurs
      if (refreshData) {
        refreshData();
      }
      
      // 3. Forcer le rafraîchissement du graphique
      setChartUpdateTrigger(Date.now());
      
      // Notification optionnelle en bas à droite
      toast({
        title: "Données mises à jour",
        description: "Actualisation automatique",
        duration: 1000,
      });
    };
    
    // Configurer l'intervalle de rafraîchissement
    const refreshInterval = setInterval(refreshAllData, 10000); // 10 secondes
    
    return () => clearInterval(refreshInterval);
  }, [refreshData, toast, queryClient]);
  
  // État pour le formulaire d'authentification MQTT
  const [mqttCredentials, setMqttCredentials] = useState({
    username: "",
    password: ""
  });
  
  // Gérer la soumission du formulaire d'authentification
  const handleAuthSubmit = () => {
    connectWithCredentials(mqttCredentials);
  };

  // État pour le formulaire de paramètres
  const [settings, setSettings] = useState<{
    [key: string]: { 
      minThreshold: number | null; 
      maxThreshold: number | null; 
      alarmEnabled: boolean;
    }
  }>({});

  // Initialiser les paramètres des capteurs
  useEffect(() => {
    if (sensorSettings) {
      const newSettings: any = {};
      
      sensorSettings.forEach(setting => {
        newSettings[setting.sensorType] = {
          minThreshold: setting.minThreshold,
          maxThreshold: setting.maxThreshold,
          alarmEnabled: setting.alarmEnabled
        };
      });
      
      setSettings(newSettings);
    }
  }, [sensorSettings]);

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
        // Limiter l'historique à 100 entrées
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

  // Enregistrer les modifications des paramètres
  const handleSaveSettings = () => {
    if (!sensorSettings) return;
    
    // Pour chaque type de capteur, mettre à jour les paramètres
    sensorSettings.forEach(setting => {
      if (settings[setting.sensorType]) {
        updateSensorSetting({
          id: setting.id,
          data: settings[setting.sensorType]
        });
      }
    });
  };

  // Exporter les données au format CSV
  const handleExportCsv = () => {
    if (device) {
      downloadSensorDataCsv(device.deviceId, timeRange, "now()");
    }
  };

  // Déterminer le statut d'une entrée de données
  const getDataStatus = (item: any) => {
    // Vérifier si toutes les valeurs sont dans les limites normales
    const tempSetting = sensorSettings?.find(s => s.sensorType === "temperature");
    const pulseSetting = sensorSettings?.find(s => s.sensorType === "pulse");
    const creatinineSetting = sensorSettings?.find(s => s.sensorType === "creatinine");
    
    const tempStatus = getSensorStatus(
      item.temperature, 
      tempSetting?.minThreshold || null, 
      tempSetting?.maxThreshold || null
    );
    
    const pulseStatus = getSensorStatus(
      item.pulse, 
      pulseSetting?.minThreshold || null, 
      pulseSetting?.maxThreshold || null
    );
    
    const creatinineStatus = getSensorStatus(
      item.creatinine, 
      creatinineSetting?.minThreshold || null, 
      creatinineSetting?.maxThreshold || null
    );
    
    // Le statut global est le plus critique
    if (tempStatus === "danger" || pulseStatus === "danger" || creatinineStatus === "danger") {
      return { text: "Critique", status: "danger" as const };
    }
    
    if (tempStatus === "warning" || pulseStatus === "warning" || creatinineStatus === "warning") {
      return { text: "Attention", status: "warning" as const };
    }
    
    return { text: "Normal", status: "normal" as const };
  };

  // Afficher un chargement si les données ne sont pas encore disponibles
  if (isLoadingDevice || (!device && !isLoadingDevice)) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Dialogue d'authentification MQTT */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Authentification MQTT Requise
            </DialogTitle>
            <DialogDescription>
              Ce topic MQTT nécessite une authentification. Veuillez saisir vos identifiants pour vous connecter au broker MQTT.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mqtt-username">Nom d'utilisateur</Label>
              <Input
                id="mqtt-username"
                placeholder="Nom d'utilisateur MQTT"
                value={mqttCredentials.username}
                onChange={(e) => setMqttCredentials(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mqtt-password">Mot de passe</Label>
              <Input
                id="mqtt-password"
                type="password"
                placeholder="Mot de passe MQTT"
                value={mqttCredentials.password}
                onChange={(e) => setMqttCredentials(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
            {authError && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Erreur d'authentification</AlertTitle>
                <AlertDescription>
                  L'authentification a échoué. Veuillez vérifier vos identifiants.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuthDialog(false)}>
              Annuler
            </Button>
            <Button type="submit" onClick={handleAuthSubmit}>
              Se connecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex items-center mb-6">
          <Button variant="outline" size="icon" className="mr-3">
            <Link href="/devices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-neutral-darkest">{device?.name}</h1>
              <div className={`ml-3 px-2 py-1 text-xs rounded-full ${
                device?.status === "active" 
                  ? "bg-success bg-opacity-10 text-success" 
                  : "bg-danger bg-opacity-10 text-danger"
              }`}>
                {device?.status === "active" ? "Actif" : "Inactif"}
              </div>
            </div>
            <p className="text-neutral-dark">ID: {device?.deviceId} | Topic: {device?.mqttTopic}</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="icon" onClick={refreshData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {alerts && alerts.length > 0 && (
              <Button variant="outline" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger text-white text-xs rounded-full flex items-center justify-center">
                  {alerts.length}
                </span>
              </Button>
            )}
            <Button onClick={() => setActiveTab("settings")}>
              <Settings className="h-4 w-4 mr-1" />
              Paramètres
            </Button>
          </div>
        </div>
        
        {/* Informations sur le patient et la chambre */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-neutral-light p-4">
            <p className="text-neutral-dark text-sm">Patient</p>
            <p className="font-medium">{device?.patient || "Non assigné"}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-neutral-light p-4">
            <p className="text-neutral-dark text-sm">Chambre</p>
            <p className="font-medium">{device?.room || "Non assignée"}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-neutral-light p-4">
            <p className="text-neutral-dark text-sm">Statut de connexion</p>
            <p className={`font-medium ${isConnected ? "text-success" : "text-danger"}`}>
              {isConnected ? "Connecté" : "Déconnecté"}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-neutral-light p-4">
            <p className="text-neutral-dark text-sm">Dernière mise à jour</p>
            <p className="font-medium">
              {latestData?.timestamp 
                ? new Date(latestData.timestamp).toLocaleString("fr-FR") 
                : "Jamais"}
            </p>
          </div>
        </div>
        
        {/* Onglets pour les différentes sections */}
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Aperçu</TabsTrigger>
            <TabsTrigger value="data">Données</TabsTrigger>
            <TabsTrigger value="alerts">Alertes</TabsTrigger>
            <TabsTrigger value="settings">Paramètres</TabsTrigger>
          </TabsList>
          
          {/* Onglet d'aperçu */}
          <TabsContent value="overview" className="space-y-6">
            {/* Cartes d'aperçu des capteurs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sensorSettings?.map(setting => {
                let value;
                let description = "";
                
                if (setting.sensorType === "temperature") {
                  value = latestData?.temperature;
                  description = "Corps";
                } else if (setting.sensorType === "pulse") {
                  value = latestData?.pulse;
                  description = "Pouls";
                } else if (setting.sensorType === "creatinine") {
                  value = latestData?.creatinine;
                  description = "Fonction rénale";
                }
                
                return (
                  <SensorCard
                    key={setting.id}
                    type={setting.sensorType as any}
                    value={value}
                    unit={setting.unit || ""}
                    minThreshold={setting.minThreshold}
                    maxThreshold={setting.maxThreshold}
                    description={description}
                  />
                );
              })}
            </div>
            
            {/* Graphique des tendances */}
            <SensorChart
              temperatureData={historicalData.temperature}
              pulseData={historicalData.pulse}
              creatinineData={historicalData.creatinine}
              isLoading={isLoadingSensors}
              onTimeRangeChange={handleTimeRangeChange}
            />
            
            {/* Alertes récentes */}
            {alerts && alerts.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-4 border border-neutral-light">
                <h3 className="font-medium text-lg text-neutral-darkest mb-4">Alertes Récentes</h3>
                <div className="space-y-3">
                  {alerts.slice(0, 3).map((alert) => (
                    <Alert key={alert.id} variant={alert.level === "danger" ? "destructive" : "warning" as any}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>{alert.sensorType === "temperature" ? "Température" : 
                                   alert.sensorType === "pulse" ? "Pouls" : 
                                   alert.sensorType === "creatinine" ? "Créatinine" : 
                                   alert.sensorType}</AlertTitle>
                      <AlertDescription className="flex justify-between items-center">
                        <span>{alert.message}</span>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => resolveAlert(alert.id)}
                        >
                          Résoudre
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ))}
                  {alerts.length > 3 && (
                    <Button variant="link" onClick={() => setActiveTab("alerts")}>
                      Voir toutes les alertes ({alerts.length})
                    </Button>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
          
          {/* Onglet des données */}
          <TabsContent value="data" className="space-y-6">
            {/* Graphique des tendances */}
            <SensorChart
              temperatureData={historicalData.temperature}
              pulseData={historicalData.pulse}
              creatinineData={historicalData.creatinine}
              isLoading={isLoadingSensors}
              onTimeRangeChange={handleTimeRangeChange}
            />
            
            {/* Tableau des données */}
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
                  header: "Température (°C)",
                  render: (value) => value?.toFixed(1) || "-"
                },
                {
                  key: "pulse" as keyof any,
                  header: "Pouls (bpm)",
                  render: (value) => value?.toFixed(0) || "-"
                },
                {
                  key: "creatinine" as keyof any,
                  header: "Créatinine (mg/dL)",
                  render: (value) => value?.toFixed(2) || "-"
                },
                {
                  key: "" as keyof any,
                  header: "Statut",
                  render: (_, row) => {
                    const status = getDataStatus(row);
                    return (
                      <div className={`px-2 py-1 text-xs rounded-full inline-flex items-center ${
                        status.status === "normal" 
                          ? "bg-success bg-opacity-10 text-success" 
                          : status.status === "warning" 
                          ? "bg-warning bg-opacity-10 text-warning" 
                          : "bg-danger bg-opacity-10 text-danger"
                      }`}>
                        {status.text}
                      </div>
                    );
                  }
                }
              ]}
              emptyText="Aucune donnée disponible"
            />
            
            {/* Bouton d'export */}
            <div className="flex justify-end">
              <Button onClick={handleExportCsv} className="mt-4">
                <Download className="h-4 w-4 mr-2" />
                Exporter en CSV
              </Button>
            </div>
          </TabsContent>
          
          {/* Onglet des alertes */}
          <TabsContent value="alerts" className="space-y-6">
            {alerts && alerts.length > 0 ? (
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <Alert key={alert.id} variant={alert.level === "danger" ? "destructive" : "warning" as any}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="flex items-center">
                      {alert.sensorType === "temperature" ? "Température" : 
                       alert.sensorType === "pulse" ? "Pouls" : 
                       alert.sensorType === "creatinine" ? "Créatinine" : 
                       alert.sensorType}
                      <span className="ml-2 text-xs text-neutral-dark">
                        {new Date(alert.timestamp).toLocaleString("fr-FR")}
                      </span>
                    </AlertTitle>
                    <AlertDescription className="flex justify-between items-center">
                      <span>{alert.message}</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => resolveAlert(alert.id)}
                      >
                        Résoudre
                      </Button>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-neutral-dark">
                <p>Aucune alerte active</p>
              </div>
            )}
          </TabsContent>
          
          {/* Onglet des paramètres */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-medium mb-4">Informations du dispositif</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="device-name">Nom du dispositif</Label>
                      <Input 
                        id="device-name"
                        value={device?.name || ""}
                        onChange={(e) => updateDevice({ 
                          id: device?.id as number, 
                          data: { name: e.target.value } 
                        })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="device-status">Statut</Label>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="device-status"
                          checked={device?.status === "active"}
                          onCheckedChange={(checked) => updateDevice({
                            id: device?.id as number,
                            data: { status: checked ? "active" : "inactive" }
                          })}
                        />
                        <Label htmlFor="device-status">
                          {device?.status === "active" ? "Actif" : "Inactif"}
                        </Label>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="device-patient">Patient</Label>
                      <Input 
                        id="device-patient"
                        value={device?.patient || ""}
                        onChange={(e) => updateDevice({ 
                          id: device?.id as number, 
                          data: { patient: e.target.value } 
                        })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="device-room">Chambre</Label>
                      <Input 
                        id="device-room"
                        value={device?.room || ""}
                        onChange={(e) => updateDevice({ 
                          id: device?.id as number, 
                          data: { room: e.target.value } 
                        })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="device-topic">Topic MQTT</Label>
                      <Input 
                        id="device-topic"
                        value={device?.mqttTopic || ""}
                        onChange={(e) => updateDevice({ 
                          id: device?.id as number, 
                          data: { mqttTopic: e.target.value } 
                        })}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-medium mb-4">Paramètres des capteurs</h3>
                <div className="space-y-6">
                  {sensorSettings?.map(setting => (
                    <div key={setting.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                      <h4 className="font-medium mb-3">
                        {setting.sensorType === "temperature" ? "Température (°C)" : 
                         setting.sensorType === "pulse" ? "Pouls (bpm)" : 
                         setting.sensorType === "creatinine" ? "Créatinine (mg/dL)" : 
                         setting.sensorType}
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                        <div className="space-y-2">
                          <Label>Seuil minimal</Label>
                          <Input 
                            type="number"
                            value={settings[setting.sensorType]?.minThreshold || ""}
                            onChange={(e) => {
                              const value = e.target.value === "" ? null : parseFloat(e.target.value);
                              setSettings(prev => ({
                                ...prev,
                                [setting.sensorType]: {
                                  ...prev[setting.sensorType],
                                  minThreshold: value
                                }
                              }));
                            }}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Seuil maximal</Label>
                          <Input 
                            type="number"
                            value={settings[setting.sensorType]?.maxThreshold || ""}
                            onChange={(e) => {
                              const value = e.target.value === "" ? null : parseFloat(e.target.value);
                              setSettings(prev => ({
                                ...prev,
                                [setting.sensorType]: {
                                  ...prev[setting.sensorType],
                                  maxThreshold: value
                                }
                              }));
                            }}
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id={`alert-${setting.sensorType}`}
                          checked={settings[setting.sensorType]?.alarmEnabled || false}
                          onCheckedChange={(checked) => {
                            setSettings(prev => ({
                              ...prev,
                              [setting.sensorType]: {
                                ...prev[setting.sensorType],
                                alarmEnabled: checked
                              }
                            }));
                          }}
                        />
                        <Label htmlFor={`alert-${setting.sensorType}`}>
                          Activer les alertes
                        </Label>
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex justify-end">
                    <Button onClick={handleSaveSettings}>
                      Enregistrer les paramètres
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}