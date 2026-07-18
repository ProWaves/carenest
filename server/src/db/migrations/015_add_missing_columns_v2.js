const db = require('../../config/database');

const migrate = async () => {
  try {
    console.log('🔄 Running migration: 015_add_missing_columns_v2');

    // Add cancelled_by to bookings
    await db.query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS cancelled_by INTEGER REFERENCES users(id)
    `);
    console.log('✅ Added cancelled_by to bookings');

    // Add admin_notes to reports
    await db.query(`
      ALTER TABLE reports 
      ADD COLUMN IF NOT EXISTS admin_notes TEXT
    `);
    console.log('✅ Added admin_notes to reports');

    // Add admin_action to reports
    await db.query(`
      ALTER TABLE reports 
      ADD COLUMN IF NOT EXISTS admin_action VARCHAR(50)
    `);
    console.log('✅ Added admin_action to reports');

    // Add job_post_id to reports
    await db.query(`
      ALTER TABLE reports 
      ADD COLUMN IF NOT EXISTS job_post_id INTEGER REFERENCES job_posts(id) ON DELETE SET NULL
    `);
    console.log('✅ Added job_post_id to reports');

    // Add refund_requested to reports
    await db.query(`
      ALTER TABLE reports 
      ADD COLUMN IF NOT EXISTS refund_requested BOOLEAN DEFAULT false
    `);
    console.log('✅ Added refund_requested to reports');

    // Add refund_amount to reports
    await db.query(`
      ALTER TABLE reports 
      ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10,2)
    `);
    console.log('✅ Added refund_amount to reports');

    // Add refund_status to reports
    await db.query(`
      ALTER TABLE reports 
      ADD COLUMN IF NOT EXISTS refund_status VARCHAR(20) DEFAULT 'pending'
    `);
    console.log('✅ Added refund_status to reports');

    // Add action_taken_at to reports
    await db.query(`
      ALTER TABLE reports 
      ADD COLUMN IF NOT EXISTS action_taken_at TIMESTAMP
    `);
    console.log('✅ Added action_taken_at to reports');

    // Add severity to reports
    await db.query(`
      ALTER TABLE reports 
      ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'medium'
    `);
    console.log('✅ Added severity to reports');

    console.log('✅ Migration 015 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrate();