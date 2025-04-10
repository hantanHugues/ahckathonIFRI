import * as mqtt from 'mqtt';
import { SensorData } from '@shared/schema';

// Définir l'interface MqttClient pour éviter les erreurs TypeScript
interface MqttClient {
  on(event: string, callback: (...args: any[]) => void): void;
  subscribe(topic: string, callback?: (err?: Error) => void): void;
  unsubscribe(topic: string, callback?: (err?: Error) => void): void;
  publish(topic: string, message: string, callback?: (err?: Error) => void): void;
  end(force?: boolean): void;
}

// Options pour la connexion MQTT
interface MqttOptions {
  username?: string;
  password?: string;
  [key: string]: any;
}

class MQTTClient {
  private client: MqttClient | null = null;
  private isConnected = false;
  private defaultTopic = 'patient/esp32-c40a24/data';
  private handlers: Map<string, Array<(data: SensorData) => void>> = new Map();
  private connectionHandlers: Array<(connected: boolean, errorType?: string) => void> = [];

  constructor() {
    // Ce constructeur peut être vide car nous initialisons la connexion manuellement
  }

  connect(brokerUrl = 'mqtt://broker.hivemq.com:1883', options: MqttOptions = {}) {
    console.log('Tentative de connexion au broker MQTT via WebSocket');
    
    // Utiliser WebSocket pour la connexion dans le navigateur
    // Dans le navigateur, nous devons utiliser l'URL du broker comme fournie
    const websocketUrl = brokerUrl;
    
    // Options par défaut
    const defaultOptions = {
      clientId: `sensmed_frontend_${Math.random().toString(16).substring(2, 10)}`,
      clean: true,
      reconnectPeriod: 5000, // Tentative de reconnexion toutes les 5 secondes
      connectTimeout: 10000, // Augmentation du timeout pour les environnements avec latence
      keepalive: 60,
      rejectUnauthorized: false, // Nécessaire dans certains environnements
    };
    
    try {
      // Si nous avons déjà un client, le fermer
      if (this.client) {
        this.client.end(true);
        this.client = null;
      }

      // Adapter les options pour le broker public (pas besoin d'identifiants)
      const fullOptions = { 
        ...defaultOptions, 
        ...options
      };

      console.log('Connexion au broker MQTT avec options:', websocketUrl, fullOptions);
      
      // Utiliser mqtt.connect pour créer un client MQTT
      this.client = mqtt.connect(websocketUrl, fullOptions);
      
      // Configurer les gestionnaires d'événements pour le client
      if (this.client) {
        this.client.on('connect', () => {
          console.log('Connecté au broker MQTT avec succès');
          this.isConnected = true;
          this.connectionHandlers.forEach(handler => handler(true));
        });
        
        this.client.on('error', (error) => {
          console.error('Erreur de connexion MQTT:', error);
          this.isConnected = false;
          
          // Notifier les gestionnaires avec le type d'erreur
          let errorType = 'unknown';
          
          if (error.message) {
            if (error.message.includes('Not authorized')) {
              errorType = 'auth_required';
            } else if (error.message.includes('connack timeout')) {
              errorType = 'timeout';
            }
          }
          
          this.connectionHandlers.forEach(handler => handler(false, errorType));
        });
        
        this.client.on('close', () => {
          console.log('Connexion MQTT fermée');
          this.isConnected = false;
          this.connectionHandlers.forEach(handler => handler(false));
        });
        
        this.client.on('offline', () => {
          console.log('Connexion MQTT hors ligne, tentative de reconnexion...');
          this.isConnected = false;
          this.connectionHandlers.forEach(handler => handler(false, 'offline'));
        });
        
        this.client.on('reconnect', () => {
          console.log('Tentative de reconnexion MQTT...');
        });
        
        this.client.on('message', (topic, message) => {
          try {
            const messageStr = message.toString();
            console.log(`Message reçu sur ${topic}:`, messageStr);
            
            let payload: SensorData;
            try {
              payload = JSON.parse(messageStr);
            } catch (e) {
              // Si le parsing JSON échoue, essayer de gérer des formats simples
              const parts = messageStr.split(',');
              if (parts.length >= 3) {
                payload = {
                  temperature: parseFloat(parts[0]) || undefined,
                  pulse: parseFloat(parts[1]) || undefined,
                  creatinine: parseFloat(parts[2]) || undefined,
                  timestamp: new Date().toISOString(),
                  deviceId: topic.split('/')[1] || 'unknown'
                };
              } else {
                console.error('Format de message non reconnu:', messageStr);
                return;
              }
            }
            
            // Notifier tous les gestionnaires pour ce topic
            const handlers = this.handlers.get(topic) || [];
            handlers.forEach(handler => handler(payload));
          } catch (error) {
            console.error('Erreur de traitement du message MQTT:', error);
          }
        });
      }
      
      return true;
    } catch (error) {
      console.error('Erreur lors de la création du client MQTT:', error);
      return false;
    }
  }
  
  subscribe(topic = this.defaultTopic) {
    if (!this.client || !this.isConnected) {
      console.error('Client MQTT non connecté. Impossible de s\'abonner au topic.');
      return false;
    }
    
    this.client.subscribe(topic, (err) => {
      if (err) {
        console.error('Erreur lors de l\'abonnement au topic:', err);
      } else {
        console.log('Abonné au topic:', topic);
      }
    });
    
    return true;
  }
  
  unsubscribe(topic = this.defaultTopic) {
    if (!this.client || !this.isConnected) {
      console.error('Client MQTT non connecté. Impossible de se désabonner du topic.');
      return false;
    }
    
    this.client.unsubscribe(topic, (err) => {
      if (err) {
        console.error('Erreur lors du désabonnement du topic:', err);
      } else {
        console.log('Désabonné du topic:', topic);
      }
    });
    
    return true;
  }
  
  publish(topic: string, message: string | object) {
    if (!this.client || !this.isConnected) {
      console.error('Client MQTT non connecté. Impossible de publier le message.');
      return false;
    }
    
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    
    this.client.publish(topic, payload, (err) => {
      if (err) {
        console.error('Erreur lors de la publication du message:', err);
      }
    });
    
    return true;
  }
  
  addMessageHandler(topic: string, handler: (data: SensorData) => void) {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, []);
    }
    
    this.handlers.get(topic)!.push(handler);
    
    // S'abonner automatiquement au topic si un gestionnaire est ajouté
    this.subscribe(topic);
    
    return () => this.removeMessageHandler(topic, handler);
  }
  
  removeMessageHandler(topic: string, handler: (data: SensorData) => void) {
    if (!this.handlers.has(topic)) return;
    
    const handlers = this.handlers.get(topic)!;
    const index = handlers.indexOf(handler);
    
    if (index !== -1) {
      handlers.splice(index, 1);
      
      // Se désabonner si plus aucun gestionnaire pour ce topic
      if (handlers.length === 0) {
        this.unsubscribe(topic);
        this.handlers.delete(topic);
      }
    }
  }
  
  onConnectionChange(handler: (connected: boolean, errorType?: string) => void) {
    this.connectionHandlers.push(handler);
    
    // Appeler immédiatement avec l'état actuel
    handler(this.isConnected);
    
    return () => {
      const index = this.connectionHandlers.indexOf(handler);
      if (index !== -1) {
        this.connectionHandlers.splice(index, 1);
      }
    };
  }
  
  getConnectionStatus() {
    return this.isConnected;
  }
  
  disconnect() {
    if (this.client) {
      this.client.end();
      this.isConnected = false;
      this.client = null;
    }
  }
}

// Créer une instance singleton
const mqttClient = new MQTTClient();

// Exporter à la fois les exports nommés et par défaut pour assurer la compatibilité
export { mqttClient };
export default mqttClient;
