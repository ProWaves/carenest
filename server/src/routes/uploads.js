// ==========================================================================
// /api/uploads — serve bytes stored in the `uploads` table
// ==========================================================================
// GET /uploads/:id
//
// Resolution order:
//   1. If :id is numeric → look up the `uploads` table and stream `data`.
//   2. Otherwise → fall back to the legacy static file at server/uploads/<id>.
//      This keeps every pre-existing /uploads/xyz.jpg row working.
//
// No auth required — anyone with the URL can fetch the image, exactly
// like the old static route. The URL contains a random row id, so
// guessing is impractical.
// ==========================================================================

const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../config/database');

const router = express.Router();

const LEGACY_UPLOADS_DIR = path.join(__dirname, '../../uploads');

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  // ── Path 1: numeric id → read from the uploads table ─────────────
  if (/^\d+$/.test(id)) {
    try {
      const result = await db.query(
        'SELECT filename, mime_type, data, size FROM uploads WHERE id = $1',
        [id]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
        res.setHeader('Content-Length', row.size);
        // Long cache — filenames are effectively immutable row ids.
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.end(row.data);
      }
      // If numeric but not found, fall through to legacy disk lookup.
    } catch (err) {
      console.error('❌ /uploads/:id DB error:', err.message);
      // Fall through to legacy lookup.
    }
  }

  // ── Path 2: legacy disk file ──────────────────────────────────────
  // Sanitize: reject anything with slashes or ".." to prevent traversal.
  if (id.includes('/') || id.includes('..')) {
    return res.status(400).json({ error: 'Invalid file id.' });
  }

  const legacyPath = path.join(LEGACY_UPLOADS_DIR, id);
  if (fs.existsSync(legacyPath)) {
    return res.sendFile(legacyPath);
  }

  return res.status(404).json({
    error: 'File not found',
    path: `/uploads/${id}`,
  });
});

module.exports = router;