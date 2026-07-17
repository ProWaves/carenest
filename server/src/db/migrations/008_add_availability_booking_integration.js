// server/src/db/migrations/008_add_availability_booking_integration.js
const db = require('../../config/database');

const migrate = async () => {
  try {
    console.log('🔄 Running migration: 008_add_availability_booking_integration');

    // Add booked status to babysitter_availability
    await db.query(`
      ALTER TABLE babysitter_availability 
      ADD COLUMN IF NOT EXISTS is_booked BOOLEAN DEFAULT false;
    `);
    console.log('✅ Added is_booked column');

    // Add booked_booking_id to track which booking took this slot
    await db.query(`
      ALTER TABLE babysitter_availability 
      ADD COLUMN IF NOT EXISTS booked_booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL;
    `);
    console.log('✅ Added booked_booking_id column');

    // Add booked_at timestamp
    await db.query(`
      ALTER TABLE babysitter_availability 
      ADD COLUMN IF NOT EXISTS booked_at TIMESTAMP;
    `);
    console.log('✅ Added booked_at column');

    // Create index for faster queries
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_availability_booked 
      ON babysitter_availability (babysitter_id, is_booked, is_published);
    `);
    console.log('✅ Created index on booked availability');

    console.log('✅ Migration 008 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrate();