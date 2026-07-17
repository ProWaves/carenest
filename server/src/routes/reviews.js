// server/src/routes/reviews.js
const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { createNotification } = require('../routes/notifications');

const router = express.Router();

// ============================================
// PARENT REVIEWS BABYSITTER
// ============================================
router.post('/', authenticate, authorize('parent'), async (req, res) => {
  try {
    const { booking_id, babysitter_id, rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    const booking = await db.query(
      'SELECT * FROM bookings WHERE id = $1 AND parent_id = $2 AND babysitter_id = $3 AND status = $4',
      [booking_id, req.user.id, babysitter_id, 'completed']
    );
    if (booking.rows.length === 0) {
      return res.status(400).json({ error: 'Booking not found or not completed.' });
    }

    const existing = await db.query(
      'SELECT id FROM reviews WHERE booking_id = $1 AND parent_id = $2',
      [booking_id, req.user.id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Review already exists for this booking.' });
    }

    const result = await db.query(
      `INSERT INTO reviews (booking_id, parent_id, babysitter_id, rating, comment) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [booking_id, req.user.id, babysitter_id, rating, comment]
    );

    await createNotification(
      parseInt(babysitter_id),
      'new_review',
      '⭐ New Review',
      `${req.user.first_name} ${req.user.last_name} left you a review.`,
      '/dashboard?tab=reviews'
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// GET BABYSITTER REVIEWS (Public)
// ============================================
router.get('/babysitter/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT r.rating, r.comment, r.created_at,
        u.first_name, u.last_name, u.avatar_url
       FROM reviews r
       JOIN users u ON u.id = r.parent_id
       WHERE r.babysitter_id = $1
       ORDER BY r.created_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get babysitter reviews error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// ADMIN - GET ALL REVIEWS
// ============================================
router.get('/admin/all', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.*, 
        p.first_name as parent_first_name, p.last_name as parent_last_name,
        s.first_name as babysitter_first_name, s.last_name as babysitter_last_name,
        b.start_date, b.end_date
      FROM reviews r
      JOIN users p ON p.id = r.parent_id
      JOIN users s ON s.id = r.babysitter_id
      JOIN bookings b ON b.id = r.booking_id
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Admin reviews error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// ADMIN - GET ALL PARENT REVIEWS
// ============================================
router.get('/admin/parent-reviews', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT pr.*, 
        p.first_name as parent_first_name, p.last_name as parent_last_name,
        s.first_name as babysitter_first_name, s.last_name as babysitter_last_name,
        b.start_date, b.end_date
      FROM parent_reviews pr
      JOIN users p ON p.id = pr.parent_id
      JOIN users s ON s.id = pr.babysitter_id
      JOIN bookings b ON b.id = pr.booking_id
      ORDER BY pr.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Admin parent reviews error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// USER - GET MY REVIEWS
// ============================================
router.get('/my-reviews', authenticate, async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'parent') {
      query = `
        SELECT r.*, s.first_name as babysitter_first_name, s.last_name as babysitter_last_name,
               b.start_date, b.end_date
        FROM reviews r
        JOIN users s ON s.id = r.babysitter_id
        JOIN bookings b ON b.id = r.booking_id
        WHERE r.parent_id = $1
        ORDER BY r.created_at DESC
      `;
      params = [req.user.id];
    } else if (req.user.role === 'babysitter') {
      query = `
        SELECT r.*, p.first_name as parent_first_name, p.last_name as parent_last_name,
               b.start_date, b.end_date
        FROM reviews r
        JOIN users p ON p.id = r.parent_id
        JOIN bookings b ON b.id = r.booking_id
        WHERE r.babysitter_id = $1
        ORDER BY r.created_at DESC
      `;
      params = [req.user.id];
    } else {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;