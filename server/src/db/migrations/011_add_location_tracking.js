// server/src/db/migrations/011_add_location_tracking.js
const db = require('../../config/database');

const migrate = async () => {
  try {
    console.log('🔄 Running migration: 011_add_location_tracking');

    // 1. Check if user_locations table exists, create if not
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_locations'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('📝 Creating user_locations table...');
      await db.query(`
        CREATE TABLE user_locations (
          id SERIAL PRIMARY KEY,
          user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          latitude DECIMAL(10, 8),
          longitude DECIMAL(11, 8),
          is_sharing BOOLEAN DEFAULT false,
          location_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Created user_locations table');
    } else {
      console.log('✅ user_locations table already exists');

      // Add columns if they don't exist
      const columnsToAdd = [
        { name: 'is_sharing', type: 'BOOLEAN DEFAULT false' },
        { name: 'location_updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
      ];

      for (const col of columnsToAdd) {
        try {
          await db.query(`
            ALTER TABLE user_locations 
            ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};
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
    }

    // 2. Add columns to babysitter_profiles
    try {
      await db.query(`
        ALTER TABLE babysitter_profiles 
        ADD COLUMN IF NOT EXISTS share_location BOOLEAN DEFAULT false;
      `);
      console.log('✅ Added share_location to babysitter_profiles');
    } catch (err) {
      if (err.code === '42701') {
        console.log('ℹ️ share_location column already exists');
      } else {
        console.log(`⚠️ Could not add share_location: ${err.message}`);
      }
    }

    try {
      await db.query(`
        ALTER TABLE babysitter_profiles 
        ADD COLUMN IF NOT EXISTS max_travel_distance INTEGER DEFAULT 20;
      `);
      console.log('✅ Added max_travel_distance to babysitter_profiles');
    } catch (err) {
      if (err.code === '42701') {
        console.log('ℹ️ max_travel_distance column already exists');
      } else {
        console.log(`⚠️ Could not add max_travel_distance: ${err.message}`);
      }
    }

    // 3. Create indexes (safely)
    console.log('📊 Creating indexes...');
    
    // Check if columns exist before creating indexes
    const columnsExist = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_locations' 
      AND column_name IN ('latitude', 'longitude');
    `);

    if (columnsExist.rows.length === 2) {
      try {
        await db.query(`
          CREATE INDEX IF NOT EXISTS idx_user_locations_coords 
          ON user_locations (latitude, longitude);
        `);
        console.log('✅ Created index on coordinates');
      } catch (err) {
        console.log(`⚠️ Could not create coordinates index: ${err.message}`);
      }
    } else {
      console.log('ℹ️ Skipping coordinates index - columns not ready');
    }

    // Check if is_sharing column exists before creating index
    const sharingColumn = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_locations' 
      AND column_name = 'is_sharing';
    `);

    if (sharingColumn.rows.length > 0) {
      try {
        await db.query(`
          CREATE INDEX IF NOT EXISTS idx_user_locations_sharing 
          ON user_locations (is_sharing, location_updated_at DESC);
        `);
        console.log('✅ Created index on sharing status');
      } catch (err) {
        console.log(`⚠️ Could not create sharing index: ${err.message}`);
      }
    } else {
      console.log('ℹ️ Skipping sharing index - column not ready');
    }

    console.log('✅ Migration 011 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrate();