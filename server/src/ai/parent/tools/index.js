// server/src/ai/parent/tools/index.js
const parentTools = require('./parentTools');
const sharedTools = require('./sharedTools');

module.exports = {
  ...parentTools,
  ...sharedTools,
};