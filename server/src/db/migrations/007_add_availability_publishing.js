// server/src/db/migrations/007_add_availability_publishing.js
const db = require('../../config/database');

const migrate = async () => {
  try {
    console.log('🔄 Running migration: 007_add_availability_publishing');

    // Add published column to babysitter_availability
    await db.query(`
      ALTER TABLE babysitter_availability 
      ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
    `);
    console.log('✅ Added is_published column');

    // Add published_at column
    await db.query(`
      ALTER TABLE babysitter_availability 
      ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;
    `);
    console.log('✅ Added published_at column');

    // Add suspension_end_date to users
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS suspension_end_date TIMESTAMP;
    `);
    console.log('✅ Added suspension_end_date to users');

    // Create index for faster queries
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_availability_published 
      ON babysitter_availability (babysitter_id, is_published, is_available);
    `);
    console.log('✅ Created index on published availability');

    console.log('✅ Migration 007 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrate();