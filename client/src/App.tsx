import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ConnectionStatus } from "@/components/connection-status";
import { RulesModal } from "@/components/rules-modal";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import LobbyPage from "@/pages/lobby";
import GamePage from "@/pages/game";
import { useState } from "react";

// Simple navbar component
const Navbar = () => {
  const [rulesOpen, setRulesOpen] = useState(false);
  
  const handleExitGame = () => {
    // Clear session storage and redirect to home
    sessionStorage.removeItem('gameId');
    sessionStorage.removeItem('playerId');
    window.location.href = '/';
  };
  
  return (
    <>
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-primary font-heading font-bold text-xl">QRAMO (Questionable Retroactive Ambiguous Moral Offerings)</span>
              <div className="ml-4">
                <ConnectionStatus variant="indicator" />
              </div>
            </div>
            <div className="flex items-center">
              <a 
                href="/"
                className="text-gray-600 hover:text-primary px-3 py-2 rounded-md text-sm font-medium"
              >
                Home
              </a>
              <button 
                className="ml-4 text-gray-600 hover:text-primary px-3 py-2 rounded-md text-sm font-medium"
                onClick={() => setRulesOpen(true)}
              >
                Rules
              </button>
              <button 
                className="ml-4 text-gray-600 hover:text-primary px-3 py-2 rounded-md text-sm font-medium"
                onClick={handleExitGame}
              >
                Exit Game
              </button>
            </div>
          </div>
        </div>
      </nav>
      <RulesModal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
      />
    </>
  );
};

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/lobby/:gameId" component={LobbyPage} />
      <Route path="/game/:gameId" component={GamePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-grow container mx-auto py-8">
          <Router />
        </main>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
