import { Button } from "@/components/ui/button";
// Désactiver temporairement l'utilisation du hook useAuth
// import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Menu } from "lucide-react";
import { useState } from "react";

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  // Simuler un utilisateur pour le développement au lieu d'utiliser useAuth
  const user = { firstName: 'Dev', lastName: 'User', username: 'devuser' };
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const handleLogout = () => {
    // Simulation de déconnexion
    console.log('Simulation: Déconnexion utilisateur');
    // Si nous utilisions vraiment useAuth:
    // logoutMutation.mutate();
  };
  
  return (
    <header className="bg-white border-b border-neutral-light">
      <div className="flex justify-between items-center px-4 py-2">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onToggleSidebar}>
            <Menu className="h-5 w-5 text-neutral-dark" />
          </Button>
          <h1 className="text-xl font-semibold text-primary">SensMed</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center">
            <span className="text-sm mr-2">
              <i className="fas fa-signal-bars text-success-dark"></i> Connecté
            </span>
            <div className="live-indicator w-2 h-2 rounded-full bg-success-light"></div>
          </div>
          
          <div className="relative">
            <Button 
              variant="ghost" 
              className="flex items-center space-x-2 text-neutral-darkest hover:text-primary"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <span className="hidden md:inline-block">
                {user ? `${user.firstName || ''} ${user.lastName || user.username}` : 'Utilisateur'}
              </span>
              <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center">
                {user?.firstName ? user.firstName[0].toUpperCase() : 'U'}
              </div>
            </Button>
            
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-neutral-light z-10">
                <div className="py-1">
                  <Link href="/settings" className="block px-4 py-2 text-sm text-neutral-darkest hover:bg-neutral-lightest">
                    Paramètres
                  </Link>
                  <button 
                    className="block w-full text-left px-4 py-2 text-sm text-neutral-darkest hover:bg-neutral-lightest"
                    onClick={handleLogout}
                  >
                    Déconnexion
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
