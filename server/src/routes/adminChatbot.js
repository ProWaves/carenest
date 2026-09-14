const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const adminChatbot = require('../services/adminChatbot');
const Groq = require('groq-sdk');

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Conversation history per admin
const histories = new Map();
const MAX_HISTORY = 8;

// Messages that should always go to the deterministic keyword engine
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

// ============================================================
// TOOLS — the AI can call these to query the database
// ============================================================
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_platform_stats',
      description: 'Get current platform counts (users, bookings, revenue, pending reports). Use this for any "how many" or "total" question.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_babysitters',
      description: 'List babysitters. Use when the admin asks to see, list, or find babysitters.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'], description: 'Filter by approval status' },
          city: { type: 'string', description: 'Filter by city (partial match)' },
          sort: { type: 'string', enum: ['newest', 'rating', 'rate'], description: 'Sort order' },
          limit: { type: 'integer', description: 'Max results (default 20, max 50)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_parents',
      description: 'List parents. Use when the admin asks to see or list parents.',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'Filter by city' },
          limit: { type: 'integer', description: 'Max results (default 20, max 50)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_user',
      description: 'Search for a user by name, email, or partial match. Returns matching users with their status.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name, email, or fragment to search for' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_bookings',
      description: 'List recent bookings. Use when the admin asks about bookings.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] },
          limit: { type: 'integer', description: 'Max results (default 10, max 30)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_reports',
      description: 'List reports. Use when the admin asks about reports or complaints.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'reviewed', 'resolved', 'dismissed'] },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          limit: { type: 'integer', description: 'Max results (default 10, max 30)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_top_babysitters',
      description: 'Get babysitters with the most completed bookings. Use for "top" or "best" babysitter questions.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'Max results (default 5)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_warnings',
      description: 'Get warning history for a specific user by ID.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'integer', description: 'User ID' },
        },
        required: ['user_id'],
      },
    },
  },
];

// ============================================================
// TOOL IMPLEMENTATIONS — actual DB queries
// ============================================================
async function runTool(name, args) {
  switch (name) {
    case 'get_platform_stats': {
      const r = await db.query(`
        SELECT
          (SELECT COUNT(*) FROM users)                                          AS total_users,
          (SELECT COUNT(*) FROM users WHERE role='parent')                      AS parents,
          (SELECT COUNT(*) FROM users WHERE role='babysitter')                  AS babysitters,
          (SELECT COUNT(*) FROM users WHERE role='babysitter' AND suspended_at IS NOT NULL) AS suspended,
          (SELECT COUNT(*) FROM bookings)                                       AS total_bookings,
          (SELECT COUNT(*) FROM bookings WHERE status='completed')              AS completed_bookings,
          (SELECT COUNT(*) FROM bookings WHERE status='pending')                AS pending_bookings,
          (SELECT COUNT(*) FROM bookings WHERE status='cancelled')              AS cancelled_bookings,
          (SELECT COUNT(*) FROM reports WHERE status='pending')                 AS pending_reports,
          (SELECT COALESCE(SUM(total_amount),0) FROM bookings WHERE status='completed') AS total_revenue
      `);
      return r.rows[0];
    }

    case 'list_babysitters': {
      const limit = Math.min(args.limit || 20, 50);
      const params = [];
      let where = "u.role='babysitter'";

      if (args.status) {
        params.push(args.status);
        where += ` AND bp.status = $${params.length}`;
      }
      if (args.city) {
        params.push(`%${args.city}%`);
        where += ` AND LOWER(u.city) LIKE LOWER($${params.length})`;
      }

      let order = 'u.id DESC';
      if (args.sort === 'rating') order = 'avg_rating DESC NULLS LAST';
      else if (args.sort === 'rate') order = 'bp.hourly_rate DESC NULLS LAST';

      params.push(limit);

      const r = await db.query(`
        SELECT u.id, u.first_name, u.last_name, u.email, u.city,
               bp.status, bp.is_verified, bp.hourly_rate,
               (SELECT COALESCE(AVG(rating),0) FROM reviews WHERE babysitter_id=u.id) AS avg_rating,
               (SELECT COUNT(*) FROM bookings WHERE babysitter_id=u.id AND status='completed') AS completed_bookings
        FROM users u
        JOIN babysitter_profiles bp ON bp.user_id = u.id
        WHERE ${where}
        ORDER BY ${order}
        LIMIT $${params.length}
      `, params);

      return { count: r.rows.length, babysitters: r.rows };
    }

    case 'list_parents': {
      const limit = Math.min(args.limit || 20, 50);
      const params = [];
      let where = "role='parent'";
      if (args.city) {
        params.push(`%${args.city}%`);
        where += ` AND LOWER(city) LIKE LOWER($${params.length})`;
      }
      params.push(limit);
      const r = await db.query(`
        SELECT id, first_name, last_name, email, city, created_at
        FROM users WHERE ${where}
        ORDER BY id DESC LIMIT $${params.length}
      `, params);
      return { count: r.rows.length, parents: r.rows };
    }

    case 'find_user': {
      const q = `%${args.query}%`;
      const r = await db.query(`
        SELECT id, first_name, last_name, email, role, city,
               is_active, suspended_at, suspension_reason, created_at
        FROM users
        WHERE LOWER(first_name) LIKE LOWER($1)
           OR LOWER(last_name)  LIKE LOWER($1)
           OR LOWER(email)      LIKE LOWER($1)
           OR CONCAT(first_name,' ',last_name) ILIKE $1
        ORDER BY id DESC LIMIT 10
      `, [q]);
      return { count: r.rows.length, users: r.rows };
    }

    case 'list_bookings': {
      const limit = Math.min(args.limit || 10, 30);
      const params = [];
      let where = '1=1';
      if (args.status) {
        params.push(args.status);
        where += ` AND b.status = $${params.length}`;
      }
      params.push(limit);
      const r = await db.query(`
        SELECT b.id, b.status, b.total_amount, b.start_date, b.created_at,
               p.first_name || ' ' || p.last_name AS parent_name,
               s.first_name || ' ' || s.last_name AS babysitter_name
        FROM bookings b
        JOIN users p ON p.id = b.parent_id
        JOIN users s ON s.id = b.babysitter_id
        WHERE ${where}
        ORDER BY b.created_at DESC
        LIMIT $${params.length}
      `, params);
      return { count: r.rows.length, bookings: r.rows };
    }

    case 'list_reports': {
      const limit = Math.min(args.limit || 10, 30);
      const params = [];
      let where = '1=1';
      if (args.status) {
        params.push(args.status);
        where += ` AND r.status = $${params.length}`;
      }
      if (args.severity) {
        params.push(args.severity);
        where += ` AND r.severity = $${params.length}`;
      }
      params.push(limit);
      const r = await db.query(`
        SELECT r.id, r.status, r.severity, r.category, r.reason,
               r.created_at,
               rep.first_name || ' ' || rep.last_name AS reporter_name,
               repu.first_name || ' ' || repu.last_name AS reported_name
        FROM reports r
        LEFT JOIN users rep  ON rep.id  = r.reporter_id
        LEFT JOIN users repu ON repu.id = r.reported_user_id
        WHERE ${where}
        ORDER BY r.created_at DESC
        LIMIT $${params.length}
      `, params);
      return { count: r.rows.length, reports: r.rows };
    }

    case 'get_top_babysitters': {
      const limit = Math.min(args.limit || 5, 20);
      const r = await db.query(`
        SELECT u.id, u.first_name, u.last_name, u.city,
               COUNT(b.id) AS completed_bookings,
               COALESCE(SUM(b.total_amount),0) AS revenue,
               (SELECT COALESCE(AVG(rating),0) FROM reviews WHERE babysitter_id=u.id) AS avg_rating
        FROM users u
        JOIN bookings b ON b.babysitter_id = u.id AND b.status='completed'
        WHERE u.role='babysitter'
        GROUP BY u.id
        ORDER BY completed_bookings DESC
        LIMIT $1
      `, [limit]);
      return { count: r.rows.length, babysitters: r.rows };
    }

    case 'get_user_warnings': {
      const r = await db.query(`
        SELECT COUNT(*) AS warning_count,
               array_agg(id ORDER BY created_at DESC) AS report_ids
        FROM reports
        WHERE reported_user_id = $1
          AND admin_action = 'warning'
          AND status = 'resolved'
          AND created_at > NOW() - INTERVAL '90 days'
      `, [args.user_id]);
      return r.rows[0];
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ============================================================
// MAIN CHAT HANDLER
// ============================================================
router.post('/chat', authenticate, authorize('admin'), async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message is required.' });

  try {
    // ---- Layer 1: deterministic keyword commands ----
    if (looksLikeCommand(message)) {
      const result = await adminChatbot.processMessage(req.user.id, message);

      await db.query(
        `INSERT INTO admin_activity_log (admin_id, action, target_type, details)
         VALUES ($1, $2, $3, $4)`,
        [req.user.id, 'chat_command', 'admin_chat',
         JSON.stringify({ message, source: 'keyword' })]
      );

      return res.json({ ...result, source: 'keyword' });
    }

    // ---- Layer 2: Groq with tool calling ----
    const history = histories.get(req.user.id) || [];
    const trimmed = history.slice(-MAX_HISTORY);

    const systemPrompt = {
      role: 'system',
      content: `You are CareNest's admin assistant.

You help the admin understand the platform by answering questions using the tools provided.

RULES:
- Call tools when you need data. Never invent numbers, names, or IDs.
- You CANNOT perform moderation actions (warn, suspend, ban, refund).
  If the admin asks for one of those, reply:
  "Moderation actions must be typed as exact commands. Type 'help' to see them."
- Keep replies short — 2 to 4 sentences, or a compact list.
- After calling tools, summarize the results in plain language.
- Tone: professional, concise. No emojis unless the admin uses them first.`
    };

    let conversation = [
      systemPrompt,
      ...trimmed,
      { role: 'user', content: message },
    ];

    // Loop up to 3 times to allow multi-step tool calls
    let toolCallCount = 0;
    let finalReply = null;
    const MAX_TOOL_ROUNDS = 3;

    while (toolCallCount < MAX_TOOL_ROUNDS) {
      const completion = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        temperature: 0.2,
        max_tokens: 700,
        messages: conversation,
        tools: TOOLS,
        tool_choice: 'auto',
      });

      const msg = completion.choices[0]?.message;

      // No tool call → this is the final answer
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        finalReply = msg.content?.trim() || 'No response.';
        conversation.push({ role: 'assistant', content: finalReply });
        break;
      }

      // Append the assistant's tool-call message to conversation
      conversation.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.tool_calls,
      });

      // Execute each requested tool
      for (const call of msg.tool_calls) {
        let parsedArgs = {};
        try { parsedArgs = JSON.parse(call.function.arguments || '{}'); } catch {}

        let result;
        try {
          result = await runTool(call.function.name, parsedArgs);
        } catch (e) {
          result = { error: e.message };
        }

        conversation.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }

      toolCallCount++;
    }

    if (!finalReply) {
      finalReply = "I wasn't able to complete that request. Please try rephrasing.";
    }

    // Save to history
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: finalReply });
    histories.set(req.user.id, history);

    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, details)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, 'chat_command', 'admin_chat',
       JSON.stringify({ message, source: 'groq', tools_used: toolCallCount })]
    );

    res.json({ response: finalReply, source: 'groq' });

  } catch (err) {
    console.error('❌ Admin chat error:', err?.response?.data || err.message);
    res.status(500).json({
      error: 'Admin chat unavailable.',
      details: err.message,
    });
  }
});

// Clear conversation history for the current admin
router.delete('/chat', authenticate, authorize('admin'), (req, res) => {
  histories.delete(req.user.id);
  res.json({ message: 'Cleared.' });
});

// Keep the existing history endpoint
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