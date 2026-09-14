// server/src/ai/parent/groqClient.js
const Groq = require('groq-sdk');

if (!process.env.GROQ_API_KEY) {
  console.warn('⚠️  GROQ_API_KEY is not set — parent AI will not work.');
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

module.exports = groq;