// server/src/routes/reports.js
const express = require('express');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { createNotification } = require('./notifications');

const router = express.Router();

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getUserWarnings(userId) {
  const result = await db.query(
    `SELECT COUNT(*) as count, 
            array_agg(id) as warning_ids,
            array_agg(created_at) as warning_dates
     FROM reports 
     WHERE reported_user_id = $1 
       AND admin_action = 'warning' 
       AND status = 'resolved'
       AND created_at > NOW() - INTERVAL '90 days'`,
    [userId]
  );
  return {
    count: parseInt(result.rows[0].count) || 0,
    warningIds: result.rows[0].warning_ids || [],
    warningDates: result.rows[0].warning_dates || []
  };
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
// MODERATION ACTION HANDLERS
// ============================================

// 1. WARNING HANDLER
async function handleWarning(report, message, adminId) {
  try {
    // Create warning record
    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, 'warning', 'user', report.user_id, JSON.stringify({ message, report_id: report.id })]
    );

    // Notify user
    await createNotification(
      report.user_id,
      'warning_received',
      '⚠️ Warning Issued',
      `You have received a warning: ${message || 'Please follow community guidelines.'}`,
      '/dashboard'
    );

    // Check if user now has 3 warnings
    const warnings = await getUserWarnings(report.user_id);
    
    if (warnings.count >= 3) {
      // Auto-suspend
      const suspensionResult = await checkAndApplySuspension(report.user_id);
      return {
        action: 'warning',
        message: `Warning issued. User now has ${warnings.count} warnings. Account auto-suspended for 7 days.`,
        warnings: warnings.count,
        autoSuspended: true,
        suspensionEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };
    }

    return {
      action: 'warning',
      message: `Warning issued. User has ${warnings.count} of 3 warnings before auto-suspension.`,
      warnings: warnings.count,
      autoSuspended: false
    };
  } catch (error) {
    console.error('Warning handler error:', error);
    throw error;
  }
}

// 2. SUSPENSION HANDLER
async function handleSuspension(report, reason, duration, adminId) {
  try {
    const suspensionEnd = new Date();
    suspensionEnd.setDate(suspensionEnd.getDate() + duration);

    await db.query(
      `UPDATE users 
       SET suspended_at = CURRENT_TIMESTAMP,
           suspension_reason = $1,
           suspension_end_date = $2,
           suspended_by = $3,
           is_active = false
       WHERE id = $4`,
      [reason || 'Suspended by admin', suspensionEnd, adminId, report.user_id]
    );

    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, 'suspension', 'user', report.user_id, JSON.stringify({ reason, duration, report_id: report.id })]
    );

    await createNotification(
      report.user_id,
      'account_suspended',
      `⛔ Account Suspended (${duration} days)`,
      `Your account has been suspended for ${duration} days. Reason: ${reason || 'Violation of community guidelines'}. Please contact admin for more information.`,
      '/dashboard'
    );

    // Notify admins
    const admins = await db.query("SELECT id FROM users WHERE role = 'admin' AND is_active = true");
    for (const admin of admins.rows) {
      await createNotification(
        admin.id,
        'admin_action',
        `⛔ User Suspended`,
        `User ${report.first_name} ${report.last_name} has been suspended for ${duration} days.`,
        '/admin-dashboard?tab=users'
      );
    }

    return {
      action: 'suspension',
      duration,
      suspensionEnd,
      message: `User suspended for ${duration} days.`
    };
  } catch (error) {
    console.error('Suspension handler error:', error);
    throw error;
  }
}

// 3. BAN HANDLER
async function handleBan(report, reason, adminId) {
  try {
    // Ban - permanent account block
    await db.query(
      `UPDATE users 
       SET is_active = false,
           suspended_at = CURRENT_TIMESTAMP,
           suspension_reason = $1,
           suspended_by = $2,
           suspension_end_date = NULL
       WHERE id = $3`,
      [`BANNED: ${reason || 'Permanent ban for severe violation'}`, adminId, report.user_id]
    );

    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, 'ban', 'user', report.user_id, JSON.stringify({ reason, report_id: report.id })]
    );

    // Notify user
    await createNotification(
      report.user_id,
      'account_banned',
      '🚫 Account Banned',
      `Your account has been permanently banned. Reason: ${reason || 'Severe violation of terms'}. Please contact admin if you believe this is an error.`,
      '/dashboard'
    );

    // Notify admins
    const admins = await db.query("SELECT id FROM users WHERE role = 'admin' AND is_active = true");
    for (const admin of admins.rows) {
      await createNotification(
        admin.id,
        'admin_action',
        `🚫 User Banned`,
        `User ${report.first_name} ${report.last_name} has been permanently banned.`,
        '/admin-dashboard?tab=users'
      );
    }

    return {
      action: 'ban',
      message: `User permanently banned.`
    };
  } catch (error) {
    console.error('Ban handler error:', error);
    throw error;
  }
}

// 4. REFUND HANDLER
async function handleRefund(report, amount, adminId) {
  try {
    const refundAmount = amount || report.refund_amount || 0;
    
    if (refundAmount <= 0) {
      return {
        action: 'refund',
        message: 'No refund processed - invalid amount.',
        refundAmount: 0
      };
    }

    await db.query(
      `INSERT INTO refunds (booking_id, report_id, user_id, amount, reason, status, processed_by, processed_at)
       VALUES ($1, $2, $3, $4, $5, 'approved', $6, CURRENT_TIMESTAMP)`,
      [report.booking_id, report.id, report.reporter_id, refundAmount, report.reason, adminId]
    );

    await createNotification(
      report.reporter_id,
      'refund_approved',
      '💰 Refund Approved',
      `Your refund request has been approved. Amount: $${refundAmount}. Please allow 5-7 business days for processing.`,
      '/dashboard'
    );

    return {
      action: 'refund',
      amount: refundAmount,
      message: `Refund of $${refundAmount} approved.`
    };
  } catch (error) {
    console.error('Refund handler error:', error);
    throw error;
  }
}

// 5. DISMISS HANDLER
async function handleDismiss(report, reason, adminId) {
  try {
    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, 'dismiss_report', 'report', report.id, JSON.stringify({ reason, report_id: report.id })]
    );

    await createNotification(
      report.reporter_id,
      'report_dismissed',
      '📋 Report Dismissed',
      `Your report against ${report.first_name} ${report.last_name} has been dismissed. Reason: ${reason || 'Insufficient evidence'}`,
      '/dashboard?tab=reports'
    );

    return {
      action: 'dismissed',
      message: 'Report dismissed.'
    };
  } catch (error) {
    console.error('Dismiss handler error:', error);
    throw error;
  }
}

// ============================================
// CREATE REPORT (Authenticated Users)
// ============================================
router.post('/', authenticate, async (req, res) => {
  try {
    console.log('📝 Creating report...');
    console.log('📊 Request body:', req.body);

    const { 
      reported_user_id, 
      booking_id,
      category, 
      reason, 
      description,
      severity = 'medium',
      refund_requested = false,
      refund_amount 
    } = req.body;

    // Validate required fields
    if (!reported_user_id || !category || !reason) {
      return res.status(400).json({ 
        error: 'Reported user, category, and reason are required.' 
      });
    }

    // Validate category
    const validCategories = [
      'unprofessional_behavior', 'no_show', 'late_arrival',
      'cancellation_without_notice', 'inappropriate_conduct',
      'safety_concern', 'fraud', 'harassment', 'dispute', 'other',
      'last_minute_cancellation', 'disrespectful', 'payment_issue',
      'unreasonable_demands'
    ];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid report category.' });
    }

    // Check if reported user exists
    const reportedUser = await db.query(
      'SELECT id, role, first_name, last_name, email, is_active, suspended_at FROM users WHERE id = $1',
      [reported_user_id]
    );
    
    if (reportedUser.rows.length === 0) {
      return res.status(404).json({ error: 'Reported user not found.' });
    }

    // Prevent self-reporting
    if (reported_user_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot report yourself.' });
    }

    // Check if booking exists
    if (booking_id) {
      const booking = await db.query(
        `SELECT * FROM bookings WHERE id = $1 AND (parent_id = $2 OR babysitter_id = $2)`,
        [booking_id, req.user.id]
      );
      if (booking.rows.length === 0) {
        return res.status(404).json({ error: 'Booking not found.' });
      }
    }

    // Check for duplicate pending reports
    const duplicate = await db.query(
      `SELECT id FROM reports 
       WHERE reporter_id = $1 AND reported_user_id = $2 
       AND booking_id IS NOT DISTINCT FROM $3 
       AND status = 'pending'`,
      [req.user.id, reported_user_id, booking_id || null]
    );
    
    if (duplicate.rows.length > 0) {
      return res.status(409).json({ error: 'You already have a pending report for this user/booking.' });
    }

    // Handle refund amount
    let refundAmountValue = null;
    if (refund_requested && refund_amount) {
      const parsed = parseFloat(refund_amount);
      if (!isNaN(parsed) && parsed > 0) {
        refundAmountValue = parsed;
      }
    }

    // Insert report
    const result = await db.query(
      `INSERT INTO reports (
        reporter_id, reported_user_id, booking_id, category, reason, description, 
        severity, refund_requested, refund_amount, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      RETURNING *`,
      [
        req.user.id, 
        reported_user_id, 
        booking_id || null,
        category, 
        reason, 
        description || null,
        severity,
        refund_requested || false,
        refundAmountValue,
      ]
    );

    console.log('✅ Report created:', result.rows[0].id);

    // Notify admins
    const admins = await db.query("SELECT id FROM users WHERE role = 'admin' AND is_active = true");
    const reporter = await db.query(
      'SELECT first_name, last_name FROM users WHERE id = $1',
      [req.user.id]
    );
    const reporterName = `${reporter.rows[0].first_name} ${reporter.rows[0].last_name}`;
    
    for (const admin of admins.rows) {
      await createNotification(
        admin.id,
        'new_report',
        `🚨 New ${category.replace(/_/g, ' ')} Report`,
        `${reporterName} reported ${reportedUser.rows[0].first_name} ${reportedUser.rows[0].last_name}`,
        '/admin-dashboard?tab=reports'
      );
    }

    res.status(201).json({
      success: true,
      report: result.rows[0],
      message: 'Report submitted successfully. Admin will review it shortly.'
    });
  } catch (error) {
    console.error('❌ Create report error:', error);
    res.status(500).json({ 
      error: 'Server error.',
      message: error.message
    });
  }
});

// ============================================
// ADMIN - UPDATE REPORT WITH MODERATION
// ============================================
router.put('/admin/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      status, 
      admin_notes, 
      admin_action, 
      refund_status,
      refund_amount,
      warning_message,
      suspension_duration = 7,
      ban_reason
    } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }

    if (!['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    // Get report details
    const report = await db.query(
      `SELECT r.*, u.id as user_id, u.email, u.first_name, u.last_name, u.role,
              u.suspended_at, u.is_active
       FROM reports r
       JOIN users u ON u.id = r.reported_user_id
       WHERE r.id = $1`,
      [id]
    );
    
    if (report.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const reportData = report.rows[0];
    let actionResult = {};

    // Handle different admin actions
    if (admin_action) {
      switch (admin_action) {
        case 'warning':
          actionResult = await handleWarning(reportData, warning_message, req.user.id);
          break;
        case 'suspension':
          actionResult = await handleSuspension(reportData, admin_notes, suspension_duration, req.user.id);
          break;
        case 'ban':
          actionResult = await handleBan(reportData, ban_reason || admin_notes, req.user.id);
          break;
        case 'refund':
          actionResult = await handleRefund(reportData, refund_amount, req.user.id);
          break;
        case 'dismissed':
          actionResult = await handleDismiss(reportData, admin_notes, req.user.id);
          break;
      }
    }

    // Handle refund amount for numeric column
    let refundAmountValue = null;
    if (refund_amount !== undefined && refund_amount !== null && refund_amount !== '') {
      const parsed = parseFloat(refund_amount);
      if (!isNaN(parsed) && parsed >= 0) {
        refundAmountValue = parsed;
      }
    }

    // Update report
    const result = await db.query(
      `UPDATE reports 
       SET status = $1, 
           admin_notes = COALESCE($2, admin_notes),
           admin_action = COALESCE($3, admin_action),
           refund_status = COALESCE($4, refund_status),
           refund_amount = COALESCE($5, refund_amount),
           action_taken_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [
        status, 
        admin_notes || null, 
        admin_action || null, 
        refund_status || null, 
        refundAmountValue,
        id
      ]
    );

    // Notify reporter
    await createNotification(
      reportData.reporter_id,
      'report_updated',
      `📋 Report ${status}`,
      `Your report against ${reportData.first_name} ${reportData.last_name} has been ${status}.`,
      '/dashboard?tab=reports'
    );

    res.json({
      report: result.rows[0],
      actionResult,
      message: 'Report updated successfully.'
    });
  } catch (error) {
    console.error('❌ Update report error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// ADMIN - RESTORE USER (Remove suspension/ban)
// ============================================
router.put('/restore/:userId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await db.query(
      'SELECT id, first_name, last_name, suspended_at, is_active FROM users WHERE id = $1',
      [userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (!user.rows[0].suspended_at) {
      return res.status(400).json({ error: 'User is not suspended.' });
    }

    // Restore user
    await db.query(
      `UPDATE users 
       SET suspended_at = NULL,
           suspension_reason = NULL,
           suspension_end_date = NULL,
           is_active = true
       WHERE id = $1`,
      [userId]
    );

    // Log action
    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, 'restore_user', 'user', userId, JSON.stringify({ reason: reason || 'Restored by admin' })]
    );

    // Notify user
    await createNotification(
      userId,
      'account_restored',
      '✅ Account Restored',
      `Your account has been restored. ${reason || 'Please continue to follow community guidelines.'}`,
      '/dashboard'
    );

    res.json({ 
      message: 'User restored successfully.',
      user: user.rows[0]
    });
  } catch (error) {
    console.error('❌ Restore user error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// GET USER WARNINGS
// ============================================
router.get('/warnings/:userId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const warnings = await getUserWarnings(userId);
    
    const details = await db.query(
      `SELECT r.id, r.reason, r.created_at, r.admin_notes,
              u.first_name, u.last_name, u.email
       FROM reports r
       JOIN users u ON u.id = r.admin_id
       WHERE r.reported_user_id = $1 
         AND r.admin_action = 'warning'
         AND r.status = 'resolved'
       ORDER BY r.created_at DESC`,
      [userId]
    );

    res.json({
      warningCount: warnings.count,
      warnings: details.rows,
      autoSuspendThreshold: 3,
      warningsRemaining: Math.max(0, 3 - warnings.count)
    });
  } catch (error) {
    console.error('❌ Get warnings error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// GET MY REPORTS
// ============================================
router.get('/my-reports', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, 
        u.first_name as reported_first_name, u.last_name as reported_last_name,
        u.email as reported_email, u.role as reported_role,
        rep.first_name as reporter_first_name, rep.last_name as reporter_last_name,
        b.start_date, b.end_date
      FROM reports r
      JOIN users u ON u.id = r.reported_user_id
      JOIN users rep ON rep.id = r.reporter_id
      LEFT JOIN bookings b ON b.id = r.booking_id
      WHERE r.reporter_id = $1 OR r.reported_user_id = $1
      ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get my reports error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// ADMIN - GET ALL REPORTS
// ============================================
router.get('/admin/all', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { status, category, severity, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT r.*, 
        rep.first_name as reporter_first_name, rep.last_name as reporter_last_name, rep.email as reporter_email,
        u.first_name as reported_first_name, u.last_name as reported_last_name, u.email as reported_email,
        u.role as reported_role,
        u.suspended_at, u.is_active, u.suspension_end_date,
        b.start_date, b.end_date, b.total_amount
      FROM reports r
      JOIN users rep ON rep.id = r.reporter_id
      JOIN users u ON u.id = r.reported_user_id
      LEFT JOIN bookings b ON b.id = r.booking_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      query += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (category && category !== 'all') {
      query += ` AND r.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    if (severity && severity !== 'all') {
      query += ` AND r.severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }

    query += ` ORDER BY 
      CASE r.severity 
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
      END,
      r.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    
    // Get count
    let countQuery = 'SELECT COUNT(*) as total FROM reports r WHERE 1=1';
    const countParams = [];
    let countIndex = 1;
    
    if (status && status !== 'all') {
      countQuery += ` AND r.status = $${countIndex}`;
      countParams.push(status);
      countIndex++;
    }
    if (category && category !== 'all') {
      countQuery += ` AND r.category = $${countIndex}`;
      countParams.push(category);
      countIndex++;
    }
    if (severity && severity !== 'all') {
      countQuery += ` AND r.severity = $${countIndex}`;
      countParams.push(severity);
      countIndex++;
    }
    
    const countResult = await db.query(countQuery, countParams);

    res.json({
      reports: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('❌ Admin reports error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// ADMIN - GET REPORT STATS
// ============================================
router.get('/admin/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_reports,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reports,
        COUNT(CASE WHEN status = 'reviewed' THEN 1 END) as reviewed_reports,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_reports,
        COUNT(CASE WHEN status = 'dismissed' THEN 1 END) as dismissed_reports,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_reports,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_reports,
        COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_reports,
        COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_reports,
        COUNT(CASE WHEN refund_requested = true THEN 1 END) as refund_requests,
        COUNT(CASE WHEN refund_requested = true AND refund_status = 'approved' THEN 1 END) as refunds_approved,
        COUNT(CASE WHEN admin_action = 'warning' THEN 1 END) as warnings_issued,
        COUNT(CASE WHEN admin_action = 'suspension' THEN 1 END) as suspensions_issued,
        COUNT(CASE WHEN admin_action = 'ban' THEN 1 END) as bans_issued
      FROM reports
    `);

    // Users with most warnings
    const topWarned = await db.query(`
      SELECT u.id, u.first_name, u.last_name, u.email,
        COUNT(r.id) as warning_count
      FROM users u
      JOIN reports r ON r.reported_user_id = u.id
      WHERE r.admin_action = 'warning' AND r.status = 'resolved'
      GROUP BY u.id, u.first_name, u.last_name, u.email
      ORDER BY warning_count DESC
      LIMIT 10
    `);

    res.json({
      ...stats.rows[0],
      topWarned: topWarned.rows
    });
  } catch (error) {
    console.error('❌ Report stats error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ============================================
// REFUND ROUTES
// ============================================

// GET /api/reports/refunds - Get user's refunds
router.get('/refunds', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, 
        b.start_date, b.end_date, b.total_amount,
        u.first_name as processed_by_first_name, u.last_name as processed_by_last_name
       FROM refunds r
       JOIN bookings b ON b.id = r.booking_id
       LEFT JOIN users u ON u.id = r.processed_by
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Get refunds error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/reports/refunds/admin - Admin view all refunds
router.get('/refunds/admin', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT r.*, 
        b.start_date, b.end_date, b.total_amount,
        u.first_name as user_first_name, u.last_name as user_last_name,
        adm.first_name as admin_first_name, adm.last_name as admin_last_name,
        rep.reason as report_reason
      FROM refunds r
      JOIN bookings b ON b.id = r.booking_id
      JOIN users u ON u.id = r.user_id
      LEFT JOIN users adm ON adm.id = r.processed_by
      LEFT JOIN reports rep ON rep.id = r.report_id
      WHERE 1=1
    `;
    const params = [];
    
    if (status && status !== 'all') {
      query += ` AND r.status = $1`;
      params.push(status);
    }
    
    query += ` ORDER BY r.created_at DESC`;
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('❌ Admin refunds error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;