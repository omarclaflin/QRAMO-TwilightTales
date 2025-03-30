import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupWebSocketServer } from "./socket-handler";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Game } from '@shared/schema';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists for card data
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

/**
 * Copies card data files from attached_assets to the data directory
 * This ensures that all necessary card data is available when the server starts
 */
function saveCardData() {
  try {
    // Copy the card data files from attached_assets to the data directory
    const cardFiles = [
      { source: 'location-cards-json.json', dest: 'location-cards.json' },
      { source: 'action1-cards-json.json', dest: 'initial-twist-cards.json' },
      { source: 'action2-cards-json.json', dest: 'escalation-cards.json' },
      { source: 'action3-cards-json.json', dest: 'final-twist-cards.json' },
      { source: 'character-cards-json.json', dest: 'character-cards.json' },
      { source: 'combined-cards-json.json', dest: 'combined-cards.json' }
    ];

    for (const file of cardFiles) {
      const sourcePath = path.join(__dirname, '../attached_assets', file.source);
      const destinationPath = path.join(dataDir, file.dest);
      
      if (fs.existsSync(sourcePath) && !fs.existsSync(destinationPath)) {
        console.log(`Copying card data from ${sourcePath} to ${destinationPath}`);
        fs.copyFileSync(sourcePath, destinationPath);
      } 
    }
  } catch (error) {
    console.error('Error saving card data:', error);
  }
}

/**
 * Sanitizes a game state object for API responses by removing sensitive data
 * @param game - The full game state
 * @returns A sanitized game state safe for API responses
 */
function sanitizeGameForApi(game: Game): Partial<Game> {
  return {
    ...game,
    players: game.players.map(player => ({
      ...player,
      hand: undefined // Remove player's cards from API responses
    }))
  };
}

/**
 * Registers API routes and sets up Socket.io server
 * @param app - Express application instance
 * @returns HTTP server with Socket.io attached
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Save card data on startup
  saveCardData();

  // API route to get information about the game
  app.get('/api/game-info', (req: Request, res: Response) => {
    res.json({
      title: "Twilight Tales",
      description: "A storytelling card game where players create bizarre narratives with escalating twists",
      playerCount: "1-5 players",
      ageRating: "16+",
      playTime: "30-60 minutes"
    });
  });

  // API route to get all active games (for the lobby)
  app.get('/api/games', async (req: Request, res: Response) => {
    try {
      const games = await storage.getAllGames();
      
      // Only return minimal game info for the lobby
      const gameList = games.map(game => ({
        gameId: game.gameId,
        status: game.status,
        playerCount: game.players.length,
        maxPlayers: game.settings.maxPlayers,
        hostName: game.players.find(p => p.isHost)?.name || 'Unknown Host'
      }));
      
      res.json(gameList);
    } catch (error) {
      console.error('Error getting games:', error);
      res.status(500).json({ error: 'Failed to retrieve games' });
    }
  });

  // API route to get a specific game by ID
  app.get('/api/games/:id', async (req: Request, res: Response) => {
    try {
      const gameId = req.params.id;
      const game = await storage.getGame(gameId);
      
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }
      
      // Return sanitized game state
      res.json(sanitizeGameForApi(game));
    } catch (error) {
      console.error('Error getting game:', error);
      res.status(500).json({ error: 'Failed to retrieve game' });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Create HTTP server for our app
  const httpServer = createServer(app);

  // Enhance server to handle connection issues specific to Replit
  httpServer.on('error', (error: any) => {
    console.error('HTTP Server error:', error);
    // Attempt recovery for known recoverable errors
    if (error.code === 'EADDRINUSE') {
      console.log('Address in use, retrying in 3 seconds...');
      setTimeout(() => {
        httpServer.close();
        httpServer.listen(5000, '0.0.0.0');
      }, 3000);
    }
  });

  // Set up Socket.io server for real-time communication with Replit-optimized config
  const io = setupWebSocketServer(httpServer);
  
  // Setup native WebSocket server as a fallback for Socket.io
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws' // Different path than Socket.io to avoid conflicts
  });
  
  console.log('Native WebSocket server initialized on path: /ws');
  
  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    console.log('[WebSocket] New connection established');
    
    // Set up ping-pong for connection monitoring
    const pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
        // Send a lightweight heartbeat message every 20 seconds
        ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
      }
    }, 20000);
    
    // Handle messages from client
    ws.on('message', (message) => {
      try {
        const messageStr = message.toString();
        console.log('[WebSocket] Received message:', messageStr);
        
        // Try to parse as JSON first, otherwise treat as plain text
        try {
          const data = JSON.parse(messageStr);
          console.log('[WebSocket] Parsed as JSON:', data.type || 'unknown type');
          
          // Handle different message types
          switch (data.type) {
            case 'ping':
              ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
              break;
              
            default:
              console.log('[WebSocket] Unhandled message type:', data.type);
              // Echo back JSON messages
              ws.send(JSON.stringify({ 
                type: 'echo', 
                originalMessage: data,
                timestamp: Date.now() 
              }));
              break;
          }
        } catch (jsonError) {
          // Not valid JSON, treat as plain text
          console.log('[WebSocket] Handling as plain text');
          
          // Echo back the text message
          ws.send(`Echo: ${messageStr}`);
          
          // Send a timestamp message after a short delay
          setTimeout(() => {
            if (ws.readyState === ws.OPEN) {
              ws.send(`Server time: ${new Date().toLocaleTimeString()}`);
            }
          }, 1000);
        }
      } catch (error) {
        console.error('[WebSocket] Error processing message:', error);
      }
    });
    
    // Handle connection close
    ws.on('close', () => {
      console.log('[WebSocket] Connection closed');
      clearInterval(pingInterval);
    });
    
    // Handle errors
    ws.on('error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      clearInterval(pingInterval);
    });
    
    // Send initial connection success message
    ws.send(JSON.stringify({ 
      type: 'connected', 
      message: 'WebSocket connection established',
      timestamp: Date.now() 
    }));
    
    // Also send a simple text message for non-JSON clients
    setTimeout(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send('Welcome to the Twilight Tales WebSocket server!');
      }
    }, 500);
  });

  return httpServer;
}
