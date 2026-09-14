const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const adminChatbot = require('../services/adminChatbot');
const Groq = require('groq-sdk');

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const histories = new Map();
const MAX_HISTORY = 8;

// Helper: does the message look like an action command?
const ACTION_KEYWORDS = [
  'warn', 'warning', 'suspend', 'ban', 'activate', 'restore',
  'stats', 'total', 'users', 'babysitters', 'parents',
  'reports', 'reviews', 'bookings', 'cancellations',
  'find', 'search', 'lookup', 'user',
  'help', '?',
];

function looksLikeCommand(message) {
  const first = message.toLowerCase().trim().split(/\s+/)[0];
  return ACTION_KEYWORDS.includes(first);
}

router.post('/chat', authenticate, authorize('admin'), async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    // ---- Layer 1: try the deterministic keyword command engine ----
    if (looksLikeCommand(message)) {
      const result = await adminChatbot.processMessage(req.user.id, message);

      // Log activity
      await db.query(
        `INSERT INTO admin_activity_log (admin_id, action, target_type, details)
         VALUES ($1, $2, $3, $4)`,
        [req.user.id, 'chat_command', 'admin_chat',
         JSON.stringify({ message, source: 'keyword' })]
      );

      return res.json({ ...result, source: 'keyword' });
    }

    // ---- Layer 2: fall back to Groq for natural-language questions ----
    const snapshot = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM users)                                            AS total_users,
        (SELECT COUNT(*) FROM users WHERE role='parent')                        AS parents,
        (SELECT COUNT(*) FROM users WHERE role='babysitter')                    AS babysitters,
        (SELECT COUNT(*) FROM bookings)                                         AS total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status='completed')                AS completed_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status='pending')                  AS pending_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status='cancelled')                AS cancelled_bookings,
        (SELECT COUNT(*) FROM reports WHERE status='pending')                   AS pending_reports,
        (SELECT COALESCE(SUM(total_amount),0) FROM bookings WHERE status='completed') AS total_revenue
    `);

    const recent = await db.query(`
      SELECT b.id, b.status, b.total_amount,
             p.first_name AS parent_first, p.last_name AS parent_last,
             s.first_name AS sitter_first, s.last_name AS sitter_last
      FROM bookings b
      JOIN users p ON p.id = b.parent_id
      JOIN users s ON s.id = b.babysitter_id
      ORDER BY b.created_at DESC
      LIMIT 5
    `);

    const systemPrompt = {
      role: 'system',
      content: `You are CareNest's admin assistant.

PLATFORM SNAPSHOT:
${JSON.stringify(snapshot.rows[0], null, 2)}

RECENT BOOKINGS:
${JSON.stringify(recent.rows, null, 2)}

RULES:
- Answer READ-ONLY questions only.
- You CANNOT perform actions. If asked to warn/suspend/ban/refund/activate/delete, reply:
  "Moderation actions must be typed as exact commands. Type 'help' to see them."
- Never invent numbers — only use the data above.
- Keep replies to 2–4 sentences or a short list.
- If a question can't be answered from the snapshot, say so and suggest the exact keyword command that would help.`
    };

    const history = histories.get(req.user.id) || [];
    const trimmed = history.slice(-MAX_HISTORY);

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        systemPrompt,
        ...trimmed,
        { role: 'user', content: message },
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim()
      || 'No response.';

    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: reply });
    histories.set(req.user.id, history);

    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, details)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, 'chat_command', 'admin_chat',
       JSON.stringify({ message, source: 'groq' })]
    );

    res.json({ response: reply, source: 'groq' });

  } catch (err) {
    console.error('❌ Admin chat error:', err?.response?.data || err.message);
    res.status(500).json({
      error: 'Admin chat unavailable.',
      details: err.message,
    });
  }
});

// Keep existing history endpoint
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
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;