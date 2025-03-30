import React, { useEffect } from 'react';
import { useParams } from 'wouter';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGameState } from '@/hooks/use-game-state';
import { PlayerList } from '@/components/player-list';
import { useToast } from '@/hooks/use-toast';
import RulesModal from '@/components/rules-modal';

const LobbyPage: React.FC = () => {
  const { gameId } = useParams();
  const { toast } = useToast();
  const [rulesOpen, setRulesOpen] = React.useState(false);
  const { 
    gameState, 
    playerId, 
    currentPlayer,
    startGame
  } = useGameState();
  
  // Check if the game exists
  useEffect(() => {
    if (!gameState && gameId) {
      toast({
        title: 'Game Not Found',
        description: 'The game you are trying to join does not exist.',
        variant: 'destructive',
      });
    }
  }, [gameState, gameId, toast]);
  
  // Redirect if game has already started
  useEffect(() => {
    if (gameState && gameState.status !== 'lobby') {
      // The useGameState hook will handle redirection
    }
  }, [gameState]);
  
  const isHost = currentPlayer?.isHost;
  const playerCount = gameState?.players.length || 0;
  
  // Handle starting the game
  const handleStartGame = () => {
    if (gameState && playerId) {
      startGame();
    }
  };
  
  if (!gameState) {
    return (
      <div className="h-[80vh] flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p>Loading game...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <Card>
        <CardHeader className="border-b flex-row justify-between items-center p-4">
          <h2 className="text-2xl font-heading font-bold text-gray-900">Game Lobby</h2>
          <div>
            <span className="text-gray-600 mr-2">Room Code:</span>
            <span className="font-mono bg-gray-100 px-3 py-1 rounded text-primary font-bold">
              {gameState.gameId}
            </span>
          </div>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Players</h3>
            <PlayerList 
              players={gameState.players}
              currentPlayerId={playerId}
              maxPlayers={gameState.settings.maxPlayers}
              mode="lobby"
            />
          </div>
          
          <div className="flex justify-between">
            <div>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Note:</span> Empty slots will be filled with AI players
              </p>
            </div>
            {isHost && (
              <Button 
                onClick={handleStartGame}
                disabled={playerCount < 1}
              >
                Start Game
              </Button>
            )}
            {!isHost && (
              <div className="text-sm text-gray-600">
                Waiting for the host to start the game...
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-4 text-center">
        <button 
          onClick={() => setRulesOpen(true)}
          className="text-primary underline text-sm"
        >
          Game Rules
        </button>
      </div>
      
      <RulesModal 
        open={rulesOpen} 
        onClose={() => setRulesOpen(false)}
      />
    </div>
  );
};

export default LobbyPage;
