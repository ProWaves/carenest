// ==========================================================================
// Database Migration Script
// ==========================================================================
// Adds columns that may be missing from existing tables (e.g. after schema
// changes). Run via: npm run db:migrate
// ==========================================================================

const db = require('../config/database');
require('dotenv').config();

const migrate = async () => {
  try {
    console.log('Running migrations...');

    // Add skills and emergency contact columns to babysitter_profiles if missing
    await db.query(`
      ALTER TABLE babysitter_profiles
        ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100),
        ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20);
    `);
    console.log('Added missing columns to babysitter_profiles');

    // Ensure babysitter_images table exists (may have been added after initial schema)
    await db.query(`
      CREATE TABLE IF NOT EXISTS babysitter_images (
        id SERIAL PRIMARY KEY,
        babysitter_id INTEGER REFERENCES babysitter_profiles(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        caption VARCHAR(255),
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Ensured babysitter_images table exists');

    // Add gender column to users table if missing
    await db.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other'));
    `);
    console.log('Added gender column to users');

    console.log('Migrations complete.');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
};

migrate();
