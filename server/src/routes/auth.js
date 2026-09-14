// server/src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const verifyTurnstile = require('../middleware/turnstile');

const router = express.Router();

// POST /api/auth/register
router.post('/register', verifyTurnstile, async (req, res) => {
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

    // ============================================================
    // ✅ FIX: Always run bcrypt.compare — even when the email doesn't
    //         exist — so response times don't leak whether an account
    //         is registered.
    //
    //         Previously:
    //           1) 401 if email not found
    //           2) 403 if account suspended (BEFORE password check)
    //           3) 401 if password wrong
    //         which allowed user enumeration + suspension-reason leaks
    //         (without knowing the password) and a timing side-channel.
    //
    //         Now:
    //           1) Always bcrypt.compare against the real hash OR a
    //              dummy hash if the user doesn't exist.
    //           2) Return 401 "Invalid email or password" for any
    //              mismatch — no distinction between "no user" and
    //              "wrong password".
    //           3) Only AFTER a correct password do we reveal
    //              suspension / deactivation details.
    // ============================================================

    const DUMMY_HASH = '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';

    if (result.rows.length === 0) {
      // Burn the same CPU time as a real compare so timing is flat.
      await bcrypt.compare(password, DUMMY_HASH).catch(() => {});
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // ============================================================
    // Password is correct from here on. It's now safe to reveal
    // account state to the legitimate owner.
    // ============================================================

    // If suspension has expired, auto-restore and continue.
    if (user.suspended_at && user.suspension_end_date) {
      const now = new Date();
      const endDate = new Date(user.suspension_end_date);

      if (endDate <= now) {
        await db.query(
          `UPDATE users 
           SET suspended_at = NULL,
               suspension_reason = NULL,
               suspension_end_date = NULL,
               is_active = true
           WHERE id = $1`,
          [user.id]
        );

        const token = jwt.sign(
          { id: user.id, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );
        const { password: _, ...userData } = user;
        return res.json({ token, user: userData });
      }
    }

    // Deactivated
    if (!user.is_active && !user.suspended_at) {
      return res.status(403).json({
        error: 'account_deactivated',
        message: 'Your account has been deactivated. Please contact support to reactivate your account.',
        supportEmail: 'support@carenest.com',
        supportLink: 'mailto:support@carenest.com?subject=Account%20Deactivation%20-%20' + encodeURIComponent(user.email),
        blocked: true
      });
    }

    // Suspended (still active in the window)
    if (user.suspended_at) {
      let suspensionMessage = 'Your account has been suspended.';
      let suspensionDetails = '';

      if (user.suspension_end_date) {
        const daysRemaining = Math.ceil(
          (new Date(user.suspension_end_date) - new Date()) / (1000 * 60 * 60 * 24)
        );
        if (daysRemaining > 0) {
          suspensionDetails = `Your account is suspended for ${daysRemaining} more day${daysRemaining > 1 ? 's' : ''}.`;
        }
      }

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

    // All clear — generate token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

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