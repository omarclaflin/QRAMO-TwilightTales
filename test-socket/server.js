// Simple Express server with Socket.io for testing
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Create Socket.io server with Replit-friendly settings
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 5000
});

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);
  
  // Send welcome message to client
  socket.emit('welcome', { message: 'Connected to server!', id: socket.id });
  
  // Broadcast to all clients how many are connected
  io.emit('clientCount', { count: io.engine.clientsCount });
  
  // Echo message back to client
  socket.on('message', (data) => {
    console.log(`Message from ${socket.id}: ${data.text}`);
    socket.emit('echo', { 
      text: data.text,
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle ping from client to measure latency
  socket.on('ping', (callback) => {
    console.log(`Ping from ${socket.id}`);
    // If callback is provided, call it with server timestamp
    if (typeof callback === 'function') {
      callback({ serverTime: Date.now() });
    } else {
      socket.emit('pong', { serverTime: Date.now() });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`Disconnected: ${socket.id}, Reason: ${reason}`);
    // Broadcast updated client count
    io.emit('clientCount', { count: io.engine.clientsCount });
  });
});

// Log connection events for debugging
io.engine.on('connection', (socket) => {
  console.log(`Transport: ${socket.transport.name}`);
});

// Start server on port 3001 (different from main app)
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Socket.io test server running on port ${PORT}`);
  console.log(`Socket.io configuration: transports=${JSON.stringify(io.engine.opts.transports)}`);
});