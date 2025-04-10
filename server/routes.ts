import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { initializeMqtt, subscribeTopic, unsubscribeTopic } from "./mqtt";
import { initializeInfluxDB, getLatestSensorData, getRecentData, getHistoricalData, getAllSensorDataForExport } from "./influxdb";
import { z } from "zod";
import { insertDeviceSchema, insertSensorSettingSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configuration de l'authentification
  setupAuth(app);
  
  // Initialisation d'InfluxDB
  await initializeInfluxDB();
  
  // Initialisation du client MQTT
  const mqttClient = initializeMqtt();
  
  // Routes pour les dispositifs (matelas)
  app.get("/api/devices", ensureAuthenticated, async (req, res) => {
    try {
      const devices = await storage.getDevices();
      res.json(devices);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des dispositifs" });
    }
  });
  
  app.get("/api/devices/:id", ensureAuthenticated, async (req, res) => {
    try {
      // Tentative de conversion en nombre pour les IDs numériques
      const idParam = req.params.id;
      let device;
      
      // Vérifier si l'ID est un nombre ou une chaîne (deviceId)
      if (!isNaN(parseInt(idParam))) {
        // ID numérique
        device = await storage.getDevice(parseInt(idParam));
      } else {
        // ID de chaîne (deviceId)
        device = await storage.getDeviceByDeviceId(idParam);
      }
      
      if (!device) {
        return res.status(404).json({ message: "Dispositif non trouvé" });
      }
      
      res.json(device);
    } catch (error) {
      console.error("Erreur lors de la récupération du dispositif:", error);
      res.status(500).json({ message: "Erreur lors de la récupération du dispositif" });
    }
  });
  
  app.post("/api/devices", ensureAuthenticated, async (req, res) => {
    try {
      const validatedData = insertDeviceSchema.parse(req.body);
      const device = await storage.createDevice(validatedData);
      
      // S'abonner au topic MQTT du dispositif
      if (device.mqttTopic) {
        subscribeTopic(device.mqttTopic);
      }
      
      res.status(201).json(device);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      res.status(500).json({ message: "Erreur lors de la création du dispositif" });
    }
  });
  
  app.put("/api/devices/:id", ensureAuthenticated, async (req, res) => {
    try {
      const deviceId = parseInt(req.params.id);
      const device = await storage.getDevice(deviceId);
      
      if (!device) {
        return res.status(404).json({ message: "Dispositif non trouvé" });
      }
      
      const updatedDevice = await storage.updateDevice(deviceId, req.body);
      
      // Si le topic MQTT a changé, se désabonner de l'ancien et s'abonner au nouveau
      if (req.body.mqttTopic && req.body.mqttTopic !== device.mqttTopic) {
        if (device.mqttTopic) {
          unsubscribeTopic(device.mqttTopic);
        }
        subscribeTopic(req.body.mqttTopic);
      }
      
      res.json(updatedDevice);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la mise à jour du dispositif" });
    }
  });
  
  app.delete("/api/devices/:id", ensureAuthenticated, async (req, res) => {
    try {
      const deviceId = parseInt(req.params.id);
      const device = await storage.getDevice(deviceId);
      
      if (!device) {
        return res.status(404).json({ message: "Dispositif non trouvé" });
      }
      
      // Se désabonner du topic MQTT
      if (device.mqttTopic) {
        unsubscribeTopic(device.mqttTopic);
      }
      
      const success = await storage.deleteDevice(deviceId);
      
      if (success) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Erreur lors de la suppression du dispositif" });
      }
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la suppression du dispositif" });
    }
  });
  
  // Routes pour les paramètres des capteurs
  app.get("/api/devices/:deviceId/sensor-settings", ensureAuthenticated, async (req, res) => {
    try {
      const idParam = req.params.deviceId;
      let deviceId: number;
      let device;
      
      // Vérifier si l'ID est un nombre ou une chaîne (deviceId)
      if (!isNaN(parseInt(idParam))) {
        // ID numérique
        deviceId = parseInt(idParam);
      } else {
        // ID de chaîne (deviceId)
        device = await storage.getDeviceByDeviceId(idParam);
        if (!device) {
          return res.status(404).json({ message: "Dispositif non trouvé" });
        }
        deviceId = device.id;
      }
      
      const sensorSettings = await storage.getSensorSettings(deviceId);
      res.json(sensorSettings);
    } catch (error) {
      console.error("Erreur lors de la récupération des paramètres des capteurs:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des paramètres des capteurs" });
    }
  });
  
  app.put("/api/sensor-settings/:id", ensureAuthenticated, async (req, res) => {
    try {
      const settingId = parseInt(req.params.id);
      const updatedSetting = await storage.updateSensorSetting(settingId, req.body);
      
      if (!updatedSetting) {
        return res.status(404).json({ message: "Paramètre de capteur non trouvé" });
      }
      
      res.json(updatedSetting);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la mise à jour du paramètre de capteur" });
    }
  });
  
  // Routes pour les alertes
  app.get("/api/alerts", ensureAuthenticated, async (req, res) => {
    try {
      const resolved = req.query.resolved === 'true' ? true : 
                      req.query.resolved === 'false' ? false : 
                      undefined;
      
      const alerts = await storage.getAlerts(resolved);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des alertes" });
    }
  });
  
  app.get("/api/devices/:deviceId/alerts", ensureAuthenticated, async (req, res) => {
    try {
      const deviceId = parseInt(req.params.deviceId);
      const resolved = req.query.resolved === 'true' ? true : 
                      req.query.resolved === 'false' ? false : 
                      undefined;
      
      const alerts = await storage.getAlertsByDevice(deviceId, resolved);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des alertes du dispositif" });
    }
  });
  
  app.put("/api/alerts/:id/resolve", ensureAuthenticated, async (req, res) => {
    try {
      const alertId = parseInt(req.params.id);
      const resolvedAlert = await storage.resolveAlert(alertId);
      
      if (!resolvedAlert) {
        return res.status(404).json({ message: "Alerte non trouvée" });
      }
      
      res.json(resolvedAlert);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la résolution de l'alerte" });
    }
  });
  
  // Routes pour les données des capteurs (InfluxDB)
  app.get("/api/devices/:deviceId/latest-data", ensureAuthenticated, async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      const latestData = await getLatestSensorData(deviceId);
      res.json(latestData);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des dernières données" });
    }
  });
  
  app.get("/api/devices/:deviceId/sensor-data", ensureAuthenticated, async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      const sensorType = req.query.sensorType as string;
      
      if (!sensorType) {
        return res.status(400).json({ message: "Le paramètre sensorType est requis" });
      }
      
      const duration = req.query.duration as string || '-1h';
      const data = await getRecentData(deviceId, sensorType, duration);
      
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des données des capteurs" });
    }
  });
  
  app.get("/api/devices/:deviceId/historical-data", ensureAuthenticated, async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      const sensorType = req.query.sensorType as string;
      const startTime = req.query.startTime as string || '-24h';
      const endTime = req.query.endTime as string || 'now()';
      
      if (!sensorType) {
        return res.status(400).json({ message: "Le paramètre sensorType est requis" });
      }
      
      const data = await getHistoricalData(deviceId, sensorType, startTime, endTime);
      
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la récupération des données historiques" });
    }
  });
  
  // Route pour l'exportation CSV
  app.get("/api/devices/:deviceId/export-csv", ensureAuthenticated, async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      const startTime = req.query.startTime as string || '-24h';
      const endTime = req.query.endTime as string || 'now()';
      
      const data = await getAllSensorDataForExport(deviceId, startTime, endTime);
      
      if (data.length === 0) {
        return res.status(404).json({ message: "Aucune donnée disponible pour l'exportation" });
      }
      
      // Convertir en format CSV
      const headers = ['timestamp', 'temperature', 'pulse', 'creatinine'];
      
      const csvRows = [
        headers.join(','),
        ...data.map(row => {
          return headers.map(header => {
            if (header === 'timestamp') {
              // Formater la date pour le CSV
              return new Date(row[header]).toLocaleString('fr-FR');
            }
            return row[header] !== null ? row[header] : '';
          }).join(',');
        })
      ];
      
      const csvContent = csvRows.join('\n');
      
      // Configurer l'en-tête de la réponse pour le téléchargement
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=sensmed_data_${deviceId}_${Date.now()}.csv`);
      
      res.send(csvContent);
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de l'exportation des données" });
    }
  });
  
  // Route pour vérifier l'état du broker MQTT
  app.get("/api/mqtt/status", ensureAuthenticated, (req, res) => {
    res.json({
      connected: mqttClient.isConnected(),
      broker: process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com',
      activeTopic: mqttClient.getActiveTopic()
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Middleware pour vérifier l'authentification
function ensureAuthenticated(req: any, res: any, next: any) {
  // Temporairement désactivé pour le développement
  return next();
  
  /* Version originale
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Authentification requise" });
  */
}
