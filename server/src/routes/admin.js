// server/src/routes/admin.js
const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { createNotification } = require('../routes/notifications');

const router = express.Router();  // <-- ADD THIS LINE

// All routes in this file require admin role
router.use(authenticate, authorize('admin'));

// ============================================
// HELPER FUNCTIONS FOR WARNINGS & SUSPENSION
// ============================================

async function getUserWarnings(userId) {
  const result = await db.query(
    `SELECT COUNT(*) as count 
     FROM reports 
     WHERE reported_user_id = $1 
       AND admin_action = 'warning' 
       AND status = 'resolved'
       AND created_at > NOW() - INTERVAL '90 days'`,
    [userId]
  );
  return { count: parseInt(result.rows[0].count) || 0 };
}

async function checkAndApplySuspension(userId) {
  const warnings = await getUserWarnings(userId);
  
  if (warnings.count >= 3) {
    // Auto-suspend for 7 days
    const suspensionEnd = new Date();
    suspensionEnd.setDate(suspensionEnd.getDate() + 7);
    
    await db.query(
      `UPDATE users 
       SET suspended_at = CURRENT_TIMESTAMP,
           suspension_reason = 'Auto-suspended for receiving 3 warnings within 90 days',
           suspension_end_date = $1,
           is_active = false
       WHERE id = $2`,
      [suspensionEnd, userId]
    );

    await createNotification(
      userId,
      'auto_suspended',
      '⛔ Account Auto-Suspended',
      `Your account has been automatically suspended for 7 days due to receiving 3 warnings. Please contact admin if you believe this is an error.`,
      '/dashboard'
    );

    // Notify admins
    const admins = await db.query("SELECT id FROM users WHERE role = 'admin' AND is_active = true");
    for (const admin of admins.rows) {
      await createNotification(
        admin.id,
        'auto_suspension',
        '⛔ User Auto-Suspended',
        `User ID ${userId} has been auto-suspended for 7 days due to 3 warnings.`,
        '/admin-dashboard?tab=reports'
      );
    }

    return { suspended: true, duration: 7, reason: '3 warnings within 90 days' };
  }
  
  return { suspended: false, warnings: warnings.count };
}

// ============================================
// TEST ENDPOINT - Check if route is working
// ============================================
router.get('/ping', (req, res) => {
  console.log('✅ Admin route pinged!');
  res.json({ 
    status: 'ok', 
    message: 'Admin routes are working!',
    user: req.user 
  });
});

// ============================================
// DASHBOARD STATS
// ============================================
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Fetching admin stats');
    
    const [
      totalUsers,
      totalParents,
      totalBabysitters,
      pendingApprovals,
      pendingDocuments,
      totalBookings,
      completedBookings,
      activeBookings,
      cancelledBookings,
      totalRevenue,
      monthlyRevenue,
      avgBookingValue,
      cancellationRate,
      monthlyBookings,
      topBabysitters,
      cityDistribution,
      recentActivity,
      newUsersToday,
      pendingReports
    ] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM users'),
      db.query("SELECT COUNT(*) as count FROM users WHERE role = 'parent' AND suspended_at IS NULL"),
      db.query("SELECT COUNT(*) as count FROM users WHERE role = 'babysitter' AND suspended_at IS NULL"),
      db.query("SELECT COUNT(*) as count FROM babysitter_profiles WHERE status = 'pending'"),
      db.query("SELECT COUNT(*) as count FROM babysitter_documents WHERE is_verified = false"),
      db.query('SELECT COUNT(*) as count FROM bookings'),
      db.query("SELECT COUNT(*) as count FROM bookings WHERE status = 'completed'"),
      db.query("SELECT COUNT(*) as count FROM bookings WHERE status = 'in_progress'"),
      db.query("SELECT COUNT(*) as count FROM bookings WHERE status = 'cancelled'"),
      db.query("SELECT COALESCE(SUM(total_amount), 0) as total FROM bookings WHERE status = 'completed'"),
      db.query("SELECT COALESCE(SUM(total_amount), 0) as total FROM bookings WHERE status = 'completed' AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)"),
      db.query("SELECT COALESCE(AVG(total_amount), 0) as avg FROM bookings WHERE status = 'completed'"),
      db.query("SELECT COALESCE((SELECT COUNT(*) FROM bookings WHERE status = 'cancelled') * 100.0 / NULLIF(COUNT(*), 0), 0) as rate FROM bookings"),
      db.query(`
        SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count 
        FROM bookings 
        WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY month 
        ORDER BY month DESC
      `),
      db.query(`
        SELECT u.id, u.first_name, u.last_name, COUNT(b.id) as completed, COALESCE(SUM(b.total_amount), 0) as revenue
        FROM users u
        JOIN bookings b ON b.babysitter_id = u.id
        WHERE b.status = 'completed'
        GROUP BY u.id, u.first_name, u.last_name
        ORDER BY revenue DESC
        LIMIT 10
      `),
      db.query(`
        SELECT city, COUNT(*) as count 
        FROM users 
        WHERE role = 'babysitter' AND city IS NOT NULL AND city != ''
        GROUP BY city 
        ORDER BY count DESC 
        LIMIT 10
      `),
      db.query(`
        SELECT b.id, b.status, b.total_amount, b.created_at,
          p.first_name as pfirst, p.last_name as plast,
          s.first_name as sfirst, s.last_name as slast
        FROM bookings b
        JOIN users p ON p.id = b.parent_id
        JOIN users s ON s.id = b.babysitter_id
        ORDER BY b.created_at DESC
        LIMIT 10
      `),
      db.query("SELECT COUNT(*) as count FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours'"),
      db.query("SELECT COUNT(*) as count FROM reports WHERE status = 'pending'")
    ]);

    console.log('✅ Stats fetched successfully');
    res.json({
      totalUsers: parseInt(totalUsers.rows[0].count),
      totalParents: parseInt(totalParents.rows[0].count),
      totalBabysitters: parseInt(totalBabysitters.rows[0].count),
      pendingApprovals: parseInt(pendingApprovals.rows[0].count),
      pendingDocuments: parseInt(pendingDocuments.rows[0].count),
      pendingReports: parseInt(pendingReports.rows[0].count),
      totalBookings: parseInt(totalBookings.rows[0].count),
      completedBookings: parseInt(completedBookings.rows[0].count),
      activeBookings: parseInt(activeBookings.rows[0].count),
      cancelledBookings: parseInt(cancelledBookings.rows[0].count),
      totalRevenue: parseFloat(totalRevenue.rows[0].total),
      monthlyRevenue: parseFloat(monthlyRevenue.rows[0].total),
      averageBookingValue: parseFloat(avgBookingValue.rows[0].avg || 0),
      cancellationRate: parseFloat(cancellationRate.rows[0].rate || 0),
      monthlyBookings: monthlyBookings.rows || [],
      topBabysitters: topBabysitters.rows || [],
      cityDistribution: cityDistribution.rows || [],
      recentActivity: recentActivity.rows || [],
      newUsersToday: parseInt(newUsersToday.rows[0].count)
    });
  } catch (error) {
    console.error('❌ Stats error:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({ 
      error: 'Server error.', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ============================================
// LIVE STATS (Real-time updates)
// ============================================
router.get('/live-stats', async (req, res) => {
  try {
    const [
      newParents,
      newBabysitters,
      newBookings,
      completedBookingsToday,
      pendingReviews,
      activeUsers
    ] = await Promise.all([
      db.query("SELECT COUNT(*) as count FROM users WHERE role = 'parent' AND created_at >= CURRENT_DATE - INTERVAL '24 hours'"),
      db.query("SELECT COUNT(*) as count FROM users WHERE role = 'babysitter' AND created_at >= CURRENT_DATE - INTERVAL '24 hours'"),
      db.query("SELECT COUNT(*) as count FROM bookings WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours'"),
      db.query("SELECT COUNT(*) as count FROM bookings WHERE status = 'completed' AND updated_at >= CURRENT_DATE - INTERVAL '24 hours'"),
      db.query("SELECT COUNT(*) as count FROM reviews WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours' AND rating < 3"),
      db.query("SELECT COUNT(*) as count FROM users WHERE is_active = true AND suspended_at IS NULL")
    ]);

    res.json({
      newParents: parseInt(newParents.rows[0].count),
      newBabysitters: parseInt(newBabysitters.rows[0].count),
      newBookings: parseInt(newBookings.rows[0].count),
      completedBookingsToday: parseInt(completedBookingsToday.rows[0].count),
      pendingReviews: parseInt(pendingReviews.rows[0].count),
      activeUsers: parseInt(activeUsers.rows[0].count),
      timestamp: new Date()
    });
  } catch (error) {
    console.error('❌ Live stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// BABYSITTER MANAGEMENT
// ============================================
router.get('/babysitters', async (req, res) => {
  try {
    console.log('👶 Fetching babysitters');
    const { status, search } = req.query;
    
    let query = `
      SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.city, u.language, u.gender,
        bp.bio, bp.experience_years, bp.hourly_rate, bp.status, bp.is_verified, bp.skills,
        bp.emergency_contact_name, bp.emergency_contact_phone,
        (SELECT COUNT(*) FROM bookings WHERE babysitter_id = u.id AND status = 'completed') as completed_bookings,
        (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE babysitter_id = u.id) as avg_rating,
        (SELECT COUNT(*) FROM babysitter_documents WHERE babysitter_id = bp.id AND is_verified = false) as pending_documents,
        u.created_at,
        u.suspended_at,
        u.suspension_reason
      FROM users u
      JOIN babysitter_profiles bp ON bp.user_id = u.id
      WHERE u.role = 'babysitter'
    `;
    const params = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      query += ` AND bp.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      query += ` AND (LOWER(u.first_name) LIKE LOWER($${paramIndex}) OR LOWER(u.last_name) LIKE LOWER($${paramIndex}) OR LOWER(u.email) LIKE LOWER($${paramIndex}))`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY u.created_at DESC`;

    const result = await db.query(query, params);
    console.log('✅ Babysitters found:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Babysitters error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/babysitters/:id - Get single babysitter details
router.get('/babysitters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Fetching babysitter details for ID:', id);
    
    const result = await db.query(`
      SELECT u.*, bp.*,
        (SELECT json_agg(d.*) FROM babysitter_documents d WHERE d.babysitter_id = bp.id) as documents,
        (SELECT json_agg(a.*) FROM babysitter_availability a WHERE a.babysitter_id = bp.id) as availability,
        (SELECT json_agg(i.*) FROM babysitter_images i WHERE i.babysitter_id = bp.id) as images,
        (SELECT COUNT(*) FROM bookings WHERE babysitter_id = u.id) as total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE babysitter_id = u.id AND status = 'completed') as completed_bookings,
        (SELECT json_agg(r.*) FROM reviews r WHERE r.babysitter_id = u.id ORDER BY r.created_at DESC LIMIT 10) as recent_reviews
      FROM users u
      JOIN babysitter_profiles bp ON bp.user_id = u.id
      WHERE u.id = $1 AND u.role = 'babysitter'
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Babysitter not found' });
    }

    console.log('✅ Babysitter details fetched successfully');
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Get babysitter error:', error);
    res.status(500).json({ error: error.message });
  }
});

// UPDATE BABYSITTER STATUS
router.put('/babysitters/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const result = await db.query(
      `UPDATE babysitter_profiles 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = $2 
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Babysitter not found.' });
    }

    const messages = {
      approved: '🎉 Your babysitter profile has been approved! You can now start accepting bookings.',
      rejected: '❌ Your babysitter application has been reviewed. Please check your documents for more details.',
      suspended: '⚠️ Your account has been suspended. Please contact support for more information.'
    };

    await createNotification(
      parseInt(id),
      'profile_update',
      `Profile ${status}`,
      messages[status] || `Your profile status has been updated to ${status}`,
      '/dashboard'
    );

    // Log admin action
    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'update_babysitter_status', 'user', id, { status, notes }]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Update status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE BABYSITTER (Admin removes)
router.delete('/babysitters/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const check = await db.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2',
      [id, 'babysitter']
    );

    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Babysitter not found.' });
    }

    // Delete user (cascades to all related tables)
    await db.query('DELETE FROM users WHERE id = $1', [id]);

    // Log admin action
    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'delete_babysitter', 'user', id, { reason: 'Removed by admin' }]
    );

    res.json({ message: 'Babysitter removed successfully.' });
  } catch (error) {
    console.error('❌ Delete babysitter error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DOCUMENT MANAGEMENT
// ============================================
router.get('/documents', async (req, res) => {
  try {
    console.log('📄 Fetching documents');
    const { status } = req.query;
    
    let query = `
      SELECT d.*, 
        u.id as user_id,
        u.first_name, 
        u.last_name, 
        u.email, 
        u.phone, 
        bp.hourly_rate, 
        bp.experience_years,
        bp.id as profile_id
      FROM babysitter_documents d
      JOIN babysitter_profiles bp ON bp.id = d.babysitter_id
      JOIN users u ON u.id = bp.user_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status === 'pending') {
      query += ` AND d.is_verified = false AND (d.rejection_reason IS NULL OR d.rejection_reason = '')`;
    } else if (status === 'verified') {
      query += ` AND d.is_verified = true`;
    } else if (status === 'revision') {
      query += ` AND d.is_verified = false AND d.rejection_reason IS NOT NULL AND d.rejection_reason != ''`;
    }

    query += ` ORDER BY d.uploaded_at DESC`;

    const result = await db.query(query, params);
    console.log('✅ Documents found:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Documents error:', error);
    res.status(500).json({ error: error.message });
  }
});

// VERIFY DOCUMENT
router.put('/documents/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_verified, rejection_reason, admin_notes } = req.body;

    const docInfo = await db.query(`
      SELECT d.*, u.id as user_id, bp.id as profile_id
      FROM babysitter_documents d
      JOIN babysitter_profiles bp ON bp.id = d.babysitter_id
      JOIN users u ON u.id = bp.user_id
      WHERE d.id = $1
    `, [id]);

    if (docInfo.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    const doc = docInfo.rows[0];

    const result = await db.query(
      `UPDATE babysitter_documents 
       SET is_verified = $1, 
           rejection_reason = $2, 
           admin_notes = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 
       RETURNING *`,
      [is_verified, is_verified ? null : rejection_reason, admin_notes, id]
    );

    // Create notification for babysitter
    if (!is_verified && rejection_reason) {
      await createNotification(
        doc.user_id,
        'document_rejected',
        '📄 Document Needs Revision',
        `Your ${doc.document_type} needs revision: ${rejection_reason}`,
        '/dashboard?tab=documents'
      );
    } else if (is_verified) {
      await createNotification(
        doc.user_id,
        'document_approved',
        '✅ Document Verified',
        `Your ${doc.document_type} has been verified!`,
        '/dashboard?tab=documents'
      );
    }

    // Check if all documents are verified
    if (is_verified) {
      const pendingDocs = await db.query(
        'SELECT COUNT(*) as count FROM babysitter_documents WHERE babysitter_id = $1 AND is_verified = false',
        [doc.profile_id]
      );

      if (pendingDocs.rows[0].count === '0') {
        await db.query(
          'UPDATE babysitter_profiles SET status = $1, is_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['approved', doc.profile_id]
        );

        await createNotification(
          doc.user_id,
          'profile_approved',
          '🎉 Profile Approved!',
          'All your documents are verified! You are now an approved babysitter.',
          '/dashboard'
        );
      }
    }

    // Log admin action
    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'verify_document', 'document', id, { is_verified, rejection_reason }]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Verify document error:', error);
    res.status(500).json({ error: error.message });
  }
});

// REQUEST DOCUMENT REVISION
router.post('/documents/:id/request-revision', async (req, res) => {
  try {
    const { id } = req.params;
    const { revision_notes } = req.body;

    if (!revision_notes) {
      return res.status(400).json({ error: 'Revision notes required.' });
    }

    const docResult = await db.query(
      'UPDATE babysitter_documents SET rejection_reason = $1, is_verified = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [revision_notes, id]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    // Create revision record
    await db.query(
      `INSERT INTO document_revisions (document_id, requested_by, revision_notes, status) 
       VALUES ($1, $2, $3, 'pending')`,
      [id, req.user.id, revision_notes]
    );

    const doc = docResult.rows[0];
    const userInfo = await db.query(`
      SELECT u.id FROM babysitter_profiles bp
      JOIN users u ON u.id = bp.user_id
      WHERE bp.id = $1
    `, [doc.babysitter_id]);

    if (userInfo.rows.length > 0) {
      await createNotification(
        userInfo.rows[0].id,
        'revision_requested',
        '🔄 Document Revision Requested',
        `Please update your ${doc.document_type}: ${revision_notes}`,
        '/dashboard?tab=documents'
      );
    }

    // Log admin action
    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'request_revision', 'document', id, { revision_notes }]
    );

    res.json({ message: 'Revision requested successfully.' });
  } catch (error) {
    console.error('❌ Request revision error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// USER MANAGEMENT (with Suspension)
// ============================================
router.get('/users', async (req, res) => {
  try {
    console.log('👤 Fetching users');
    const { role, search } = req.query;
    
    let query = `
      SELECT id, email, role, first_name, last_name, phone, city, language, gender,
             is_active, avatar_url, suspended_at, suspension_reason, created_at
      FROM users
      WHERE role != 'admin'
    `;
    const params = [];
    let paramIndex = 1;

    if (role && role !== 'all') {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (search) {
      query += ` AND (LOWER(first_name) LIKE LOWER($${paramIndex}) OR LOWER(last_name) LIKE LOWER($${paramIndex}) OR LOWER(email) LIKE LOWER($${paramIndex}))`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await db.query(query, params);
    console.log('✅ Users found:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Users error:', error);
    res.status(500).json({ error: error.message });
  }
});

// TOGGLE USER SUSPENSION
router.put('/users/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params;
    const { suspend, reason } = req.body;

    if (suspend && !reason) {
      return res.status(400).json({ error: 'Suspension reason required.' });
    }

    const result = await db.query(
      `UPDATE users 
       SET suspended_at = $1, 
           suspension_reason = $2, 
           suspended_by = $3,
           is_active = $4
       WHERE id = $5
       RETURNING id, email, role, first_name, last_name, suspended_at, suspension_reason`,
      [
        suspend ? new Date() : null,
        suspend ? reason : null,
        suspend ? req.user.id : null,
        !suspend,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = result.rows[0];

    // Notify user
    await createNotification(
      parseInt(id),
      suspend ? 'account_suspended' : 'account_restored',
      suspend ? '⚠️ Account Suspended' : '✅ Account Restored',
      suspend 
        ? `Your account has been suspended. Reason: ${reason}. Please contact support.`
        : 'Your account has been restored. You can now use all features again.',
      '/dashboard'
    );

    // Log admin action
    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, suspend ? 'suspend_user' : 'restore_user', 'user', id, { reason }]
    );

    res.json({ 
      message: suspend ? 'User suspended.' : 'User restored.',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Toggle suspension error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// BOOKING MANAGEMENT
// ============================================
router.get('/bookings', async (req, res) => {
  try {
    console.log('📅 Fetching bookings');
    const { status, search, start_date, end_date } = req.query;
    
    let query = `
      SELECT b.*, 
        p.first_name as parent_first_name, p.last_name as parent_last_name, p.email as parent_email,
        s.first_name as babysitter_first_name, s.last_name as babysitter_last_name, s.email as babysitter_email,
        c.name as child_name,
        b.cancellation_reason,
        u_canceller.first_name as cancelled_by_first_name, u_canceller.last_name as cancelled_by_last_name
      FROM bookings b
      LEFT JOIN users p ON p.id = b.parent_id
      LEFT JOIN users s ON s.id = b.babysitter_id
      LEFT JOIN children c ON c.id = b.child_id
      LEFT JOIN users u_canceller ON u_canceller.id = b.cancelled_by
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      query += ` AND b.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      query += ` AND (LOWER(p.first_name) LIKE LOWER($${paramIndex}) OR LOWER(p.last_name) LIKE LOWER($${paramIndex}) OR LOWER(s.first_name) LIKE LOWER($${paramIndex}) OR LOWER(s.last_name) LIKE LOWER($${paramIndex}))`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (start_date) {
      query += ` AND b.start_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND b.end_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    query += ` ORDER BY b.created_at DESC`;

    const result = await db.query(query, params);
    console.log('✅ Bookings found:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Bookings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// REPORTS MANAGEMENT (with Warnings)
// ============================================
router.get('/reports', async (req, res) => {
  try {
    console.log('🚨 Fetching reports');
    const { status } = req.query;
    
    let query = `
      SELECT r.*, 
        rep.first_name as reporter_first_name, rep.last_name as reporter_last_name, rep.email as reporter_email,
        u.first_name as reported_first_name, u.last_name as reported_last_name, u.email as reported_email,
        rep.role as reporter_role, u.role as reported_role,
        r.admin_notes
      FROM reports r
      LEFT JOIN users rep ON rep.id = r.reporter_id
      LEFT JOIN users u ON u.id = r.reported_user_id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
      query += ` AND r.status = $1`;
      params.push(status);
    }

    query += ` ORDER BY r.created_at DESC`;

    const result = await db.query(query, params);
    console.log('✅ Reports found:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Reports error:', error);
    res.status(500).json({ error: error.message });
  }
});

// UPDATED: PUT /admin/reports/:id/status - With warning handling
router.put('/reports/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes, admin_action, warning_message } = req.body;

    if (!['reviewed', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    // Get report details
    const report = await db.query(
      `SELECT r.*, u.id as user_id, u.first_name, u.last_name, u.email, u.role
       FROM reports r
       JOIN users u ON u.id = r.reported_user_id
       WHERE r.id = $1`,
      [id]
    );

    if (report.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const reportData = report.rows[0];

    // Update report
    const result = await db.query(
      `UPDATE reports 
       SET status = $1, 
           admin_notes = COALESCE($2, admin_notes),
           admin_action = COALESCE($3, admin_action),
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4 
       RETURNING *`,
      [status, admin_notes, admin_action, id]
    );

    // If warning was issued, check for auto-suspension
    if (admin_action === 'warning') {
      const warnings = await getUserWarnings(reportData.user_id);
      
      if (warnings.count >= 3) {
        const suspensionResult = await checkAndApplySuspension(reportData.user_id);
        
        // Add suspension info to response
        result.rows[0].autoSuspended = true;
        result.rows[0].suspensionDuration = 7;
      } else {
        result.rows[0].autoSuspended = false;
        result.rows[0].warningsRemaining = 3 - warnings.count;
      }
    }

    // Log admin action
    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'update_report', 'report', id, { status, admin_notes, admin_action }]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Update report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADMIN ACTIVITY LOG
// ============================================
router.get('/activity-log', async (req, res) => {
  try {
    const { limit = 50, action } = req.query;
    let query = `
      SELECT l.*, u.first_name, u.last_name, u.email
      FROM admin_activity_log l
      JOIN users u ON u.id = l.admin_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (action) {
      query += ` AND l.action = $${paramIndex}`;
      params.push(action);
      paramIndex++;
    }

    query += ` ORDER BY l.created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Activity log error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// REVIEWS (Admin view all)
// ============================================
router.get('/reviews/all', async (req, res) => {
  try {
    console.log('⭐ Fetching all reviews');
    const result = await db.query(`
      SELECT r.*, 
        p.first_name as parent_first_name, p.last_name as parent_last_name,
        s.first_name as babysitter_first_name, s.last_name as babysitter_last_name,
        b.start_date, b.end_date
      FROM reviews r
      JOIN users p ON p.id = r.parent_id
      JOIN users s ON s.id = r.babysitter_id
      JOIN bookings b ON b.id = r.booking_id
      ORDER BY r.created_at DESC
    `);
    console.log('✅ Reviews found:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Reviews error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PARENT REVIEWS (Admin view all)
router.get('/parent-reviews', async (req, res) => {
  try {
    console.log('👨‍👩‍👦 Fetching parent reviews');
    const result = await db.query(`
      SELECT pr.*, 
        p.first_name as parent_first_name, p.last_name as parent_last_name,
        s.first_name as babysitter_first_name, s.last_name as babysitter_last_name,
        b.start_date, b.end_date
      FROM parent_reviews pr
      JOIN users p ON p.id = pr.parent_id
      JOIN users s ON s.id = pr.babysitter_id
      JOIN bookings b ON b.id = pr.booking_id
      ORDER BY pr.created_at DESC
    `);
    console.log('✅ Parent reviews found:', result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Parent reviews error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NOTIFICATIONS (Admin send notification)
// ============================================
router.post('/notifications', async (req, res) => {
  try {
    const { user_id, target_role, type, title, message, link } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message required.' });
    }

    if (user_id) {
      await createNotification(
        user_id,
        type || 'admin_message',
        title,
        message,
        link || null
      );

      await db.query(
        `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, 'send_notification', 'user', user_id, { title, message }]
      );

      return res.json({ message: 'Notification sent successfully.', count: 1 });
    }

    if (target_role) {
      const roleFilter = target_role === 'all' ? '' : `WHERE role = $1`;
      const params = target_role === 'all' ? [] : [target_role];
      const usersRes = await db.query(`SELECT id FROM users ${roleFilter}`, params);
      
      let count = 0;
      for (const row of usersRes.rows) {
        await createNotification(
          row.id,
          type || 'admin_message',
          title,
          message,
          link || null
        );
        count++;
      }

      await db.query(
        `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, 'send_notification', 'broadcast', 0, { title, message, target_role, count }]
      );

      return res.json({ message: `Notification sent to ${count} users.`, count });
    }

    return res.status(400).json({ error: 'Provide user_id or target_role.' });
  } catch (error) {
    console.error('❌ Send notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// JOB STATS
// ============================================

// GET /admin/jobs/stats - Get job statistics
router.get('/jobs/stats', async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_jobs,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_jobs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_jobs,
        COUNT(CASE WHEN status = 'active' AND selected_babysitter_id IS NULL THEN 1 END) as open_jobs,
        COUNT(CASE WHEN selected_babysitter_id IS NOT NULL THEN 1 END) as booked_jobs,
        COUNT(DISTINCT parent_id) as unique_parents,
        COUNT(DISTINCT selected_babysitter_id) as unique_babysitters,
        COALESCE(AVG(hourly_rate), 0) as avg_hourly_rate
      FROM job_posts
    `);

    const appStats = await db.query(`
      SELECT 
        COUNT(*) as total_applications,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_applications,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_applications,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_applications
      FROM job_applications
    `);

    const bookingFromJobs = await db.query(`
      SELECT COUNT(*) as count FROM bookings b
      JOIN job_posts j ON j.parent_id = b.parent_id AND j.selected_babysitter_id = b.babysitter_id
    `);

    // Monthly trends
    const monthly = await db.query(`
      SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count
      FROM job_posts
      WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month DESC
    `);

    // Top parents by jobs posted
    const topParents = await db.query(`
      SELECT u.id, u.first_name, u.last_name, COUNT(j.id) as jobs_posted
      FROM users u
      JOIN job_posts j ON j.parent_id = u.id
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY jobs_posted DESC
      LIMIT 10
    `);

    // Top babysitters by jobs completed
    const topBabysitters = await db.query(`
      SELECT u.id, u.first_name, u.last_name, COUNT(j.id) as jobs_completed
      FROM users u
      JOIN job_posts j ON j.selected_babysitter_id = u.id
      WHERE j.status = 'completed'
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY jobs_completed DESC
      LIMIT 10
    `);

    res.json({
      ...stats.rows[0],
      ...appStats.rows[0],
      jobs_with_bookings: parseInt(bookingFromJobs.rows[0].count),
      monthly: monthly.rows,
      topParents: topParents.rows,
      topBabysitters: topBabysitters.rows
    });
  } catch (error) {
    console.error('❌ Job stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/jobs - Get all jobs for admin
router.get('/jobs', async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT j.*,
        p.first_name as parent_first_name, p.last_name as parent_last_name, p.email as parent_email,
        b.first_name as babysitter_first_name, b.last_name as babysitter_last_name,
        (SELECT COUNT(*) FROM job_applications WHERE job_post_id = j.id) as application_count
      FROM job_posts j
      LEFT JOIN users p ON p.id = j.parent_id
      LEFT JOIN users b ON b.id = j.selected_babysitter_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      query += ` AND j.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY j.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await db.query(query, params);

    const countResult = await db.query(
      'SELECT COUNT(*) as total FROM job_posts'
    );

    res.json({
      jobs: result.rows,
      total: parseInt(countResult.rows[0].total),
      page: parseInt(page),
      totalPages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit))
    });
  } catch (error) {
    console.error('❌ Admin jobs error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ANALYTICS ENDPOINTS
// ============================================

// GET /admin/analytics/user-growth - Monthly user signups for last 12 months
router.get('/analytics/user-growth', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        role,
        COUNT(*) as count
      FROM users
      WHERE role != 'admin'
        AND created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY month, role
      ORDER BY month ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ User growth error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/analytics/rating-distribution - Rating histogram
router.get('/analytics/rating-distribution', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        rating,
        COUNT(*) as count
      FROM reviews
      GROUP BY rating
      ORDER BY rating ASC
    `);
    const avgResult = await db.query('SELECT COALESCE(AVG(rating), 0) as avg_rating, COUNT(*) as total_reviews FROM reviews');
    res.json({
      distribution: result.rows,
      avgRating: parseFloat(avgResult.rows[0].avg_rating).toFixed(2),
      totalReviews: parseInt(avgResult.rows[0].total_reviews)
    });
  } catch (error) {
    console.error('❌ Rating distribution error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/analytics/revenue-trend - Daily revenue for last 30 days
router.get('/analytics/revenue-trend', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM-DD') as date,
        COALESCE(SUM(total_amount), 0) as revenue,
        COUNT(*) as bookings
      FROM bookings
      WHERE status IN ('completed', 'in_progress')
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY date
      ORDER BY date ASC
    `);
    const totalResult = await db.query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_30d,
        COUNT(*) as total_bookings_30d
      FROM bookings
      WHERE status IN ('completed', 'in_progress')
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    `);
    res.json({
      trend: result.rows,
      summary: {
        totalRevenue30d: parseFloat(totalResult.rows[0].total_30d),
        totalBookings30d: parseInt(totalResult.rows[0].total_bookings_30d)
      }
    });
  } catch (error) {
    console.error('❌ Revenue trend error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/analytics/platform-health - Quick health metrics
router.get('/analytics/platform-health', async (req, res) => {
  try {
    const [
      avgResponseTime,
      completionRate,
      activeToday,
      pendingActions,
      avgSessionDuration
    ] = await Promise.all([
      db.query(`
        SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600), 0) as avg_hours
        FROM bookings WHERE status IN ('completed', 'cancelled')
      `),
      db.query(`
        SELECT 
          CASE WHEN COUNT(*) > 0 
            THEN (COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*))
            ELSE 0 
          END as rate
        FROM bookings
      `),
      db.query("SELECT COUNT(*) as count FROM users WHERE is_active = true AND suspended_at IS NULL AND created_at >= CURRENT_DATE - INTERVAL '24 hours'"),
      db.query("SELECT COUNT(*) as count FROM babysitter_profiles WHERE status = 'pending'"),
      db.query(`
        SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (b.updated_at - b.created_at)) / 60), 0) as avg_minutes
        FROM bookings b
        WHERE b.status IN ('completed', 'cancelled')
          AND b.created_at >= CURRENT_DATE - INTERVAL '30 days'
      `)
    ]);

    res.json({
      avgResponseHours: parseFloat(avgResponseTime.rows[0].avg_hours).toFixed(1),
      completionRate: parseFloat(completionRate.rows[0].rate).toFixed(1),
      activeToday: parseInt(activeToday.rows[0].count),
      pendingApprovals: parseInt(pendingActions.rows[0].count),
      avgBookingDurationMins: parseFloat(avgSessionDuration.rows[0].avg_minutes).toFixed(0)
    });
  } catch (error) {
    console.error('❌ Platform health error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADMIN LOCATION MANAGEMENT
// ============================================

// GET /admin/locations - Get all babysitters with location status
router.get('/locations', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.city,
        u.avatar_url,
        bp.id as profile_id,
        bp.status,
        bp.is_verified,
        bp.share_location,
        bp.hourly_rate,
        bp.experience_years,
        ul.latitude,
        ul.longitude,
        ul.is_sharing,
        ul.location_updated_at,
        (SELECT COUNT(*) FROM bookings WHERE babysitter_id = u.id AND status = 'completed') as completed_bookings,
        (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE babysitter_id = u.id) as avg_rating
      FROM users u
      JOIN babysitter_profiles bp ON bp.user_id = u.id
      LEFT JOIN user_locations ul ON ul.user_id = u.id
      WHERE u.role = 'babysitter'
      ORDER BY u.first_name ASC
    `);

    console.log(`✅ Found ${result.rows.length} babysitters with location data`);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get locations error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /admin/locations/:userId/toggle - Admin toggle location sharing
router.put('/locations/:userId/toggle', async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_sharing } = req.body;

    if (is_sharing === undefined) {
      return res.status(400).json({ error: 'is_sharing is required.' });
    }

    // Check if user exists and is a babysitter
    const userCheck = await db.query(
      'SELECT id, first_name, last_name, email FROM users WHERE id = $1 AND role = $2',
      [userId, 'babysitter']
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Babysitter not found.' });
    }

    // Update profile share_location
    await db.query(
      'UPDATE babysitter_profiles SET share_location = $1 WHERE user_id = $2',
      [is_sharing, userId]
    );

    // Update user_locations
    await db.query(
      `UPDATE user_locations 
       SET is_sharing = $1, location_updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [is_sharing, userId]
    );

    // Log admin action
    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'toggle_location_sharing', 'user', userId, 
       JSON.stringify({ is_sharing, babysitter: userCheck.rows[0].first_name + ' ' + userCheck.rows[0].last_name })]
    );

    // Notify babysitter
    await createNotification(
      parseInt(userId),
      'location_sharing_updated',
      is_sharing ? '📍 Location Sharing Enabled by Admin' : '📍 Location Sharing Disabled by Admin',
      is_sharing 
        ? 'Admin has enabled your location sharing. Parents can now see you on the map.'
        : 'Admin has disabled your location sharing. You will not appear on the map to parents.',
      '/dashboard?tab=location'
    );

    res.json({
      message: `Location sharing ${is_sharing ? 'enabled' : 'disabled'} for ${userCheck.rows[0].first_name} ${userCheck.rows[0].last_name}.`,
      user_id: userId,
      is_sharing
    });
  } catch (error) {
    console.error('❌ Toggle location error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /admin/locations/:userId - Get specific babysitter location details
router.get('/locations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await db.query(`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.city,
        u.avatar_url,
        bp.id as profile_id,
        bp.bio,
        bp.hourly_rate,
        bp.experience_years,
        bp.status,
        bp.is_verified,
        bp.skills,
        bp.share_location,
        ul.latitude,
        ul.longitude,
        ul.is_sharing,
        ul.location_updated_at,
        (SELECT COUNT(*) FROM bookings WHERE babysitter_id = u.id AND status = 'completed') as completed_bookings,
        (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE babysitter_id = u.id) as avg_rating,
        (SELECT COUNT(*) FROM reviews WHERE babysitter_id = u.id) as review_count
      FROM users u
      JOIN babysitter_profiles bp ON bp.user_id = u.id
      LEFT JOIN user_locations ul ON ul.user_id = u.id
      WHERE u.id = $1 AND u.role = 'babysitter'
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Babysitter not found.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Get babysitter location error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// EXPORT
// ============================================
module.exports = router;