import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getSensorStatus, getStatusColor, translateSensorType } from "@/lib/utils";
import { Thermometer, Heart, Activity } from "lucide-react";

interface SensorCardProps {
  type: 'temperature' | 'pulse' | 'creatinine';
  value: number | undefined;
  unit: string;
  minThreshold: number | null;
  maxThreshold: number | null;
  description?: string;
}

export function SensorCard({
  type,
  value,
  unit,
  minThreshold,
  maxThreshold,
  description
}: SensorCardProps) {
  // Déterminer le statut en fonction des seuils
  const status = getSensorStatus(value, minThreshold, maxThreshold);
  
  // Configurer l'icône et la couleur en fonction du type
  const getIcon = () => {
    switch (type) {
      case 'temperature':
        return <Thermometer className="h-5 w-5" />;
      case 'pulse':
        return <Heart className="h-5 w-5" />;
      case 'creatinine':
        return <Activity className="h-5 w-5" />;
    }
  };
  
  const getIconBgColor = () => {
    switch (type) {
      case 'temperature':
        return 'bg-primary bg-opacity-10 text-primary';
      case 'pulse':
        return 'bg-danger bg-opacity-10 text-danger';
      case 'creatinine':
        return 'bg-secondary bg-opacity-10 text-secondary';
    }
  };
  
  // Calculer une valeur de progression pour la barre de progression
  const getProgressValue = () => {
    if (value === undefined || minThreshold === null || maxThreshold === null) {
      return 0;
    }
    
    const range = maxThreshold - minThreshold;
    const normalized = (value - minThreshold) / range;
    return Math.max(0, Math.min(100, normalized * 100));
  };
  
  // Déterminer le texte du statut
  const getStatusText = () => {
    switch (status) {
      case 'normal':
        return 'Normal';
      case 'warning':
        return 'Attention';
      case 'danger':
        return 'Critique';
      case 'unknown':
      default:
        return 'En attente de données';
    }
  };
  
  // Déterminer la couleur de la barre de progression
  const getProgressColor = () => {
    switch (status) {
      case 'normal':
        return 'bg-success';
      case 'warning':
        return 'bg-yellow-500';
      case 'danger':
        return 'bg-danger';
      case 'unknown':
      default:
        return 'bg-neutral-medium';
    }
  };
  
  return (
    <Card className="sensor-card bg-white shadow-sm border border-neutral-light transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-medium text-neutral-darkest">{translateSensorType(type)}</h3>
            <p className="text-neutral-dark text-sm">{description || ''}</p>
          </div>
          <div className={`rounded-full p-2 ${getIconBgColor()}`}>
            {getIcon()}
          </div>
        </div>
        
        <div className="flex items-end">
          <div className="text-3xl font-bold">
            {value !== undefined ? value.toFixed(1) : '—'}
          </div>
          <div className="text-neutral-dark ml-1 mb-1">{unit}</div>
        </div>
        
        <div className="mt-4">
          <div className="flex justify-between text-sm">
            <span className="text-neutral-dark">
              Seuil d'alerte: <span className="font-medium">
                {minThreshold !== null && maxThreshold !== null 
                  ? `${minThreshold}-${maxThreshold} ${unit}`
                  : minThreshold !== null
                    ? `Min. ${minThreshold} ${unit}`
                    : maxThreshold !== null
                      ? `Max. ${maxThreshold} ${unit}`
                      : 'Non défini'}
              </span>
            </span>
            <span className={`font-medium ${getStatusColor(status).split(' ')[0]}`}>
              {getStatusText()}
            </span>
          </div>
          <div className="w-full bg-neutral-light rounded-full h-2 mt-2">
            <div 
              className={`${getProgressColor()} h-2 rounded-full transition-all duration-700`} 
              style={{ width: `${getProgressValue()}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
