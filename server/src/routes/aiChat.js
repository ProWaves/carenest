// server/src/routes/aiChat.js
const express = require('express');
const Groq = require('groq-sdk');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

const groq = new Groq();

// In-memory history per user (fine for dev; move to DB later)
const histories = new Map();

router.post('/chat', authenticate, async (req, res) => {
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    const userId = req.user.id;
    const history = histories.get(userId) || [];

    // Keep the last 10 messages for context
    const trimmed = history.slice(-10);

    const systemPrompt = {
      role: 'system',
      content: `You are CareNest's AI assistant. Help parents find babysitters,
manage bookings, request refunds, and answer questions about the platform.
Be friendly, concise, and helpful. If the user is a babysitter, focus on jobs and availability.`
    };

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        systemPrompt,
        ...trimmed,
        { role: 'user', content: message }
      ],
      model: 'openai/gpt-oss-20b',
      temperature: 0.7,
      max_completion_tokens: 1024,
    });

    const reply = chatCompletion.choices[0]?.message?.content
      || "I'm sorry, I couldn't process that.";

    // Save to history
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: reply });
    histories.set(userId, history);

    res.json({ response: reply });

  } catch (error) {
    console.error('Groq error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;