// server/src/ai/admin/toolExecutor.js
// Dispatches a tool call to the matching handler in tools/index.js.

const tools = require('./tools');

async function executeTool(name, args, adminUser) {
  const handler = tools[name];

  if (typeof handler !== 'function') {
    return { error: `Unknown tool: ${name}` };
  }

  try {
    const result = await handler(args, adminUser);
    return result;
  } catch (err) {
    console.error(`❌ Tool ${name} threw:`, err);
    return { error: err.message };
  }
}

module.exports = executeTool;