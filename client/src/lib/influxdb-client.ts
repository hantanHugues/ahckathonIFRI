import { apiRequest } from './queryClient';
import { SensorData, TimeSeriesPoint } from '@shared/schema';

// Fonctions pour interagir avec l'API backend qui communique avec InfluxDB
export async function getLatestSensorData(deviceId: string): Promise<SensorData> {
  try {
    const res = await apiRequest('GET', `/api/devices/${deviceId}/latest-data`);
    return await res.json();
  } catch (error) {
    console.error('Erreur lors de la récupération des dernières données:', error);
    throw error;
  }
}

export async function getSensorData(
  deviceId: string,
  sensorType: string,
  duration: string = '-1h'
): Promise<TimeSeriesPoint[]> {
  try {
    const res = await apiRequest(
      'GET',
      `/api/devices/${deviceId}/sensor-data?sensorType=${sensorType}&duration=${duration}`
    );
    return await res.json();
  } catch (error) {
    console.error('Erreur lors de la récupération des données des capteurs:', error);
    throw error;
  }
}

export async function getHistoricalData(
  deviceId: string,
  sensorType: string,
  startTime: string,
  endTime: string
): Promise<TimeSeriesPoint[]> {
  try {
    const res = await apiRequest(
      'GET',
      `/api/devices/${deviceId}/historical-data?sensorType=${sensorType}&startTime=${startTime}&endTime=${endTime}`
    );
    return await res.json();
  } catch (error) {
    console.error('Erreur lors de la récupération des données historiques:', error);
    throw error;
  }
}

// Fonction pour exporter les données au format CSV
export function downloadSensorDataCsv(
  deviceId: string,
  startTime: string = '-24h',
  endTime: string = 'now()'
): void {
  const url = `/api/devices/${deviceId}/export-csv?startTime=${startTime}&endTime=${endTime}`;
  
  // Créer un lien temporaire pour le téléchargement
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `sensmed_data_${deviceId}_${Date.now()}.csv`);
  document.body.appendChild(link);
  
  // Déclencher le téléchargement
  link.click();
  
  // Nettoyer
  document.body.removeChild(link);
}

// Fonction pour formater les données pour les graphiques
export function formatDataForCharts(
  data: TimeSeriesPoint[],
  sensorType: string
): { time: string; value: number }[] {
  return data.map(point => ({
    time: new Date(point.time).toLocaleTimeString('fr-FR'),
    value: point.value
  }));
}
