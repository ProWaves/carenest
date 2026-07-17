const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All routes in this file require authentication (parent role)
router.use(authenticate);

// ============================================
// CHILDREN MANAGEMENT
// ============================================

// GET /api/admin/children — Get current parent's children
router.get('/children', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, age, notes, created_at FROM children WHERE parent_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get children error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/admin/children — Add a child
router.post('/children', async (req, res) => {
  try {
    const { name, age, notes } = req.body;
    if (!name || age === undefined) {
      return res.status(400).json({ error: 'Name and age are required.' });
    }
    const result = await db.query(
      'INSERT INTO children (parent_id, name, age, notes) VALUES ($1, $2, $3, $4) RETURNING id, name, age, notes, created_at',
      [req.user.id, name, age, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add child error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/admin/children/:id — Remove a child
router.delete('/children/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM children WHERE id = $1 AND parent_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Child not found.' });
    }
    res.json({ message: 'Child removed.' });
  } catch (error) {
    console.error('Delete child error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// FAVORITES MANAGEMENT
// ============================================

// GET /api/admin/favorites — Get current parent's favorite babysitters
router.get('/favorites', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.first_name, u.last_name, u.city, u.avatar_url,
        bp.hourly_rate, bp.experience_years, bp.is_verified, bp.skills,
        (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE babysitter_id = u.id) as avg_rating,
        (SELECT COUNT(*) FROM reviews WHERE babysitter_id = u.id) as review_count
      FROM favorites f
      JOIN users u ON u.id = f.babysitter_id
      LEFT JOIN babysitter_profiles bp ON bp.user_id = u.id
      WHERE f.parent_id = $1
      ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/admin/favorites — Add a babysitter to favorites
router.post('/favorites', async (req, res) => {
  try {
    const { babysitter_id } = req.body;
    if (!babysitter_id) {
      return res.status(400).json({ error: 'Babysitter ID is required.' });
    }
    // Check if already favorited
    const existing = await db.query(
      'SELECT id FROM favorites WHERE parent_id = $1 AND babysitter_id = $2',
      [req.user.id, babysitter_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Already in favorites.' });
    }
    const result = await db.query(
      'INSERT INTO favorites (parent_id, babysitter_id) VALUES ($1, $2) RETURNING *',
      [req.user.id, babysitter_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/admin/favorites/:babysitter_id — Remove a babysitter from favorites
router.delete('/favorites/:babysitterId', async (req, res) => {
  try {
    const { babysitterId } = req.params;
    const result = await db.query(
      'DELETE FROM favorites WHERE parent_id = $1 AND babysitter_id = $2 RETURNING id',
      [req.user.id, babysitterId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Favorite not found.' });
    }
    res.json({ message: 'Favorite removed.' });
  } catch (error) {
    console.error('Delete favorite error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
