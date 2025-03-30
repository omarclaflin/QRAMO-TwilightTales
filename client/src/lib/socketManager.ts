import { io, Socket } from 'socket.io-client';
import { Game, Player } from '@shared/schema';

// Define MessageType enum directly here to avoid circular dependencies
enum MessageType {
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

// Socket connection state
type ConnectionState = 'disconnected' | 'connecting' | 'connected';

// Socket event listeners
type Listener = (...args: any[]) => void;
type EventListeners = {
  [event: string]: Listener[];
};

/**
 * Singleton Socket Manager
 * Manages a persistent Socket.io connection independent of component lifecycles
 */
class SocketManager {
  private socket: Socket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private connectingPromise: Promise<Socket> | null = null;
  private connectAttempts: number = 0;
  private eventListeners: EventListeners = {};
  private reconnectTimer: NodeJS.Timeout | null = null;
  // Make gameState public so it can be accessed in use-socket-manager.ts
  public gameState: Game | null = null;
  // Add playerData to track the current player's info
  public playerData?: { playerId: string; gameId: string; };
  
  // Callbacks for state changes
  private connectionStateCallbacks: ((state: ConnectionState) => void)[] = [];
  private gameStateCallbacks: ((game: Game | null) => void)[] = [];
  
  // Configuration
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  
  constructor() {
    console.log('[SocketManager] Initialized singleton instance');
  }
  
  /**
   * Get the current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }
  
  /**
   * Update the game state and notify all listeners
   * This is useful for client-side UI updates that don't require server communication
   */
  updateGameState(newState: Game): void {
    console.log('[SocketManager] Manually updating game state for UI rendering');
    this.gameState = newState;
    
    // Notify all game state callbacks
    this.gameStateCallbacks.forEach(callback => {
      callback(this.gameState);
    });
  }
  
  /**
   * Register a callback for connection state changes
   */
  onConnectionStateChange(callback: (state: ConnectionState) => void): () => void {
    this.connectionStateCallbacks.push(callback);
    
    // Immediately call with current state
    callback(this.connectionState);
    
    // Return unsubscribe function
    return () => {
      this.connectionStateCallbacks = this.connectionStateCallbacks.filter(cb => cb !== callback);
    };
  }
  
  /**
   * Register a callback for game state changes
   */
  onGameStateChange(callback: (game: Game | null) => void): () => void {
    this.gameStateCallbacks.push(callback);
    
    // Immediately call with current state if available
    if (this.gameState) {
      callback(this.gameState);
    }
    
    // Return unsubscribe function
    return () => {
      this.gameStateCallbacks = this.gameStateCallbacks.filter(cb => cb !== callback);
    };
  }
  
  /**
   * Update connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      console.log(`[SocketManager] Connection state changed: ${state}`);
      
      // Notify all registered callbacks
      this.connectionStateCallbacks.forEach(callback => {
        try {
          callback(state);
        } catch (error) {
          console.error('[SocketManager] Error in connection state callback:', error);
        }
      });
    }
  }
  
  /**
   * Get the socket instance, connecting if not already connected
   */
  async getSocket(): Promise<Socket> {
    // If we're already connected, return the socket
    if (this.socket?.connected) {
      return this.socket;
    }
    
    // If we're in the process of connecting, return the promise
    if (this.connectingPromise) {
      return this.connectingPromise;
    }
    
    // Otherwise, initiate connection
    this.connectingPromise = this.connect();
    return this.connectingPromise;
  }
  
  /**
   * Connect to the Socket.io server
   */
  private async connect(): Promise<Socket> {
    // Use the most robust and reliable connection strategy
    return new Promise((resolve, reject) => {
      // Close any existing socket connection
      if (this.socket) {
        console.log('[SocketManager] Closing existing socket connection');
        this.socket.disconnect();
        this.socket = null;
      }
      
      this.setConnectionState('connecting');
      this.connectAttempts++;
      
      console.log(`[SocketManager] Connection attempt #${this.connectAttempts}`);
      
      try {
        // Using full URL with protocol and host for maximum compatibility
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        const wsUrl = `${protocol}//${window.location.host}`;
        console.log(`[SocketManager] Connecting to: ${wsUrl}`);
        
        // Create Socket.io connection with proven options
        const socket = io(wsUrl, {
          transports: ['polling', 'websocket'], // Start with polling which is more stable in Replit
          forceNew: true, // Ensure a fresh connection
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 20000
        });
        
        this.socket = socket;
        
        // Set up core event handlers
        socket.on('connect', () => {
          console.log(`[SocketManager] Connected successfully (ID: ${socket.id})`);
          this.setConnectionState('connected');
          this.connectAttempts = 0; // Reset the counter on successful connection
          this.connectingPromise = null;
          resolve(socket);
          
          // Cancel any pending reconnect
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
        });
        
        socket.on('disconnect', (reason) => {
          console.log(`[SocketManager] Disconnected: ${reason}`);
          this.setConnectionState('disconnected');
          
          // Only attempt to reconnect if we haven't reached the max attempts
          if (this.connectAttempts < this.maxReconnectAttempts) {
            console.log(`[SocketManager] Will attempt to reconnect in ${this.reconnectDelay}ms`);
            
            // Set a timer to reconnect
            this.reconnectTimer = setTimeout(() => {
              console.log('[SocketManager] Attempting to reconnect...');
              this.connectingPromise = null; // Clear the connecting promise
              this.getSocket(); // Attempt to reconnect
            }, this.reconnectDelay);
          }
        });
        
        socket.on('connect_error', (error) => {
          console.error(`[SocketManager] Connection error: ${error.message}`);
          this.setConnectionState('disconnected');
          this.connectingPromise = null;
          
          const details = {
            attempt: this.connectAttempts,
            message: error.message,
            protocol: window.location.protocol,
            host: window.location.host,
            pathname: window.location.pathname
          };
          
          console.log('[SocketManager] Connection error details:', details);
          
          // If we've reached max attempts, reject the promise
          if (this.connectAttempts >= this.maxReconnectAttempts) {
            reject(new Error(`Failed to connect after ${this.maxReconnectAttempts} attempts: ${error.message}`));
          } else {
            // Otherwise, try again after a delay
            console.log(`[SocketManager] Will retry in ${this.reconnectDelay}ms`);
            
            this.reconnectTimer = setTimeout(() => {
              console.log('[SocketManager] Retrying connection...');
              this.connectingPromise = null; // Clear the connecting promise
              this.getSocket(); // Attempt to reconnect
            }, this.reconnectDelay);
          }
        });
        
        // Game state updates
        socket.on(MessageType.GAME_STATE, (data) => {
          console.log('[SocketManager] Received game state update');
          
          // The server might send the game object directly or wrapped in a data object
          const gameData = data.game ? data.game : data;
          
          if (gameData) {
            console.log('[SocketManager] Updating game state with new data');
            
            // Simply store the server's game state - don't modify it
            // Card selection UI components will handle their own temporary state
            this.gameState = gameData;
            
            // Notify all registered callbacks
            this.gameStateCallbacks.forEach(callback => {
              try {
                callback(this.gameState);
              } catch (error) {
                console.error('[SocketManager] Error in game state callback:', error);
              }
            });
          } else {
            console.warn('[SocketManager] Received empty game state update');
          }
        });
        
      } catch (error) {
        console.error('[SocketManager] Error creating socket:', error);
        this.setConnectionState('disconnected');
        this.connectingPromise = null;
        reject(error);
      }
    });
  }
  
  /**
   * Send a message to the server with callback support
   */
  async emit<T>(event: string, data?: any): Promise<T> {
    try {
      const socket = await this.getSocket();
      
      return new Promise((resolve, reject) => {
        socket.emit(event, data, (response: any) => {
          if (response && response.success === false) {
            reject(new Error(response.error || 'Unknown error'));
          } else {
            resolve(response);
          }
        });
      });
    } catch (error) {
      console.error(`[SocketManager] Error emitting ${event}:`, error);
      throw error;
    }
  }
  
  /**
   * Register an event listener
   */
  on(event: string, listener: Listener): () => void {
    // Initialize the event array if needed
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    
    // Add the listener
    this.eventListeners[event].push(listener);
    
    // Add to the socket if it exists
    if (this.socket) {
      this.socket.on(event, listener);
    }
    
    // Return an unsubscribe function
    return () => {
      this.off(event, listener);
    };
  }
  
  /**
   * Remove an event listener
   */
  off(event: string, listener: Listener): void {
    // Remove from our tracking
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(l => l !== listener);
    }
    
    // Remove from the socket if it exists
    if (this.socket) {
      this.socket.off(event, listener);
    }
  }
  
  /**
   * Disconnect the socket
   */
  disconnect(): void {
    console.log('[SocketManager] Manually disconnecting');
    
    // Cancel any reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Disconnect the socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.connectingPromise = null;
    this.setConnectionState('disconnected');
  }
}

// Create a singleton instance
const socketManager = new SocketManager();

// Export the singleton
export default socketManager;