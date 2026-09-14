// server/src/ai/parent/toolExecutor.js
const tools = require('./tools');

async function executeTool(name, args, user) {
  const handler = tools[name];
  if (typeof handler !== 'function') {
    return { error: `Unknown tool: ${name}` };
  }
  try {
    return await handler(args, user);
  } catch (err) {
    console.error(`❌ Parent tool ${name} threw:`, err);
    return { error: err.message };
  }
}

module.exports = executeTool;