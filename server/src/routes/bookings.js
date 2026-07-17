// server/src/routes/bookings.js
const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { createNotification } = require('../routes/notifications');

const router = express.Router();

// GET /api/bookings
router.get('/', authenticate, async (req, res) => {
  try {
    console.log('🔍 Fetching bookings for user:', req.user.id);
    console.log('👤 User role:', req.user.role);
    
    let sql, params;
    if (req.user.role === 'parent') {
      sql = `
        SELECT b.*, 
          u.first_name as babysitter_first_name, u.last_name as babysitter_last_name,
          c.name as child_name,
          b.cancellation_reason,
          uc.first_name as cancelled_by_first_name, uc.last_name as cancelled_by_last_name
        FROM bookings b
        JOIN users u ON u.id = b.babysitter_id
        LEFT JOIN children c ON c.id = b.child_id
        LEFT JOIN users uc ON uc.id = b.cancelled_by
        WHERE b.parent_id = $1 
        ORDER BY b.created_at DESC`;
      params = [req.user.id];
    } else if (req.user.role === 'babysitter') {
      sql = `
        SELECT b.*, 
          u.first_name as parent_first_name, u.last_name as parent_last_name,
          c.name as child_name,
          b.cancellation_reason,
          uc.first_name as cancelled_by_first_name, uc.last_name as cancelled_by_last_name
        FROM bookings b
        JOIN users u ON u.id = b.parent_id
        LEFT JOIN children c ON c.id = b.child_id
        LEFT JOIN users uc ON uc.id = b.cancelled_by
        WHERE b.babysitter_id = $1 
        ORDER BY b.created_at DESC`;
      params = [req.user.id];
    } else {
      sql = `
        SELECT b.*, 
          p.first_name as parent_first_name, p.last_name as parent_last_name,
          s.first_name as babysitter_first_name, s.last_name as babysitter_last_name,
          b.cancellation_reason,
          uc.first_name as cancelled_by_first_name, uc.last_name as cancelled_by_last_name
        FROM bookings b
        JOIN users p ON p.id = b.parent_id
        JOIN users s ON s.id = b.babysitter_id
        LEFT JOIN users uc ON uc.id = b.cancelled_by
        ORDER BY b.created_at DESC`;
      params = [];
    }

    const result = await db.query(sql, params);
    console.log('✅ Bookings found:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get bookings error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Server error.', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// POST /api/bookings - Create booking with slot locking
router.post('/', authenticate, authorize('parent'), async (req, res) => {
  try {
    const { babysitter_id, child_id, start_date, end_date, start_time, end_time, notes, slot_ids } = req.body;

    // Check if parent is suspended
    const parentCheck = await db.query(
      'SELECT suspended_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (parentCheck.rows[0]?.suspended_at) {
      return res.status(403).json({ error: 'Your account is suspended. Cannot make bookings.' });
    }

    // Check if babysitter is suspended
    const sitterCheck = await db.query(
      `SELECT u.suspended_at, bp.status 
       FROM users u 
       JOIN babysitter_profiles bp ON bp.user_id = u.id 
       WHERE u.id = $1`,
      [babysitter_id]
    );
    if (sitterCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Babysitter not found.' });
    }
    if (sitterCheck.rows[0].suspended_at) {
      return res.status(403).json({ error: 'Babysitter account is suspended.' });
    }
    if (sitterCheck.rows[0].status !== 'approved') {
      return res.status(403).json({ error: 'Babysitter profile not approved.' });
    }

    // Get hourly rate
    const profile = await db.query(
      'SELECT hourly_rate FROM babysitter_profiles WHERE user_id = $1',
      [babysitter_id]
    );

    // Calculate total
    const startDateTime = new Date(`${start_date}T${start_time}`);
    const endDateTime = new Date(`${end_date}T${end_time}`);
    const totalHours = Math.max(0, (endDateTime - startDateTime) / (1000 * 60 * 60));
    const totalAmount = totalHours * parseFloat(profile.rows[0].hourly_rate);

    // Begin transaction
    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create booking
      const result = await client.query(
        `INSERT INTO bookings (parent_id, babysitter_id, child_id, start_date, end_date, start_time, end_time, total_hours, total_amount, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [req.user.id, babysitter_id, child_id || null, start_date, end_date, start_time, end_time, totalHours, totalAmount, notes]
      );

      const booking = result.rows[0];

      // If slot_ids provided, mark them as booked
      if (slot_ids && Array.isArray(slot_ids) && slot_ids.length > 0) {
        // Verify all slots belong to this babysitter and are available
        const slotCheck = await client.query(
          `SELECT id FROM babysitter_availability 
           WHERE id = ANY($1::int[]) 
           AND babysitter_id = (SELECT id FROM babysitter_profiles WHERE user_id = $2)
           AND is_booked = false
           AND is_published = true`,
          [slot_ids, babysitter_id]
        );

        if (slotCheck.rows.length !== slot_ids.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            error: 'One or more selected slots are no longer available. Please refresh and try again.' 
          });
        }

        for (const slotId of slot_ids) {
          await client.query(
            `UPDATE babysitter_availability 
             SET is_booked = true, 
                 booked_booking_id = $1,
                 booked_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [booking.id, slotId]
          );
        }
      }

      await client.query('COMMIT');

      // Notify babysitter
      await createNotification(
        parseInt(babysitter_id),
        'new_booking',
        '📅 New Booking Request',
        `You have a new booking request from ${req.user.first_name} ${req.user.last_name}`,
        '/dashboard?tab=bookings'
      );

      res.status(201).json(booking);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// PUT /api/bookings/:id/cancel - Cancel booking and FREE SLOTS
// Babysitter AND Parent can cancel
// ============================================
router.put('/:id/cancel', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    console.log(`🔄 Cancelling booking #${id}...`);

    // Get the booking
    const booking = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (booking.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const b = booking.rows[0];

    // Check if booking can be cancelled
    if (b.status === 'completed') {
      return res.status(400).json({ error: 'Cannot cancel a completed booking.' });
    }

    if (b.status === 'cancelled') {
      return res.status(400).json({ error: 'Booking is already cancelled.' });
    }

    // Allow BOTH parent AND babysitter to cancel
    if (req.user.role === 'parent' && b.parent_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }
    if (req.user.role === 'babysitter' && b.babysitter_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    // Check if user is suspended
    const userCheck = await db.query(
      'SELECT suspended_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (userCheck.rows[0]?.suspended_at) {
      return res.status(403).json({ error: 'Your account is suspended.' });
    }

    // Begin transaction to cancel booking AND free slots
    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Update booking status to cancelled
      const result = await client.query(
        `UPDATE bookings 
         SET status = 'cancelled', 
             cancellation_reason = $1, 
             cancelled_by = $2,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3 
         RETURNING *`,
        [reason || 'No reason provided', req.user.id, id]
      );

      console.log(`✅ Booking #${id} cancelled by user ${req.user.id}`);

      // 2. FREE ALL SLOTS BOOKED BY THIS BOOKING
      const freedSlots = await client.query(
        `UPDATE babysitter_availability 
         SET is_booked = false, 
             booked_booking_id = NULL,
             booked_at = NULL
         WHERE booked_booking_id = $1
         RETURNING id, day_of_week, start_time, end_time`,
        [id]
      );

      console.log(`✅ Freed ${freedSlots.rows.length} slots for cancelled booking #${id}`);

      await client.query('COMMIT');

      // Notify the other party
      const otherPartyId = req.user.id === b.parent_id ? b.babysitter_id : b.parent_id;
      await createNotification(
        otherPartyId,
        'booking_cancelled',
        '❌ Booking Cancelled',
        `Your booking has been cancelled by ${req.user.first_name} ${req.user.last_name}. Reason: ${reason || 'No reason provided'}`,
        '/dashboard?tab=bookings'
      );

      res.json({
        message: 'Booking cancelled successfully.',
        booking: result.rows[0],
        freedSlots: freedSlots.rows.length
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Error in cancellation transaction:', err);
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Cancel booking error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/bookings/:id/status - Update status
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['confirmed', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const booking = await db.query('SELECT * FROM bookings WHERE id = $1', [id]);
    if (booking.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const b = booking.rows[0];

    if (b.status === 'completed') {
      return res.status(400).json({ error: 'Cannot change status of a completed booking.' });
    }

    if (b.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot change status of a cancelled booking.' });
    }

    if (req.user.role === 'parent' && b.parent_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }
    if (req.user.role === 'babysitter' && b.babysitter_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const userCheck = await db.query(
      'SELECT suspended_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (userCheck.rows[0]?.suspended_at) {
      return res.status(403).json({ error: 'Your account is suspended.' });
    }

    const result = await db.query(
      'UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (status === 'completed') {
      await db.query(
        'UPDATE babysitter_profiles SET is_verified = true WHERE user_id = $1',
        [b.babysitter_id]
      );
    }

    const otherPartyId = req.user.id === b.parent_id ? b.babysitter_id : b.parent_id;
    const statusMessages = {
      confirmed: '✅ Your booking has been confirmed!',
      in_progress: '🔄 Your booking is now in progress.',
      completed: '🎉 Your booking is complete! Please leave a review.',
    };

    if (statusMessages[status]) {
      await createNotification(
        otherPartyId,
        'booking_update',
        `Booking ${status}`,
        statusMessages[status],
        '/dashboard?tab=bookings'
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/bookings/:id - Get single booking
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT b.*,
        p.first_name as parent_first_name, p.last_name as parent_last_name, p.phone as parent_phone, p.city as parent_city,
        s.first_name as babysitter_first_name, s.last_name as babysitter_last_name, s.phone as babysitter_phone, s.city as babysitter_city,
        c.name as child_name, c.age as child_age,
        b.cancellation_reason,
        uc.first_name as cancelled_by_first_name, uc.last_name as cancelled_by_last_name
      FROM bookings b
      JOIN users p ON p.id = b.parent_id
      JOIN users s ON s.id = b.babysitter_id
      LEFT JOIN children c ON c.id = b.child_id
      LEFT JOIN users uc ON uc.id = b.cancelled_by
      WHERE b.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/bookings/parent-reviews - Babysitter reviews parent
router.post('/parent-reviews', authenticate, authorize('babysitter'), async (req, res) => {
  try {
    const { booking_id, parent_id, rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    const booking = await db.query(
      'SELECT * FROM bookings WHERE id = $1 AND babysitter_id = $2 AND status = $3',
      [booking_id, req.user.id, 'completed']
    );
    if (booking.rows.length === 0) {
      return res.status(400).json({ error: 'Booking not found or not completed.' });
    }

    const existing = await db.query(
      'SELECT id FROM parent_reviews WHERE booking_id = $1 AND babysitter_id = $2',
      [booking_id, req.user.id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Review already exists for this booking.' });
    }

    const result = await db.query(
      `INSERT INTO parent_reviews (booking_id, parent_id, babysitter_id, rating, comment) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [booking_id, parent_id, req.user.id, rating, comment]
    );

    await createNotification(
      parseInt(parent_id),
      'parent_review',
      '📝 You\'ve been reviewed!',
      `${req.user.first_name} ${req.user.last_name} left you a review.`,
      '/dashboard?tab=reviews'
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create parent review error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/bookings/parent-reviews
router.get('/parent-reviews', authenticate, async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'parent') {
      query = `
        SELECT pr.*, s.first_name as babysitter_first_name, s.last_name as babysitter_last_name,
               b.start_date, b.end_date
        FROM parent_reviews pr
        JOIN users s ON s.id = pr.babysitter_id
        JOIN bookings b ON b.id = pr.booking_id
        WHERE pr.parent_id = $1
        ORDER BY pr.created_at DESC
      `;
      params = [req.user.id];
    } else if (req.user.role === 'babysitter') {
      query = `
        SELECT pr.*, p.first_name as parent_first_name, p.last_name as parent_last_name,
               b.start_date, b.end_date
        FROM parent_reviews pr
        JOIN users p ON p.id = pr.parent_id
        JOIN bookings b ON b.id = pr.booking_id
        WHERE pr.babysitter_id = $1
        ORDER BY pr.created_at DESC
      `;
      params = [req.user.id];
    } else {
      query = `
        SELECT pr.*, p.first_name as parent_first_name, p.last_name as parent_last_name,
               s.first_name as babysitter_first_name, s.last_name as babysitter_last_name,
               b.start_date, b.end_date
        FROM parent_reviews pr
        JOIN users p ON p.id = pr.parent_id
        JOIN users s ON s.id = pr.babysitter_id
        JOIN bookings b ON b.id = pr.booking_id
        ORDER BY pr.created_at DESC
      `;
      params = [];
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get parent reviews error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;