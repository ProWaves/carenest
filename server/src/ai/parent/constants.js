// server/src/ai/parent/constants.js
module.exports = {
  // Free-tier friendly, faster than 120b, higher token budget
  MODEL: 'openai/gpt-oss-20b',

  // Parent queries usually need fewer rounds than admin
  MAX_TOOL_ROUNDS: 4,

  MAX_HISTORY: 8,

  TEMPERATURE: 0.5,

  MAX_TOKENS: 700,
};