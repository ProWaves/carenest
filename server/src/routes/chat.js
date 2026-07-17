// ==========================================================================
// Chat Routes — /api/chat
// ==========================================================================
// GET  /conversations — list all conversations for the current user
// GET  /:userId       — get messages between current user and another user
// POST /              — send a new message (persisted to DB)
// ==========================================================================

const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/chat/conversations
// Returns all unique conversations for the authenticated user, each with the
// last message preview, timestamp, and unread count. Sorted by most recent.
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT
        CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END as user_id,
        u.first_name, u.last_name, u.avatar_url, u.role,
        (SELECT content FROM messages WHERE (sender_id = $1 OR receiver_id = $1) AND (sender_id = u.id OR receiver_id = u.id) ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE (sender_id = $1 OR receiver_id = $1) AND (sender_id = u.id OR receiver_id = u.id) ORDER BY created_at DESC LIMIT 1) as last_message_time,
        (SELECT COUNT(*) FROM messages WHERE receiver_id = $1 AND sender_id = u.id AND is_read = false) as unread_count
      FROM messages m
      JOIN users u ON u.id IN (m.sender_id, m.receiver_id)
      WHERE (m.sender_id = $1 OR m.receiver_id = $1) AND u.id != $1
      ORDER BY last_message_time DESC NULLS LAST`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/chat/:userId
// Returns messages between the current user and another user.
// Optionally filtered by booking_id. Marks incoming messages as read.
router.get('/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { booking_id } = req.query;

    let sql;
    let params;
    if (booking_id) {
      // Filter by booking context
      sql = `SELECT m.*, u.first_name, u.last_name
             FROM messages m
             JOIN users u ON u.id = m.sender_id
             WHERE ((m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1))
             AND m.booking_id = $3
             ORDER BY m.created_at ASC`;
      params = [req.user.id, userId, booking_id];
    } else {
      // All messages between the two users
      sql = `SELECT m.*, u.first_name, u.last_name
             FROM messages m
             JOIN users u ON u.id = m.sender_id
             WHERE (m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1)
             ORDER BY m.created_at ASC`;
      params = [req.user.id, userId];
    }

    const result = await db.query(sql, params);

    // Mark unread messages from this user as read
    await db.query(
      'UPDATE messages SET is_read = true WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false',
      [userId, req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/chat
// Sends a new message from the authenticated user to a receiver.
router.post('/', authenticate, async (req, res) => {
  try {
    const { receiver_id, content, booking_id } = req.body;

    if (!receiver_id || !content) {
      return res.status(400).json({ error: 'Receiver and content required.' });
    }

    const result = await db.query(
      'INSERT INTO messages (sender_id, receiver_id, content, booking_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.user.id, receiver_id, content, booking_id || null]
    );

    // Fetch the full message with sender info
    const message = await db.query(
      'SELECT m.*, u.first_name, u.last_name FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = $1',
      [result.rows[0].id]
    );

    res.status(201).json(message.rows[0]);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
