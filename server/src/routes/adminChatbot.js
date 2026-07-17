// server/src/routes/adminChatbot.js
const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const adminChatbot = require('../services/adminChatbot');

const router = express.Router();

// All routes in this file are prefixed with /api/admin/chatbot

// POST /api/admin/chatbot/chat - Send message to admin assistant
router.post('/chat', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    // Process message through admin chatbot
    const result = await adminChatbot.processMessage(req.user.id, message);
    
    // Log admin chat activity
    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, details) 
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, 'chat_command', 'admin_chat', JSON.stringify({ message, response: result.response })]
    );

    res.json(result);
  } catch (error) {
    console.error('Admin chat error:', error);
    res.status(500).json({ 
      error: 'Server error.',
      message: error.message
    });
  }
});

// GET /api/admin/chatbot/history - Get admin chat history
router.get('/history', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const result = await db.query(
      `SELECT * FROM admin_activity_log 
       WHERE admin_id = $1 AND action = 'chat_command'
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;