const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const http = require('http');
const connectDB = require('./config/database');
const chatRoutes = require('./routes/chatRoutes');
const { generalLimiter } = require('./middleware/rateLimit');
const ChatSocket = require('./sockets/chatSocket');
const supplierRoutes = require('./routes/supplierRoutes');

// Load environment variables
require("dotenv").config({ path: "./.env" });

const app = express();
const server = http.createServer(app);

// Connect to database
connectDB();

// Initialize Socket.io
new ChatSocket(server);

// Middleware
app.use(helmet());

app.use(cors({
  origin: [
    "http://localhost:5173",              // local frontend
    "https://gemini-uzpx.vercel.app"      // deployed frontend
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to all routes
app.use(generalLimiter);

// Routes
app.use('/user', chatRoutes);
app.use('/supplier', supplierRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running with WebSocket support',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server is active`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

module.exports = { app, server };