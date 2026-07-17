// server/src/routes/aiChatbot.js
const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const aiChatbot = require('../services/aiChatbot');

const router = express.Router();

// POST /api/ai/chat - Send message to AI assistant
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, sessionData } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const result = await aiChatbot.processMessage(
      req.user.id,
      message,
      sessionData || {}
    );

    res.json(result);
  } catch (error) {
    console.error('AI Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ai/conversations - Get user's AI chat history
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT m.*, u.first_name, u.last_name 
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.sender_id = $1 OR m.receiver_id = $1
       AND m.content LIKE '🤖 AI Assistant:%'
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get AI conversations error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/action - Execute action from AI (e.g., create booking, report)
router.post('/action', authenticate, async (req, res) => {
  try {
    const { action, data } = req.body;
    
    let result;
    switch (action) {
      case 'create_booking':
        result = await createBookingFromAI(req.user.id, data);
        break;
      case 'create_report':
        result = await createReportFromAI(req.user.id, data);
        break;
      case 'request_refund':
        result = await requestRefundFromAI(req.user.id, data);
        break;
      case 'cancel_booking':
        result = await cancelBookingFromAI(req.user.id, data);
        break;
      default:
        return res.status(400).json({ error: 'Invalid action.' });
    }

    res.json({ success: true, result });
  } catch (error) {
    console.error('AI Action error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
async function createBookingFromAI(userId, data) {
  const { babysitter_id, start_date, end_date, start_time, end_time, notes } = data;
  
  // Get babysitter's hourly rate
  const profile = await db.query(
    'SELECT hourly_rate FROM babysitter_profiles WHERE user_id = $1',
    [babysitter_id]
  );
  
  const startDateTime = new Date(`${start_date}T${start_time}`);
  const endDateTime = new Date(`${end_date}T${end_time}`);
  const totalHours = Math.max(0, (endDateTime - startDateTime) / (1000 * 60 * 60));
  const totalAmount = totalHours * parseFloat(profile.rows[0].hourly_rate || 15);

  const result = await db.query(
    `INSERT INTO bookings (parent_id, babysitter_id, start_date, end_date, start_time, end_time, total_hours, total_amount, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [userId, babysitter_id, start_date, end_date, start_time, end_time, totalHours, totalAmount, notes || 'AI-assisted booking']
  );

  return result.rows[0];
}

async function createReportFromAI(userId, data) {
  const { reported_user_id, reason, description } = data;
  
  const result = await db.query(
    `INSERT INTO reports (reporter_id, reported_user_id, reason, description, status)
     VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
    [userId, reported_user_id, reason, description]
  );

  // Notify admins
  const admins = await db.query("SELECT id FROM users WHERE role = 'admin'");
  for (const admin of admins.rows) {
    await createNotification(
      admin.id,
      'new_report',
      '🚨 New Report from AI Assistant',
      `A new report has been created by a user via the AI assistant.`,
      '/admin?tab=reports'
    );
  }

  return result.rows[0];
}

async function requestRefundFromAI(userId, data) {
  const { booking_id, reason } = data;
  
  // Create a report for refund request
  const booking = await db.query('SELECT babysitter_id FROM bookings WHERE id = $1', [booking_id]);
  
  const result = await db.query(
    `INSERT INTO reports (reporter_id, reported_user_id, reason, description, status)
     VALUES ($1, $2, 'refund_request', $3, 'pending') RETURNING *`,
    [userId, booking.rows[0]?.babysitter_id, `Refund request for booking #${booking_id}: ${reason}`]
  );

  return result.rows[0];
}

async function cancelBookingFromAI(userId, data) {
  const { booking_id, reason } = data;
  
  const result = await db.query(
    `UPDATE bookings 
     SET status = 'cancelled', 
         cancellation_reason = $1, 
         cancelled_by = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 AND (parent_id = $2 OR babysitter_id = $2)
     RETURNING *`,
    [reason || 'Cancelled via AI assistant', userId, booking_id]
  );

  return result.rows[0];
}

// Import createNotification
const { createNotification } = require('./notifications');

module.exports = router;