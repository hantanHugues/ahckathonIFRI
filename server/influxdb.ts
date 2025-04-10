import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { BucketsAPI } from '@influxdata/influxdb-client-apis';
import { TimeSeriesPoint, SensorData } from '@shared/schema';

// Configuration InfluxDB
// Extraire juste le domaine de base de l'URL InfluxDB Cloud
let url = process.env.INFLUXDB_CLOUD_URL || 'http://127.0.0.1:8086';
// Si l'URL contient '/orgs/', supprimer cette partie et tout ce qui suit
if (url && url.includes('/orgs/')) {
  url = url.split('/orgs/')[0];
}
const token = process.env.INFLUXDB_TOKEN || ' HfFC0e_yzfgNxSR9QJUcBqwC3LnMyLn5-YyCdCr_Jq-M_kj4NyOE7wP8y_lQi4MPzWmN4_o3MOkaMz5ayFYq6A==';
// Extraire l'identifiant d'organisation de l'URL si disponible
let org = 'IFRI';
if (process.env.INFLUXDB_CLOUD_URL && process.env.INFLUXDB_CLOUD_URL.includes('/orgs/')) {
  const match = process.env.INFLUXDB_CLOUD_URL.match(/\/orgs\/([^\/]+)/);
  if (match && match[1]) {
    org = match[1];
  }
}
const bucket = 'Hackathon';

console.log('Connexion à InfluxDB avec URL:', url);
console.log('Organisation InfluxDB:', org);
console.log('Bucket InfluxDB:', bucket);

let influxDB: InfluxDB;
let writeApi: any;
let queryApi: any;

const USE_REAL_INFLUXDB = true;

if (USE_REAL_INFLUXDB) {
  // Créer un client InfluxDB réel
  influxDB = new InfluxDB({ url, token });
  writeApi = influxDB.getWriteApi(org, bucket, 'ns');
  queryApi = influxDB.getQueryApi(org);
} else {
  console.log('Utilisation d\'une simulation InfluxDB pour le développement');
  // Les API réelles ne seront pas utilisées en mode développement, mais définies pour éviter les erreurs
  influxDB = {} as InfluxDB;
  writeApi = {
    writePoint: () => {},
    flush: async () => {}
  };
  queryApi = {
    collectRows: async () => []
  };
}

// Assurer que le bucket existe
async function ensureBucketExists() {
  try {
    const bucketsAPI = new BucketsAPI(influxDB);
    const buckets = await bucketsAPI.getBuckets({ org });
    
    const bucketExists = buckets.buckets?.some(b => b.name === bucket);
    
    if (!bucketExists) {
      console.log(`Création du bucket ${bucket}`);
      await bucketsAPI.postBuckets({ body: { orgID: org, name: bucket } });
    }
  } catch (error) {
    console.error('Erreur lors de la vérification/création du bucket:', error);
  }
}

// Données de simulation pour le développement
const simulatedData: Record<string, TimeSeriesPoint[]> = {
  'temperature': Array.from({ length: 100 }, (_, i) => ({
    time: new Date(Date.now() - (i * 60000)).toISOString(),
    deviceId: 'esp32-c40a24',
    sensorType: 'temperature',
    value: 36.5 + (Math.random() * 2 - 1),
    unit: '°C'
  })),
  'pulse': Array.from({ length: 100 }, (_, i) => ({
    time: new Date(Date.now() - (i * 60000)).toISOString(),
    deviceId: 'esp32-c40a24',
    sensorType: 'pulse',
    value: 75 + Math.floor(Math.random() * 20 - 10),
    unit: 'BPM'
  })),
  'creatinine': Array.from({ length: 100 }, (_, i) => ({
    time: new Date(Date.now() - (i * 60000)).toISOString(),
    deviceId: 'esp32-c40a24',
    sensorType: 'creatinine',
    value: 0.8 + (Math.random() * 0.4 - 0.2),
    unit: 'mg/dL'
  }))
};

// Initialiser InfluxDB
export async function initializeInfluxDB() {
  if (USE_REAL_INFLUXDB) {
    try {
      await ensureBucketExists();
      console.log('InfluxDB initialisé avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'initialisation d\'InfluxDB:', error);
    }
  } else {
    console.log('Simulation InfluxDB initialisée avec succès');
    // En mode simulation, nous n'avons rien à initialiser réellement
  }
}

// Stocker les données des capteurs
export async function storeSensorData(deviceId: string, data: SensorData) {
  try {
    const timestamp = new Date();
    
    // Créer un point pour chaque type de capteur présent dans les données
    if (data.temperature !== undefined) {
      const point = new Point('sensor_data')
        .tag('deviceId', deviceId)
        .tag('sensorType', 'temperature')
        .floatField('value', data.temperature)
        .timestamp(timestamp);
      writeApi.writePoint(point);
    }
    
    if (data.pulse !== undefined) {
      const point = new Point('sensor_data')
        .tag('deviceId', deviceId)
        .tag('sensorType', 'pulse')
        .floatField('value', data.pulse)
        .timestamp(timestamp);
      writeApi.writePoint(point);
    }
    
    if (data.creatinine !== undefined) {
      const point = new Point('sensor_data')
        .tag('deviceId', deviceId)
        .tag('sensorType', 'creatinine')
        .floatField('value', data.creatinine)
        .timestamp(timestamp);
      writeApi.writePoint(point);
    }
    
    await writeApi.flush();
    return true;
  } catch (error) {
    console.error('Erreur lors du stockage des données dans InfluxDB:', error);
    return false;
  }
}

// Récupérer les données historiques
export async function getHistoricalData(
  deviceId: string,
  sensorType: string,
  startTime: string,
  endTime: string
): Promise<TimeSeriesPoint[]> {
  if (USE_REAL_INFLUXDB) {
    try {
      const query = `
        from(bucket: "${bucket}")
          |> range(start: ${startTime}, stop: ${endTime})
          |> filter(fn: (r) => r._measurement == "sensor_data")
          |> filter(fn: (r) => r.deviceId == "${deviceId}")
          |> filter(fn: (r) => r.sensorType == "${sensorType}")
          |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      `;
      
      const result: TimeSeriesPoint[] = [];
      
      const rows = await queryApi.collectRows(query);
      rows.forEach((row: any) => {
        result.push({
          time: row._time,
          deviceId: row.deviceId,
          sensorType: row.sensorType,
          value: row.value,
          unit: getSensorUnit(sensorType)
        });
      });
      
      return result;
    } catch (error) {
      console.error('Erreur lors de la récupération des données d\'InfluxDB:', error);
      return [];
    }
  } else {
    // En mode développement, retourner les données simulées
    if (sensorType in simulatedData) {
      // Filtrer les données selon la plage de temps
      // Convertir les paramètres de temps FluxQL en timestamps JavaScript
      const now = Date.now();
      let startMs = now;
      if (startTime === '-1h') startMs = now - 3600000; // -1 heure
      else if (startTime === '-24h') startMs = now - 86400000; // -24 heures
      else if (startTime === '-7d') startMs = now - 604800000; // -7 jours
      
      let endMs = now;
      if (endTime !== 'now()') {
        endMs = new Date(endTime).getTime();
      }
      
      return simulatedData[sensorType].filter(point => {
        const pointTime = new Date(point.time).getTime();
        return pointTime >= startMs && pointTime <= endMs && point.deviceId === deviceId;
      });
    }
    return [];
  }
}

// Récupérer les données récentes (dernière heure par défaut)
export async function getRecentData(
  deviceId: string,
  sensorType: string,
  duration: string = '-1h'
): Promise<TimeSeriesPoint[]> {
  return getHistoricalData(deviceId, sensorType, duration, 'now()');
}

// Récupérer les dernières données pour tous les types de capteurs
export async function getLatestSensorData(deviceId: string): Promise<SensorData> {
  if (USE_REAL_INFLUXDB) {
    try {
      const query = `
        from(bucket: "${bucket}")
          |> range(start: -1h)
          |> filter(fn: (r) => r._measurement == "sensor_data")
          |> filter(fn: (r) => r.deviceId == "${deviceId}")
          |> last()
          |> pivot(rowKey:["_time"], columnKey: ["sensorType"], valueColumn: "_value")
      `;
      
      const rows = await queryApi.collectRows(query);
      
      if (rows.length === 0) {
        return {};
      }
      
      const latestData: SensorData = {
        deviceId,
        timestamp: new Date().toISOString()
      };
      
      rows.forEach((row: any) => {
        if (row.temperature) latestData.temperature = row.temperature;
        if (row.pulse) latestData.pulse = row.pulse;
        if (row.creatinine) latestData.creatinine = row.creatinine;
      });
      
      return latestData;
    } catch (error) {
      console.error('Erreur lors de la récupération des dernières données:', error);
      return { deviceId };
    }
  } else {
    // En mode développement, retourner les dernières valeurs simulées
    const latestData: SensorData = {
      deviceId,
      timestamp: new Date().toISOString()
    };
    
    if (simulatedData.temperature && simulatedData.temperature.length > 0) {
      latestData.temperature = simulatedData.temperature[0].value;
    }
    
    if (simulatedData.pulse && simulatedData.pulse.length > 0) {
      latestData.pulse = simulatedData.pulse[0].value;
    }
    
    if (simulatedData.creatinine && simulatedData.creatinine.length > 0) {
      latestData.creatinine = simulatedData.creatinine[0].value;
    }
    
    return latestData;
  }
}

// Récupérer toutes les entrées de données pour l'exportation CSV
export async function getAllSensorDataForExport(
  deviceId: string,
  startTime: string = '-24h',
  endTime: string = 'now()'
): Promise<any[]> {
  if (USE_REAL_INFLUXDB) {
    try {
      const query = `
        from(bucket: "${bucket}")
          |> range(start: ${startTime}, stop: ${endTime})
          |> filter(fn: (r) => r._measurement == "sensor_data")
          |> filter(fn: (r) => r.deviceId == "${deviceId}")
          |> pivot(rowKey:["_time"], columnKey: ["sensorType"], valueColumn: "_value")
      `;
      
      const rows = await queryApi.collectRows(query);
      return rows.map((row: any) => {
        return {
          timestamp: row._time,
          temperature: row.temperature || null,
          pulse: row.pulse || null,
          creatinine: row.creatinine || null
        };
      });
    } catch (error) {
      console.error('Erreur lors de la récupération des données pour l\'exportation:', error);
      return [];
    }
  } else {
    // En mode développement, combiner les données simulées pour les valeurs communes
    const timeMap = new Map<string, any>();
    
    // Créer une structure temporelle commune
    ['temperature', 'pulse', 'creatinine'].forEach(type => {
      if (type in simulatedData) {
        simulatedData[type].forEach(point => {
          if (!timeMap.has(point.time)) {
            timeMap.set(point.time, {
              timestamp: point.time,
              temperature: null,
              pulse: null,
              creatinine: null
            });
          }
          
          const entry = timeMap.get(point.time);
          entry[point.sensorType] = point.value;
        });
      }
    });
    
    // Convertir la map en tableau et trier par timestamp
    return Array.from(timeMap.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}

// Récupérer les temps d'inactivité des capteurs
export async function getSensorDowntimes(
  deviceId: string,
  duration: string = '-24h'
): Promise<any[]> {
  // Cette fonction est une simplification, idéalement on analyserait les gaps de données
  // pour déterminer les périodes d'inactivité
  
  if (USE_REAL_INFLUXDB) {
    try {
      const query = `
        from(bucket: "${bucket}")
          |> range(start: ${duration})
          |> filter(fn: (r) => r._measurement == "sensor_data")
          |> filter(fn: (r) => r.deviceId == "${deviceId}")
          |> group(columns: ["sensorType"])
          |> count()
      `;
      
      const rows = await queryApi.collectRows(query);
      
      const expectedReadings = {
        temperature: 60, // exemple: une lecture attendue par minute
        pulse: 60,
        creatinine: 60
      };
      
      return rows.map((row: any) => {
        const sensorType = row.sensorType;
        const actualCount = row._value;
        const expectedCount = expectedReadings[sensorType as keyof typeof expectedReadings];
        const downtime = Math.max(0, 1 - (actualCount / expectedCount));
        
        return {
          sensorType,
          readingsCount: actualCount,
          expectedReadingsCount: expectedCount,
          downtimePercentage: downtime * 100
        };
      });
    } catch (error) {
      console.error('Erreur lors du calcul des temps d\'inactivité:', error);
      return [];
    }
  } else {
    // En mode développement, générer des valeurs de temps d'inactivité simulées
    const expectedReadings = {
      temperature: 60,
      pulse: 60,
      creatinine: 60
    };
    
    return Object.keys(simulatedData).map(sensorType => {
      const actualCount = simulatedData[sensorType].length;
      const expectedCount = expectedReadings[sensorType as keyof typeof expectedReadings];
      
      // Simuler quelques temps d'inactivité pour rendre les données plus réalistes
      const randomFactor = 0.7 + (Math.random() * 0.3); // Entre 70% et 100% des données attendues
      const adjustedCount = Math.floor(actualCount * randomFactor);
      const downtime = Math.max(0, 1 - (adjustedCount / expectedCount));
      
      return {
        sensorType,
        readingsCount: adjustedCount,
        expectedReadingsCount: expectedCount,
        downtimePercentage: downtime * 100
      };
    });
  }
}

// Fonction utilitaire pour obtenir l'unité d'un capteur
function getSensorUnit(sensorType: string): string {
  switch (sensorType) {
    case 'temperature':
      return '°C';
    case 'pulse':
      return 'BPM';
    case 'creatinine':
      return 'mg/dL';
    default:
      return '';
  }
}
