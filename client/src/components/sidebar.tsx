import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface MenuItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badgeCount?: number;
}

export function Sidebar({ className }: { className?: string }) {
  const [location] = useLocation();
  
  // Récupérer les dispositifs récents (derniers dispositifs actifs)
  const { data: recentDevices } = useQuery({
    queryKey: ['/api/devices'],
    select: (devices) => devices?.slice(0, 3)
  });
  
  // Récupérer l'état du broker MQTT
  const { data: mqttStatus } = useQuery({
    queryKey: ['/api/mqtt/status'],
    refetchInterval: 60000 // Actualiser toutes les minutes
  });
  
  // Compter les alertes non-résolues
  const { data: alertsCount } = useQuery({
    queryKey: ['/api/alerts', { resolved: false }],
    select: (alerts) => alerts?.length || 0,
    refetchInterval: 30000 // Actualiser toutes les 30 secondes
  });
  
  // Créer les éléments du menu
  const menuItems: MenuItem[] = [
    {
      href: "/dashboard",
      label: "Tableau de bord",
      icon: <i className="fas fa-home-lg"></i>
    },
    {
      href: "/devices",
      label: "Dispositifs",
      icon: <i className="fas fa-bed-pulse"></i>
    },
    {
      href: "/alerts",
      label: "Alertes",
      icon: <i className="fas fa-bell"></i>,
      badgeCount: alertsCount
    },
    {
      href: "/settings",
      label: "Paramètres",
      icon: <i className="fas fa-gear"></i>
    }
  ];
  
  return (
    <aside className={cn("bg-white w-64 border-r border-neutral-light flex-shrink-0 md:block overflow-y-auto", className)}>
      <nav className="px-4 py-4">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
                location === item.href
                  ? "bg-primary-light bg-opacity-10 text-primary font-medium"
                  : "text-neutral-darkest hover:bg-neutral-lightest hover:text-primary"
              )}>
                {item.icon}
                <span>{item.label}</span>
                {item.badgeCount && item.badgeCount > 0 && (
                  <span className="ml-auto bg-danger text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {item.badgeCount}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        
        {recentDevices && recentDevices.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xs font-semibold text-neutral-medium uppercase tracking-wider px-3 mb-2">
              Dispositifs récents
            </h3>
            <ul className="space-y-1">
              {recentDevices.map((device) => (
                <li key={device.id}>
                  <Link href={`/devices/${device.id}`} className="flex items-center space-x-3 px-3 py-2 rounded-md text-neutral-darkest hover:bg-neutral-lightest">
                    <span className={`w-2 h-2 rounded-full ${device.status === 'active' ? 'bg-success' : 'bg-danger'}`}></span>
                    <span className="text-sm">{device.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="mt-8 pt-4 border-t border-neutral-light">
          <div className="px-3">
            <div className="flex items-center mb-3">
              <span className="text-xs font-semibold text-neutral-medium uppercase tracking-wider">État du broker</span>
              <div className="ml-auto flex items-center">
                <div className={`live-indicator w-2 h-2 rounded-full ${mqttStatus?.connected ? 'bg-success-light' : 'bg-danger'} mr-1`}></div>
                <span className={`text-xs ${mqttStatus?.connected ? 'text-success-dark' : 'text-danger'}`}>
                  {mqttStatus?.connected ? 'Actif' : 'Inactif'}
                </span>
              </div>
            </div>
            <div className="text-xs text-neutral-dark mb-1">
              <span className="font-medium">Broker:</span> {mqttStatus?.broker || 'broker.hivemq.com'}
            </div>
            <div className="text-xs text-neutral-dark">
              <span className="font-medium">Topic:</span> {mqttStatus?.activeTopic || 'patient/esp32-c40a24/data'}
            </div>
          </div>
        </div>
      </nav>
    </aside>
  );
}
