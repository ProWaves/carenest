// server/src/db/migrations/004_add_user_locations.js
const db = require('../../config/database');

const migrate = async () => {
  try {
    console.log('🔄 Running migration: 004_add_user_locations');

    // Create user_locations table
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_locations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        location_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created user_locations table');

    // Add index for faster geolocation queries
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_user_locations_coords 
      ON user_locations (latitude, longitude);
    `);
    console.log('✅ Created index on user_locations');

    console.log('✅ Migration 004 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrate();