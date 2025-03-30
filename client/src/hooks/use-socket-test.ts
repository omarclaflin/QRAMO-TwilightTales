import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { MessageType } from './use-socket';

interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected';
  error?: string;
  socketId?: string;
  transport?: string;
  ping?: number;
  messageLog: string[];
}

/**
 * Simple Socket.io hook for testing connectivity in Replit environment.
 * This is a minimal implementation focused on diagnostics.
 */
export function useSocketTest() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
    messageLog: []
  });

  const addLog = (message: string) => {
    console.log(message);
    setConnectionState(prev => ({
      ...prev,
      messageLog: [...prev.messageLog, `${new Date().toISOString().split('T')[1].slice(0, 8)} - ${message}`]
    }));
  };

  // Initialize connection only once
  useEffect(() => {
    const connect = () => {
      addLog('Initializing Socket.io connection...');
      setConnectionState(prev => ({
        ...prev,
        status: 'connecting'
      }));
      
      // This should dynamically handle both local and Replit environments
      const getServerUrl = () => {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        return `${protocol}//${hostname}${window.location.port ? ':' + window.location.port : ''}`;
      };

      const serverUrl = getServerUrl();
      addLog(`Connecting to: ${serverUrl}`);

      // Create socket with minimal configuration
      const newSocket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 20000
      });

      // Set up connection event handlers
      newSocket.on('connect', () => {
        addLog(`Connected to server with ID: ${newSocket.id}`);
        setConnectionState(prev => ({
          ...prev,
          status: 'connected',
          socketId: newSocket.id,
          transport: newSocket.io.engine.transport.name,
          error: undefined
        }));

        // Test message
        newSocket.emit(MessageType.MESSAGE, { text: 'Hello from client', timestamp: Date.now() });
      });

      newSocket.on('disconnect', (reason) => {
        addLog(`Disconnected: ${reason}`);
        setConnectionState(prev => ({
          ...prev,
          status: 'disconnected',
          error: reason
        }));
      });

      newSocket.on('connect_error', (error) => {
        addLog(`Connection error: ${error.message}`);
        setConnectionState(prev => ({
          ...prev,
          status: 'disconnected',
          error: error.message
        }));
      });

      newSocket.on(MessageType.MESSAGE, (data) => {
        addLog(`Received message: ${JSON.stringify(data)}`);
      });

      newSocket.on('ping', (data) => {
        const ping = Date.now() - new Date(data.time).getTime();
        addLog(`Ping: ${ping}ms`);
        setConnectionState(prev => ({
          ...prev,
          ping
        }));
      });

      // Store the socket instance
      setSocket(newSocket);

      // Cleanup on unmount
      return () => {
        addLog('Cleaning up socket connection');
        newSocket.disconnect();
      };
    };

    connect();
  }, []);

  // Function to send a test message
  const sendTestMessage = (text: string) => {
    if (socket && socket.connected) {
      addLog(`Sending message: ${text}`);
      socket.emit(MessageType.MESSAGE, { text, timestamp: Date.now() });
      return true;
    } 
    addLog('Cannot send message - not connected');
    return false;
  };

  return {
    connectionState,
    sendTestMessage,
    reconnect: () => {
      if (socket) {
        setConnectionState(prev => ({
          ...prev,
          status: 'connecting',
          error: undefined
        }));
        socket.disconnect();
        socket.connect();
        addLog('Manually reconnecting...');
      }
    }
  };
}