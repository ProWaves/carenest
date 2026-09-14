// server/src/ai/admin/constants.js
// Central place for tunables. Change once, applies everywhere.

module.exports = {
  // Groq model — free tier, 500 T/s, good reasoning
  MODEL: 'openai/gpt-oss-120b',

  // How many tool-call rounds the AI can do per user message
  MAX_TOOL_ROUNDS: 5,

  // How many past turns to keep per admin
  MAX_HISTORY: 8,

  // Soft cap for BULK destructive actions.
  // Single-row actions are always allowed (with an "are you sure?" in chat).
  // If a bulk operation would affect more than this many rows, the AI refuses
  // and tells the admin to run it manually via SQL.
  BULK_DELETE_CAP: 10,

  // Temperature: low = consistent, factual. High = creative.
  TEMPERATURE: 0.2,

  // Max tokens per LLM response
  MAX_TOKENS: 900,
};