import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDevice } from "@/hooks/use-device";
import { apiRequest } from "@/lib/queryClient";
import { formatDateTime } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Check, Filter, Loader2, Search } from "lucide-react";
import { Alert as AlertType } from "@shared/schema";
import { Link } from "wouter";

export default function Alerts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterResolved, setFilterResolved] = useState<boolean | undefined>(false);

  // Récupérer tous les dispositifs pour le mapping ID -> nom
  const { devices } = useDevice();

  // Récupérer toutes les alertes
  const { data: alerts = [], isLoading, refetch } = useQuery<AlertType[]>({
    queryKey: ['/api/alerts', { resolved: filterResolved }],
    refetchInterval: 30000
  });

  // Fonction pour résoudre une alerte
  const resolveAlert = async (alertId: number) => {
    try {
      await apiRequest('PUT', `/api/alerts/${alertId}/resolve`, {});
      refetch();
    } catch (error) {
      console.error("Erreur lors de la résolution de l'alerte:", error);
    }
  };

  // Filtrer les alertes en fonction du terme de recherche
  const filteredAlerts = alerts.filter(alert => {
    const deviceName = devices?.find(d => d.id === alert.deviceId)?.name || "";
    
    return (
      alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.sensorType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deviceName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Obtenir le nom du dispositif à partir de son ID
  const getDeviceName = (deviceId: number) => {
    const device = devices?.find(d => d.id === deviceId);
    return device ? device.name : `Dispositif #${deviceId}`;
  };

  // Traduire le type de capteur
  const translateSensorType = (type: string) => {
    switch (type) {
      case "temperature":
        return "Température";
      case "pulse":
        return "Pouls";
      case "creatinine":
        return "Créatinine";
      default:
        return type;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-darkest">Alertes</h1>
            <p className="text-neutral-dark">Suivi et gestion des alertes des capteurs</p>
          </div>
          <div className="flex items-center space-x-3 mt-4 md:mt-0">
            <div className="relative">
              <Input
                type="text"
                placeholder="Rechercher une alerte..."
                className="pl-9 pr-4 py-2"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-dark" />
            </div>
            
            <div className="relative">
              <select
                className="pl-9 pr-4 py-2 border border-neutral-light rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                value={filterResolved === undefined ? "all" : filterResolved ? "resolved" : "active"}
                onChange={(e) => {
                  if (e.target.value === "all") {
                    setFilterResolved(undefined);
                  } else if (e.target.value === "resolved") {
                    setFilterResolved(true);
                  } else {
                    setFilterResolved(false);
                  }
                }}
              >
                <option value="all">Toutes les alertes</option>
                <option value="active">Alertes actives</option>
                <option value="resolved">Alertes résolues</option>
              </select>
              <Filter className="absolute left-3 top-3 h-4 w-4 text-neutral-dark" />
            </div>
          </div>
        </div>
        
        {/* Statistiques des alertes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Alertes Totales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {alerts.length}
              </div>
              <p className="text-neutral-dark text-sm mt-1">
                {new Date().toLocaleDateString('fr-FR')}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Alertes Actives</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-danger">
                {alerts.filter(a => !a.resolved).length}
              </div>
              <p className="text-neutral-dark text-sm mt-1">
                Nécessitent votre attention
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Alertes Résolues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">
                {alerts.filter(a => a.resolved).length}
              </div>
              <p className="text-neutral-dark text-sm mt-1">
                Traitées avec succès
              </p>
            </CardContent>
          </Card>
        </div>
        
        {/* Liste des alertes */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-neutral-darkest">
            {filterResolved === undefined 
              ? "Toutes les Alertes" 
              : filterResolved 
                ? "Alertes Résolues" 
                : "Alertes Actives"}
          </h2>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredAlerts.length > 0 ? (
            <div className="space-y-4">
              {filteredAlerts.map((alert) => (
                <Alert 
                  key={alert.id} 
                  variant={alert.resolved ? "default" : (alert.level === "danger" ? "destructive" : "warning")}
                >
                  <div className="flex items-start">
                    {alert.resolved ? (
                      <Check className="h-4 w-4 mt-1" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mt-1" />
                    )}
                    <div className="ml-2 flex-1">
                      <div className="flex items-center justify-between">
                        <AlertTitle>
                          {translateSensorType(alert.sensorType)} - {alert.message}
                        </AlertTitle>
                        <Badge variant={alert.resolved ? "outline" : (alert.level === "danger" ? "destructive" : "warning")}>
                          {alert.resolved ? "Résolu" : alert.level === "danger" ? "Critique" : "Attention"}
                        </Badge>
                      </div>
                      <AlertDescription className="mt-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                          <div className="space-y-1 mb-2 sm:mb-0">
                            <p>
                              <span className="font-medium">Dispositif:</span>{" "}
                              <Link href={`/devices/${alert.deviceId}`} className="text-primary hover:underline">
                                {getDeviceName(alert.deviceId)}
                              </Link>
                            </p>
                            <p>
                              <span className="font-medium">Valeur:</span>{" "}
                              {alert.value?.toFixed(1)} {alert.sensorType === "temperature" ? "°C" : 
                                                      alert.sensorType === "pulse" ? "BPM" : 
                                                      alert.sensorType === "creatinine" ? "mg/dL" : ""}
                              {alert.threshold && ` (Seuil: ${alert.threshold})`}
                            </p>
                            <p>
                              <span className="font-medium">Date:</span>{" "}
                              {formatDateTime(alert.createdAt)}
                              {alert.resolvedAt && (
                                <span> - Résolu le {formatDateTime(alert.resolvedAt)}</span>
                              )}
                            </p>
                          </div>
                          
                          {!alert.resolved && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => resolveAlert(alert.id)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Résoudre
                            </Button>
                          )}
                        </div>
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center border border-neutral-light">
              <Check className="h-12 w-12 text-success mx-auto mb-3" />
              <h3 className="text-lg font-medium text-neutral-darkest mb-2">
                Aucune Alerte Trouvée
              </h3>
              <p className="text-neutral-dark mb-4">
                {searchTerm 
                  ? `Aucune alerte ne correspond à "${searchTerm}"` 
                  : filterResolved === false 
                    ? "Aucune alerte active - Tout fonctionne normalement" 
                    : "Aucune alerte n'a été générée pour le moment"}
              </p>
              {searchTerm && (
                <Button 
                  variant="outline"
                  onClick={() => setSearchTerm("")}
                >
                  Effacer la recherche
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
