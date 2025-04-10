import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { InsertDevice, Device } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

export function useDevice(deviceId?: string | number) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  
  // Récupérer tous les dispositifs
  const { data: devices = [] } = useQuery({
    queryKey: ['/api/devices'],
    enabled: !deviceId,
  });
  
  // Récupérer un dispositif spécifique
  const { data: device, isLoading: isLoadingDevice } = useQuery({
    queryKey: [`/api/devices/${deviceId}`],
    enabled: !!deviceId,
  });
  
  // Récupérer les alertes actives pour le dispositif
  const { data: alerts = [] } = useQuery({
    queryKey: [`/api/devices/${deviceId}/alerts`, { resolved: false }],
    enabled: !!deviceId,
    refetchInterval: 30000,
  });
  
  // Mutation pour créer un nouveau dispositif
  const createDeviceMutation = useMutation({
    mutationFn: async (newDevice: InsertDevice) => {
      const res = await apiRequest('POST', '/api/devices', newDevice);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      toast({
        title: 'Dispositif créé',
        description: 'Le dispositif a été créé avec succès',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: `Erreur lors de la création du dispositif: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
  
  // Mutation pour mettre à jour un dispositif
  const updateDeviceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Device> }) => {
      const res = await apiRequest('PUT', `/api/devices/${id}`, data);
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/devices/${variables.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      toast({
        title: 'Dispositif mis à jour',
        description: 'Le dispositif a été mis à jour avec succès',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: `Erreur lors de la mise à jour du dispositif: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
  
  // Mutation pour supprimer un dispositif
  const deleteDeviceMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/devices/${id}`);
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      toast({
        title: 'Dispositif supprimé',
        description: 'Le dispositif a été supprimé avec succès',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: `Erreur lors de la suppression du dispositif: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
  
  // Fonction pour mettre à jour les paramètres des capteurs
  const updateSensorSettingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PUT', `/api/sensor-settings/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      if (deviceId) {
        queryClient.invalidateQueries({ queryKey: [`/api/devices/${deviceId}/sensor-settings`] });
      }
      toast({
        title: 'Paramètres mis à jour',
        description: 'Les paramètres du capteur ont été mis à jour avec succès',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: `Erreur lors de la mise à jour des paramètres: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
  
  // Fonction pour résoudre une alerte
  const resolveAlertMutation = useMutation({
    mutationFn: async (alertId: number) => {
      const res = await apiRequest('PUT', `/api/alerts/${alertId}/resolve`, {});
      return await res.json();
    },
    onSuccess: () => {
      if (deviceId) {
        queryClient.invalidateQueries({ queryKey: [`/api/devices/${deviceId}/alerts`] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
      toast({
        title: 'Alerte résolue',
        description: "L'alerte a été marquée comme résolue",
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: `Erreur lors de la résolution de l'alerte: ${error.message}`,
        variant: 'destructive',
      });
    },
  });
  
  return {
    devices,
    device,
    alerts,
    isLoading: isLoading || isLoadingDevice,
    createDevice: createDeviceMutation.mutate,
    updateDevice: updateDeviceMutation.mutate,
    deleteDevice: deleteDeviceMutation.mutate,
    updateSensorSetting: updateSensorSettingMutation.mutate,
    resolveAlert: resolveAlertMutation.mutate,
  };
}
