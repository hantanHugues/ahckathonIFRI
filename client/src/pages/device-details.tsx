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
                    <Alert key={alert.id} variant={alert.level === "danger" ? "destructive" : "warning"}>
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
              pageSize={10}
              onExport={handleExportCsv}
              statusFn={getDataStatus}
            />
            
            <div className="flex justify-end">
              <Button onClick={handleExportCsv}>
                <Download className="h-4 w-4 mr-1" />
                Exporter toutes les données (CSV)
              </Button>
            </div>
          </TabsContent>
          
          {/* Onglet des alertes */}
          <TabsContent value="alerts" className="space-y-6">
            {alerts && alerts.length > 0 ? (
              <div className="space-y-4">
                <h3 className="font-medium text-lg text-neutral-darkest">Alertes en Cours</h3>
                {alerts.map((alert) => (
                  <Alert key={alert.id} variant={alert.level === "danger" ? "destructive" : "warning"}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>
                      {alert.sensorType === "temperature" ? "Température" : 
                       alert.sensorType === "pulse" ? "Pouls" : 
                       alert.sensorType === "creatinine" ? "Créatinine" : 
                       alert.sensorType} -  
                      {new Date(alert.createdAt).toLocaleString("fr-FR")}
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
              <div className="bg-white rounded-lg shadow-sm p-8 text-center border border-neutral-light">
                <AlertTriangle className="h-12 w-12 text-success mx-auto mb-3" />
                <h3 className="text-lg font-medium text-neutral-darkest mb-2">
                  Aucune Alerte Active
                </h3>
                <p className="text-neutral-dark">
                  Ce dispositif ne présente actuellement aucune alerte active.
                </p>
              </div>
            )}
          </TabsContent>
          
          {/* Onglet des paramètres */}
          <TabsContent value="settings" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Informations du dispositif */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-medium text-lg text-neutral-darkest mb-4">
                    Informations du Dispositif
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-dark mb-1">
                          Nom du dispositif
                        </label>
                        <Input 
                          value={device?.name} 
                          onChange={(e) => {
                            if (device) {
                              updateDevice({
                                id: device.id,
                                data: { ...device, name: e.target.value }
                              });
                            }
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-dark mb-1">
                          Statut
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-neutral-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                          value={device?.status}
                          onChange={(e) => {
                            if (device) {
                              updateDevice({
                                id: device.id,
                                data: { ...device, status: e.target.value as "active" | "inactive" }
                              });
                            }
                          }}
                        >
                          <option value="active">Actif</option>
                          <option value="inactive">Inactif</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-dark mb-1">
                          Patient
                        </label>
                        <Input 
                          value={device?.patient || ""}
                          onChange={(e) => {
                            if (device) {
                              updateDevice({
                                id: device.id,
                                data: { ...device, patient: e.target.value }
                              });
                            }
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-dark mb-1">
                          Chambre
                        </label>
                        <Input 
                          value={device?.room || ""}
                          onChange={(e) => {
                            if (device) {
                              updateDevice({
                                id: device.id,
                                data: { ...device, room: e.target.value }
                              });
                            }
                          }}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-neutral-dark mb-1">
                        Topic MQTT
                      </label>
                      <Input 
                        value={device?.mqttTopic} 
                        onChange={(e) => {
                          if (device) {
                            updateDevice({
                              id: device.id,
                              data: { ...device, mqttTopic: e.target.value }
                            });
                          }
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Paramètres des capteurs */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-medium text-lg text-neutral-darkest mb-4">
                    Paramètres des Capteurs
                  </h3>
                  
                  {sensorSettings && sensorSettings.map((setting) => (
                    <div key={setting.id} className="mb-6">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-medium">
                          {setting.sensorType === "temperature" ? "Température" : 
                           setting.sensorType === "pulse" ? "Pouls" : 
                           setting.sensorType === "creatinine" ? "Créatinine" : 
                           setting.sensorType}
                        </h4>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-neutral-dark">Alertes</span>
                          <Switch 
                            checked={settings[setting.sensorType]?.alarmEnabled} 
                            onCheckedChange={(checked) => {
                              setSettings({
                                ...settings,
                                [setting.sensorType]: {
                                  ...settings[setting.sensorType],
                                  alarmEnabled: checked
                                }
                              });
                            }}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm text-neutral-dark mb-2">
                            <span>Seuil minimum</span>
                            <span>
                              {settings[setting.sensorType]?.minThreshold} {setting.unit}
                            </span>
                          </div>
                          <Slider 
                            value={[settings[setting.sensorType]?.minThreshold || 0]}
                            min={
                              setting.sensorType === "temperature" ? 30 : 
                              setting.sensorType === "pulse" ? 30 : 
                              setting.sensorType === "creatinine" ? 0 : 0
                            }
                            max={
                              setting.sensorType === "temperature" ? 40 : 
                              setting.sensorType === "pulse" ? 150 : 
                              setting.sensorType === "creatinine" ? 2 : 100
                            }
                            step={
                              setting.sensorType === "temperature" ? 0.1 : 
                              setting.sensorType === "pulse" ? 1 : 
                              setting.sensorType === "creatinine" ? 0.1 : 1
                            }
                            onValueChange={(value) => {
                              setSettings({
                                ...settings,
                                [setting.sensorType]: {
                                  ...settings[setting.sensorType],
                                  minThreshold: value[0]
                                }
                              });
                            }}
                          />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm text-neutral-dark mb-2">
                            <span>Seuil maximum</span>
                            <span>
                              {settings[setting.sensorType]?.maxThreshold} {setting.unit}
                            </span>
                          </div>
                          <Slider 
                            value={[settings[setting.sensorType]?.maxThreshold || 0]}
                            min={
                              setting.sensorType === "temperature" ? 30 : 
                              setting.sensorType === "pulse" ? 30 : 
                              setting.sensorType === "creatinine" ? 0 : 0
                            }
                            max={
                              setting.sensorType === "temperature" ? 40 : 
                              setting.sensorType === "pulse" ? 150 : 
                              setting.sensorType === "creatinine" ? 2 : 100
                            }
                            step={
                              setting.sensorType === "temperature" ? 0.1 : 
                              setting.sensorType === "pulse" ? 1 : 
                              setting.sensorType === "creatinine" ? 0.1 : 1
                            }
                            onValueChange={(value) => {
                              setSettings({
                                ...settings,
                                [setting.sensorType]: {
                                  ...settings[setting.sensorType],
                                  maxThreshold: value[0]
                                }
                              });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="flex justify-end mt-6">
                    <Button onClick={handleSaveSettings}>
                      Enregistrer les Paramètres
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
