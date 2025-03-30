import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Minimal Socket.io hook based on the working implementation from simple-socket-test
 * Focuses only on establishing a reliable connection
 */
export const useSimpleSocket = () => {
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const socketId = useRef<string | null>(null);

  // Connect function
  const connect = useCallback(() => {
    console.log('[SimpleSocket] Starting connection attempt...');

    // Close any existing socket
    if (socketRef.current) {
      console.log('[SimpleSocket] Closing existing socket connection');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    // Get the base URL using window.location.origin - most reliable approach in Replit
    const baseUrl = window.location.origin;
    console.log(`[SimpleSocket] Using base URL: ${baseUrl}`);
    
    // Create socket with minimal options that work in the test implementation
    try {
      console.log('[SimpleSocket] Creating socket with minimal options');
      const socket = io(baseUrl, {
        transports: ['polling', 'websocket'],  // Start with polling which is more stable in Replit
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        forceNew: true
      });
      
      socketRef.current = socket;
      
      // Connection events
      socket.on('connect', () => {
        console.log(`[SimpleSocket] Connected successfully with ID: ${socket.id}`);
        setConnected(true);
        setConnectionError(null);
        socketId.current = socket.id || null;
      });
      
      socket.on('disconnect', (reason) => {
        console.log(`[SimpleSocket] Disconnected: ${reason}`);
        setConnected(false);
        socketId.current = null;
      });
      
      socket.on('connect_error', (error) => {
        console.error(`[SimpleSocket] Connection error: ${error.message}`);
        setConnectionError(error.message);
        
        // Log detailed information for debugging
        console.log(`[SimpleSocket] Connection details:
          - URL: ${baseUrl}
          - Protocol: ${window.location.protocol}
          - Host: ${window.location.host}
          - Error: ${error.message}
        `);
      });
      
      // Generic message handling - for testing
      socket.on('message', (data) => {
        console.log('[SimpleSocket] Received message:', data);
      });
      
      // Game state handling
      socket.on('gameState', (data) => {
        console.log('[SimpleSocket] Received game state:', data);
      });
      
    } catch (error) {
      console.error('[SimpleSocket] Error initializing socket:', error);
      setConnectionError(error instanceof Error ? error.message : String(error));
    }
  }, []);
  
  // Disconnect
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[SimpleSocket] Disconnecting socket');
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
      socketId.current = null;
    }
  }, []);
  
  // Send a simple message - for testing connection
  const sendMessage = useCallback((message: string) => {
    if (!socketRef.current || !connected) {
      console.error('[SimpleSocket] Cannot send message - not connected');
      return false;
    }
    
    console.log(`[SimpleSocket] Sending message: ${message}`);
    socketRef.current.emit('message', message);
    return true;
  }, [connected]);
  
  // Create game - minimal implementation
  const createGame = useCallback((playerName: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || !connected) {
        console.error('[SimpleSocket] Cannot create game - not connected');
        return reject(new Error('Not connected'));
      }
      
      console.log(`[SimpleSocket] Creating game with player name: ${playerName}`);
      socketRef.current.emit('createGame', { playerName }, (response: any) => {
        console.log('[SimpleSocket] Create game response:', response);
        
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to create game'));
        }
      });
    });
  }, [connected]);
  
  // Join game - minimal implementation
  const joinGame = useCallback((gameId: string, playerName: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || !connected) {
        console.error('[SimpleSocket] Cannot join game - not connected');
        return reject(new Error('Not connected'));
      }
      
      console.log(`[SimpleSocket] Joining game ${gameId} with player name: ${playerName}`);
      socketRef.current.emit('joinGame', { gameId, playerName }, (response: any) => {
        console.log('[SimpleSocket] Join game response:', response);
        
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to join game'));
        }
      });
    });
  }, [connected]);
  
  // Start game - minimal implementation
  const startGame = useCallback((gameId: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current || !connected) {
        console.error('[SimpleSocket] Cannot start game - not connected');
        return reject(new Error('Not connected'));
      }
      
      console.log(`[SimpleSocket] Starting game: ${gameId}`);
      socketRef.current.emit('startGame', { gameId }, (response: any) => {
        console.log('[SimpleSocket] Start game response:', response);
        
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to start game'));
        }
      });
    });
  }, [connected]);
  
  // Auto-connect on mount
  useEffect(() => {
    console.log('[SimpleSocket] Component mounted, connecting...');
    connect();
    
    // Clean up on unmount
    return () => {
      console.log('[SimpleSocket] Component unmounting, disconnecting...');
      disconnect();
    };
  }, [connect, disconnect]);
  
  return {
    connected,
    connectionError,
    socketId: socketId.current,
    connect,
    disconnect,
    sendMessage,
    createGame,
    joinGame,
    startGame,
    socket: socketRef.current
  };
};