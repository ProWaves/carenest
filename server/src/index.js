// server/src/index.js
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

  let allowedOrigin = null;

  if (origin) {
    const isAllowed = allowedOrigins.some((allowed) => {
      if (allowed.includes('*')) {
        const escaped = allowed.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        const pattern = escaped.replace(/\*/g, '.*');
        return new RegExp(`^${pattern}$`).test(origin);
      }
      return allowed === origin;
    });

    const isVercel = /\.vercel\.app$/.test(origin);
    const isLocalDev = /^https?:\/\/(localhost|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin);

    if (isAllowed || isVercel || isLocalDev) {
      allowedOrigin = origin;
    }
  }

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

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// ============================================
// ✅ NO-CACHE MIDDLEWARE FOR API ROUTES
// ============================================
// Express sets ETag on every JSON response by default. Browsers then send
// If-None-Match on subsequent requests, Express replies 304 Not Modified
// (no body), and the browser serves stale data. That breaks endpoints like
// GET /babysitters/:id — the parent keeps seeing the old profile after the
// sitter updates it.
//
// We disable caching for everything under /api, but leave /uploads cacheable
// (static assets don't change, so caching them is good).
// ============================================
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

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
const jobRoutes = require('./routes/jobs');
const paymentRoutes = require('./routes/payments');

// AI modules
const adminAiRoutes = require('./ai/admin');
const aiChatRoutes = require('./ai/parent');

const { setupChatSocket } = require('./sockets/chat');
const { setIo: setNotificationIo } = require('./routes/notifications');
const db = require('./config/database');

// ============================================
// MIDDLEWARE
// ============================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const fs = require('fs');
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`📁 Created uploads dir: ${uploadsDir}`);
}
const uploadsRoutes = require('./routes/uploads');
app.use('/uploads', uploadsRoutes);
app.use('/api/uploads', uploadsRoutes);

// Legacy disk fallback for any file that still lives under uploads/
app.use('/uploads', express.static(uploadsDir));

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
app.use('/api/jobs', jobRoutes);
app.use('/api/payments', paymentRoutes);

// AI routes
app.use('/api/admin/chatbot', adminAiRoutes);
app.use('/api/ai', aiChatRoutes);

// ============================================
// PUBLIC ENDPOINTS
// ============================================
app.get('/api/cities', async (req, res) => {
  try {
    const result = await db.query("SELECT DISTINCT city FROM users WHERE city IS NOT NULL AND city != '' ORDER BY city");
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
      if (!origin) return callback(null, true);
      if (/\.vercel\.app$/.test(origin)) return callback(null, true);
      if (/^https?:\/\/(localhost|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      const allowedOrigins = [
        'https://sitterspot-backend.onrender.com',
        'https://carenest.vercel.app',
        'https://carenest-rzmg-seven.vercel.app',
        'https://carenest-red.vercel.app',
        'https://carenest-rzmg.vercel.app',
      ];
      if (allowedOrigins.includes(origin)) return callback(null, true);
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
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔥 CORS: ALLOWING SPECIFIC ORIGINS`);
  console.log(`🚫 API responses: no-cache`);
  console.log(`📁 Uploads served from: ${path.join(__dirname, '../uploads')}`);
});