// server/src/index.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

// ============================================
// RUN MIGRATIONS ON STARTUP
// ============================================
const { exec } = require('child_process');
const fs = require('fs');

function runMigrations() {
  console.log('🔄 Running database migrations...');
  
  // Run init.js first (creates tables)
  const initPath = './src/db/init.js';
  if (fs.existsSync(initPath)) {
    console.log('📦 Running init.js...');
    exec(`node ${initPath}`, (error, stdout, stderr) => {
      if (error) {
        console.log('⚠️ init.js error:', error.message);
      } else {
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        console.log('✅ init.js completed');
      }
    });
  }

  // Run all migration files
  const migrationFiles = [
    './src/db/migrations/003_add_review_and_admin_features.js',
    './src/db/migrations/004_add_user_locations.js',
    './src/db/migrations/005_enhance_reports_table.js',
    './src/db/migrations/007_add_availability_publishing.js',
    './src/db/migrations/008_add_availability_booking_integration.js',
    './src/db/migrations/010_add_job_posts_table.js',
    './src/db/migrations/011_add_location_tracking.js',
    './src/db/migrations/012_add_refunds_table.js',
    './src/db/migrations/013_fix_reports_columns.js',
  ];

  for (const file of migrationFiles) {
    if (fs.existsSync(file)) {
      console.log(`📦 Running migration: ${file}`);
      exec(`node ${file}`, (error, stdout, stderr) => {
        if (error) {
          console.log(`⚠️ Migration error: ${error.message}`);
        } else {
          if (stdout) console.log(stdout);
          if (stderr) console.error(stderr);
          console.log(`✅ Migration completed: ${file}`);
        }
      });
    } else {
      console.log(`⚠️ Migration file not found: ${file}`);
    }
  }

  // Run seed.js last
  const seedPath = './src/db/seed.js';
  if (fs.existsSync(seedPath)) {
    console.log('📦 Running seed.js...');
    exec(`node ${seedPath}`, (error, stdout, stderr) => {
      if (error) {
        console.log('⚠️ seed.js error:', error.message);
      } else {
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        console.log('✅ seed.js completed');
      }
    });
  }
}

// ============================================
// CORS CONFIGURATION - FIXED FOR PRODUCTION
// ============================================
const allowedOrigins = [
  // Local development
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  
  // Vercel production URLs
  'https://carenest-rzmg-git-main-provaves-projects-6643b984.vercel.app',
  'https://carenest-rzmg-qz7q73mdb-provaves-projects-6643b984.vercel.app',
  'https://carenest-rzmg-seven.vercel.app',
  'https://carenest.vercel.app',
  
  // Railway backend URL
  'https://sitterspot-production-fc11.up.railway.app',
  
  // Allow all vercel.app subdomains (preview deployments)
  process.env.CLIENT_URL,
].filter(Boolean);

// Also allow any .vercel.app domain via regex
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('✅ CORS: No origin, allowing');
      return callback(null, true);
    }
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed === origin) return true;
      // Check for .vercel.app domains
      if (origin.endsWith('.vercel.app')) return true;
      return false;
    });
    
    if (isAllowed) {
      console.log(`✅ CORS allowed: ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept',
    'Origin',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Allow-Methods'
  ],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

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
const adminChatbotRoutes = require('./routes/adminChatbot');
const { setIo: setNotificationIo } = require('./routes/notifications');
const db = require('./config/database');

const app = express();
const server = http.createServer(app);

// ============================================
// SOCKET.IO CONFIGURATION
// ============================================
const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ============================================
// MIDDLEWARE
// ============================================
// CORS must come BEFORE other middleware
app.use(cors(corsOptions));

// Log all requests (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.url}`);
    next();
  });
} else {
  // Production: log only errors and important requests
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
      res.header('Access-Control-Allow-Credentials', 'true');
      return res.sendStatus(204);
    }
    next();
  });
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
app.use('/api/admin/chatbot', adminChatbotRoutes);

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
// HEALTH CHECK - For Railway monitoring
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
    environment: process.env.NODE_ENV || 'development',
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
  });
});

// ============================================
// MIGRATION ENDPOINT (Admin only - for debugging)
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
  
  // Handle specific error types
  if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  
  if (err.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({ error: 'Duplicate entry.' });
  }
  
  if (err.code === '23503') { // PostgreSQL foreign key violation
    return res.status(400).json({ error: 'Referenced record not found.' });
  }
  
  res.status(500).json({ 
    error: 'Internal server error', 
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
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
// Run migrations when server starts (async)
runMigrations();

// Setup Socket.io
setupChatSocket(io);
setNotificationIo(io);

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Important for Railway

server.listen(PORT, HOST, () => {
  console.log(`🚀 SitterSpot server running on port ${PORT}`);
  console.log(`🔌 Socket.io ready for real-time chat`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
  console.log(`📍 CORS allowed origins: ${allowedOrigins.join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  console.error('Stack:', err.stack);
  // Don't exit the process, let it recover
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
});// Restart server - Sat Jul 18 14:06:40 MEST 2026
