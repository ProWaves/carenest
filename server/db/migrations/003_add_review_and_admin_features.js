// server/src/db/migrations/003_add_review_and_admin_features.js
const db = require('../../config/database');

const migrate = async () => {
  try {
    console.log('🔄 Running migration: 003_add_review_and_admin_features');

    // 1. Add admin notes to babysitter_documents
    await db.query(`
      ALTER TABLE babysitter_documents 
        ADD COLUMN IF NOT EXISTS admin_notes TEXT,
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);
    console.log('✅ Added admin_notes and rejection_reason to babysitter_documents');

    // 2. Create parent_reviews table
    await db.query(`
      CREATE TABLE IF NOT EXISTS parent_reviews (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        babysitter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(booking_id, babysitter_id)
      );
    `);
    console.log('✅ Created parent_reviews table');

    // 3. Add suspension columns to users
    await db.query(`
      ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
        ADD COLUMN IF NOT EXISTS suspended_by INTEGER REFERENCES users(id);
    `);
    console.log('✅ Added suspension columns to users');

    // 4. Create document_revisions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS document_revisions (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES babysitter_documents(id) ON DELETE CASCADE,
        requested_by INTEGER REFERENCES users(id),
        revision_notes TEXT,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'resubmitted', 'approved', 'rejected')),
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      );
    `);
    console.log('✅ Created document_revisions table');

    // 5. Add cancellation columns to bookings
    await db.query(`
      ALTER TABLE bookings 
        ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
        ADD COLUMN IF NOT EXISTS cancelled_by INTEGER REFERENCES users(id);
    `);
    console.log('✅ Added cancellation columns to bookings');

    // 6. Add status to babysitter_images
    await db.query(`
      ALTER TABLE babysitter_images 
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'approved', 'rejected'));
    `);
    console.log('✅ Added status to babysitter_images');

    // 7. Create admin_activity_log table
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_activity_log (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES users(id),
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(50),
        target_id INTEGER,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created admin_activity_log table');

    // 8. Add admin_notes to reports
    await db.query(`
      ALTER TABLE reports 
        ADD COLUMN IF NOT EXISTS admin_notes TEXT;
    `);
    console.log('✅ Added admin_notes to reports');

    console.log('✅ Migration 003 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrate();