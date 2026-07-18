const db = require('../../config/database');

const migrate = async () => {
  try {
    console.log('🔄 Running migration: 013_fix_reports_columns');

    // Add admin_id column
    await db.query(`
      ALTER TABLE reports 
      ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES users(id);
    `);
    console.log('✅ Added admin_id to reports');

    // Add job_post_id column
    await db.query(`
      ALTER TABLE reports 
      ADD COLUMN IF NOT EXISTS job_post_id INTEGER REFERENCES job_posts(id) ON DELETE SET NULL;
    `);
    console.log('✅ Added job_post_id to reports');

    // Add indexes for performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_reports_admin_id ON reports(admin_id);
      CREATE INDEX IF NOT EXISTS idx_reports_job_post_id ON reports(job_post_id);
    `);
    console.log('✅ Created indexes on reports');

    console.log('✅ Migration 013 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrate();