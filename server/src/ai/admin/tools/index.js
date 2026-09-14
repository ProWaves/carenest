// server/src/ai/admin/tools/index.js
// Aggregator. Both halves of the toolset.

const readTools = require('./readTools');
const writeTools = require('./writeTools');

module.exports = {
  ...readTools,
  ...writeTools,
};