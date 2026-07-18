// server/src/db/migrations/014_add_missing_columns.js
const db = require('../../config/database');

const migrate = async () => {
  try {
    console.log('🔄 Running migration: 014_add_missing_columns');

    // Add missing columns to users table
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
      ADD COLUMN IF NOT EXISTS suspension_end_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS suspended_by INTEGER REFERENCES users(id)
    `);
    console.log('✅ Added suspension columns to users');

    // Create parent_reviews table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS parent_reviews (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        babysitter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(booking_id, babysitter_id)
      )
    `);
    console.log('✅ parent_reviews table created');

    // Create admin_activity_log table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_activity_log (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(50),
        target_id INTEGER,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ admin_activity_log table created');

    console.log('✅ Migration 014 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrate();