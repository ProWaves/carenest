// server/src/index.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

const { setupChatSocket } = require('./sockets/chat');

// Route modules
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const babysitterRoutes = require('./routes/babysitters');
const bookingRoutes = require('./routes/bookings');
const reviewRoutes = require('./routes/reviews');
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const parentRoutes = require('./routes/parent');
const notificationRoutes = require('./routes/notifications');
const reportRoutes = require('./routes/reports');
const aiRoutes = require('./routes/aiChatbot');
const jobRoutes = require('./routes/jobs');
const { setIo: setNotificationIo } = require('./routes/notifications');
const db = require('./config/database');

const app = express();
const server = http.createServer(app);

// Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Log all requests
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  next();
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/babysitters', babysitterRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/jobs', jobRoutes);

// GET /api/cities
app.get('/api/cities', async (req, res) => {
  try {
    const result = await db.query('SELECT DISTINCT city FROM users WHERE city IS NOT NULL AND city != \'\' ORDER BY city');
    res.json(result.rows.map(r => r.city));
  } catch (error) {
    console.error('Cities error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/skills
app.get('/api/skills', async (req, res) => {
  try {
    const result = await db.query('SELECT DISTINCT unnest(skills) as skill FROM babysitter_profiles WHERE skills IS NOT NULL ORDER BY skill');
    res.json(result.rows.map(r => r.skill));
  } catch (error) {
    console.error('Skills error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  console.error('❌ Stack:', err.stack);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Route not found', path: req.url });
});

// Attach real-time chat handlers
setupChatSocket(io);
setNotificationIo(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 CareNest server running on port ${PORT}`);
  console.log(`🔌 Socket.io ready for real-time chat`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
});