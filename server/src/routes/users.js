// ==========================================================================
// User Routes — /api/users
// ==========================================================================
// GET  /profile/:id  — public profile for any user
// PUT  /profile      — update own profile (authenticated)
// PUT  /password     — change own password (authenticated)
// POST /avatar       — upload a profile picture (authenticated)
// ==========================================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// GET /api/users/profile/:id
// Returns public info for any user by ID.
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
// Updates own profile fields. Only provided fields are changed (COALESCE).
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
// Updates password after verifying the current one.
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
// Uploads an avatar image via multipart/form-data. Saves to /uploads/.
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

module.exports = router;
