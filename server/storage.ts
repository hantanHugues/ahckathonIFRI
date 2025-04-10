import { users, devices, sensorSettings, alerts } from "@shared/schema";
import type { User, InsertUser, Device, InsertDevice, SensorSetting, InsertSensorSetting, Alert, InsertAlert } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Device operations
  getDevices(): Promise<Device[]>;
  getDevice(id: number): Promise<Device | undefined>;
  getDeviceByDeviceId(deviceId: string): Promise<Device | undefined>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: number, device: Partial<Device>): Promise<Device | undefined>;
  deleteDevice(id: number): Promise<boolean>;
  
  // Sensor settings operations
  getSensorSettings(deviceId: number): Promise<SensorSetting[]>;
  getSensorSetting(id: number): Promise<SensorSetting | undefined>;
  getSensorSettingByType(deviceId: number, sensorType: string): Promise<SensorSetting | undefined>;
  createSensorSetting(setting: InsertSensorSetting): Promise<SensorSetting>;
  updateSensorSetting(id: number, setting: Partial<SensorSetting>): Promise<SensorSetting | undefined>;
  
  // Alert operations
  getAlerts(resolved?: boolean): Promise<Alert[]>;
  getAlertsByDevice(deviceId: number, resolved?: boolean): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  resolveAlert(id: number): Promise<Alert | undefined>;
  
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private devices: Map<number, Device>;
  private sensorSettings: Map<number, SensorSetting>;
  private alerts: Map<number, Alert>;
  
  private userIdCounter = 1;
  private deviceIdCounter = 1;
  private sensorSettingIdCounter = 1;
  private alertIdCounter = 1;
  
  sessionStore: session.SessionStore;

  constructor() {
    this.users = new Map();
    this.devices = new Map();
    this.sensorSettings = new Map();
    this.alerts = new Map();
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    
    // Initialize default sensor settings for standard sensors
    // Ce code s'exécute de manière asynchrone mais nous n'attendons pas sa résolution
    // dans le constructeur, c'est acceptable pour l'initialisation des données de test
    this.setupDefaultSensorSettings().catch(err => {
      console.error("Erreur lors de l'initialisation des données par défaut:", err);
    });
  }
  
  private async setupDefaultSensorSettings() {
    // Créer un dispositif par défaut pour le développement
    const defaultDevice: InsertDevice = {
      deviceId: "esp32-c40a24",
      name: "Matelas médical - Chambre 101",
      status: "active",
      patient: "Jean Dupont",
      room: "101",
      mqttTopic: "patient/esp32-c40a24/data"
    };
    
    // Ajouter le dispositif
    const device = await this.createDevice(defaultDevice);
    
    // Configurer les paramètres par défaut des capteurs
    const defaultSettings = [
      { sensorType: "temperature", minThreshold: 35, maxThreshold: 38.5, unit: "°C", alarmEnabled: true },
      { sensorType: "pulse", minThreshold: 50, maxThreshold: 120, unit: "BPM", alarmEnabled: true },
      { sensorType: "creatinine", minThreshold: 0.5, maxThreshold: 1.5, unit: "mg/dL", alarmEnabled: true },
    ];
    
    // Créer les paramètres des capteurs pour le dispositif
    for (const setting of defaultSettings) {
      await this.createSensorSetting({
        deviceId: device.id,
        sensorType: setting.sensorType,
        minThreshold: setting.minThreshold,
        maxThreshold: setting.maxThreshold,
        unit: setting.unit,
        alarmEnabled: setting.alarmEnabled
      });
    }
    
    console.log("Dispositif par défaut créé avec ID:", device.id);
  }
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const newUser: User = { 
      ...user, 
      id,
      role: "user",
      createdAt: new Date()
    };
    this.users.set(id, newUser);
    return newUser;
  }
  
  // Device operations
  async getDevices(): Promise<Device[]> {
    return Array.from(this.devices.values());
  }
  
  async getDevice(id: number): Promise<Device | undefined> {
    return this.devices.get(id);
  }
  
  async getDeviceByDeviceId(deviceId: string): Promise<Device | undefined> {
    return Array.from(this.devices.values()).find(device => device.deviceId === deviceId);
  }
  
  async createDevice(device: InsertDevice): Promise<Device> {
    const id = this.deviceIdCounter++;
    const now = new Date();
    const newDevice: Device = {
      ...device,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.devices.set(id, newDevice);
    
    // Create default sensor settings for the new device
    const defaultSensorTypes = ["temperature", "pulse", "creatinine"];
    for (const sensorType of defaultSensorTypes) {
      let minThreshold = 0;
      let maxThreshold = 100;
      let unit = "";
      
      if (sensorType === "temperature") {
        minThreshold = 35;
        maxThreshold = 38.5;
        unit = "°C";
      } else if (sensorType === "pulse") {
        minThreshold = 50;
        maxThreshold = 120;
        unit = "BPM";
      } else if (sensorType === "creatinine") {
        minThreshold = 0.5;
        maxThreshold = 1.5;
        unit = "mg/dL";
      }
      
      await this.createSensorSetting({
        deviceId: id,
        sensorType,
        minThreshold,
        maxThreshold,
        alarmEnabled: true,
        unit
      });
    }
    
    return newDevice;
  }
  
  async updateDevice(id: number, updatedFields: Partial<Device>): Promise<Device | undefined> {
    const device = this.devices.get(id);
    if (!device) return undefined;
    
    const updatedDevice: Device = {
      ...device,
      ...updatedFields,
      updatedAt: new Date()
    };
    this.devices.set(id, updatedDevice);
    return updatedDevice;
  }
  
  async deleteDevice(id: number): Promise<boolean> {
    return this.devices.delete(id);
  }
  
  // Sensor settings operations
  async getSensorSettings(deviceId: number): Promise<SensorSetting[]> {
    return Array.from(this.sensorSettings.values())
      .filter(setting => setting.deviceId === deviceId);
  }
  
  async getSensorSetting(id: number): Promise<SensorSetting | undefined> {
    return this.sensorSettings.get(id);
  }
  
  async getSensorSettingByType(deviceId: number, sensorType: string): Promise<SensorSetting | undefined> {
    return Array.from(this.sensorSettings.values())
      .find(setting => setting.deviceId === deviceId && setting.sensorType === sensorType);
  }
  
  async createSensorSetting(setting: InsertSensorSetting): Promise<SensorSetting> {
    const id = this.sensorSettingIdCounter++;
    const now = new Date();
    const newSetting: SensorSetting = {
      ...setting,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.sensorSettings.set(id, newSetting);
    return newSetting;
  }
  
  async updateSensorSetting(id: number, updatedFields: Partial<SensorSetting>): Promise<SensorSetting | undefined> {
    const setting = this.sensorSettings.get(id);
    if (!setting) return undefined;
    
    const updatedSetting: SensorSetting = {
      ...setting,
      ...updatedFields,
      updatedAt: new Date()
    };
    this.sensorSettings.set(id, updatedSetting);
    return updatedSetting;
  }
  
  // Alert operations
  async getAlerts(resolved?: boolean): Promise<Alert[]> {
    let alerts = Array.from(this.alerts.values());
    if (resolved !== undefined) {
      alerts = alerts.filter(alert => alert.resolved === resolved);
    }
    return alerts.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }
  
  async getAlertsByDevice(deviceId: number, resolved?: boolean): Promise<Alert[]> {
    let alerts = Array.from(this.alerts.values())
      .filter(alert => alert.deviceId === deviceId);
    if (resolved !== undefined) {
      alerts = alerts.filter(alert => alert.resolved === resolved);
    }
    return alerts.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }
  
  async createAlert(alert: InsertAlert): Promise<Alert> {
    const id = this.alertIdCounter++;
    const newAlert: Alert = {
      ...alert,
      id,
      resolved: false,
      createdAt: new Date(),
      resolvedAt: null
    };
    this.alerts.set(id, newAlert);
    return newAlert;
  }
  
  async resolveAlert(id: number): Promise<Alert | undefined> {
    const alert = this.alerts.get(id);
    if (!alert) return undefined;
    
    const resolvedAlert: Alert = {
      ...alert,
      resolved: true,
      resolvedAt: new Date()
    };
    this.alerts.set(id, resolvedAlert);
    return resolvedAlert;
  }
}

export const storage = new MemStorage();
