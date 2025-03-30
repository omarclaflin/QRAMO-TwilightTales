// socket-handler.js
const gameStateManager = require('./game-state-manager');
const aiService = require('./ai-service');

/**
 * Set up Socket.io event handlers
 * @param {Object} io - The Socket.io server instance
 */
function setupSocketHandlers(io) {
  // Keep track of players and their socket IDs
  const playerSockets = new Map();

  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      handlePlayerDisconnect(socket, playerSockets, io);
    });
    
    // Create a new game
    socket.on('create-game', (data, callback) => {
      try {
        const { playerName } = data;
        
        // Create player object
        const player = {
          id: socket.id,
          name: playerName,