import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useGameState } from '@/hooks/use-game-state';
import RulesModal from '@/components/rules-modal';
import { useToast } from '@/hooks/use-toast';
import { ConnectionStatus } from '@/components/connection-status';

const HomePage: React.FC = () => {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('initializing');
  const { toast } = useToast();
  const { createGame, joinGame, connected, isConnecting } = useGameState();
  
  // Log connection status changes
  useEffect(() => {
    console.log(`[HomePage] Socket connection status: ${connected ? 'connected' : 'disconnected'}, isConnecting: ${isConnecting}`);
    setConnectionStatus(connected ? 'connected' : (isConnecting ? 'connecting' : 'disconnected'));
    
    // Add visual indicator for connection status
    if (connected) {
      toast({
        title: 'Connected to Server',
        description: 'Your connection is established. You can now create or join games.',
        variant: 'default',
      });
    }
  }, [connected, isConnecting, toast]);
  
  const handleCreateGame = () => {
    createGame(playerName);
  };
  
  const handleJoinGame = () => {
    joinGame(roomCode, playerName);
  };
  
  const isJoinDisabled = !roomCode || !playerName || !connected || isConnecting;
  const isCreateDisabled = !playerName || !connected || isConnecting;

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-heading font-bold text-primary">QRAMO (Questionable Retroactive Anxious Moral Offerings)</h1>
            <p className="mt-2 text-gray-600">A storytelling card game with bizarre twists</p>
            
            {/* Connection status indicator */}
            <div className="mt-2">
              <ConnectionStatus variant="indicator" />
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-gray-700 font-medium">Your Name</label>
              <Input
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={15}
              />
            </div>
            
            <Button 
              className="w-full"
              onClick={handleCreateGame}
              disabled={isCreateDisabled}
            >
              {isConnecting ? 'Connecting...' : 'Create New Game'}
            </Button>
            
            <div className="relative">
              <div className="text-center text-sm font-medium text-gray-500 py-2">
                or
              </div>
              
              <div className="space-y-4">
                <label className="text-gray-700 font-medium">Join Existing Game</label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Enter room code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                  <Button 
                    onClick={handleJoinGame}
                    disabled={isJoinDisabled}
                  >
                    Join
                  </Button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <button 
              onClick={() => setRulesOpen(true)}
              className="text-primary underline text-sm"
            >
              How to Play
            </button>
          </div>
        </CardContent>
      </Card>
      
      <RulesModal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
      />
    </div>
  );
};

export default HomePage;
