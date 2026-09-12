// server/src/db/migrations/019_add_fcm_tokens.js
const db = require('../../config/database');

const migrate = async () => {
  try {
    console.log('🔄 Running migration: 019_add_fcm_tokens');

    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS fcm_token TEXT;
    `);
    console.log('✅ Added fcm_token to users');

    console.log('✅ Migration 019 completed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrate();