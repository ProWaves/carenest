// server/src/ai/parent/index.js
const express = require('express');
const db = require('../../config/database');
const { authenticate } = require('../../middleware/auth');

const groq = require('./groqClient');
const { MODEL, TEMPERATURE, MAX_TOKENS, MAX_TOOL_ROUNDS } = require('./constants');
const { getHistory, appendTurn, clearHistory } = require('./history');
const { buildSystemPrompt } = require('./systemPrompt');
const TOOLS = require('./toolDefinitions');
const executeTool = require('./toolExecutor');

const router = express.Router();

// ============================================================
// POST /api/ai/chat
// ============================================================
router.post('/chat', authenticate, async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    const user = req.user;
    const history = getHistory(user.id);

    const conversation = [
      { role: 'system', content: buildSystemPrompt(user) },
      ...history,
      { role: 'user', content: message },
    ];

    let finalReply = null;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        messages: conversation,
        tools: TOOLS,
        tool_choice: 'auto',
      });

      const msg = completion.choices[0]?.message;
      if (!msg) break;

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        finalReply = msg.content?.trim() || 'No response.';
        conversation.push({ role: 'assistant', content: finalReply });
        break;
      }

      conversation.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.tool_calls,
      });

      for (const call of msg.tool_calls) {
        let args = {};
        try { args = JSON.parse(call.function.arguments || '{}'); } catch {}

        let result;
        try {
          result = await executeTool(call.function.name, args, user);
        } catch (e) {
          result = { error: e.message };
        }

        conversation.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    if (!finalReply) {
      finalReply = "I couldn't complete that request. Please rephrase and try again.";
    }

    appendTurn(user.id, 'user', message);
    appendTurn(user.id, 'assistant', finalReply);

    // Persist to messages table so /conversations can find it
    try {
      await db.query(
        `INSERT INTO messages (sender_id, receiver_id, content, is_read)
         VALUES ($1, $1, $2, true)`,
        [user.id, `🤖 AI Assistant: ${finalReply}`]
      );
    } catch (persistErr) {
      console.warn('Could not persist AI message:', persistErr.message);
    }

    res.json({ response: finalReply });

  } catch (err) {
    console.error('❌ Parent AI error:', err?.response?.data || err.message);
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
// POST /api/ai/action — kept so frontend doesn't 404
// ============================================================
router.post('/action', authenticate, async (req, res) => {
  res.json({
    success: false,
    message: 'Actions are handled through the app UI, not the AI.',
  });
});

// Clear history
router.delete('/chat', authenticate, (req, res) => {
  clearHistory(req.user.id);
  res.json({ message: 'Cleared.' });
});

module.exports = router;