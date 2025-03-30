// Minimal Socket.io server for testing Replit connectivity
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Create Socket.io server with minimal configuration
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);
  
  // Send welcome message
  socket.emit('message', { text: 'Connected to Socket.io server!' });
  
  // Echo back any messages
  socket.on('message', (data) => {
    console.log(`Received from ${socket.id}: ${JSON.stringify(data)}`);
    socket.emit('message', { 
      text: `Echo: ${data.text}`,
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`Disconnected: ${socket.id}, Reason: ${reason}`);
  });

  // Regular ping to test connection stability
  setInterval(() => {
    socket.emit('ping', { time: new Date().toISOString() });
  }, 10000);
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Minimal Socket.io test server running on port ${PORT}`);
  console.log(`Socket.io configuration: ${JSON.stringify(io.engine.opts)}`);
});