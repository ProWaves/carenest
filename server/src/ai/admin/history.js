// server/src/ai/admin/history.js
// In-memory conversation history per admin.
// For production scale, swap this for a DB table later.

const { MAX_HISTORY } = require('./constants');

const histories = new Map();

function getHistory(userId) {
  return histories.get(userId) || [];
}

function appendTurn(userId, role, content, extra = {}) {
  const list = histories.get(userId) || [];
  list.push({ role, content, ...extra });
  // Keep only the last N turns
  const trimmed = list.slice(-MAX_HISTORY * 2); // *2 because user+assistant are 2 entries
  histories.set(userId, trimmed);
}

function clearHistory(userId) {
  histories.delete(userId);
}

module.exports = { getHistory, appendTurn, clearHistory };