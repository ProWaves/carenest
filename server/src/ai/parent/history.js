// server/src/ai/parent/history.js
const { MAX_HISTORY } = require('./constants');

const histories = new Map();

function getHistory(userId) {
  return histories.get(userId) || [];
}

function appendTurn(userId, role, content, extra = {}) {
  const list = histories.get(userId) || [];
  list.push({ role, content, ...extra });
  histories.set(userId, list.slice(-MAX_HISTORY * 2));
}

function clearHistory(userId) {
  histories.delete(userId);
}

module.exports = { getHistory, appendTurn, clearHistory };