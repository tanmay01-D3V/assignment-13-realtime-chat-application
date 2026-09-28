const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Import socket handlers
const userHandler = require('./sockets/userHandler');
const chatHandler = require('./sockets/chatHandler');

// Register Socket.io events
io.on('connection', (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  // Register Handlers
  userHandler(io, socket);
  chatHandler(io, socket);

  socket.on('error', (err) => {
    console.error(`Socket error (${socket.id}):`, err);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Assignment 13 Real-Time Group Chat & Messaging Engine',
    timestamp: new Date().toISOString()
  });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`💬 Real-Time Chat Server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket / Socket.io Engine ready`);
    console.log(`====================================================`);
  });
}

module.exports = { app, server, io };
