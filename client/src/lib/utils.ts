import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Fonctions utilitaires pour formater les dates et heures en français
export function formatDate(date: Date | string): string {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function formatTime(date: Date | string): string {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function formatDateTime(date: Date | string): string {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  return `${formatDate(date)} ${formatTime(date)}`;
}

// Fonction pour déterminer le statut d'une valeur de capteur
export function getSensorStatus(value: number | undefined, minThreshold: number | null, maxThreshold: number | null): 'normal' | 'warning' | 'danger' | 'unknown' {
  if (value === undefined) return 'unknown';
  
  if (minThreshold !== null && value < minThreshold) {
    return value < minThreshold * 0.8 ? 'danger' : 'warning';
  }
  
  if (maxThreshold !== null && value > maxThreshold) {
    return value > maxThreshold * 1.2 ? 'danger' : 'warning';
  }
  
  return 'normal';
}

// Fonction pour déterminer la couleur en fonction du statut
export function getStatusColor(status: 'normal' | 'warning' | 'danger' | 'unknown'): string {
  switch (status) {
    case 'normal':
      return 'text-success bg-success bg-opacity-10';
    case 'warning':
      return 'text-yellow-700 bg-yellow-100';
    case 'danger':
      return 'text-danger bg-danger bg-opacity-10';
    case 'unknown':
    default:
      return 'text-neutral-dark bg-neutral-light';
  }
}

// Fonction pour traduire le nom des capteurs en français
export function translateSensorType(sensorType: string): string {
  switch (sensorType) {
    case 'temperature':
      return 'Température';
    case 'pulse':
      return 'Pouls';
    case 'creatinine':
      return 'Créatinine';
    default:
      return sensorType;
  }
}

// Fonction pour obtenir l'unité d'un capteur
export function getSensorUnit(sensorType: string): string {
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

// Fonction pour générer un CSV à partir de données
export function generateCSV(data: any[], headers: string[]): string {
  const headerRow = headers.join(',');
  const dataRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      return value !== undefined && value !== null ? value : '';
    }).join(',')
  );
  
  return [headerRow, ...dataRows].join('\n');
}

// Fonction pour télécharger un fichier CSV
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
