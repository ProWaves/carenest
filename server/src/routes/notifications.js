// server/src/routes/notifications.js
const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
let io = null;

const setIo = (socketIo) => { io = socketIo; };

// GET /api/notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    const unread = await db.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );
    res.json({ notifications: result.rows, unread: parseInt(unread.rows[0].count) });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Marked as read.' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ message: 'All marked as read.' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// EXPORT createNotification helper
// ============================================
const createNotification = async (userId, type, title, message, link) => {
  try {
    const result = await db.query(
      'INSERT INTO notifications (user_id, type, title, message, link) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, type, title, message, link || null]
    );
    const notif = result.rows[0];
    console.log(`📨 Notification sent to user ${userId}: ${title}`);

    if (io) {
      io.to(`user_${userId}`).emit('notification:new', notif);
    }
  } catch (error) {
    console.error('Create notification error:', error);
  }
};

module.exports = router;
module.exports.createNotification = createNotification;
module.exports.setIo = setIo;