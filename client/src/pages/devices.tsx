import { useState } from "react";
import { useDevice } from "@/hooks/use-device";
import { AppLayout } from "@/components/app-layout";
import { DeviceCard } from "@/components/ui/device-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Form, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormControl,
  FormMessage 
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Device, InsertDevice } from "@shared/schema";
import { Loader2, Plus, Search } from "lucide-react";

export default function Devices() {
  const { devices, isLoading, createDevice } = useDevice();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Schéma de validation pour la création d'un dispositif
  const deviceSchema = z.object({
    deviceId: z.string().min(3, "L'identifiant doit contenir au moins 3 caractères"),
    name: z.string().min(3, "Le nom doit contenir au moins 3 caractères"),
    status: z.enum(["active", "inactive"]),
    patient: z.string().optional(),
    room: z.string().optional(),
    mqttTopic: z.string().default("patient/esp32-c40a24/data"),
  });

  // Configuration du formulaire
  const form = useForm<z.infer<typeof deviceSchema>>({
    resolver: zodResolver(deviceSchema),
    defaultValues: {
      deviceId: "",
      name: "",
      status: "inactive",
      patient: "",
      room: "",
      mqttTopic: "patient/esp32-c40a24/data",
    },
  });

  // Soumission du formulaire
  const onSubmit = (values: z.infer<typeof deviceSchema>) => {
    createDevice(values as InsertDevice);
    setIsDialogOpen(false);
    form.reset();
  };

  // Filtrer les dispositifs en fonction du terme de recherche
  const filteredDevices = devices
    ? devices.filter(
        (device) =>
          device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          device.deviceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (device.patient && device.patient.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (device.room && device.room.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-darkest">Dispositifs</h1>
            <p className="text-neutral-dark">Gestion des matelas médicaux connectés</p>
          </div>
          <div className="flex items-center space-x-3 mt-4 md:mt-0">
            <div className="relative">
              <Input
                type="text"
                placeholder="Rechercher un dispositif..."
                className="pl-9 pr-4 py-2"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-dark" />
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter un Nouveau Dispositif</DialogTitle>
                </DialogHeader>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="deviceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ID du Dispositif</FormLabel>
                          <FormControl>
                            <Input placeholder="esp32-c40a24" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nom</FormLabel>
                          <FormControl>
                            <Input placeholder="Matelas 001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="patient"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Patient</FormLabel>
                            <FormControl>
                              <Input placeholder="Nom du patient" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="room"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Chambre</FormLabel>
                            <FormControl>
                              <Input placeholder="101" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="mqttTopic"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Topic MQTT</FormLabel>
                          <FormControl>
                            <Input placeholder="patient/esp32-c40a24/data" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Statut</FormLabel>
                          <FormControl>
                            <select
                              className="w-full px-3 py-2 border border-neutral-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                              {...field}
                            >
                              <option value="active">Actif</option>
                              <option value="inactive">Inactif</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <DialogFooter>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Annuler
                      </Button>
                      <Button type="submit">Ajouter le Dispositif</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        {/* Liste des dispositifs */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredDevices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDevices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                sensorsCount={{ total: 3, active: device.status === "active" ? 3 : 0 }}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-neutral-light p-8 text-center">
            <h3 className="text-lg font-medium text-neutral-darkest mb-2">
              {searchTerm ? "Aucun résultat trouvé" : "Aucun dispositif disponible"}
            </h3>
            <p className="text-neutral-dark mb-6">
              {searchTerm
                ? `Aucun dispositif ne correspond à "${searchTerm}"`
                : "Commencez par ajouter un premier dispositif pour le connecter au système"}
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter un Dispositif
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
