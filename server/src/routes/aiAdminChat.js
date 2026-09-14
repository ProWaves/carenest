const express = require('express');
const Groq = require('groq-sdk');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Keep short history per admin for context
const histories = new Map();
const MAX_HISTORY = 8;

router.post('/chat', authenticate, authorize('admin'), async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ error: 'Message required.' });
  }

  try {
    // ---- 1. Pull a live snapshot of the platform ----
    const snapshot = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM users)                                            AS total_users,
        (SELECT COUNT(*) FROM users WHERE role='parent')                        AS parents,
        (SELECT COUNT(*) FROM users WHERE role='babysitter')                    AS babysitters,
        (SELECT COUNT(*) FROM users WHERE role='babysitter' AND suspended_at IS NOT NULL) AS suspended,
        (SELECT COUNT(*) FROM bookings)                                         AS total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status='completed')                AS completed_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status='pending')                  AS pending_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status='cancelled')                AS cancelled_bookings,
        (SELECT COUNT(*) FROM reports WHERE status='pending')                   AS pending_reports,
        (SELECT COALESCE(SUM(total_amount),0) FROM bookings WHERE status='completed') AS total_revenue
    `);

    // A few recent bookings — cheap query, gives the AI real examples
    const recent = await db.query(`
      SELECT b.id, b.status, b.total_amount, b.created_at,
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
      content: `You are CareNest's ADMIN assistant.

You are helping an admin understand the platform. You have live data:

PLATFORM SNAPSHOT:
${JSON.stringify(snapshot.rows[0], null, 2)}

RECENT BOOKINGS (5 most recent):
${JSON.stringify(recent.rows, null, 2)}

RULES:
- You may answer READ-ONLY questions: counts, revenue, users, bookings, recent activity.
- You CANNOT perform actions. If the admin asks you to warn / suspend / ban / refund / activate / delete, reply exactly:
  "Moderation actions must be typed as exact commands. Type 'help' to see them."
- Never invent numbers. Only use the data above.
- Keep replies short — 2 to 4 sentences, or a short list.
- If the question can't be answered from the snapshot above (e.g. "top babysitter this month"),
  say so and suggest the exact keyword command that would answer it.
- Tone: professional, concise, no emojis unless the admin uses them first.`
    };

    const history = histories.get(req.user.id) || [];
    const trimmed = history.slice(-MAX_HISTORY);

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
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

    res.json({ response: reply, source: 'groq' });

  } catch (err) {
    console.error('❌ Admin AI error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'AI service unavailable.' });
  }
});

// Clear conversation history
router.delete('/chat', authenticate, authorize('admin'), (req, res) => {
  histories.delete(req.user.id);
  res.json({ message: 'Cleared.' });
});

module.exports = router;