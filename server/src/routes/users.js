// ==========================================================================
// User Routes — /api/users
// ==========================================================================
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// GET /api/users/profile/:id
router.get('/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT id, email, role, first_name, last_name, phone, city, language, gender, avatar_url, created_at FROM users WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/users/profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { first_name, last_name, phone, city, language, gender } = req.body;
    const result = await db.query(
      `UPDATE users SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        phone = COALESCE($3, phone),
        city = COALESCE($4, city),
        language = COALESCE($5, language),
        gender = COALESCE(NULLIF($6, ''), gender),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING id, email, role, first_name, last_name, phone, city, language, gender, avatar_url`,
      [first_name, last_name, phone, city, language, gender, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/users/password
router.put('/password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const result = await db.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, result.rows[0].password);
    if (!valid) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    const hashed = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);
    res.json({ message: 'Password updated.' });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/users/avatar
router.post('/avatar', authenticate, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    const avatarUrl = `/uploads/${req.file.filename}`;
    await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, req.user.id]);
    res.json({ avatar_url: avatarUrl });
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/users/fcm-token
// Stores the device's FCM token so the backend can push to this user.
router.post('/fcm-token', authenticate, async (req, res) => {
  try {
    const { fcm_token } = req.body;
    if (!fcm_token || typeof fcm_token !== 'string') {
      return res.status(400).json({ error: 'fcm_token is required.' });
    }

    const token = fcm_token.trim();

    // ============================================================
    // ✅ FIX: validate the FCM token shape before storing it.
    //
    // FCM tokens are 150-200 characters of [A-Za-z0-9_\-:].
    // Anything outside that range is either corrupt, malicious, or
    // from a client using a different push provider. Storing it
    // means every future notification will fail silently and the
    // row will bloat the DB.
    // ============================================================
    const FCM_TOKEN_RE = /^[A-Za-z0-9_\-:]{100,250}$/;
    if (!FCM_TOKEN_RE.test(token)) {
      return res.status(400).json({
        error: 'Invalid fcm_token format.',
        hint: 'Expected 100-250 characters of [A-Za-z0-9_-:].',
      });
    }

    // ============================================================
    // ✅ FIX: FCM tokens are unique per app install. If the token
    //         was previously registered to a different user (device
    //         handed over, account switch, etc.), clear it from
    //         that user first so the two don't race to receive the
    //         same pushes.
    // ============================================================
    await db.query(
      'UPDATE users SET fcm_token = NULL WHERE fcm_token = $1 AND id != $2',
      [token, req.user.id]
    );

    await db.query(
      'UPDATE users SET fcm_token = $1 WHERE id = $2',
      [token, req.user.id]
    );

    res.json({ message: 'FCM token registered.' });
  } catch (error) {
    console.error('Register FCM error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;