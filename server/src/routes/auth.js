// server/src/routes/auth.js - Updated login endpoint

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, role, first_name, last_name, phone, city, language, gender } = req.body;

    if (!email || !password || !role || !first_name || !last_name) {
      return res.status(400).json({ error: 'Required fields missing.' });
    }

    if (!['parent', 'babysitter'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be parent or babysitter.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (email, password, role, first_name, last_name, phone, city, language, gender)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, email, role, first_name, last_name, city, language, gender`,
      [email, hashedPassword, role, first_name, last_name, phone || null, city || null, language || 'en', gender || null]
    );

    const user = result.rows[0];

    if (role === 'babysitter') {
      await db.query(
        'INSERT INTO babysitter_profiles (user_id) VALUES ($1)',
        [user.id]
      );
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.status(201).json({ token, user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// POST /api/auth/login - Updated with account blocking
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required.' });
    }

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    // ============================================
    // CHECK IF ACCOUNT IS BLOCKED/SUSPENDED
    // ============================================
    
    // Check if account is deactivated
    if (!user.is_active) {
      return res.status(403).json({ 
        error: 'account_deactivated',
        message: 'Your account has been deactivated. Please contact support to reactivate your account.',
        supportEmail: 'support@carenest.com',
        supportLink: 'mailto:support@carenest.com?subject=Account%20Deactivation%20-%20' + encodeURIComponent(user.email),
        blocked: true
      });
    }

    // Check if account is suspended
    if (user.suspended_at) {
      let suspensionMessage = 'Your account has been suspended.';
      let suspensionDetails = '';

      // Check if there's a suspension end date
      if (user.suspension_end_date) {
        const now = new Date();
        const endDate = new Date(user.suspension_end_date);
        
        if (endDate > now) {
          const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
          suspensionDetails = `Your account is suspended for ${daysRemaining} more day${daysRemaining > 1 ? 's' : ''}.`;
        } else {
          // Suspension has expired, automatically restore
          await db.query(
            `UPDATE users 
             SET suspended_at = NULL,
                 suspension_reason = NULL,
                 suspension_end_date = NULL,
                 is_active = true
             WHERE id = $1`,
            [user.id]
          );
          // Continue with login
          const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d',
          });
          const { password: _, ...userData } = user;
          return res.json({ token, user: userData });
        }
      }

      // If no end date or still suspended
      if (user.suspension_reason) {
        suspensionMessage = `Your account has been suspended. Reason: ${user.suspension_reason}`;
      }

      return res.status(403).json({
        error: 'account_suspended',
        message: suspensionMessage,
        details: suspensionDetails,
        supportEmail: 'support@carenest.com',
        supportLink: 'mailto:support@carenest.com?subject=Account%20Suspension%20-%20' + encodeURIComponent(user.email),
        suspendedAt: user.suspended_at,
        suspensionEndDate: user.suspension_end_date,
        suspensionReason: user.suspension_reason,
        blocked: true
      });
    }

    // ============================================
    // CHECK PASSWORD
    // ============================================
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // ============================================
    // GENERATE TOKEN
    // ============================================
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    const { password: _, ...userData } = user;
    res.json({ token, user: userData });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, email, role, first_name, last_name, phone, city, language, gender, avatar_url, is_active, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;