// server/src/db/migrations/017_add_payments.js
const db = require('../../config/database');

const migrate = async () => {
  try {
    console.log('🔄 Running migration: 017_add_payments');

    // Each statement is run separately, with its own try/catch,
    // so a failure on one doesn't stop the others.
    const statements = [
      {
        name: 'payment_method',
        sql: `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'cash'`,
      },
      {
        name: 'payment_status',
        sql: `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid'`,
      },
      {
        name: 'paid_at',
        sql: `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP`,
      },
      {
        name: 'paid_confirmed_by',
        sql: `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paid_confirmed_by INTEGER`,
      },
      {
        name: 'paid_note',
        sql: `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paid_note TEXT`,
      },
      {
        name: 'index_payment_status',
        sql: `CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status)`,
      },
    ];

    for (const stmt of statements) {
      try {
        console.log(`   → Adding ${stmt.name}...`);
        await db.query(stmt.sql);
        console.log(`   ✅ ${stmt.name}`);
      } catch (err) {
        console.error(`   ❌ ${stmt.name} FAILED:`, err.message);
        console.error(`      code: ${err.code}, detail: ${err.detail || 'none'}`);
        // continue to next statement instead of aborting
      }
    }

    // Verify at the end
    const check = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'bookings' AND column_name LIKE 'pay%'
      ORDER BY column_name
    `);
    console.log('📋 Columns now present:', check.rows.map(r => r.column_name).join(', '));

    console.log('✅ Migration 017 completed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrate();