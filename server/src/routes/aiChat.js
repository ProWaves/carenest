// server/src/routes/aiChat.js
const express = require('express');
const Groq = require('groq-sdk');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const groq = new Groq();

// Per-user short-term memory
const histories = new Map();
const MAX_HISTORY = 8;

// ============================================================
// POST /api/ai/chat
// ============================================================
router.post('/chat', authenticate, async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    const userId = req.user.id;
    const role = req.user.role;

    const userRow = await db.query(
      'SELECT first_name, last_name, city FROM users WHERE id = $1',
      [userId]
    );
    const u = userRow.rows[0] || {};

    const systemPrompt = {
      role: 'system',
      content: `You are CareNest's AI assistant.

You are talking to ${u.first_name || 'a user'} ${u.last_name || ''},
who is a ${role}${u.city ? ` based in ${u.city}` : ''}.

Your job:
- Help parents find babysitters, create bookings, understand the refund policy, and navigate the app.
- Help babysitters find jobs, manage availability, and update their profile.
- Answer questions about CareNest in a friendly, concise, professional tone.
- Keep answers short. 2–4 sentences unless the user asks for detail.
- Never invent policies, prices, or features that don't exist in the app.`
    };

    const history = histories.get(userId) || [];
    const trimmed = history.slice(-MAX_HISTORY);

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      temperature: 0.6,
      max_tokens: 512,
      messages: [
        systemPrompt,
        ...trimmed,
        { role: 'user', content: message },
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim()
      || "I'm sorry, I couldn't process that.";

    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: reply });
    histories.set(userId, history);

    // Persist so /conversations can find it later
    try {
      await db.query(
        `INSERT INTO messages (sender_id, receiver_id, content, is_read)
         VALUES ($1, $1, $2, true)`,
        [userId, `🤖 AI Assistant: ${reply}`]
      );
    } catch (persistErr) {
      console.warn('Could not persist AI message:', persistErr.message);
    }

    res.json({ response: reply });

  } catch (error) {
    console.error('❌ Parent AI error:', error?.response?.data || error.message);
    res.status(500).json({
      error: 'AI service unavailable. Please try again shortly.',
    });
  }
});

// ============================================================
// GET /api/ai/conversations
// ============================================================
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT m.*, u.first_name, u.last_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE (m.sender_id = $1 OR m.receiver_id = $1)
         AND m.content LIKE '🤖 AI Assistant:%'
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get AI conversations error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================================
// POST /api/ai/action — kept so AIChatbot.jsx doesn't 404
// ============================================================
router.post('/action', authenticate, async (req, res) => {
  try {
    res.json({
      success: false,
      message: 'Actions are handled through the app UI, not the AI.',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear history
router.delete('/chat', authenticate, (req, res) => {
  histories.delete(req.user.id);
  res.json({ message: 'Cleared.' });
});

module.exports = router;