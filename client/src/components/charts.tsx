import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TimeSeriesPoint } from "@shared/schema";
import { formatDate, formatTime } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface SensorChartProps {
  temperatureData: TimeSeriesPoint[];
  pulseData: TimeSeriesPoint[];
  creatinineData: TimeSeriesPoint[];
  isLoading?: boolean;
  onTimeRangeChange?: (range: string) => void;
}

export function SensorChart({
  temperatureData,
  pulseData,
  creatinineData,
  isLoading = false,
  onTimeRangeChange,
}: SensorChartProps) {
  const [timeRange, setTimeRange] = useState<string>("1h");
  const [chartData, setChartData] = useState<any[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());

  // Forcer la mise à jour du graphique périodiquement
  useEffect(() => {
    // On force le rafraîchissement toutes les 10 secondes
    const refreshInterval = setInterval(() => {
      setLastUpdateTime(Date.now());
    }, 10000);
    
    return () => clearInterval(refreshInterval);
  }, []);
  
  // Préparer les données pour le graphique
  useEffect(() => {
    if (!temperatureData.length && !pulseData.length && !creatinineData.length) {
      setChartData([]);
      return;
    }
    
    // Forcer la mise à jour à chaque changement de lastUpdateTime
    console.log('Mise à jour du graphique:', new Date().toLocaleTimeString());

    // Créer un dictionnaire pour regrouper les données par horodatage
    const dataByTime: { [key: string]: any } = {};

    // Traiter les données de température
    temperatureData.forEach((point) => {
      const time = new Date(point.time).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      
      if (!dataByTime[time]) {
        dataByTime[time] = { time };
      }
      
      dataByTime[time].temperature = point.value;
    });

    // Traiter les données de pouls
    pulseData.forEach((point) => {
      const time = new Date(point.time).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      
      if (!dataByTime[time]) {
        dataByTime[time] = { time };
      }
      
      dataByTime[time].pulse = point.value;
    });

    // Traiter les données de créatinine
    creatinineData.forEach((point) => {
      const time = new Date(point.time).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      
      if (!dataByTime[time]) {
        dataByTime[time] = { time };
      }
      
      dataByTime[time].creatinine = point.value;
    });

    // Convertir le dictionnaire en tableau pour le graphique
    const chartDataArray = Object.values(dataByTime);
    
    // Trier par horodatage
    chartDataArray.sort((a, b) => {
      const timeA = new Date(`1970-01-01T${a.time}`).getTime();
      const timeB = new Date(`1970-01-01T${b.time}`).getTime();
      return timeA - timeB;
    });
    
    setChartData(chartDataArray);
  }, [temperatureData, pulseData, creatinineData, lastUpdateTime]);

  // Gérer le changement de plage de temps
  const handleTimeRangeChange = (range: string) => {
    setTimeRange(range);
    if (onTimeRangeChange) {
      onTimeRangeChange(range);
    }
  };

  return (
    <Card className="bg-white shadow-sm border border-neutral-light">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <h3 className="font-medium text-lg text-neutral-darkest">Tendances des Capteurs</h3>
          
          <div className="flex items-center space-x-2 mt-2 md:mt-0">
            <div className="flex items-center space-x-1">
              <span className="inline-block w-3 h-3 bg-primary rounded-full"></span>
              <span className="text-sm text-neutral-dark">Température</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="inline-block w-3 h-3 bg-danger rounded-full"></span>
              <span className="text-sm text-neutral-dark">Pouls</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="inline-block w-3 h-3 bg-secondary rounded-full"></span>
              <span className="text-sm text-neutral-dark">Créatinine</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap -mx-2 mb-4">
          <div className="px-2 mb-2">
            <Button 
              variant={timeRange === "1h" ? "default" : "outline"} 
              size="sm"
              onClick={() => handleTimeRangeChange("1h")}
            >
              1h
            </Button>
          </div>
          <div className="px-2 mb-2">
            <Button 
              variant={timeRange === "6h" ? "default" : "outline"} 
              size="sm"
              onClick={() => handleTimeRangeChange("6h")}
            >
              6h
            </Button>
          </div>
          <div className="px-2 mb-2">
            <Button 
              variant={timeRange === "24h" ? "default" : "outline"} 
              size="sm"
              onClick={() => handleTimeRangeChange("24h")}
            >
              24h
            </Button>
          </div>
          <div className="px-2 mb-2">
            <Button 
              variant={timeRange === "7d" ? "default" : "outline"} 
              size="sm"
              onClick={() => handleTimeRangeChange("7d")}
            >
              7j
            </Button>
          </div>
        </div>
        
        <div className="chart-container h-[300px] w-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis yAxisId="left" orientation="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  formatter={(value, name) => {
                    const formattedValue = Number(value).toFixed(1);
                    switch (name) {
                      case "temperature":
                        return [`${formattedValue} °C`, "Température"];
                      case "pulse":
                        return [`${formattedValue} BPM`, "Pouls"];
                      case "creatinine":
                        return [`${formattedValue} mg/dL`, "Créatinine"];
                      default:
                        return [formattedValue, name];
                    }
                  }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="temperature"
                  name="Température"
                  stroke="#2563eb"
                  activeDot={{ r: 8 }}
                  connectNulls
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="pulse"
                  name="Pouls"
                  stroke="#ef4444"
                  connectNulls
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="creatinine"
                  name="Créatinine"
                  stroke="#f97316"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full border border-dashed border-neutral-light rounded-md">
              <p className="text-neutral-dark">Aucune donnée disponible pour cette période</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
