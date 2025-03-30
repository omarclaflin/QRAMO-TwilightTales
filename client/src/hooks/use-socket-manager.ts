import { useState, useEffect, useCallback } from 'react';
import socketManager from '@/lib/socketManager';
import { useToast } from '@/hooks/use-toast';
import { Game, Player } from '@shared/schema';

// Types imported from our previous socket hook
export type SocketResponse = {
  success: boolean;
  error?: string;
  gameId?: string;
  playerId?: string;
  [key: string]: any;
};

export enum MessageType {
  JOIN_GAME = 'joinGame',
  CREATE_GAME = 'createGame',
  START_GAME = 'startGame',
  SELECT_CARD = 'selectCard',
  UPDATE_CUSTOM_CARD = 'updateCustomCard',
  SUBMIT_MORAL = 'submitMoral',
  CAST_VOTE = 'castVote',
  NEXT_ROUND = 'nextRound',
  LEAVE_GAME = 'leaveGame',
  GAME_STATE = 'gameState',
  ERROR = 'error',
  MESSAGE = 'message'
}

/**
 * Custom hook for using the socket manager in components
 * This provides a stable socket connection that persists across component lifecycles
 */

export function useSocketManager() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [gameState, setGameState] = useState<Game | null>(null);
  
  // State to track only the current player's temporary card selection
  // Using a simple state instead of a map since we only care about the current player
  const [temporaryCardSelection, setTemporaryCardSelection] = useState<number | null>(null);
  
  const { toast } = useToast();
  
  // Show appropriate toasts when connection status changes
  useEffect(() => {
    console.log('[useSocketManager] Setting up connection state listener');
    
    const unsubscribe = socketManager.onConnectionStateChange((state) => {
      console.log(`[useSocketManager] Connection state changed to: ${state}`);
      
      if (state === 'connected') {
        setConnected(true);
        setConnecting(false);
        
        toast({
          title: 'Connected',
          description: 'Connected to the game server',
          variant: 'default',
        });
      } else if (state === 'connecting') {
        setConnected(false);
        setConnecting(true);
      } else {
        setConnected(false);
        setConnecting(false);
        
        // Don't show disconnection toast if we were never connected
        if (connected) {
          toast({
            title: 'Disconnected',
            description: 'Lost connection to the game server',
            variant: 'destructive',
          });
        }
      }
    });
    
    return () => {
      console.log('[useSocketManager] Cleaning up connection state listener');
      unsubscribe();
    };
  }, [connected, toast]);
  
  // Listen for game state updates
  useEffect(() => {
    console.log('[useSocketManager] Setting up game state listener');
    
    const unsubscribe = socketManager.onGameStateChange((game) => {
      // First detect if there's a round status change
      const previousRoundStatus = gameState?.round?.status;
      const previousRoundNumber = gameState?.round?.number;
      const newRoundStatus = game?.round?.status;
      const newRoundNumber = game?.round?.number;
      
      const statusChanged = previousRoundStatus !== newRoundStatus;
      const roundChanged = previousRoundNumber !== newRoundNumber;
      
      console.log('[useSocketManager] Game state updated:', {
        roundStatus: newRoundStatus,
        roundNumber: newRoundNumber,
        previousStatus: previousRoundStatus,
        previousRound: previousRoundNumber,
        statusChanged,
        roundChanged,
        playersCount: game?.players?.length || 0,
        submissionsCount: game?.round?.submissions?.length || 0,
        temporaryCardSelection,
        playerData: socketManager.playerData
      });
      
      if (statusChanged || roundChanged) {
        console.log('[useSocketManager] *** PHASE TRANSITION DETECTED ***', {
          transition: `${previousRoundStatus || 'none'} -> ${newRoundStatus || 'none'}`,
          roundChange: roundChanged ? `Round ${previousRoundNumber || 0} -> ${newRoundNumber || 0}` : 'No round change',
          detailedSubmissions: game?.round?.submissions?.map(s => ({
            playerId: s.playerId,
            cardId: s.cardId,
            hasMoral: !!s.moral,
            votes: Array.isArray(s.votes) ? s.votes.length : s.votes || 0
          }))
        });
      }
      
      if (game) {
        // Handle temporary card selection only during card selection phase
        if (game.round.status === 'cardSelection') {
          // Get the current player ID
          const currentPlayerId = socketManager.playerData?.playerId;
          
          if (currentPlayerId) {
            // Find the current player in the server game state
            const myPlayer = game.players.find((p: Player) => p.id === currentPlayerId);
            
            if (myPlayer) {
              // Make a copy of the game state for potential local modifications
              const preservedGame = JSON.parse(JSON.stringify(game));
              
              // Only keep our temporary selection if:
              // 1. We have a local selection, AND
              // 2. Server hasn't recorded our selection yet
              if (temporaryCardSelection !== null && myPlayer.selectedCard === null) {
                console.log(`[useSocketManager] Preserving temporary card selection: ${temporaryCardSelection}`);
                
                // Find and update current player in the preserved game
                const playerIndex = preservedGame.players.findIndex((p: Player) => p.id === currentPlayerId);
                if (playerIndex !== -1) {
                  preservedGame.players[playerIndex] = {
                    ...preservedGame.players[playerIndex],
                    selectedCard: temporaryCardSelection
                  };
                  
                  // Use the preserved game state with our local selection
                  setGameState(preservedGame);
                  return; // Skip the normal setGameState below
                }
              } else if (myPlayer.selectedCard !== null && temporaryCardSelection !== null) {
                // Server has acknowledged our selection, clear temporary state
                console.log('[useSocketManager] Server has confirmed our card selection, clearing temporary selection');
                setTemporaryCardSelection(null);
              }
            }
          }
        } else if (game.round.status !== 'cardSelection' && temporaryCardSelection !== null) {
          // If we're not in card selection phase anymore, clear temporary selection
          console.log('[useSocketManager] Not in card selection phase, clearing temporary selection');
          setTemporaryCardSelection(null);
        }
        
        // Log specific information for voting phase
        if (game.round.status === 'voting') {
          console.log('[useSocketManager] Voting phase details:', {
            roundNumber: game.round.number,
            submissions: game.round.submissions.map(s => ({
              playerId: s.playerId,
              hasMoral: !!s.moral,
              moralExcerpt: s.moral ? `${s.moral.substring(0, 20)}...` : null, 
              votes: Array.isArray(s.votes) ? s.votes : (typeof s.votes === 'number' ? s.votes : 0)
            }))
          });
        }
        
        // Normal update if no preservation was needed
        setGameState(game);
      }
    });
    
    return () => {
      console.log('[useSocketManager] Cleaning up game state listener');
      unsubscribe();
    };
  }, [temporaryCardSelection]);
  
  // Initialize connection if not already connecting/connected
  useEffect(() => {
    console.log('[useSocketManager] Component mounted, ensuring connection');
    
    // Get the socket to trigger a connection if needed
    socketManager.getSocket().catch(error => {
      console.error('[useSocketManager] Initial connection error:', error);
    });
    
    return () => {
      // Don't disconnect on unmount - that's the key difference from before
      console.log('[useSocketManager] Component unmounting, but keeping socket connection');
    };
  }, []);
  
  // ---- Game Actions ----
  
  /**
   * Create a new game
   */
  const createGame = useCallback(async (playerName: string): Promise<SocketResponse> => {
    try {
      console.log(`[useSocketManager] Creating game with player name: ${playerName}`);
      const response = await socketManager.emit<SocketResponse>(MessageType.CREATE_GAME, { playerName });
      
      console.log('[useSocketManager] Create game response:', response);
      
      // Store player data from response
      if (response.success && response.gameId && response.playerId) {
        console.log(`[useSocketManager] Storing player data: playerId=${response.playerId}, gameId=${response.gameId}`);
        socketManager.playerData = {
          playerId: response.playerId,
          gameId: response.gameId
        };
      }
      
      return response;
    } catch (error) {
      console.error('[useSocketManager] Error creating game:', error);
      
      toast({
        title: 'Error Creating Game',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      
      throw error;
    }
  }, [toast]);
  
  /**
   * Join an existing game
   */
  const joinGame = useCallback(async (gameId: string, playerName: string): Promise<SocketResponse> => {
    try {
      console.log(`[useSocketManager] Joining game ${gameId} with player name: ${playerName}`);
      const response = await socketManager.emit<SocketResponse>(MessageType.JOIN_GAME, { gameId, playerName });
      
      console.log('[useSocketManager] Join game response:', response);
      
      // Store player data from response
      if (response.success && response.gameId && response.playerId) {
        console.log(`[useSocketManager] Storing player data: playerId=${response.playerId}, gameId=${response.gameId}`);
        socketManager.playerData = {
          playerId: response.playerId,
          gameId: response.gameId
        };
      }
      
      return response;
    } catch (error) {
      console.error('[useSocketManager] Error joining game:', error);
      
      toast({
        title: 'Error Joining Game',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      
      throw error;
    }
  }, [toast]);
  
  /**
   * Start a game (host only)
   */
  const startGame = useCallback(async (gameId: string): Promise<SocketResponse> => {
    try {
      console.log(`[useSocketManager] Starting game: ${gameId}`);
      const response = await socketManager.emit<SocketResponse>(MessageType.START_GAME, { gameId });
      
      console.log('[useSocketManager] Start game response:', response);
      return response;
    } catch (error) {
      console.error('[useSocketManager] Error starting game:', error);
      
      toast({
        title: 'Error Starting Game',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      
      throw error;
    }
  }, [toast]);
  
  /**
   * Temporarily select a card during the card selection phase (client-side only)
   * This function is used to highlight a card in the UI without actually submitting it to the server
   * User must call confirmCardSelection to commit their selection to the server
   * 
   * @param gameId - ID of the game
   * @param cardId - ID of the selected card
   * @param customText - Optional custom text for custom cards
   */
  const selectCard = useCallback(async (
    gameId: string, 
    cardId: number, 
    customText?: string
  ): Promise<SocketResponse> => {
    try {
      console.log(`[useSocketManager] Temporarily selecting card ${cardId} in game ${gameId}${customText ? ' with custom text' : ''} (UI only)`);
      
      // Store the selection in our local state
      setTemporaryCardSelection(cardId);
      
      // Update the UI immediately if possible
      if (socketManager.gameState && socketManager.gameState.gameId === gameId) {
        const updatedState = { ...socketManager.gameState };
        
        // Find the current player in the game state
        const currentPlayerId = socketManager.playerData?.playerId;
        if (currentPlayerId) {
          const playerIndex = updatedState.players.findIndex((p: Player) => p.id === currentPlayerId);
          
          if (playerIndex >= 0) {
            console.log(`[useSocketManager] Updating local game state for player ${currentPlayerId}, setting selectedCard to ${cardId}`);
            
            // Update the player's selected card in our modified game state
            updatedState.players[playerIndex] = {
              ...updatedState.players[playerIndex],
              selectedCard: cardId
            };
            
            // Notify game state subscribers with our updated state
            // This will trigger our game state listener which will preserve our selection
            socketManager.updateGameState(updatedState);
          }
        }
      }
      
      // Return success - the card is selected in the UI only at this point
      return { success: true, cardId };
    } catch (error) {
      console.error('[useSocketManager] Error in temporary card selection:', error);
      return { success: false, error: 'Error selecting card' };
    }
  }, [setTemporaryCardSelection]);
  
  /**
   * Confirm card selection and send it to the server
   * This should be called when the user clicks the "Confirm Selection" button
   * 
   * @param gameId - ID of the game
   * @param cardId - ID of the selected card
   * @param customText - Optional custom text for custom cards
   */
  const confirmCardSelection = useCallback(async (
    gameId: string, 
    cardId: number, 
    customText?: string
  ): Promise<SocketResponse> => {
    try {
      console.log(`[useSocketManager] CONFIRMING card selection ${cardId} in game ${gameId}${customText ? ' with custom text' : ''}`);
      const response = await socketManager.emit<SocketResponse>(
        MessageType.SELECT_CARD, 
        { gameId, cardId, customText }
      );
      
      // Server accepted our selection, clear the temporary selection
      if (response.success) {
        console.log('[useSocketManager] Selection confirmed by server, clearing temporary selection');
        
        // No need to check playerId here, just clear our temporary selection
        setTemporaryCardSelection(null);
      }
      
      console.log('[useSocketManager] Confirm card selection response:', response);
      return response;
    } catch (error) {
      console.error('[useSocketManager] Error confirming card selection:', error);
      
      toast({
        title: 'Error Confirming Card',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      
      throw error;
    }
  }, [toast, setTemporaryCardSelection]);
  
  /**
   * Submit a moral for the story
   */
  const submitMoral = useCallback(async (gameId: string, moral: string): Promise<SocketResponse> => {
    try {
      console.log(`[useSocketManager] Submitting moral for game ${gameId}`);
      const response = await socketManager.emit<SocketResponse>(MessageType.SUBMIT_MORAL, { gameId, moral });
      
      console.log('[useSocketManager] Submit moral response:', response);
      return response;
    } catch (error) {
      console.error('[useSocketManager] Error submitting moral:', error);
      
      toast({
        title: 'Error Submitting Moral',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      
      throw error;
    }
  }, [toast]);
  
  /**
   * Cast a vote for another player's moral
   */
  const castVote = useCallback(async (gameId: string, votedForId: string): Promise<SocketResponse> => {
    try {
      console.log(`[useSocketManager] Casting vote for player ${votedForId} in game ${gameId}`);
      const response = await socketManager.emit<SocketResponse>(MessageType.CAST_VOTE, { gameId, votedForId });
      
      console.log('[useSocketManager] Cast vote response:', response);
      return response;
    } catch (error) {
      console.error('[useSocketManager] Error casting vote:', error);
      
      toast({
        title: 'Error Casting Vote',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      
      throw error;
    }
  }, [toast]);
  
  /**
   * Move to the next round of the game
   */
  const nextRound = useCallback(async (gameId: string): Promise<SocketResponse> => {
    try {
      console.log(`[useSocketManager] Starting next round for game ${gameId}`);
      const response = await socketManager.emit<SocketResponse>(MessageType.NEXT_ROUND, { gameId });
      
      console.log('[useSocketManager] Next round response:', response);
      return response;
    } catch (error) {
      console.error('[useSocketManager] Error starting next round:', error);
      
      toast({
        title: 'Error Starting Next Round',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      
      throw error;
    }
  }, [toast]);
  
  /**
   * Leave the current game
   */
  const leaveGame = useCallback(async (gameId: string): Promise<SocketResponse> => {
    try {
      console.log(`[useSocketManager] Leaving game ${gameId}`);
      const response = await socketManager.emit<SocketResponse>(MessageType.LEAVE_GAME, { gameId });
      
      console.log('[useSocketManager] Leave game response:', response);
      return response;
    } catch (error) {
      console.error('[useSocketManager] Error leaving game:', error);
      
      toast({
        title: 'Error Leaving Game',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      
      throw error;
    }
  }, [toast]);
  
  // Manual connection management (usually not needed)
  const connect = useCallback(() => {
    socketManager.getSocket().catch(error => {
      console.error('[useSocketManager] Connection error:', error);
    });
  }, []);
  
  const disconnect = useCallback(() => {
    socketManager.disconnect();
  }, []);
  
  /**
   * Update a custom card's text
   */
  const updateCustomCard = useCallback(async (gameId: string, cardId: number, customText: string): Promise<SocketResponse> => {
    try {
      console.log(`[useSocketManager] Updating custom card ${cardId} in game ${gameId}`);
      const response = await socketManager.emit<SocketResponse>(MessageType.UPDATE_CUSTOM_CARD, { 
        gameId, 
        cardId, 
        customText 
      });
      
      console.log('[useSocketManager] Update custom card response:', response);
      return response;
    } catch (error) {
      console.error('[useSocketManager] Error updating custom card:', error);
      
      toast({
        title: 'Error Updating Custom Card',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      
      throw error;
    }
  }, [toast]);

  return {
    connected,
    connecting,
    gameState,
    temporaryCardSelection, // Current player's temporary card selection
    createGame,
    joinGame,
    startGame,
    selectCard,
    confirmCardSelection, // Function to actually submit the card
    updateCustomCard,
    submitMoral,
    castVote,
    nextRound,
    leaveGame,
    connect,
    disconnect
  };
}