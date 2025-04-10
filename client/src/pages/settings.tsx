import { useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { 
  Form, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormControl,
  FormDescription,
  FormMessage 
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
// Désactiver temporairement l'authentification pour le développement
// import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { MqttStatus } from "@/components/mqtt-status";
import { mqttClient } from "@/lib/mqtt-client";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { User } from "@shared/schema";

export default function Settings() {
  // Simulation d'un utilisateur pour le développement
  const user = {
    id: 1,
    username: 'dev_user',
    email: 'dev@example.com',
    firstName: 'Développeur',
    lastName: 'Test',
    role: 'admin',
    createdAt: new Date()
  };
  const logoutMutation = {
    mutate: () => console.log('Simulation: Déconnexion utilisateur')
  };
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("account");
  const [mqttConnected, setMqttConnected] = useState(mqttClient.getConnectionStatus());

  // Récupérer l'état du broker MQTT
  const { data: mqttStatus } = useQuery({
    queryKey: ['/api/mqtt/status'],
    refetchInterval: 30000
  });

  // Schéma de validation pour le changement de mot de passe
  const passwordSchema = z.object({
    currentPassword: z.string().min(1, "Le mot de passe actuel est requis"),
    newPassword: z.string().min(6, "Le nouveau mot de passe doit contenir au moins 6 caractères"),
    confirmPassword: z.string().min(1, "Veuillez confirmer votre nouveau mot de passe"),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

  // Schéma de validation pour le profil utilisateur
  const profileSchema = z.object({
    username: z.string().min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères"),
    email: z.string().email("L'email doit être valide"),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  });

  // Formulaire pour le changement de mot de passe
  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Formulaire pour le profil utilisateur
  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
    },
  });

  // Mettre à jour les valeurs du formulaire de profil lorsque l'utilisateur change
  useState(() => {
    if (user) {
      profileForm.reset({
        username: user.username,
        email: user.email || "",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
      });
    }
  });

  // Soumission du formulaire de changement de mot de passe
  const onPasswordSubmit = async (values: z.infer<typeof passwordSchema>) => {
    try {
      // Cette fonctionnalité nécessiterait un endpoint API supplémentaire
      // Pour l'instant, affichons simplement une notification de succès factice
      toast({
        title: "Mot de passe mis à jour",
        description: "Votre mot de passe a été modifié avec succès",
      });
      passwordForm.reset();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le mot de passe",
        variant: "destructive",
      });
    }
  };

  // Soumission du formulaire de profil
  const onProfileSubmit = async (values: z.infer<typeof profileSchema>) => {
    try {
      // Cette fonctionnalité nécessiterait un endpoint API supplémentaire
      // Pour l'instant, affichons simplement une notification de succès factice
      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été mises à jour avec succès",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le profil",
        variant: "destructive",
      });
    }
  };

  // Connecter ou déconnecter le client MQTT
  const handleMqttConnection = () => {
    if (mqttConnected) {
      mqttClient.disconnect();
      setMqttConnected(false);
      toast({
        title: "MQTT déconnecté",
        description: "La connexion au broker MQTT a été fermée",
      });
    } else {
      const success = mqttClient.connect();
      setMqttConnected(success);
      
      if (success) {
        mqttClient.subscribe(mqttStatus?.activeTopic || "patient/esp32-c40a24/data");
        toast({
          title: "MQTT connecté",
          description: "Connexion au broker MQTT établie avec succès",
        });
      } else {
        toast({
          title: "Erreur de connexion",
          description: "Impossible de se connecter au broker MQTT",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-neutral-darkest">Paramètres</h1>
          <p className="text-neutral-dark">Gérez votre compte et les paramètres de l'application</p>
        </div>
        
        {/* Onglets de paramètres */}
        <Tabs defaultValue="account" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="account">Compte</TabsTrigger>
            <TabsTrigger value="connection">Connexion</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="about">À propos</TabsTrigger>
          </TabsList>
          
          {/* Paramètres du compte */}
          <TabsContent value="account" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profil */}
              <Card>
                <CardHeader>
                  <CardTitle>Profil</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                      <FormField
                        control={profileForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom d'utilisateur</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={profileForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={profileForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prénom</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={profileForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nom</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="flex justify-end">
                        <Button type="submit">Enregistrer</Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
              
              {/* Mot de passe */}
              <Card>
                <CardHeader>
                  <CardTitle>Changer le Mot de Passe</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                      <FormField
                        control={passwordForm.control}
                        name="currentPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mot de passe actuel</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nouveau mot de passe</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmer le mot de passe</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex justify-end">
                        <Button type="submit">Changer le Mot de Passe</Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
              
              {/* Actions du compte */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Actions du Compte</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                    <div>
                      <h3 className="font-medium">Se déconnecter de tous les appareils</h3>
                      <p className="text-neutral-dark text-sm mt-1">
                        Cela vous déconnectera de tous les appareils où vous êtes actuellement connecté.
                      </p>
                    </div>
                    <Button className="mt-3 sm:mt-0" variant="outline">
                      Se déconnecter partout
                    </Button>
                  </div>
                  
                  <div className="border-t border-neutral-light my-4"></div>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                    <div>
                      <h3 className="font-medium text-danger">Supprimer le compte</h3>
                      <p className="text-neutral-dark text-sm mt-1">
                        Cette action est irréversible et supprimera définitivement toutes vos données.
                      </p>
                    </div>
                    <Button className="mt-3 sm:mt-0" variant="destructive">
                      Supprimer le compte
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Paramètres de connexion */}
          <TabsContent value="connection" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Statut MQTT */}
              <MqttStatus />
              
              {/* Paramètres MQTT */}
              <Card>
                <CardHeader>
                  <CardTitle>Paramètres MQTT</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <FormLabel>Broker URL</FormLabel>
                      <Input 
                        value={mqttStatus?.broker || "broker.hivemq.com"} 
                        readOnly 
                      />
                      <p className="text-sm text-neutral-dark mt-1">
                        Défini par l'administrateur système
                      </p>
                    </div>
                    
                    <div>
                      <FormLabel>Topic par défaut</FormLabel>
                      <Input 
                        value={mqttStatus?.activeTopic || "patient/esp32-c40a24/data"} 
                        readOnly 
                      />
                      <p className="text-sm text-neutral-dark mt-1">
                        Topic utilisé pour la récupération des données
                      </p>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">État de la connexion</h3>
                        <p className="text-sm text-neutral-dark">
                          {mqttConnected ? "Connecté au broker MQTT" : "Déconnecté du broker MQTT"}
                        </p>
                      </div>
                      <Button onClick={handleMqttConnection}>
                        {mqttConnected ? "Déconnecter" : "Connecter"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Options de stockage */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Options de Stockage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">Durée de rétention des données</h3>
                        <p className="text-sm text-neutral-dark mt-1">
                          Période pendant laquelle les données des capteurs sont conservées
                        </p>
                      </div>
                      <select
                        className="px-3 py-2 border border-neutral-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="7d">7 jours</option>
                        <option value="30d">30 jours</option>
                        <option value="90d">90 jours</option>
                        <option value="365d">1 an</option>
                      </select>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">Fréquence d'échantillonnage</h3>
                        <p className="text-sm text-neutral-dark mt-1">
                          Intervalle entre les mesures des capteurs
                        </p>
                      </div>
                      <select
                        className="px-3 py-2 border border-neutral-light rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="10s">10 secondes</option>
                        <option value="30s">30 secondes</option>
                        <option value="1m">1 minute</option>
                        <option value="5m">5 minutes</option>
                      </select>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">Compression des données</h3>
                        <p className="text-sm text-neutral-dark mt-1">
                          Réduire la taille des données stockées
                        </p>
                      </div>
                      <Switch />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Paramètres de notifications */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Préférences de Notifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">Notifications d'alerte</h3>
                      <p className="text-sm text-neutral-dark mt-1">
                        Recevoir des notifications pour les alertes critiques
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">Notifications de dispositif</h3>
                      <p className="text-sm text-neutral-dark mt-1">
                        Recevoir des notifications pour les changements d'état des dispositifs
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">Notifications par email</h3>
                      <p className="text-sm text-neutral-dark mt-1">
                        Recevoir des alertes par email
                      </p>
                    </div>
                    <Switch />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">Résumé quotidien</h3>
                      <p className="text-sm text-neutral-dark mt-1">
                        Recevoir un résumé quotidien des données des capteurs
                      </p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* À propos */}
          <TabsContent value="about" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>À propos de SensMed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium">Version</h3>
                    <p className="text-neutral-dark mt-1">1.0.0</p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium">Description</h3>
                    <p className="text-neutral-dark mt-1">
                      SensMed est une plateforme de monitoring qui permet de suivre en temps réel les données des capteurs médicaux installés sur des matelas pour patients atteints de maladie rénale chronique. 
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium">Technologies</h3>
                    <ul className="list-disc list-inside text-neutral-dark mt-1 ml-2">
                      <li>Frontend: React, Tailwind CSS</li>
                      <li>Backend: Node.js, Express</li>
                      <li>Communication: MQTT (broker.hivemq.com)</li>
                      <li>Stockage: InfluxDB</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="font-medium">Support</h3>
                    <p className="text-neutral-dark mt-1">
                      Pour toute assistance technique, veuillez contacter notre équipe de support à l'adresse <a href="mailto:support@sensmed.fr" className="text-primary hover:underline">support@sensmed.fr</a>.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
