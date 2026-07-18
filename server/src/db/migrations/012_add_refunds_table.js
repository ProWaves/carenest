const db = require('../../config/database');

const migrate = async () => {
  try {
    console.log('🔄 Running migration: 012_add_refunds_table');

    await db.query(`
      CREATE TABLE IF NOT EXISTS refunds (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        report_id INTEGER REFERENCES reports(id) ON DELETE SET NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
        processed_by INTEGER REFERENCES users(id),
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created refunds table');

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_refunds_user_id ON refunds(user_id);
      CREATE INDEX IF NOT EXISTS idx_refunds_booking_id ON refunds(booking_id);
      CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
    `);
    console.log('✅ Created indexes on refunds');

    console.log('✅ Migration 012 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrate();