const db = require('../../config/database');

const migrate = async () => {
  try {
    console.log('🔄 Running migration: 016_add_cancellation_reason');

    // Add cancellation_reason to bookings
    await db.query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS cancellation_reason TEXT
    `);
    console.log('✅ Added cancellation_reason to bookings');

    // Also add any other missing columns we might have missed
    await db.query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP
    `);
    console.log('✅ Added cancelled_at to bookings');

    console.log('✅ Migration 016 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrate();