import { pgTable, text, serial, integer, boolean, timestamp, json, real, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Utilisateurs
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  firstName: true,
  lastName: true,
});

// Matelas (dispositifs)
export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").default("inactive").notNull(),
  patient: text("patient"),
  room: text("room"),
  mqttTopic: text("mqtt_topic").default("patient/esp32-c40a24/data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDeviceSchema = createInsertSchema(devices).pick({
  deviceId: true,
  name: true,
  status: true,
  patient: true,
  room: true,
  mqttTopic: true,
});

// Capteurs (settings)
export const sensorSettings = pgTable("sensor_settings", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull(),
  sensorType: text("sensor_type").notNull(),
  minThreshold: real("min_threshold"),
  maxThreshold: real("max_threshold"),
  alarmEnabled: boolean("alarm_enabled").default(true),
  unit: text("unit"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    deviceSensorUnique: uniqueIndex("device_sensor_unique").on(table.deviceId, table.sensorType),
  };
});

export const insertSensorSettingSchema = createInsertSchema(sensorSettings).pick({
  deviceId: true,
  sensorType: true,
  minThreshold: true,
  maxThreshold: true,
  alarmEnabled: true,
  unit: true,
});

// Alertes
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull(),
  sensorType: text("sensor_type").notNull(),
  level: text("level").notNull(),
  message: text("message").notNull(),
  value: real("value"),
  threshold: real("threshold"),
  resolved: boolean("resolved").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertAlertSchema = createInsertSchema(alerts).pick({
  deviceId: true,
  sensorType: true,
  level: true,
  message: true,
  value: true,
  threshold: true,
});

// Interfaces et types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;

export type InsertSensorSetting = z.infer<typeof insertSensorSettingSchema>;
export type SensorSetting = typeof sensorSettings.$inferSelect;

export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

// Types pour les données MQTT
export interface SensorData {
  temperature?: number;
  pulse?: number;
  creatinine?: number;
  timestamp?: string;
  deviceId?: string;
}

// Interface pour les séries temporelles stockées dans InfluxDB
export interface TimeSeriesPoint {
  time: string;
  deviceId: string;
  sensorType: string;
  value: number;
  unit: string;
}
