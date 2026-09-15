// server/src/db/migrations/021_add_payment_preference.js
const db = require('../../config/database');

const migrate = async () => {
  try {
    console.log('🔄 Running migration: 021_add_payment_preference');

    await db.query(`
      ALTER TABLE babysitter_profiles
      ADD COLUMN IF NOT EXISTS payment_preference VARCHAR(20) DEFAULT 'both'
        CHECK (payment_preference IN ('cash', 'online', 'both'));
    `);
    console.log('✅ Added payment_preference to babysitter_profiles');

    console.log('✅ Migration 021 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrate();