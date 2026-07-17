// server/src/db/migrations/010_add_job_posts_table.js
const db = require('../../config/database');

const migrate = async () => {
  try {
    console.log('🔄 Running migration: 010_add_job_posts_table');

    // ============================================
    // DROP EXISTING TABLES IN CORRECT ORDER
    // ============================================
    console.log('📦 Dropping existing tables...');
    
    // Drop dependent tables first
    await db.query(`DROP TABLE IF EXISTS job_reviews CASCADE;`);
    await db.query(`DROP TABLE IF EXISTS job_applications CASCADE;`);
    await db.query(`DROP TABLE IF EXISTS job_posts CASCADE;`);
    
    console.log('✅ Dropped existing tables');

    // ============================================
    // CREATE job_posts TABLE
    // ============================================
    console.log('📝 Creating job_posts table...');
    await db.query(`
      CREATE TABLE job_posts (
        id SERIAL PRIMARY KEY,
        parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        child_age VARCHAR(50),
        child_count INTEGER DEFAULT 1,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        hourly_rate DECIMAL(10,2) NOT NULL,
        location VARCHAR(255),
        status VARCHAR(20) DEFAULT 'active',
        selected_babysitter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT job_posts_status_check CHECK (status IN ('active', 'in_progress', 'completed', 'cancelled'))
      );
    `);
    console.log('✅ Created job_posts table');

    // ============================================
    // CREATE job_applications TABLE
    // ============================================
    console.log('📝 Creating job_applications table...');
    await db.query(`
      CREATE TABLE job_applications (
        id SERIAL PRIMARY KEY,
        job_post_id INTEGER REFERENCES job_posts(id) ON DELETE CASCADE,
        babysitter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        message TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT job_applications_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
        UNIQUE(job_post_id, babysitter_id)
      );
    `);
    console.log('✅ Created job_applications table');

    // ============================================
    // CREATE job_reviews TABLE
    // ============================================
    console.log('📝 Creating job_reviews table...');
    await db.query(`
      CREATE TABLE job_reviews (
        id SERIAL PRIMARY KEY,
        job_post_id INTEGER REFERENCES job_posts(id) ON DELETE CASCADE,
        reviewer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        reviewee_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT job_reviews_rating_check CHECK (rating BETWEEN 1 AND 5)
      );
    `);
    console.log('✅ Created job_reviews table');

    // ============================================
    // CREATE INDEXES
    // ============================================
    console.log('📊 Creating indexes...');
    await db.query(`
      CREATE INDEX idx_job_posts_parent_id ON job_posts(parent_id);
      CREATE INDEX idx_job_posts_status ON job_posts(status);
      CREATE INDEX idx_job_posts_selected_babysitter ON job_posts(selected_babysitter_id);
      CREATE INDEX idx_job_applications_job_post_id ON job_applications(job_post_id);
      CREATE INDEX idx_job_applications_babysitter_id ON job_applications(babysitter_id);
      CREATE INDEX idx_job_applications_status ON job_applications(status);
      CREATE INDEX idx_job_reviews_job_post_id ON job_reviews(job_post_id);
      CREATE INDEX idx_job_reviews_reviewee_id ON job_reviews(reviewee_id);
    `);
    console.log('✅ Created indexes');

    // ============================================
    // ADD TRIGGER FOR updated_at
    // ============================================
    console.log('🔄 Creating update trigger...');
    await db.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await db.query(`
      DROP TRIGGER IF EXISTS update_job_posts_updated_at ON job_posts;
      CREATE TRIGGER update_job_posts_updated_at
        BEFORE UPDATE ON job_posts
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await db.query(`
      DROP TRIGGER IF EXISTS update_job_applications_updated_at ON job_applications;
      CREATE TRIGGER update_job_applications_updated_at
        BEFORE UPDATE ON job_applications
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Created update triggers');

    console.log('✅ Migration 010 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrate();