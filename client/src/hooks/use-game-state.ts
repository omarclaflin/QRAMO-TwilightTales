import { useState, useCallback, useEffect } from 'react';
// Use our singleton socket manager
import { useSocketManager } from './use-socket-manager';
import { useLocation } from 'wouter';
import { Game } from '@shared/schema';

interface UseGameStateProps {
  initialState?: Game | null;
}

/**
 * Main hook for managing game state and player interactions
 * @param props - Optional properties
 * @returns Game state and methods for interacting with the game
 */
export const useGameState = (props?: UseGameStateProps) => {
  const [gameState, setGameState] = useState<Game | null>(props?.initialState || null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [, setLocation] = useLocation();

  // Get game and player from session storage on mount
  useEffect(() => {
    const storedPlayerId = sessionStorage.getItem('playerId');
    const storedPlayerName = sessionStorage.getItem('playerName');
    const storedGameId = sessionStorage.getItem('gameId');
    
    if (storedPlayerId) setPlayerId(storedPlayerId);
    if (storedPlayerName) setPlayerName(storedPlayerName);
    
    // If we have a gameId but no game state, we might want to rejoin
    if (storedGameId && !gameState) {
      console.log(`Found stored gameId: ${storedGameId}`);
      // For now, we're not implementing rejoin functionality
    }
  }, [gameState]);

  // Setup socket connection with game state handling
  const {
    connected,
    connecting: isConnecting,
    gameState: socketGameState,
    createGame: socketCreateGame,
    joinGame: socketJoinGame,
    startGame: socketStartGame,
    selectCard: socketSelectCard,
    confirmCardSelection: socketConfirmCardSelection,
    updateCustomCard: socketUpdateCustomCard, // Add the update custom card method
    submitMoral: socketSubmitMoral,
    judgePick: socketJudgePick,
    nextRound: socketNextRound,
    leaveGame: socketLeaveGame,
    sendChatMessage: socketSendChatMessage
  } = useSocketManager();
  
  // Update game state when it changes in the socket manager
  useEffect(() => {
    if (socketGameState) {
      setGameState(socketGameState);
    }
  }, [socketGameState]);

  // Get the current player from the game state
  const currentPlayer = gameState && playerId 
    ? gameState.players.find(p => p.id === playerId) 
    : null;

  /**
   * Create a new game as host
   * @param name - Player name
   */
  const createGame = useCallback(async (name: string) => {
    if (!name.trim()) return;
    
    try {
      setPlayerName(name);
      sessionStorage.setItem('playerName', name);
      
      const response = await socketCreateGame(name);
      
      if (response.success) {
        // Save player info and game ID
        setPlayerId(response.playerId!);
        sessionStorage.setItem('playerId', response.playerId!);
        sessionStorage.setItem('gameId', response.gameId!);
        setLocation(`/lobby/${response.gameId}`);
      }
    } catch (error) {
      console.error('Error creating game:', error);
    }
  }, [socketCreateGame, setLocation]);

  /**
   * Join an existing game
   * @param gameId - ID of the game to join
   * @param name - Player name
   */
  const joinGame = useCallback(async (gameId: string, name: string) => {
    if (!gameId.trim() || !name.trim()) return;
    
    try {
      setPlayerName(name);
      sessionStorage.setItem('playerName', name);
      
      const response = await socketJoinGame(gameId, name);
      
      if (response.success) {
        // Save player info and game ID
        setPlayerId(response.playerId!);
        sessionStorage.setItem('playerId', response.playerId!);
        sessionStorage.setItem('gameId', response.gameId!);
        setLocation(`/lobby/${gameId}`);
      }
    } catch (error) {
      console.error('Error joining game:', error);
    }
  }, [socketJoinGame, setLocation]);

  /**
   * Start the game (host only)
   */
  const startGame = useCallback(async () => {
    if (!gameState) return;
    
    try {
      await socketStartGame(gameState.gameId);
    } catch (error) {
      console.error('Error starting game:', error);
    }
  }, [gameState, socketStartGame]);

  /**
   * Select a card during the selection phase
   * @param cardId - ID of the selected card
   */
  const selectCard = useCallback(async (cardId: number) => {
    if (!gameState) return;
    
    try {
      console.log(`[useGameState] Selecting card ${cardId} in game ${gameState.gameId} (temporary UI update)`);
      // This just updates the UI state without sending to the server yet
      await socketSelectCard(gameState.gameId, cardId);
      
      // Log the current player state after selection
      const updatedPlayer = gameState.players.find(p => p.id === playerId);
      console.log('[useGameState] Current player after selection:', updatedPlayer);
    } catch (error) {
      console.error('[useGameState] Error selecting card:', error);
    }
  }, [gameState, socketSelectCard, playerId]);

  /**
   * Submit a moral for the story
   * @param moral - The moral text
   */
  const submitMoral = useCallback(async (moral: string) => {
    if (!gameState) return;
    
    if (!moral.trim()) return;
    
    try {
      await socketSubmitMoral(gameState.gameId, moral);
    } catch (error) {
      console.error('Error submitting moral:', error);
    }
  }, [gameState, socketSubmitMoral]);

  /**
   * Judge picks the winning moral
   * @param winnerId - ID of the winning player
   * @param reason - Judge's reason for picking this moral
   */
  const judgePick = useCallback(async (winnerId: string, reason: string) => {
    if (!gameState || !playerId) return;
    
    try {
      await socketJudgePick(gameState.gameId, winnerId, reason);
    } catch (error) {
      console.error('Error in judge pick:', error);
    }
  }, [gameState, playerId, socketJudgePick]);

  /**
   * Start the next round of the game
   */
  const nextRound = useCallback(async () => {
    if (!gameState) return;
    
    try {
      console.log(`[useGameState] Starting next round for game ${gameState.gameId}`);
      // Clear any temporary card selections when starting a new round
      await socketNextRound(gameState.gameId);
    } catch (error) {
      console.error('[useGameState] Error starting next round:', error);
    }
  }, [gameState, socketNextRound]);

  /**
   * Leave the current game
   */
  const leaveGame = useCallback(async () => {
    if (!gameState) return;
    
    try {
      await socketLeaveGame(gameState.gameId);
      setGameState(null);
      sessionStorage.removeItem('gameId');
      setLocation('/');
    } catch (error) {
      console.error('Error leaving game:', error);
    }
  }, [gameState, socketLeaveGame, setLocation]);

  // Update location based on game state
  useEffect(() => {
    if (!gameState) return;
    
    const { gameId, status } = gameState;
    
    if (status === 'lobby') {
      setLocation(`/lobby/${gameId}`);
    } else if (status === 'active' || status === 'completed') {
      setLocation(`/game/${gameId}`);
    }
  }, [gameState, setLocation]);

  /**
   * Confirm and submit a selected card to the server
   * This should be called after the user clicks the Confirm button
   * @param cardId - ID of the selected card to confirm
   * @param customText - Optional custom text for custom cards
   */
  const confirmCardSelection = useCallback(async (cardId: number, customText?: string) => {
    if (!gameState) return;
    
    try {
      console.log(`[useGameState] Confirming card selection: ${cardId} in game ${gameState.gameId}`);
      await socketConfirmCardSelection(gameState.gameId, cardId, customText);
    } catch (error) {
      console.error('[useGameState] Error confirming card selection:', error);
    }
  }, [gameState, socketConfirmCardSelection]);

  /**
   * Update a custom card's text
   * @param gameId - ID of the game
   * @param cardId - ID of the card to update
   * @param customText - Custom text for the card
   */
  const updateCustomCard = useCallback(async (gameId: string, cardId: number, customText: string) => {
    try {
      console.log(`[useGameState] Updating custom card ${cardId} in game ${gameId}`);
      return await socketUpdateCustomCard(gameId, cardId, customText);
    } catch (error) {
      console.error('[useGameState] Error updating custom card:', error);
      throw error;
    }
  }, [socketUpdateCustomCard]);

  /**
   * Send a chat message to the game room
   * @param gameId - ID of the game
   * @param message - Chat message text
   */
  const sendChatMessage = useCallback(async (gameId: string, message: string) => {
    try {
      console.log(`[useGameState] Sending chat message in game ${gameId}`);
      await socketSendChatMessage(gameId, message);
    } catch (error) {
      console.error('[useGameState] Error sending chat message:', error);
    }
  }, [socketSendChatMessage]);

  return {
    gameState,
    playerId,
    playerName,
    currentPlayer,
    connected,
    isConnecting,
    createGame,
    joinGame,
    startGame,
    selectCard,
    confirmCardSelection,
    updateCustomCard, // Add the update custom card method
    submitMoral,
    judgePick,
    nextRound,
    leaveGame,
    sendChatMessage
  };
};
