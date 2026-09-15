// server/src/db/migrations/023_add_uploads_table.js
// ==========================================================================
// Moves binary uploads out of the filesystem and into Postgres.
//
// Why: Render's filesystem is ephemeral — every deploy wipes
//      /opt/render/project/src/server/uploads. Storing bytes in the
//      database makes uploads survive deploys permanently.
//
// The new /uploads/:id route streams rows from this table. Existing
// disk-based paths like /uploads/1234567-abc.jpg keep working because
// the route falls through to a disk lookup when :id isn't numeric.
// ==========================================================================
const db = require('../../config/database');

const migrate = async () => {
  try {
    console.log('🔄 Running migration: 023_add_uploads_table');

    await db.query(`
      CREATE TABLE IF NOT EXISTS uploads (
        id           SERIAL PRIMARY KEY,
        filename     VARCHAR(255) NOT NULL,
        mime_type    VARCHAR(100) NOT NULL,
        size         INTEGER      NOT NULL,
        data         BYTEA        NOT NULL,
        uploaded_by  INTEGER      REFERENCES users(id) ON DELETE SET NULL,
        created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Created uploads table');

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_uploads_created_at
      ON uploads (created_at DESC);
    `);
    console.log('✅ Created idx_uploads_created_at');

    console.log('✅ Migration 023 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrate();