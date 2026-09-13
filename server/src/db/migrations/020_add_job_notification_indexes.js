// server/src/db/migrations/020_add_job_notification_indexes.js
const db = require('../../config/database');

const migrate = async () => {
  try {
    console.log('🔄 Running migration: 020_add_job_notification_indexes');

    // Index for the "matching babysitters" query in POST /api/jobs
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_babysitter_availability_lookup
        ON babysitter_availability (day_of_week, is_published, is_available, is_booked)
        WHERE is_published = true AND is_available = true AND is_booked = false;
    `);
    console.log('✅ Created idx_babysitter_availability_lookup');

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_users_city_role_active
        ON users (LOWER(city), role, is_active)
        WHERE role = 'babysitter' AND is_active = true;
    `);
    console.log('✅ Created idx_users_city_role_active');

    console.log('✅ Migration 020 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrate();