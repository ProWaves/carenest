// server/src/routes/babysitters.js
const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { createNotification } = require('../routes/notifications');

const router = express.Router();

// ============================================
// 1. PUBLIC ROUTES (No authentication)
// ============================================

// GET /api/babysitters - Search and filter
router.get('/', async (req, res) => {
  try {
    const { city, min_rate, max_rate, min_experience, language, search, skills, sort, page, limit } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 12;
    const offset = (pageNum - 1) * limitNum;

    const baseFrom = 'FROM users u JOIN babysitter_profiles bp ON bp.user_id = u.id';
    const baseWhere = "u.role = 'babysitter' AND u.is_active = true AND bp.status = 'approved' AND u.suspended_at IS NULL";
    const params = [];
    let paramIndex = 1;
    const conditions = [];

    if (city) {
      conditions.push(`LOWER(u.city) LIKE LOWER($${paramIndex})`);
      params.push(`%${city}%`);
      paramIndex++;
    }
    if (min_rate) {
      conditions.push(`bp.hourly_rate >= $${paramIndex}`);
      params.push(min_rate);
      paramIndex++;
    }
    if (max_rate) {
      conditions.push(`bp.hourly_rate <= $${paramIndex}`);
      params.push(max_rate);
      paramIndex++;
    }
    if (min_experience) {
      conditions.push(`bp.experience_years >= $${paramIndex}`);
      params.push(min_experience);
      paramIndex++;
    }
    if (language) {
      conditions.push(`u.language = $${paramIndex}`);
      params.push(language);
      paramIndex++;
    }
    if (search) {
      conditions.push(`(LOWER(u.first_name) LIKE LOWER($${paramIndex}) OR LOWER(u.last_name) LIKE LOWER($${paramIndex}) OR LOWER(bp.bio) LIKE LOWER($${paramIndex}))`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (skills) {
      const skillList = skills.split(',');
      conditions.push(`bp.skills && $${paramIndex}`);
      params.push(skillList);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) ${baseFrom} WHERE ${baseWhere}${whereClause}`;
    const countResult = await db.query(countSql, params);
    const total = parseInt(countResult.rows[0].count);

    const selectColumns = `u.id, u.first_name, u.last_name, u.city, u.language, u.gender, u.avatar_url,
        bp.hourly_rate, bp.experience_years, bp.bio, bp.is_verified, bp.skills,
        (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE babysitter_id = u.id) as avg_rating,
        (SELECT COUNT(*) FROM reviews WHERE babysitter_id = u.id) as review_count`;

    let orderClause = ' ORDER BY bp.is_verified DESC, avg_rating DESC';
    if (sort === 'rating') orderClause = ' ORDER BY avg_rating DESC, bp.is_verified DESC';
    else if (sort === 'price_asc') orderClause = ' ORDER BY bp.hourly_rate ASC';
    else if (sort === 'price_desc') orderClause = ' ORDER BY bp.hourly_rate DESC';
    else if (sort === 'experience') orderClause = ' ORDER BY bp.experience_years DESC';

    const dataSql = `SELECT DISTINCT ${selectColumns} ${baseFrom} WHERE ${baseWhere}${whereClause}${orderClause} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum, offset);

    const result = await db.query(dataSql, params);
    res.json({ babysitters: result.rows, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
  } catch (error) {
    console.error('Get babysitters error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/babysitters/nearby - Find closest babysitters with live location
// Updated to respect admin controls (share_location must be true)
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 10, limit = 20 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ 
        error: 'Latitude and longitude required.',
        message: 'Please provide lat and lng parameters'
      });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusKm = parseFloat(radius);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({ 
        error: 'Invalid latitude or longitude values.' 
      });
    }

    console.log(`📍 Finding babysitters near (${latNum}, ${lngNum}) within ${radiusKm}km`);

    // Check if user_locations table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_locations'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.warn('⚠️ user_locations table does not exist yet');
      return res.json({
        babysitters: [],
        userLocation: { lat: latNum, lng: lngNum },
        total: 0,
        radius: radiusKm,
        message: 'Location data not available yet. Please run database migration.'
      });
    }

    // Enhanced query with distance calculation and location freshness
    // Only show babysitters where:
    // - is_sharing = true (babysitter enabled sharing)
    // - share_location = true (admin has not disabled sharing)
    const result = await db.query(`
      WITH nearby_babysitters AS (
        SELECT 
          u.id, 
          u.first_name, 
          u.last_name, 
          u.city, 
          u.language, 
          u.gender, 
          u.avatar_url,
          u.is_active,
          bp.hourly_rate, 
          bp.experience_years, 
          bp.is_verified, 
          bp.skills,
          bp.share_location,
          ul.latitude, 
          ul.longitude, 
          ul.location_updated_at,
          ul.is_sharing,
          (
            6371 * acos(
              cos(radians($1)) * cos(radians(ul.latitude)) *
              cos(radians(ul.longitude) - radians($2)) +
              sin(radians($1)) * sin(radians(ul.latitude))
            )
          ) AS distance,
          (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE babysitter_id = u.id) as avg_rating,
          (SELECT COUNT(*) FROM reviews WHERE babysitter_id = u.id) as review_count
        FROM users u
        JOIN babysitter_profiles bp ON bp.user_id = u.id
        JOIN user_locations ul ON ul.user_id = u.id
        WHERE u.role = 'babysitter' 
          AND u.is_active = true 
          AND u.suspended_at IS NULL
          AND bp.status = 'approved'
          AND ul.is_sharing = true
          AND bp.share_location = true  -- Admin must have enabled this
          AND (
            SELECT COUNT(*) FROM babysitter_availability 
            WHERE babysitter_id = bp.id 
              AND is_published = true 
              AND is_available = true 
              AND is_booked = false
          ) > 0
      )
      SELECT * FROM nearby_babysitters
      WHERE distance <= $3
      ORDER BY distance ASC
      LIMIT $4
    `, [latNum, lngNum, radiusKm, limit]);

    console.log(`✅ Found ${result.rows.length} babysitters within ${radiusKm}km`);

    // Add distance and location freshness info
    const babysitters = result.rows.map(bs => {
      const minutesAgo = bs.location_updated_at 
        ? Math.floor((Date.now() - new Date(bs.location_updated_at).getTime()) / 60000)
        : null;
      
      return {
        ...bs,
        distance_km: parseFloat(bs.distance).toFixed(1),
        location_freshness: minutesAgo !== null && minutesAgo < 30 ? 'fresh' : 'stale',
        location_updated_minutes_ago: minutesAgo,
        sharing_enabled_by_admin: bs.share_location === true
      };
    });

    res.json({
      babysitters,
      userLocation: { lat: latNum, lng: lngNum },
      total: babysitters.length,
      radius: radiusKm,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Nearby babysitters error:', error);
    res.status(500).json({ 
      error: 'Server error', 
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/babysitters/gallery/:userId
router.get('/gallery/:userId', async (req, res) => {
  try {
    console.log('🔍 Fetching gallery for user:', req.params.userId);
    
    const profile = await db.query('SELECT id FROM babysitter_profiles WHERE user_id = $1', [req.params.userId]);
    
    if (profile.rows.length === 0) {
      return res.json([]);
    }
    
    try {
      const result = await db.query(
        'SELECT id, image_url, caption, is_primary FROM babysitter_images WHERE babysitter_id = $1 ORDER BY is_primary DESC, created_at DESC',
        [profile.rows[0].id]
      );
      console.log('✅ Gallery images found:', result.rows.length);
      res.json(result.rows);
    } catch (imgError) {
      console.log('⚠️ Images query error:', imgError.message);
      res.json([]);
    }
  } catch (error) {
    console.error('❌ Get gallery error:', error);
    res.status(500).json({ 
      error: 'Server error.', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/babysitters/availability/available/:babysitterId - Get available slots for parents
router.get('/availability/available/:babysitterId', async (req, res) => {
  try {
    const { babysitterId } = req.params;

    const result = await db.query(
      `SELECT 
        a.id, 
        a.day_of_week, 
        a.start_time, 
        a.end_time,
        a.is_booked,
        a.booked_booking_id,
        CASE 
          WHEN a.is_booked = true THEN 'booked'
          ELSE 'available'
        END as status
      FROM babysitter_availability a
      JOIN babysitter_profiles bp ON bp.id = a.babysitter_id
      JOIN users u ON u.id = bp.user_id
      WHERE u.id = $1 
        AND u.is_active = true 
        AND u.suspended_at IS NULL
        AND bp.status = 'approved'
        AND a.is_published = true
        AND a.is_available = true
      ORDER BY a.day_of_week, a.start_time`,
      [babysitterId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get available slots error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// 2. AUTHENTICATED ROUTES
// ============================================

// GET /api/babysitters/profile/me
router.get('/profile/me', authenticate, authorize('babysitter'), async (req, res) => {
  try {
    console.log('🔍 Fetching profile for user:', req.user.id);
    
    const userCheck = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    console.log('👤 User found:', userCheck.rows[0]?.email);
    
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    const profileCheck = await db.query('SELECT * FROM babysitter_profiles WHERE user_id = $1', [req.user.id]);
    console.log('📋 Profile exists:', profileCheck.rows.length > 0);
    
    if (profileCheck.rows.length === 0) {
      console.log('⚠️ No profile found, creating one...');
      await db.query(
        'INSERT INTO babysitter_profiles (user_id, status) VALUES ($1, $2)',
        [req.user.id, 'pending']
      );
      console.log('✅ Profile created');
    }
    
    const profile = await db.query(
      `SELECT bp.*, u.first_name, u.last_name, u.email, u.phone, u.city, u.language, u.gender, u.avatar_url,
        u.suspended_at, u.is_active
       FROM babysitter_profiles bp 
       JOIN users u ON u.id = bp.user_id
       WHERE bp.user_id = $1`,
      [req.user.id]
    );
    
    if (profile.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    // Get documents
    try {
      const documents = await db.query(
        'SELECT id, document_type, document_url, is_verified, uploaded_at, rejection_reason FROM babysitter_documents WHERE babysitter_id = $1',
        [profile.rows[0].id]
      );
      profile.rows[0].documents = documents.rows || [];
    } catch (docError) {
      console.log('⚠️ Documents query error:', docError.message);
      profile.rows[0].documents = [];
    }

    // Get availability
    try {
      const availability = await db.query(
        'SELECT id, day_of_week, start_time, end_time, is_available, is_published, is_booked, published_at, booked_at FROM babysitter_availability WHERE babysitter_id = $1',
        [profile.rows[0].id]
      );
      profile.rows[0].availability = availability.rows || [];
    } catch (availError) {
      console.log('⚠️ Availability query error:', availError.message);
      profile.rows[0].availability = [];
    }

    // Get images
    try {
      const images = await db.query(
        'SELECT id, image_url, caption, is_primary FROM babysitter_images WHERE babysitter_id = $1 ORDER BY is_primary DESC, created_at DESC',
        [profile.rows[0].id]
      );
      profile.rows[0].images = images.rows || [];
    } catch (imgError) {
      console.log('⚠️ Images query error:', imgError.message);
      profile.rows[0].images = [];
    }

    const completedFields = [];
    if (profile.rows[0].bio) completedFields.push('bio');
    if (profile.rows[0].experience_years > 0) completedFields.push('experience');
    if (profile.rows[0].hourly_rate > 0) completedFields.push('rate');
    if (profile.rows[0].skills && profile.rows[0].skills.length > 0) completedFields.push('skills');
    if (profile.rows[0].availability && profile.rows[0].availability.length > 0) completedFields.push('availability');
    if (profile.rows[0].emergency_contact_name) completedFields.push('emergency');
    if (profile.rows[0].documents && profile.rows[0].documents.length > 0) completedFields.push('documents');
    profile.rows[0].profile_completion = Math.round((completedFields.length / 7) * 100);

    console.log('✅ Profile loaded successfully');
    res.json(profile.rows[0]);
  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({ 
      error: 'Server error.', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// PUT /api/babysitters/profile
router.put('/profile', authenticate, authorize('babysitter'), async (req, res) => {
  try {
    const { bio, experience_years, hourly_rate, skills, emergency_contact_name, emergency_contact_phone } = req.body;
    
    const userCheck = await db.query('SELECT suspended_at, is_active FROM users WHERE id = $1', [req.user.id]);
    if (userCheck.rows[0]?.suspended_at) {
      return res.status(403).json({ error: 'Your account is suspended.' });
    }
    if (!userCheck.rows[0]?.is_active) {
      return res.status(403).json({ error: 'Your account is deactivated.' });
    }

    const result = await db.query(
      `UPDATE babysitter_profiles SET
        bio = COALESCE($1, bio),
        experience_years = COALESCE($2, experience_years),
        hourly_rate = COALESCE($3, hourly_rate),
        skills = COALESCE($4, skills),
        emergency_contact_name = COALESCE($5, emergency_contact_name),
        emergency_contact_phone = COALESCE($6, emergency_contact_phone),
        updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $7
       RETURNING *`,
      [bio, experience_years, hourly_rate, skills || [], emergency_contact_name || null, emergency_contact_phone || null, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// 3. AVAILABILITY ROUTES
// ============================================

// POST /api/babysitters/availability - Save availability
router.post('/availability', authenticate, authorize('babysitter'), async (req, res) => {
  try {
    const { availability } = req.body;
    
    const userCheck = await db.query('SELECT suspended_at, is_active FROM users WHERE id = $1', [req.user.id]);
    if (userCheck.rows[0]?.suspended_at) {
      return res.status(403).json({ error: 'Your account is suspended.' });
    }
    if (!userCheck.rows[0]?.is_active) {
      return res.status(403).json({ error: 'Your account is deactivated.' });
    }

    const profile = await db.query('SELECT id, status FROM babysitter_profiles WHERE user_id = $1', [req.user.id]);
    const babysitterId = profile.rows[0].id;

    await db.query('DELETE FROM babysitter_availability WHERE babysitter_id = $1', [babysitterId]);

    for (const slot of availability) {
      await db.query(
        `INSERT INTO babysitter_availability (babysitter_id, day_of_week, start_time, end_time, is_available) 
         VALUES ($1, $2, $3, $4, true)`,
        [babysitterId, slot.day_of_week, slot.start_time, slot.end_time]
      );
    }
    res.json({ message: 'Availability updated.' });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/babysitters/availability/publish - Publish ALL slots
router.post('/availability/publish', authenticate, authorize('babysitter'), async (req, res) => {
  try {
    const { availability } = req.body;

    const userCheck = await db.query(
      'SELECT suspended_at, is_active FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (userCheck.rows[0].suspended_at) {
      return res.status(403).json({ 
        error: 'Your account is suspended. Please contact support.',
        suspended: true
      });
    }

    if (!userCheck.rows[0].is_active) {
      return res.status(403).json({ 
        error: 'Your account is deactivated. Please contact support.',
        deactivated: true
      });
    }

    const profile = await db.query(
      'SELECT id, status, is_verified FROM babysitter_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (profile.rows.length === 0) {
      return res.status(404).json({ error: 'Babysitter profile not found.' });
    }

    if (profile.rows[0].status !== 'approved') {
      return res.status(403).json({ 
        error: 'Your profile is not approved yet. Please wait for admin approval.',
        status: profile.rows[0].status
      });
    }

    const babysitterId = profile.rows[0].id;

    const hasAvailability = await db.query(
      'SELECT COUNT(*) as count FROM babysitter_availability WHERE babysitter_id = $1 AND is_available = true AND is_booked = false',
      [babysitterId]
    );

    if (parseInt(hasAvailability.rows[0].count) === 0) {
      return res.status(400).json({ 
        error: 'No availability slots to publish. Please add availability first.' 
      });
    }

    if (availability && Array.isArray(availability) && availability.length > 0) {
      let publishedCount = 0;
      for (const slot of availability) {
        const result = await db.query(
          `UPDATE babysitter_availability 
           SET is_published = true, 
               published_at = CURRENT_TIMESTAMP,
               is_available = true
           WHERE id = $1 
           AND babysitter_id = $2
           AND is_available = true
           AND is_booked = false
           RETURNING id`,
          [slot.id, babysitterId]
        );
        if (result.rows.length > 0) publishedCount++;
      }
      
      await db.query(
        `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, 'publish_availability', 'babysitter', babysitterId, 
         JSON.stringify({ slots_published: publishedCount })]
      );

      res.json({ 
        message: `Successfully published ${publishedCount} availability slots.`,
        published: publishedCount
      });
    } else {
      const result = await db.query(
        `UPDATE babysitter_availability 
         SET is_published = true, 
             published_at = CURRENT_TIMESTAMP,
             is_available = true
         WHERE babysitter_id = $1 
         AND is_published = false
         AND is_available = true
         AND is_booked = false
         RETURNING id`,
        [babysitterId]
      );

      await db.query(
        `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, 'publish_all_availability', 'babysitter', babysitterId, 
         JSON.stringify({ slots_published: result.rows.length })]
      );

      res.json({ 
        message: `Successfully published ${result.rows.length} availability slots.`,
        published: result.rows.length
      });
    }
  } catch (error) {
    console.error('❌ Publish availability error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/babysitters/availability/unpublish - Unpublish ALL slots
router.post('/availability/unpublish', authenticate, authorize('babysitter'), async (req, res) => {
  try {
    const userCheck = await db.query(
      'SELECT suspended_at, is_active FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userCheck.rows[0]?.suspended_at) {
      return res.status(403).json({ 
        error: 'Your account is suspended.',
        suspended: true
      });
    }

    const profile = await db.query(
      'SELECT id FROM babysitter_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (profile.rows.length === 0) {
      return res.status(404).json({ error: 'Babysitter profile not found.' });
    }

    const babysitterId = profile.rows[0].id;

    const result = await db.query(
      `UPDATE babysitter_availability 
       SET is_published = false
       WHERE babysitter_id = $1 
       AND is_published = true
       AND is_booked = false
       RETURNING id`,
      [babysitterId]
    );

    res.json({ 
      message: `Unpublished ${result.rows.length} availability slots.`,
      unpublished: result.rows.length
    });
  } catch (error) {
    console.error('❌ Unpublish availability error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// 4. AVAILABILITY SLOT MANAGEMENT
// ============================================

// GET /api/babysitters/availability/slots - Get all slots for current babysitter
router.get('/availability/slots', authenticate, authorize('babysitter'), async (req, res) => {
  try {
    const profile = await db.query(
      'SELECT id FROM babysitter_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (profile.rows.length === 0) {
      return res.status(404).json({ error: 'Babysitter profile not found.' });
    }

    const result = await db.query(
      `SELECT 
        a.id, 
        a.day_of_week, 
        a.start_time, 
        a.end_time, 
        a.is_available,
        a.is_published,
        a.is_booked,
        a.published_at,
        a.booked_at,
        a.booked_booking_id,
        b.status as booking_status,
        b.parent_id,
        p.first_name as booked_by_first_name,
        p.last_name as booked_by_last_name
      FROM babysitter_availability a
      LEFT JOIN bookings b ON b.id = a.booked_booking_id
      LEFT JOIN users p ON p.id = b.parent_id
      WHERE a.babysitter_id = $1
      ORDER BY a.day_of_week, a.start_time`,
      [profile.rows[0].id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get availability slots error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/babysitters/availability/slots/:id - Update a single slot
router.put('/availability/slots/:id', authenticate, authorize('babysitter'), async (req, res) => {
  try {
    const { id } = req.params;
    const { start_time, end_time, is_available } = req.body;

    const slotCheck = await db.query(
      `SELECT a.*, bp.user_id 
       FROM babysitter_availability a
       JOIN babysitter_profiles bp ON bp.id = a.babysitter_id
       WHERE a.id = $1 AND bp.user_id = $2`,
      [id, req.user.id]
    );

    if (slotCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Availability slot not found.' });
    }

    if (slotCheck.rows[0].is_booked) {
      return res.status(400).json({ 
        error: 'Cannot edit a booked slot. Please contact the parent to cancel the booking first.' 
      });
    }

    const result = await db.query(
      `UPDATE babysitter_availability 
       SET start_time = COALESCE($1, start_time),
           end_time = COALESCE($2, end_time),
           is_available = COALESCE($3, is_available)
       WHERE id = $4
       RETURNING *`,
      [start_time, end_time, is_available, id]
    );

    res.json({ 
      message: 'Availability slot updated successfully.',
      slot: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Update slot error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/babysitters/availability/slots/:id - Delete a single slot
router.delete('/availability/slots/:id', authenticate, authorize('babysitter'), async (req, res) => {
  try {
    const { id } = req.params;

    const slotCheck = await db.query(
      `SELECT a.*, bp.user_id 
       FROM babysitter_availability a
       JOIN babysitter_profiles bp ON bp.id = a.babysitter_id
       WHERE a.id = $1 AND bp.user_id = $2`,
      [id, req.user.id]
    );

    if (slotCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Availability slot not found.' });
    }

    if (slotCheck.rows[0].is_booked) {
      return res.status(400).json({ 
        error: 'Cannot delete a booked slot. Please contact the parent to cancel the booking first.' 
      });
    }

    await db.query('DELETE FROM babysitter_availability WHERE id = $1', [id]);

    res.json({ message: 'Availability slot deleted successfully.' });
  } catch (error) {
    console.error('❌ Delete slot error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// 5. PUBLISH/UNPUBLISH INDIVIDUAL SLOTS
// ============================================

// POST /api/babysitters/availability/publish/:id - Publish a single slot
router.post('/availability/publish/:id', authenticate, authorize('babysitter'), async (req, res) => {
  try {
    const { id } = req.params;

    const slotCheck = await db.query(
      `SELECT a.*, bp.user_id, bp.status 
       FROM babysitter_availability a
       JOIN babysitter_profiles bp ON bp.id = a.babysitter_id
       WHERE a.id = $1 AND bp.user_id = $2`,
      [id, req.user.id]
    );

    if (slotCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Availability slot not found.' });
    }

    if (slotCheck.rows[0].status !== 'approved') {
      return res.status(403).json({ error: 'Your profile must be approved to publish slots.' });
    }

    if (slotCheck.rows[0].is_published) {
      return res.status(400).json({ error: 'This slot is already published.' });
    }

    if (!slotCheck.rows[0].is_available) {
      return res.status(400).json({ error: 'Cannot publish an unavailable slot.' });
    }

    if (slotCheck.rows[0].is_booked) {
      return res.status(400).json({ error: 'Cannot publish a booked slot.' });
    }

    const result = await db.query(
      `UPDATE babysitter_availability 
       SET is_published = true, 
           published_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json({ 
      message: 'Slot published successfully.',
      slot: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Publish slot error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/babysitters/availability/unpublish/:id - Unpublish a single slot
router.post('/availability/unpublish/:id', authenticate, authorize('babysitter'), async (req, res) => {
  try {
    const { id } = req.params;

    const slotCheck = await db.query(
      `SELECT a.*, bp.user_id 
       FROM babysitter_availability a
       JOIN babysitter_profiles bp ON bp.id = a.babysitter_id
       WHERE a.id = $1 AND bp.user_id = $2`,
      [id, req.user.id]
    );

    if (slotCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Availability slot not found.' });
    }

    if (slotCheck.rows[0].is_booked) {
      return res.status(400).json({ 
        error: 'Cannot unpublish a booked slot.' 
      });
    }

    const result = await db.query(
      `UPDATE babysitter_availability 
       SET is_published = false
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json({ 
      message: 'Slot unpublished successfully.',
      slot: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Unpublish slot error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// 6. DOCUMENT MANAGEMENT
// ============================================

// POST /api/babysitters/documents - Upload document
router.post('/documents', authenticate, authorize('babysitter'), upload.single('document'), async (req, res) => {
  try {
    const { document_type } = req.body;
    if (!req.file || !document_type) {
      return res.status(400).json({ error: 'File and document type required.' });
    }

    const userCheck = await db.query('SELECT suspended_at, is_active FROM users WHERE id = $1', [req.user.id]);
    if (userCheck.rows[0]?.suspended_at) {
      return res.status(403).json({ error: 'Your account is suspended.' });
    }
    if (!userCheck.rows[0]?.is_active) {
      return res.status(403).json({ error: 'Your account is deactivated.' });
    }

    const profile = await db.query('SELECT id FROM babysitter_profiles WHERE user_id = $1', [req.user.id]);
    const docUrl = `/uploads/${req.file.filename}`;
    
    const result = await db.query(
      `INSERT INTO babysitter_documents (babysitter_id, document_type, document_url) 
       VALUES ($1, $2, $3) RETURNING *`,
      [profile.rows[0].id, document_type, docUrl]
    );

    const adminUsers = await db.query("SELECT id FROM users WHERE role = 'admin'");
    for (const admin of adminUsers.rows) {
      await createNotification(
        admin.id,
        'new_document',
        '📄 New Document Uploaded',
        `${req.user.first_name} ${req.user.last_name} uploaded a ${document_type}`,
        '/admin?tab=documents'
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/babysitters/documents/:id
router.delete('/documents/:id', authenticate, authorize('babysitter'), async (req, res) => {
  try {
    const { id } = req.params;

    const userCheck = await db.query('SELECT suspended_at, is_active FROM users WHERE id = $1', [req.user.id]);
    if (userCheck.rows[0]?.suspended_at) {
      return res.status(403).json({ error: 'Your account is suspended.' });
    }
    if (!userCheck.rows[0]?.is_active) {
      return res.status(403).json({ error: 'Your account is deactivated.' });
    }

    const doc = await db.query(
      `SELECT d.*, bp.id as profile_id 
       FROM babysitter_documents d
       JOIN babysitter_profiles bp ON bp.id = d.babysitter_id
       WHERE d.id = $1`,
      [id]
    );

    if (doc.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const profile = await db.query(
      'SELECT id FROM babysitter_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (doc.rows[0].profile_id !== profile.rows[0].id) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    await db.query('DELETE FROM babysitter_documents WHERE id = $1', [id]);
    res.json({ message: 'Document deleted successfully.' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/babysitters/documents/:id - Update/Resubmit document
router.put('/documents/:id', authenticate, authorize('babysitter'), upload.single('document'), async (req, res) => {
  try {
    const { id } = req.params;
    const { document_type } = req.body;

    const userCheck = await db.query('SELECT suspended_at, is_active FROM users WHERE id = $1', [req.user.id]);
    if (userCheck.rows[0]?.suspended_at) {
      return res.status(403).json({ error: 'Your account is suspended.' });
    }
    if (!userCheck.rows[0]?.is_active) {
      return res.status(403).json({ error: 'Your account is deactivated.' });
    }

    const doc = await db.query(
      `SELECT d.*, bp.id as profile_id 
       FROM babysitter_documents d
       JOIN babysitter_profiles bp ON bp.id = d.babysitter_id
       WHERE d.id = $1`,
      [id]
    );

    if (doc.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const profile = await db.query(
      'SELECT id FROM babysitter_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (doc.rows[0].profile_id !== profile.rows[0].id) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    let query = 'UPDATE babysitter_documents SET updated_at = CURRENT_TIMESTAMP';
    const params = [];
    let paramIndex = 1;

    if (document_type) {
      query += `, document_type = $${paramIndex}`;
      params.push(document_type);
      paramIndex++;
    }

    if (req.file) {
      const docUrl = `/uploads/${req.file.filename}`;
      query += `, document_url = $${paramIndex}`;
      params.push(docUrl);
      paramIndex++;
      query += `, is_verified = false, rejection_reason = NULL`;
    }

    query += ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(id);

    const result = await db.query(query, params);

    const adminUsers = await db.query("SELECT id FROM users WHERE role = 'admin'");
    for (const admin of adminUsers.rows) {
      await createNotification(
        admin.id,
        'document_updated',
        '📄 Document Updated',
        `${req.user.first_name} ${req.user.last_name} updated their ${document_type || 'document'}.`,
        '/admin?tab=documents'
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// 6.5 VIEW DOCUMENTS (Babysitter can view own documents)
// ============================================

// GET /api/babysitters/documents - Get all documents for current babysitter
router.get('/documents', authenticate, authorize('babysitter'), async (req, res) => {
  try {
    const profile = await db.query(
      'SELECT id FROM babysitter_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (profile.rows.length === 0) {
      return res.status(404).json({ error: 'Babysitter profile not found.' });
    }

    const result = await db.query(
      `SELECT id, document_type, document_url, is_verified, uploaded_at, rejection_reason, admin_notes
       FROM babysitter_documents 
       WHERE babysitter_id = $1
       ORDER BY uploaded_at DESC`,
      [profile.rows[0].id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get documents error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// 7. GALLERY MANAGEMENT
// ============================================

router.post('/gallery', authenticate, authorize('babysitter'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
    
    const userCheck = await db.query('SELECT suspended_at, is_active FROM users WHERE id = $1', [req.user.id]);
    if (userCheck.rows[0]?.suspended_at) {
      return res.status(403).json({ error: 'Your account is suspended.' });
    }
    if (!userCheck.rows[0]?.is_active) {
      return res.status(403).json({ error: 'Your account is deactivated.' });
    }

    const { caption } = req.body;
    const profile = await db.query('SELECT id FROM babysitter_profiles WHERE user_id = $1', [req.user.id]);
    const imageUrl = `/uploads/${req.file.filename}`;

    const existing = await db.query('SELECT id FROM babysitter_images WHERE babysitter_id = $1', [profile.rows[0].id]);
    const isPrimary = existing.rows.length === 0;

    const result = await db.query(
      `INSERT INTO babysitter_images (babysitter_id, image_url, caption, is_primary) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [profile.rows[0].id, imageUrl, caption || null, isPrimary]
    );

    const adminUsers = await db.query("SELECT id FROM users WHERE role = 'admin'");
    for (const admin of adminUsers.rows) {
      await createNotification(
        admin.id,
        'new_gallery_image',
        '🖼️ New Gallery Image',
        `${req.user.first_name} ${req.user.last_name} uploaded a new image.`,
        '/admin?tab=documents'
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Upload gallery error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete('/gallery/:imageId', authenticate, authorize('babysitter'), async (req, res) => {
  try {
    const userCheck = await db.query('SELECT suspended_at, is_active FROM users WHERE id = $1', [req.user.id]);
    if (userCheck.rows[0]?.suspended_at) {
      return res.status(403).json({ error: 'Your account is suspended.' });
    }
    if (!userCheck.rows[0]?.is_active) {
      return res.status(403).json({ error: 'Your account is deactivated.' });
    }

    const profile = await db.query('SELECT id FROM babysitter_profiles WHERE user_id = $1', [req.user.id]);
    const result = await db.query(
      'DELETE FROM babysitter_images WHERE id = $1 AND babysitter_id = $2 RETURNING *',
      [req.params.imageId, profile.rows[0].id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Image not found.' });
    res.json({ message: 'Image deleted.' });
  } catch (error) {
    console.error('Delete gallery error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.put('/gallery/:imageId/primary', authenticate, authorize('babysitter'), async (req, res) => {
  try {
    const userCheck = await db.query('SELECT suspended_at, is_active FROM users WHERE id = $1', [req.user.id]);
    if (userCheck.rows[0]?.suspended_at) {
      return res.status(403).json({ error: 'Your account is suspended.' });
    }
    if (!userCheck.rows[0]?.is_active) {
      return res.status(403).json({ error: 'Your account is deactivated.' });
    }

    const profile = await db.query('SELECT id FROM babysitter_profiles WHERE user_id = $1', [req.user.id]);
    await db.query('UPDATE babysitter_images SET is_primary = false WHERE babysitter_id = $1', [profile.rows[0].id]);
    await db.query('UPDATE babysitter_images SET is_primary = true WHERE id = $1 AND babysitter_id = $2', [req.params.imageId, profile.rows[0].id]);
    res.json({ message: 'Primary image updated.' });
  } catch (error) {
    console.error('Set primary error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// 8. LOCATION ROUTES (AUTHENTICATED)
// ============================================

// POST /api/babysitters/location - Update user location with sharing preference
router.post('/location', authenticate, async (req, res) => {
  try {
    const { latitude, longitude, is_sharing } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude required.' });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Invalid coordinates.' });
    }

    // Check if user is suspended
    const userCheck = await db.query(
      'SELECT suspended_at, is_active FROM users WHERE id = $1',
      [req.user.id]
    );
    if (userCheck.rows[0]?.suspended_at) {
      return res.status(403).json({ error: 'Your account is suspended.' });
    }

    // Check if babysitter profile exists
    const profileCheck = await db.query(
      'SELECT id, share_location FROM babysitter_profiles WHERE user_id = $1',
      [req.user.id]
    );
    if (profileCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Babysitter profile not found.' });
    }

    // Check if user_locations table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_locations'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      return res.status(503).json({ 
        error: 'Location service not available',
        message: 'Please run database migration first.'
      });
    }

    // Determine sharing status: user's request OR admin's override
    // If admin has disabled (share_location = false), user cannot override
    const adminEnabled = profileCheck.rows[0].share_location;
    const requestedSharing = is_sharing !== undefined ? is_sharing : profileCheck.rows[0].share_location;
    
    // User can only enable if admin hasn't disabled it
    const finalSharingStatus = adminEnabled ? requestedSharing : false;

    // Update or insert location
    await db.query(`
      INSERT INTO user_locations (user_id, latitude, longitude, is_sharing, location_updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        latitude = $2,
        longitude = $3,
        is_sharing = $4,
        location_updated_at = CURRENT_TIMESTAMP
    `, [req.user.id, lat, lng, finalSharingStatus]);

    // If admin disabled sharing, let user know
    if (!adminEnabled && is_sharing === true) {
      return res.json({
        message: 'Location sharing has been disabled by admin. Please contact support.',
        location: {
          latitude: lat,
          longitude: lng,
          is_sharing: false,
          admin_disabled: true,
          updated_at: new Date()
        }
      });
    }

    res.json({
      message: 'Location updated successfully.',
      location: {
        latitude: lat,
        longitude: lng,
        is_sharing: finalSharingStatus,
        admin_disabled: !adminEnabled,
        updated_at: new Date()
      }
    });
  } catch (error) {
    console.error('❌ Update location error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/babysitters/location/me - Get current babysitter's location
router.get('/location/me', authenticate, authorize('babysitter'), async (req, res) => {
  try {
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_locations'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      return res.json({ 
        latitude: null, 
        longitude: null, 
        is_sharing: false,
        admin_disabled: false,
        message: 'Location service not available' 
      });
    }

    const result = await db.query(
      `SELECT ul.*, bp.share_location as admin_enabled
       FROM user_locations ul
       JOIN babysitter_profiles bp ON bp.user_id = ul.user_id
       WHERE ul.user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json({ 
        latitude: null, 
        longitude: null, 
        is_sharing: false,
        admin_disabled: false,
        message: 'Location not set yet.' 
      });
    }

    const data = result.rows[0];
    // Admin disabled if admin_enabled is false
    const adminDisabled = data.admin_enabled === false;

    res.json({
      latitude: data.latitude,
      longitude: data.longitude,
      is_sharing: data.is_sharing,
      admin_disabled: adminDisabled,
      location_updated_at: data.location_updated_at
    });
  } catch (error) {
    console.error('❌ Get location error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/babysitters/location/share - Toggle location sharing (respects admin override)
router.put('/location/share', authenticate, authorize('babysitter'), async (req, res) => {
  try {
    const { is_sharing } = req.body;

    if (is_sharing === undefined) {
      return res.status(400).json({ error: 'is_sharing is required.' });
    }

    // Check if admin has disabled sharing
    const profileCheck = await db.query(
      'SELECT share_location FROM babysitter_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (profileCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Babysitter profile not found.' });
    }

    const adminEnabled = profileCheck.rows[0].share_location;
    
    if (!adminEnabled && is_sharing === true) {
      return res.status(403).json({ 
        error: 'Location sharing has been disabled by admin. Please contact support.',
        admin_disabled: true
      });
    }

    // Update profile
    await db.query(
      'UPDATE babysitter_profiles SET share_location = $1 WHERE user_id = $2',
      [is_sharing, req.user.id]
    );

    // Update user_locations if record exists
    await db.query(
      `UPDATE user_locations 
       SET is_sharing = $1, location_updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [is_sharing, req.user.id]
    );

    res.json({
      message: `Location sharing ${is_sharing ? 'enabled' : 'disabled'}.`,
      is_sharing,
      admin_disabled: false
    });
  } catch (error) {
    console.error('❌ Toggle location sharing error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/babysitters/location - Get user's saved location (for any authenticated user)
router.get('/location', authenticate, async (req, res) => {
  try {
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_locations'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      return res.json({ latitude: null, longitude: null, message: 'Location service not available' });
    }

    const result = await db.query(
      'SELECT latitude, longitude, is_sharing, location_updated_at FROM user_locations WHERE user_id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.json({ latitude: null, longitude: null, is_sharing: false });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Get location error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// 9. THE CATCH-ALL /:id ROUTE MUST BE LAST
// ============================================

// GET /api/babysitters/:id - Single babysitter profile (PUBLIC - No auth required)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Fetching babysitter profile for ID:', id);
    
    // Validate ID is a number
    if (isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid babysitter ID. Must be a number.' });
    }

    // First check if the user exists - PUBLIC query (no auth needed)
    const userCheck = await db.query(
      'SELECT id, role, is_active, suspended_at FROM users WHERE id = $1',
      [id]
    );

    if (userCheck.rows.length === 0) {
      console.log(`❌ User with ID ${id} not found in database`);
      return res.status(404).json({ 
        error: 'Babysitter not found.',
        message: `No user found with ID ${id}`
      });
    }

    const user = userCheck.rows[0];

    // Check if user is a babysitter
    if (user.role !== 'babysitter') {
      console.log(`❌ User ${id} is a ${user.role}, not a babysitter`);
      return res.status(404).json({ 
        error: 'Babysitter not found.',
        message: `User with ID ${id} is not a babysitter`
      });
    }

    // Check if account is active
    if (!user.is_active) {
      console.log(`❌ Babysitter ${id} account is deactivated`);
      return res.status(403).json({ 
        error: 'Babysitter account is deactivated.',
        message: 'This babysitter account has been deactivated.'
      });
    }

    // Check if account is suspended
    if (user.suspended_at) {
      console.log(`❌ Babysitter ${id} account is suspended`);
      return res.status(403).json({ 
        error: 'Babysitter account is suspended.',
        message: 'This babysitter account has been suspended.'
      });
    }
    
    // Get the babysitter profile - PUBLIC (no auth needed)
    const result = await db.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.city, u.language, u.gender, u.avatar_url,
        bp.bio, bp.experience_years, bp.hourly_rate, bp.is_verified, bp.status, bp.skills,
        (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE babysitter_id = u.id) as avg_rating,
        (SELECT COUNT(*) FROM reviews WHERE babysitter_id = u.id) as review_count
      FROM users u
      JOIN babysitter_profiles bp ON bp.user_id = u.id
      WHERE u.id = $1 AND u.role = 'babysitter' AND u.is_active = true`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Babysitter profile not found.' });
    }

    // Check if profile is approved
    if (result.rows[0].status !== 'approved') {
      console.log(`⚠️ Babysitter ${id} profile status is ${result.rows[0].status}, not approved`);
      // Still return the profile but with a warning
      result.rows[0].profile_warning = `Profile status is ${result.rows[0].status}`;
    }

    // Get availability - only published and available ones for public view
    try {
      const availability = await db.query(
        `SELECT day_of_week, start_time, end_time, is_booked
         FROM babysitter_availability 
         WHERE babysitter_id = (SELECT id FROM babysitter_profiles WHERE user_id = $1) 
         AND is_available = true 
         AND is_published = true`,
        [id]
      );
      result.rows[0].availability = availability.rows || [];
    } catch (availError) {
      console.log('⚠️ Availability query error:', availError.message);
      result.rows[0].availability = [];
    }

    // Get reviews
    try {
      const reviews = await db.query(
        `SELECT r.rating, r.comment, r.created_at, u.first_name, u.last_name
         FROM reviews r JOIN users u ON u.id = r.parent_id
         WHERE r.babysitter_id = $1 ORDER BY r.created_at DESC`,
        [id]
      );
      result.rows[0].reviews = reviews.rows || [];
    } catch (reviewError) {
      console.log('⚠️ Reviews query error:', reviewError.message);
      result.rows[0].reviews = [];
    }

    // Get images
    try {
      const images = await db.query(
        'SELECT id, image_url, caption, is_primary FROM babysitter_images WHERE babysitter_id = (SELECT id FROM babysitter_profiles WHERE user_id = $1) ORDER BY is_primary DESC, created_at DESC',
        [id]
      );
      result.rows[0].images = images.rows || [];
    } catch (imgError) {
      console.log('⚠️ Images query error:', imgError.message);
      result.rows[0].images = [];
    }

    console.log('✅ Babysitter profile loaded successfully');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Get babysitter error:', error);
    res.status(500).json({ 
      error: 'Server error.', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ============================================
// 10. HELPER FUNCTIONS
// ============================================

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ============================================
// 11. EXPORT
// ============================================

module.exports = router;