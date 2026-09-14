// server/src/ai/admin/index.js
// Main router. Mounts POST /admin/chatbot/chat (same URL the frontend uses).

const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const db = require('../../config/database');

const groq = require('./groqClient');
const { MODEL, TEMPERATURE, MAX_TOKENS, MAX_TOOL_ROUNDS } = require('./constants');
const { getHistory, appendTurn, clearHistory } = require('./history');
const { buildSystemPrompt } = require('./systemPrompt');
const TOOLS = require('./toolDefinitions');
const executeTool = require('./toolExecutor');

const router = express.Router();

router.post('/chat', authenticate, authorize('admin'), async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    // ---- Build conversation ----
    const adminName = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim();
    const history = getHistory(req.user.id);

    const conversation = [
      { role: 'system', content: buildSystemPrompt(adminName) },
      ...history,
      { role: 'user', content: message },
    ];

    // ---- Tool-calling loop ----
    let finalReply = null;
    const toolsUsed = [];

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

      // No tool calls → final answer
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        finalReply = msg.content?.trim() || 'No response.';
        conversation.push({ role: 'assistant', content: finalReply });
        break;
      }

      // Append assistant's tool-call message
      conversation.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.tool_calls,
      });

      // Execute each tool call
      for (const call of msg.tool_calls) {
        let args = {};
        try { args = JSON.parse(call.function.arguments || '{}'); } catch {}

        let result;
        try {
          result = await executeTool(call.function.name, args, req.user);
          toolsUsed.push({ tool: call.function.name, args });
        } catch (e) {
          console.error(`❌ Tool ${call.function.name} failed:`, e.message);
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
      finalReply = "I wasn't able to complete that request in the allowed number of steps. Please try rephrasing.";
    }

    // ---- Persist history ----
    appendTurn(req.user.id, 'user', message);
    appendTurn(req.user.id, 'assistant', finalReply);

    // ---- Log admin activity ----
    try {
      await db.query(
        `INSERT INTO admin_activity_log (admin_id, action, target_type, details)
         VALUES ($1, $2, $3, $4)`,
        [
          req.user.id,
          'ai_chat',
          'admin_ai',
          JSON.stringify({
            message,
            tools_used: toolsUsed,
            response_length: finalReply.length,
          }),
        ]
      );
    } catch (logErr) {
      console.warn('Could not log admin AI activity:', logErr.message);
    }

    res.json({
      response: finalReply,
      tools_used: toolsUsed,
      source: 'ai',
    });

  } catch (err) {
    console.error('❌ Admin AI error:', err?.response?.data || err.message);
    res.status(500).json({
      error: 'Admin AI unavailable.',
      details: err.message,
    });
  }
});

// Clear history
router.delete('/chat', authenticate, authorize('admin'), (req, res) => {
  clearHistory(req.user.id);
  res.json({ message: 'Cleared.' });
});

// History view
router.get('/history', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const result = await db.query(
      `SELECT * FROM admin_activity_log
       WHERE admin_id = $1 AND action = 'ai_chat'
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