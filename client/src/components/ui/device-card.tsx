import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Device } from "@shared/schema";
import { Link } from "wouter";
import { RefreshCw, Settings } from "lucide-react";

interface DeviceCardProps {
  device: Device;
  sensorsCount?: {
    total: number;
    active: number;
  };
  onRefresh?: (id: number) => void;
}

export function DeviceCard({ device, sensorsCount, onRefresh }: DeviceCardProps) {
  const isActive = device.status === 'active';
  
  return (
    <Card className="hover:border-primary transition-colors">
      <CardContent className="p-4">
        <div className="flex justify-between">
          <h4 className="font-medium">{device.name}</h4>
          <span className={`px-2 py-1 rounded-full text-xs ${isActive 
            ? 'bg-success bg-opacity-10 text-success' 
            : 'bg-danger bg-opacity-10 text-danger'}`}>
            {isActive ? 'Actif' : 'Inactif'}
          </span>
        </div>
        
        <div className="mt-3 text-sm text-neutral-dark">
          <div className="flex justify-between mb-1">
            <span>Patient:</span>
            <span className="font-medium text-neutral-darkest">
              {device.patient || 'Non assigné'}
            </span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Chambre:</span>
            <span className="font-medium text-neutral-darkest">
              {device.room || 'Non assigné'}
            </span>
          </div>
          {sensorsCount && (
            <div className="flex justify-between mb-1">
              <span>Capteurs:</span>
              <span className={`font-medium ${
                sensorsCount.active === sensorsCount.total 
                  ? 'text-neutral-darkest' 
                  : 'text-danger'
              }`}>
                {sensorsCount.active}/{sensorsCount.total} actifs
              </span>
            </div>
          )}
        </div>
        
        <div className="mt-4 flex justify-between items-center">
          <Button variant="link" className="p-0 h-auto text-primary hover:text-primary-dark text-sm font-medium">
            <Link to={`/devices/${device.id}`}>
              Voir les détails
            </Link>
          </Button>
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => onRefresh && onRefresh(device.id)}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Link to={`/devices/${device.id}`}>
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
