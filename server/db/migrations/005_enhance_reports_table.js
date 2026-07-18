// server/src/db/migrations/005_enhance_reports_table.js
const db = require('../../src/config/database');

const migrate = async () => {
  try {
    console.log('🔄 Running migration: 005_enhance_reports_table');

    // First, check if reports table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'reports'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('⚠️ Reports table does not exist. Creating it...');
      await db.query(`
        CREATE TABLE reports (
          id SERIAL PRIMARY KEY,
          reporter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          reported_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          reason VARCHAR(255) NOT NULL,
          description TEXT,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Created reports table');
    }

    // Add columns one by one with error handling
    const columns = [
      { name: 'category', type: 'VARCHAR(50)' },
      { name: 'severity', type: 'VARCHAR(20) DEFAULT \'medium\'' },
      { name: 'booking_id', type: 'INTEGER REFERENCES bookings(id) ON DELETE SET NULL' },
      { name: 'refund_requested', type: 'BOOLEAN DEFAULT false' },
      { name: 'refund_amount', type: 'DECIMAL(10,2)' },
      { name: 'refund_status', type: 'VARCHAR(20) DEFAULT \'pending\'' },
      { name: 'admin_action', type: 'VARCHAR(50)' },
      { name: 'admin_notes', type: 'TEXT' },
      { name: 'action_taken_at', type: 'TIMESTAMP' },
    ];

    for (const col of columns) {
      try {
        await db.query(`
          ALTER TABLE reports ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};
        `);
        console.log(`✅ Added column: ${col.name}`);
      } catch (err) {
        if (err.code === '42701') {
          console.log(`ℹ️ Column ${col.name} already exists`);
        } else {
          console.log(`⚠️ Could not add column ${col.name}: ${err.message}`);
        }
      }
    }

    // Create user_reputation table
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_reputation (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        trust_score INTEGER DEFAULT 100 CHECK (trust_score BETWEEN 0 AND 100),
        total_reports_received INTEGER DEFAULT 0,
        resolved_reports INTEGER DEFAULT 0,
        warnings_issued INTEGER DEFAULT 0,
        suspensions_issued INTEGER DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created/verified user_reputation table');

    // Create indexes
    const indexes = [
      'idx_reports_status',
      'idx_reports_category',
      'idx_reports_booking_id',
      'idx_reports_reporter_id',
      'idx_reports_reported_user_id'
    ];

    for (const idx of indexes) {
      try {
        const column = idx.replace('idx_reports_', '');
        await db.query(`
          CREATE INDEX IF NOT EXISTS ${idx} ON reports(${column});
        `);
        console.log(`✅ Created index: ${idx}`);
      } catch (err) {
        console.log(`⚠️ Could not create index ${idx}: ${err.message}`);
      }
    }

    console.log('✅ Migration 005 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrate();
