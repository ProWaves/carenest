const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// ============================================
// CORS MIDDLEWARE — FIRST MIDDLEWARE
// ============================================
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // List of allowed origins (exact matches + wildcard patterns)
  const allowedOrigins = [
    'https://sitterspot-backend.onrender.com',
    'https://carenest-rzmg-seven.vercel.app',
    'https://carenest-red.vercel.app',
    'https://carenest.vercel.app',
    'https://carenest-rzmg.vercel.app',
    'https://carenest-9l1g5cxk3-prowaves-projects-6643b984.vercel.app',
    'https://carenest-61nn1gxz8-prowaves-projects-6643b984.vercel.app',
    'http://localhost:8081',
    'http://localhost:5000',
    'http://localhost:5173',
    'http://localhost:3000',
    'exp://localhost:8081',
    'exp://10.144.149.5:8081',
  ];

  // Decide whether this origin is allowed
  let allowedOrigin = null;

  if (origin) {
    // Exact / wildcard match against the allowed list
    const isAllowed = allowedOrigins.some((allowed) => {
      if (allowed.includes('*')) {
        // Escape regex special chars, then convert * -> .*
        const escaped = allowed.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        const pattern = escaped.replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(origin);
      }
      return allowed === origin;
    });

    // Allow any *.vercel.app preview deployment
    const isVercel = /\.vercel\.app$/.test(origin);

    // Allow Android emulator / local dev hosts (10.x, 192.168.x, localhost)
    const isLocalDev = /^https?:\/\/(localhost|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin);

    if (isAllowed || isVercel || isLocalDev) {
      allowedOrigin = origin;
    }
  }

  // IMPORTANT:
  // If the origin is NOT allowed we must NOT send `*`.
  // With `Access-Control-Allow-Credentials: true`, a `*` origin is rejected
  // by every browser, so the response would fail even for valid callers.
  // Leaving the header off lets the browser block disallowed origins naturally.
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, Origin, Accept-Language'
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  console.log('🔥 CORS:', req.method, req.url, 'from', origin, '->', allowedOrigin || 'BLOCKED');

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    // Return 204 regardless. If the origin was disallowed, no CORS headers
    // were set above, so the browser will still reject the preflight.
    return res.sendStatus(204);
  }

  next();
});

// ============================================
// RUN MIGRATIONS
// ============================================
const { exec } = require('child_process');
const fs = require('fs');

function runMigrations() {
  console.log('Running database migrations...');

  const initPath = './src/models/init.js';
  if (fs.existsSync(initPath)) {
    console.log('Running init.js...');
    exec(`node ${initPath}`, (error, stdout, stderr) => {
      if (error) {
        console.log('init.js error:', error.message);
      } else {
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        console.log('init.js completed');
      }
    });
  }

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
    './src/db/migrations/014_add_missing_columns.js',
    './src/db/migrations/015_add_missing_columns_v2.js',
    './src/db/migrations/016_add_cancellation_reason.js',
  ];

  for (const file of migrationFiles) {
    if (fs.existsSync(file)) {
      console.log(`Running migration: ${file}`);
      exec(`node ${file}`, (error, stdout, stderr) => {
        if (error) {
          console.log(`Migration error: ${error.message}`);
        } else {
          if (stdout) console.log(stdout);
          if (stderr) console.error(stderr);
          console.log(`Migration completed: ${file}`);
        }
      });
    } else {
      console.log(`Migration file not found: ${file}`);
    }
  }

  const seedPath = './src/models/seed.js';
  if (fs.existsSync(seedPath)) {
    console.log('Running seed.js...');
    exec(`node ${seedPath}`, (error, stdout, stderr) => {
      if (error) {
        console.log('seed.js error:', error.message);
      } else {
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        console.log('seed.js completed');
      }
    });
  }
}

// ============================================
// ROUTES
// ============================================
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
const paymentRoutes = require('./routes/payments');   // 👈 ADDED
const { setupChatSocket } = require('./sockets/chat');
const { setIo: setNotificationIo } = require('./routes/notifications');
const db = require('./config/database');

// ============================================
// MIDDLEWARE
// ============================================
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
app.use('/api/payments', paymentRoutes);   // 👈 ADDED

// ============================================
// PUBLIC ENDPOINTS
// ============================================
app.get('/api/cities', async (req, res) => {
  try {
    const result = await db.query('SELECT DISTINCT city FROM users WHERE city IS NOT NULL AND city != \'\' ORDER BY city');
    res.json(result.rows.map(r => r.city));
  } catch (error) {
    console.error('Cities error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.get('/api/skills', async (req, res) => {
  try {
    const result = await db.query('SELECT DISTINCT unnest(skills) as skill FROM babysitter_profiles WHERE skills IS NOT NULL ORDER BY skill');
    res.json(result.rows.map(r => r.skill));
  } catch (error) {
    console.error('Skills error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: process.env.DATABASE_URL ? 'connected' : 'not configured',
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'SitterSpot API',
    version: '1.0.0',
    status: 'running',
  });
});

// ============================================
// TEMPORARY: Initialize Database via HTTP
// ============================================
app.get('/api/init-db', async (req, res) => {
  try {
    const { exec } = require('child_process');
    exec('node src/models/init.js && node src/models/seed.js', (error, stdout, stderr) => {
      if (error) {
        return res.json({ error: error.message, stderr });
      }
      res.json({ message: 'Database initialized!', stdout });
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.url });
});

// ============================================
// SOCKET.IO
// ============================================
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps)
      if (!origin) return callback(null, true);

      // Allow all vercel.app domains
      if (/\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }

      // Allow localhost / local network for development
      if (/^https?:\/\/(localhost|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      // Allow specific domains
      const allowedOrigins = [
        'https://sitterspot-backend.onrender.com',
        'https://carenest.vercel.app',
        'https://carenest-rzmg-seven.vercel.app',
        'https://carenest-red.vercel.app',
        'https://carenest-rzmg.vercel.app',
      ];

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
  },
});

setupChatSocket(io);
setNotificationIo(io);

// ============================================
// START SERVER
// ============================================
//runMigrations();

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔥 CORS: ALLOWING SPECIFIC ORIGINS`);
  console.log(`📁 Uploads served from: ${path.join(__dirname, '../uploads')}`);
});