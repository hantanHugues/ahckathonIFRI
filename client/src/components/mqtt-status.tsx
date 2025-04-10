import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { mqttClient } from "@/lib/mqtt-client";

export function MqttStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [errorType, setErrorType] = useState<string | undefined>(undefined);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [mqttCredentials, setMqttCredentials] = useState({
    username: localStorage.getItem('mqtt_username') || '',
    password: localStorage.getItem('mqtt_password') || ''
  });
  const { toast } = useToast();
  
  // Récupérer l'état du broker MQTT depuis l'API
  const { data: mqttStatus, isLoading } = useQuery({
    queryKey: ['/api/mqtt/status'],
    refetchInterval: 30000
  });
  
  // Fonction pour se connecter au broker MQTT
  const connectToBroker = (credentials?: { username: string, password: string }) => {
    const options = credentials ? { ...credentials } : {};
    mqttClient.connect('mqtt://broker.hivemq.com', options);
  };
  
  // Gérer la soumission du formulaire d'authentification
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Stocker les identifiants
    localStorage.setItem('mqtt_username', mqttCredentials.username);
    localStorage.setItem('mqtt_password', mqttCredentials.password);
    
    // Tenter de se connecter avec les nouveaux identifiants
    connectToBroker(mqttCredentials);
    
    // Fermer la boîte de dialogue
    setShowAuthDialog(false);
    
    toast({
      title: "Tentative de connexion",
      description: "Tentative de connexion au broker MQTT avec les identifiants fournis...",
    });
  };
  
  // Écouter les changements d'état de connexion du client MQTT frontend
  useEffect(() => {
    // Si le client MQTT n'est pas connecté, essayer de se connecter
    if (!mqttClient.getConnectionStatus()) {
      connectToBroker();
    }
    
    const unsubscribe = mqttClient.onConnectionChange((connected, error) => {
      setIsConnected(connected);
      setErrorType(error);
      
      // Si l'erreur est de type "auth_required", afficher la boîte de dialogue d'authentification
      if (error === 'auth_required') {
        setShowAuthDialog(true);
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  return (
    <>
      <Card className="bg-white shadow-sm border border-neutral-light">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium text-neutral-darkest">État du Système</h3>
            
            <Badge variant={isConnected ? "success" : "destructive"} className="ml-2">
              {isConnected ? "Connecté" : "Déconnecté"}
            </Badge>
          </div>
          
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-neutral-dark">Broker:</span>
              <span className="font-medium">{mqttStatus?.broker || "broker.hivemq.com"}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-neutral-dark">Topic:</span>
              <span className="font-medium">{mqttStatus?.activeTopic || "patient/esp32-c40a24/data"}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-neutral-dark">État du serveur:</span>
              <Badge variant={mqttStatus?.connected ? "success" : "destructive"}>
                {mqttStatus?.connected ? "En ligne" : "Hors ligne"}
              </Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-neutral-dark">État du client:</span>
              <Badge variant={isConnected ? "success" : "destructive"}>
                {isConnected ? "Connecté" : "Déconnecté"}
              </Badge>
            </div>
          </div>
          
          {!isConnected && errorType === 'auth_required' && (
            <div className="mt-4 bg-yellow-50 p-3 rounded-md border border-yellow-200 flex items-start">
              <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-700">Authentification requise</p>
                <p className="text-xs text-yellow-600 mt-1">
                  Le broker MQTT nécessite des identifiants. Cliquez sur le bouton ci-dessous pour les saisir.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2" 
                  onClick={() => setShowAuthDialog(true)}
                >
                  Configurer l'authentification
                </Button>
              </div>
            </div>
          )}
          
          <div className="mt-4 text-xs text-neutral-dark">
            <p className="mb-1">
              Les données sont transmises en temps réel via MQTT et stockées dans InfluxDB pour analyse ultérieure.
            </p>
            <p>
              Dernière vérification: {new Date().toLocaleTimeString('fr-FR')}
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* Dialogue d'authentification MQTT */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Authentification MQTT requise</DialogTitle>
            <DialogDescription>
              Le broker MQTT nécessite une authentification. Veuillez entrer vos identifiants ci-dessous.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAuthSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="mqtt-username">Nom d'utilisateur</Label>
                <Input
                  id="mqtt-username"
                  value={mqttCredentials.username}
                  onChange={(e) => setMqttCredentials({...mqttCredentials, username: e.target.value})}
                  placeholder="Nom d'utilisateur MQTT"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="mqtt-password">Mot de passe</Label>
                <Input
                  id="mqtt-password"
                  type="password"
                  value={mqttCredentials.password}
                  onChange={(e) => setMqttCredentials({...mqttCredentials, password: e.target.value})}
                  placeholder="Mot de passe MQTT"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAuthDialog(false)}>
                Annuler
              </Button>
              <Button type="submit">Se connecter</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
