// server/src/index.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

// ============================================
// RUN MIGRATIONS ON STARTUP (FREE TIER SOLUTION)
// ============================================
const { exec } = require('child_process');
const fs = require('fs');

// Run migrations silently on startup
function runMigrations() {
  console.log('🔄 Checking database migrations...');
  
  // Check if files exist before running
  const initPath = './src/db/init.js';
  const seedPath = './src/db/seed.js';
  
  // Try to run init.js
  if (fs.existsSync(initPath)) {
    exec(`node ${initPath}`, (error, stdout, stderr) => {
      if (error) {
        console.log('ℹ️ init.js already ran or error:', error.message);
      } else {
        console.log('✅ init.js completed');
        if (stdout) console.log(stdout);
      }
    });
  } else {
    console.log('ℹ️ init.js not found at', initPath);
  }

  // Try to run seed.js
  if (fs.existsSync(seedPath)) {
    exec(`node ${seedPath}`, (error, stdout, stderr) => {
      if (error) {
        console.log('ℹ️ seed.js already ran or error:', error.message);
      } else {
        console.log('✅ seed.js completed');
        if (stdout) console.log(stdout);
      }
    });
  } else {
    console.log('ℹ️ seed.js not found at', seedPath);
  }
}

// ============================================
// REST OF YOUR CODE
// ============================================
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

// ============================================
// SOCKET.IO CONFIGURATION
// ============================================
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Log all requests (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.url}`);
    next();
  });
}

// ============================================
// API ROUTES
// ============================================
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

// ============================================
// PUBLIC ENDPOINTS
// ============================================

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

// ============================================
// HEALTH CHECK - For Render monitoring
// ============================================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: process.env.DATABASE_URL ? 'connected' : 'not configured',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// ============================================
// ROOT ROUTE
// ============================================
app.get('/', (req, res) => {
  res.json({
    name: 'SitterSpot API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      babysitters: '/api/babysitters',
      bookings: '/api/bookings',
      reviews: '/api/reviews',
      chat: '/api/chat',
      reports: '/api/reports',
      parent: '/api/parent',
      admin: '/api/admin',
      notifications: '/api/notifications',
      ai: '/api/ai',
      jobs: '/api/jobs',
      cities: '/api/cities',
      skills: '/api/skills',
    },
    documentation: 'https://github.com/ProWaves/carenest',
  });
});

// ============================================
// TEMPORARY MIGRATION ROUTE (REMOVE AFTER FIRST RUN)
// ============================================
app.get('/api/migrate', async (req, res) => {
  try {
    console.log('🔄 Running migrations via HTTP request...');
    
    const initPath = './src/db/init.js';
    const seedPath = './src/db/seed.js';
    let initRan = false;
    let seedRan = false;

    // Run init
    if (fs.existsSync(initPath)) {
      await new Promise((resolve) => {
        exec(`node ${initPath}`, (error, stdout, stderr) => {
          if (error) {
            console.log('⚠️ init.js error:', error.message);
          } else {
            console.log('✅ init.js completed');
            initRan = true;
            if (stdout) console.log(stdout);
          }
          resolve();
        });
      });
    } else {
      console.log('ℹ️ init.js not found');
    }

    // Run seed
    if (fs.existsSync(seedPath)) {
      await new Promise((resolve) => {
        exec(`node ${seedPath}`, (error, stdout, stderr) => {
          if (error) {
            console.log('⚠️ seed.js error:', error.message);
          } else {
            console.log('✅ seed.js completed');
            seedRan = true;
            if (stdout) console.log(stdout);
          }
          resolve();
        });
      });
    } else {
      console.log('ℹ️ seed.js not found');
    }

    res.json({ 
      message: 'Migrations completed!',
      initRan,
      seedRan,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Migration failed', 
      message: error.message 
    });
  }
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  console.error('❌ Stack:', err.stack);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: 'Route not found', 
    path: req.url,
    message: `The endpoint ${req.method} ${req.url} does not exist`
  });
});

// ============================================
// START SERVER
// ============================================
// Run migrations when server starts
runMigrations();

setupChatSocket(io);
setNotificationIo(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 SitterSpot server running on port ${PORT}`);
  console.log(`🔌 Socket.io ready for real-time chat`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
});