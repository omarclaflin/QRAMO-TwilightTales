import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';

export enum MessageType {
  JOIN_GAME = 'joinGame',
  CREATE_GAME = 'createGame',
  START_GAME = 'startGame',
  SELECT_CARD = 'selectCard',
  SUBMIT_MORAL = 'submitMoral',
  CAST_VOTE = 'castVote',
  NEXT_ROUND = 'nextRound',
  LEAVE_GAME = 'leaveGame',
  GAME_STATE = 'gameState',
  ERROR = 'error',
  MESSAGE = 'message'
}

export type CreateGameData = {
  playerName: string;
};

export type JoinGameData = {
  gameId: string;
  playerName: string;
};

export type StartGameData = {
  gameId: string;
};

export type SelectCardData = {
  gameId: string;
  cardId: number;
};

export type SubmitMoralData = {
  gameId: string;
  moral: string;
};

export type CastVoteData = {
  gameId: string;
  votedForId: string;
};

export type NextRoundData = {
  gameId: string;
};

export type LeaveGameData = {
  gameId: string;
};

type SocketResponse = {
  success: boolean;
  error?: string;
  gameId?: string;
  playerId?: string;
  [key: string]: any;
};

interface UseSocketOptions {
  onGameState?: (gameState: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
}

/**
 * Custom hook for Socket.io communication with the game server
 * Uses the same stable implementation from our working test page
 * @param options - Configuration options
 * @returns Socket interface object
 */
export const useSocketNew = (options?: UseSocketOptions) => {
  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const toast = useToast();
  const connectAttempt = useRef(0);

  // Connect to socket server
  const connect = useCallback(() => {
    // Already connected or connecting - don't create multiple connections
    if (socketRef.current?.connected || isConnecting) {
      return;
    }

    setIsConnecting(true);
    connectAttempt.current += 1;
    console.log(`[GameSocket] Connection attempt #${connectAttempt.current}`);

    // Close any existing connection
    if (socketRef.current) {
      console.log('[GameSocket] Closing existing socket connection');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    try {
      // Use the simplest, most reliable connection method - exactly like our working test page
      // Using full URL with protocol and host for maximum compatibility
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const wsUrl = `${protocol}//${window.location.host}`;
      console.log(`[GameSocket] Connecting to: ${wsUrl}`);
      
      // Create Socket.io connection with minimal, proven options
      const socket = io(wsUrl, {
        transports: ['polling', 'websocket'], // Start with polling which is more stable in Replit
        forceNew: true, // Ensure a fresh connection
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000
      });
      
      socketRef.current = socket;

      // Connection events
      socket.on('connect', () => {
        console.log(`[GameSocket] Connected successfully (ID: ${socket.id})`);
        setConnected(true);
        setIsConnecting(false);
        
        toast.toast({
          title: 'Connected',
          description: 'Connected to the game server',
          variant: 'default',
        });
        
        if (options?.onConnect) {
          options.onConnect();
        }
      });

      socket.on('disconnect', (reason) => {
        console.log(`[GameSocket] Disconnected: ${reason}`);
        setConnected(false);
        
        toast.toast({
          title: 'Disconnected',
          description: `Lost connection to the game server: ${reason}`,
          variant: 'destructive',
        });
        
        if (options?.onDisconnect) {
          options.onDisconnect();
        }
      });

      socket.on('connect_error', (error) => {
        console.error(`[GameSocket] Connection error: ${error.message}`);
        setIsConnecting(false);
        
        // Log detailed information for debugging
        const details = {
          attempt: connectAttempt.current,
          message: error.message,
          protocol: window.location.protocol,
          host: window.location.host,
          pathname: window.location.pathname
        };
        
        console.log('[GameSocket] Connection error details:', details);
        
        // Only show error toast after several failed attempts
        if (connectAttempt.current > 2) {
          toast.toast({
            title: 'Connection Error',
            description: `Unable to connect: ${error.message}`,
            variant: 'destructive',
          });
        }
        
        if (options?.onError) {
          options.onError(`Connection error: ${error.message}`);
        }
      });

      // Game state updates
      socket.on(MessageType.GAME_STATE, (data) => {
        console.log('[GameSocket] Received game state update:', data);
        
        if (options?.onGameState && data.game) {
          options.onGameState(data.game);
        }
      });
      
      // Error handling
      socket.on(MessageType.ERROR, (data) => {
        console.error('[GameSocket] Error event:', data.message);
        
        toast.toast({
          title: 'Game Error',
          description: data.message,
          variant: 'destructive',
        });
        
        if (options?.onError) {
          options.onError(data.message);
        }
      });
    } catch (error) {
      console.error('[GameSocket] Error creating socket:', error);
      setIsConnecting(false);
      
      toast.toast({
        title: 'Connection Error',
        description: 'Failed to initialize socket connection',
        variant: 'destructive',
      });
    }
  }, [isConnecting, options, toast]);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[GameSocket] Disconnecting socket');
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }
  }, []);

  /**
   * Create a new game
   * @param playerName - Name of the player creating the game
   * @returns Promise resolving to the response
   */
  const createGame = useCallback((playerName: string): Promise<SocketResponse> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        console.log('[GameSocket] Cannot create game - not connected');
        toast.toast({
          title: 'Connection Error',
          description: 'Not connected to the game server',
          variant: 'destructive',
        });
        return reject(new Error('Not connected to the game server'));
      }
      
      console.log(`[GameSocket] Creating game with player name: ${playerName}`);
      socketRef.current.emit(MessageType.CREATE_GAME, { playerName }, (response: SocketResponse) => {
        console.log('[GameSocket] Create game response:', response);
        
        if (!response.success) {
          toast.toast({
            title: 'Error Creating Game',
            description: response.error || 'Unknown error',
            variant: 'destructive',
          });
          reject(new Error(response.error || 'Unknown error'));
        } else {
          resolve(response);
        }
      });
    });
  }, [toast]);

  /**
   * Join an existing game
   * @param gameId - ID of the game to join
   * @param playerName - Name of the player joining
   * @returns Promise resolving to the response
   */
  const joinGame = useCallback((gameId: string, playerName: string): Promise<SocketResponse> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        console.log('[GameSocket] Cannot join game - not connected');
        toast.toast({
          title: 'Connection Error',
          description: 'Not connected to the game server',
          variant: 'destructive',
        });
        return reject(new Error('Not connected to the game server'));
      }
      
      console.log(`[GameSocket] Joining game ${gameId} with player name: ${playerName}`);
      socketRef.current.emit(MessageType.JOIN_GAME, { gameId, playerName }, (response: SocketResponse) => {
        console.log('[GameSocket] Join game response:', response);
        
        if (!response.success) {
          toast.toast({
            title: 'Error Joining Game',
            description: response.error || 'Unknown error',
            variant: 'destructive',
          });
          reject(new Error(response.error || 'Unknown error'));
        } else {
          resolve(response);
        }
      });
    });
  }, [toast]);

  /**
   * Start a game (host only)
   * @param gameId - ID of the game to start
   * @returns Promise resolving to the response
   */
  const startGame = useCallback((gameId: string): Promise<SocketResponse> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        console.log('[GameSocket] Cannot start game - not connected');
        toast.toast({
          title: 'Connection Error',
          description: 'Not connected to the game server',
          variant: 'destructive',
        });
        return reject(new Error('Not connected to the game server'));
      }
      
      console.log(`[GameSocket] Starting game: ${gameId}`);
      socketRef.current.emit(MessageType.START_GAME, { gameId }, (response: SocketResponse) => {
        console.log('[GameSocket] Start game response:', response);
        
        if (!response.success) {
          toast.toast({
            title: 'Error Starting Game',
            description: response.error || 'Unknown error',
            variant: 'destructive',
          });
          reject(new Error(response.error || 'Unknown error'));
        } else {
          resolve(response);
        }
      });
    });
  }, [toast]);

  /**
   * Select a card during the card selection phase
   * @param gameId - ID of the current game
   * @param cardId - ID of the selected card
   * @returns Promise resolving to the response
   */
  const selectCard = useCallback((gameId: string, cardId: number): Promise<SocketResponse> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        console.log('[GameSocket] Cannot select card - not connected');
        toast.toast({
          title: 'Connection Error',
          description: 'Not connected to the game server',
          variant: 'destructive',
        });
        return reject(new Error('Not connected to the game server'));
      }
      
      console.log(`[GameSocket] Selecting card ${cardId} in game ${gameId}`);
      socketRef.current.emit(MessageType.SELECT_CARD, { gameId, cardId }, (response: SocketResponse) => {
        console.log('[GameSocket] Select card response:', response);
        
        if (!response.success) {
          toast.toast({
            title: 'Error Selecting Card',
            description: response.error || 'Unknown error',
            variant: 'destructive',
          });
          reject(new Error(response.error || 'Unknown error'));
        } else {
          resolve(response);
        }
      });
    });
  }, [toast]);

  /**
   * Submit a moral for the story
   * @param gameId - ID of the current game
   * @param moral - The player's moral for the story
   * @returns Promise resolving to the response
   */
  const submitMoral = useCallback((gameId: string, moral: string): Promise<SocketResponse> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        console.log('[GameSocket] Cannot submit moral - not connected');
        toast.toast({
          title: 'Connection Error',
          description: 'Not connected to the game server',
          variant: 'destructive',
        });
        return reject(new Error('Not connected to the game server'));
      }
      
      console.log(`[GameSocket] Submitting moral for game ${gameId}`);
      socketRef.current.emit(MessageType.SUBMIT_MORAL, { gameId, moral }, (response: SocketResponse) => {
        console.log('[GameSocket] Submit moral response:', response);
        
        if (!response.success) {
          toast.toast({
            title: 'Error Submitting Moral',
            description: response.error || 'Unknown error',
            variant: 'destructive',
          });
          reject(new Error(response.error || 'Unknown error'));
        } else {
          resolve(response);
        }
      });
    });
  }, [toast]);

  /**
   * Cast a vote for another player's moral
   * @param gameId - ID of the current game
   * @param votedForId - ID of the player being voted for
   * @returns Promise resolving to the response
   */
  const castVote = useCallback((gameId: string, votedForId: string): Promise<SocketResponse> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        console.log('[GameSocket] Cannot cast vote - not connected');
        toast.toast({
          title: 'Connection Error',
          description: 'Not connected to the game server',
          variant: 'destructive',
        });
        return reject(new Error('Not connected to the game server'));
      }
      
      console.log(`[GameSocket] Casting vote for player ${votedForId} in game ${gameId}`);
      socketRef.current.emit(MessageType.CAST_VOTE, { gameId, votedForId }, (response: SocketResponse) => {
        console.log('[GameSocket] Cast vote response:', response);
        
        if (!response.success) {
          toast.toast({
            title: 'Error Casting Vote',
            description: response.error || 'Unknown error',
            variant: 'destructive',
          });
          reject(new Error(response.error || 'Unknown error'));
        } else {
          resolve(response);
        }
      });
    });
  }, [toast]);

  /**
   * Move to the next round of the game
   * @param gameId - ID of the current game
   * @returns Promise resolving to the response
   */
  const nextRound = useCallback((gameId: string): Promise<SocketResponse> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        console.log('[GameSocket] Cannot start next round - not connected');
        toast.toast({
          title: 'Connection Error',
          description: 'Not connected to the game server',
          variant: 'destructive',
        });
        return reject(new Error('Not connected to the game server'));
      }
      
      console.log(`[GameSocket] Starting next round for game ${gameId}`);
      socketRef.current.emit(MessageType.NEXT_ROUND, { gameId }, (response: SocketResponse) => {
        console.log('[GameSocket] Next round response:', response);
        
        if (!response.success) {
          toast.toast({
            title: 'Error Starting Next Round',
            description: response.error || 'Unknown error',
            variant: 'destructive',
          });
          reject(new Error(response.error || 'Unknown error'));
        } else {
          resolve(response);
        }
      });
    });
  }, [toast]);

  /**
   * Leave the current game
   * @param gameId - ID of the game to leave
   * @returns Promise resolving to the response
   */
  const leaveGame = useCallback((gameId: string): Promise<SocketResponse> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        console.log('[GameSocket] Cannot leave game - not connected');
        toast.toast({
          title: 'Connection Error',
          description: 'Not connected to the game server',
          variant: 'destructive',
        });
        return reject(new Error('Not connected to the game server'));
      }
      
      console.log(`[GameSocket] Leaving game ${gameId}`);
      socketRef.current.emit(MessageType.LEAVE_GAME, { gameId }, (response: SocketResponse) => {
        console.log('[GameSocket] Leave game response:', response);
        
        if (!response.success) {
          toast.toast({
            title: 'Error Leaving Game',
            description: response.error || 'Unknown error',
            variant: 'destructive',
          });
          reject(new Error(response.error || 'Unknown error'));
        } else {
          resolve(response);
        }
      });
    });
  }, [toast]);

  // Connect on mount and clean up on unmount
  useEffect(() => {
    console.log('[GameSocket] Component mounted, connecting...');
    connect();
    
    // Set up a ping to check connection status and reconnect if needed
    const heartbeatInterval = setInterval(() => {
      if (connected && socketRef.current && !socketRef.current.connected) {
        // Zombie connection - we think we're connected but we're not
        console.log('[GameSocket] Heartbeat detected zombie connection. Reconnecting...');
        setConnected(false);
        connect();
      } else if (!connected && !isConnecting && connectAttempt.current < 5) {
        // We're not connected or connecting, and we haven't maxed out our attempts
        console.log('[GameSocket] Auto-reconnect attempt');
        connect();
      }
      
      // Log current connection state for debugging
      if (socketRef.current) {
        console.log(`[GameSocket] Status check - connected: ${socketRef.current.connected}, 
          state.connected: ${connected}, connecting: ${isConnecting}, 
          attempts: ${connectAttempt.current}, 
          id: ${socketRef.current.id || 'none'}`);
      }
    }, 8000);
    
    // Also set up a one-time check in case initial connection fails
    const initialCheckTimeout = setTimeout(() => {
      if (!connected && !isConnecting) {
        console.log('[GameSocket] Initial connection may have failed, retrying...');
        connect();
      }
    }, 3000);
    
    return () => {
      console.log('[GameSocket] Component unmounting, disconnecting...');
      clearInterval(heartbeatInterval);
      clearTimeout(initialCheckTimeout);
      disconnect();
    };
  }, [connect, connected, disconnect, isConnecting]);

  return {
    connected,
    isConnecting,
    createGame,
    joinGame,
    startGame,
    selectCard,
    submitMoral,
    castVote,
    nextRound,
    leaveGame,
    connect,
    disconnect,
    socket: socketRef.current
  };
};