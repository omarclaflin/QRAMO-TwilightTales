import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';

// Connection types supported
enum ConnectionType {
  SOCKETIO = 'socketio',
  WEBSOCKET = 'websocket'
}

// Message types - must match the server-side enum
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

// Types for Socket.io message data
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

// Socket event response type
type SocketResponse = {
  success: boolean;
  error?: string;
  gameId?: string;
  playerId?: string;
  [key: string]: any;
};

// Options for the socket hook
interface UseSocketOptions {
  onGameState?: (gameState: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
}

/**
 * Custom hook for Socket.io communication with the game server
 * @param options - Configuration options
 * @returns Socket interface object
 */
export const useSocket = (options?: UseSocketOptions) => {
  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const connectStartTime = useRef<number>(0);

  /**
   * Connect to the Socket.io server
   */
  // Create a fallback WebSocket connection
  const connectWebSocket = useCallback(() => {
    // If we already have a working Socket.io connection, don't create a WebSocket
    if (connected && socketRef.current?.connected) {
      return;
    }
    
    // Close existing WebSocket if any
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    // Create WebSocket connection using origin-based URL for reliability in Replit
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`Attempting fallback WebSocket connection to: ${wsUrl}`);
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('[WebSocket] Connection established');
        
        // Only use WebSocket if Socket.io is not working
        if (!socketRef.current?.connected) {
          setConnected(true);
          setIsConnecting(false);
          
          if (options?.onConnect) {
            options.onConnect();
          }
        }
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WebSocket] Received:', data);
          
          if (data.type === 'gameState' && options?.onGameState) {
            options.onGameState(data.game);
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('[WebSocket] Connection closed');
        
        // Only affect connection state if we're using WebSocket as primary
        if (!socketRef.current?.connected) {
          setConnected(false);
          
          if (options?.onDisconnect) {
            options.onDisconnect();
          }
        }
      };
      
      ws.onerror = (error) => {
        console.error('[WebSocket] Connection error:', error);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
    }
  }, [connected, options]);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    setIsConnecting(true);
    connectStartTime.current = Date.now();
    
    // Try to create a WebSocket connection as fallback
    connectWebSocket();
    
    // Get the base URL from the current page - most reliable approach in Replit
    const baseUrl = window.location.origin;
    
    console.log(`Attempting Socket.io connection to: ${baseUrl}`);
    
    // Create Socket.io connection with minimal, proven settings that work in Replit
    const socket = io(baseUrl, {
      transports: ['polling', 'websocket'],  // Start with polling which is more stable in Replit
      reconnection: true,
      reconnectionAttempts: 5,               // Limit reconnection attempts to avoid excessive retries
      reconnectionDelay: 1000,               // Start with a moderate delay
      timeout: 20000,                        // Moderate timeout
      forceNew: true                         // Force a new connection
    });
    
    socketRef.current = socket;

    // Set up event listeners
    socket.on('connect', () => {
      console.log('Socket.io connected');
      setConnected(true);
      setIsConnecting(false);
      
      if (options?.onConnect) {
        options.onConnect();
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket.io disconnected:', reason);
      setConnected(false);
      
      if (options?.onDisconnect) {
        options.onDisconnect();
      }
      
      toast({
        title: 'Disconnected',
        description: 'Lost connection to the game server. Reconnecting...',
        variant: 'destructive',
      });
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error);
      setIsConnecting(false);
      
      // Detailed error logging for debugging
      const errorDetails = {
        message: error.message,
        stack: error.stack,
        transport: socket.io?.engine?.transport?.name,
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        pathname: window.location.pathname,
        search: window.location.search,
        readyState: socket.io?.engine?.readyState
      };
      
      console.warn('Connection error details:', errorDetails);
      
      // Only show toast if this isn't a repeated reconnection attempt
      toast({
        title: 'Connection Error',
        description: `Unable to connect to the game server. Will retry automatically. (${error.message})`,
        variant: 'destructive',
      });
      
      if (options?.onError) {
        options.onError(`Connection error: ${error.message}`);
      }
      
      // Attempt a manual reconnect if socket disconnected
      setTimeout(() => {
        if (!socket.connected) {
          console.log('Attempting manual reconnection...');
          socket.connect();
        }
      }, 5000);
    });
    
    // Additional handlers for better debuggability in Replit
    socket.io.on('reconnect_attempt', (attempt) => {
      console.log(`Socket.io reconnect attempt #${attempt}`);
    });
    
    socket.io.on('reconnect', (attempt) => {
      console.log(`Socket.io reconnected after ${attempt} attempts`);
      toast({
        title: 'Reconnected',
        description: 'Connection to game server restored',
        variant: 'default',
      });
    });
    
    socket.io.on('reconnect_error', (error) => {
      console.error('Socket.io reconnection error:', error);
    });
    
    socket.io.on('reconnect_failed', () => {
      console.error('Socket.io reconnection failed after all attempts');
      toast({
        title: 'Connection Failed',
        description: 'Could not reconnect to the game server. Please refresh the page.',
        variant: 'destructive',
      });
    });

    socket.on(MessageType.ERROR, (data) => {
      console.error('Socket.io error event:', data.message);
      
      toast({
        title: 'Error',
        description: data.message,
        variant: 'destructive',
      });
      
      if (options?.onError) {
        options.onError(data.message);
      }
    });

    socket.on(MessageType.GAME_STATE, (data) => {
      console.log('Received game state update:', data);
      
      if (options?.onGameState && data.game) {
        options.onGameState(data.game);
      }
    });
  }, [options, toast]);

  /**
   * Disconnect from all socket connections
   */
  const disconnect = useCallback(() => {
    // Close Socket.io connection
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setConnected(false);
  }, []);

  /**
   * Create a new game
   * @param playerName - Name of the player creating the game
   * @returns Promise resolving to the response
   */
  const createGame = useCallback((playerName: string): Promise<SocketResponse> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current?.connected) {
        toast({
          title: 'Connection Error',
          description: 'Not connected to the game server',
          variant: 'destructive',
        });
        return reject(new Error('Not connected to the game server'));
      }
      
      socketRef.current.emit(MessageType.CREATE_GAME, { playerName }, (response: SocketResponse) => {
        console.log('Create game response:', response);
        
        if (!response.success) {
          toast({
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
        toast({
          title: 'Connection Error',
          description: 'Not connected to the game server',
          variant: 'destructive',
        });
        return reject(new Error('Not connected to the game server'));
      }
      
      socketRef.current.emit(MessageType.JOIN_GAME, { gameId, playerName }, (response: SocketResponse) => {
        console.log('Join game response:', response);
        
        if (!response.success) {
          toast({
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
        toast({
          title: 'Connection Error',
          description: 'Not connected to the game server',
          variant: 'destructive',
        });
        return reject(new Error('Not connected to the game server'));
      }
      
      socketRef.current.emit(MessageType.START_GAME, { gameId }, (response: SocketResponse) => {
        console.log('Start game response:', response);
        
        if (!response.success) {
          toast({
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
        toast({
          title: 'Connection Error',
          description: 'Not connected to the game server',
          variant: 'destructive',
        });
        return reject(new Error('Not connected to the game server'));
      }
      
      socketRef.current.emit(MessageType.SELECT_CARD, { gameId, cardId }, (response: SocketResponse) => {
        console.log('Select card response:', response);
        
        if (!response.success) {
          toast({
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
        toast({
          title: 'Connection Error',
          description: 'Not connected to the game server',
          variant: 'destructive',
        });
        return reject(new Error('Not connected to the game server'));
      }
      
      socketRef.current.emit(MessageType.SUBMIT_MORAL, { gameId, moral }, (response: SocketResponse) => {
        console.log('Submit moral response:', response);
        
        if (!response.success) {
          toast({
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
        toast({
          title: 'Connection Error',
          description: 'Not connected to the game server',
          variant: 'destructive',
        });
        return reject(new Error('Not connected to the game server'));
      }
      
      socketRef.current.emit(MessageType.CAST_VOTE, { gameId, votedForId }, (response: SocketResponse) => {
        console.log('Cast vote response:', response);
        
        if (!response.success) {
          toast({
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
        toast({
          title: 'Connection Error',
          description: 'Not connected to the game server',
          variant: 'destructive',
        });
        return reject(new Error('Not connected to the game server'));
      }
      
      socketRef.current.emit(MessageType.NEXT_ROUND, { gameId }, (response: SocketResponse) => {
        console.log('Next round response:', response);
        
        if (!response.success) {
          toast({
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
        toast({
          title: 'Connection Error',
          description: 'Not connected to the game server',
          variant: 'destructive',
        });
        return reject(new Error('Not connected to the game server'));
      }
      
      socketRef.current.emit(MessageType.LEAVE_GAME, { gameId }, (response: SocketResponse) => {
        console.log('Leave game response:', response);
        
        if (!response.success) {
          toast({
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
    connect();
    
    // Set up a heartbeat interval to detect zombie connections and reconnect if needed
    const heartbeatInterval = setInterval(() => {
      // If we think we're connected but the socket isn't actually connected
      if (connected && socketRef.current && !socketRef.current.connected) {
        console.log('Heartbeat detected zombie connection. Reconnecting...');
        socketRef.current.connect();
      }
      
      // If we've been trying to connect for over 10 seconds, try a fresh connection
      if (isConnecting && Date.now() - connectStartTime.current > 10000) {
        console.log('Connection attempt timed out. Creating a fresh connection...');
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
        setConnected(false);
        setIsConnecting(false);
        
        // Delay slightly to avoid race conditions
        setTimeout(() => {
          connect();
        }, 500);
      }
    }, 5000);
    
    return () => {
      clearInterval(heartbeatInterval);
      disconnect();
    };
  }, [connect, disconnect, connected, isConnecting]);

  return {
    // Connection state
    connected,
    isConnecting,
    connect,
    disconnect,
    
    // Game actions
    createGame,
    joinGame,
    startGame,
    selectCard,
    submitMoral,
    castVote,
    nextRound,
    leaveGame,
    
    // Raw socket access (for advanced use cases)
    socket: socketRef.current
  };
};
