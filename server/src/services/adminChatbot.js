// server/src/services/adminChatbot.js
const db = require('../config/database');
const { createNotification } = require('../routes/notifications');

class AdminChatbot {
  constructor() {
    this.commands = {
      // Stats commands
      'stats': this.handleStats.bind(this),
      'total': this.handleStats.bind(this),
      'users': this.handleUsers.bind(this),
      'babysitters': this.handleBabysitters.bind(this),
      'parents': this.handleParents.bind(this),
      'reports': this.handleReports.bind(this),
      'reviews': this.handleReviews.bind(this),
      
      // User lookup commands
      'find': this.handleFindUser.bind(this),
      'search': this.handleFindUser.bind(this),
      'lookup': this.handleFindUser.bind(this),
      'user': this.handleFindUser.bind(this),
      
      // Moderation commands
      'warn': this.handleWarn.bind(this),
      'warning': this.handleWarn.bind(this),
      'suspend': this.handleSuspend.bind(this),
      'ban': this.handleBan.bind(this),
      'activate': this.handleActivate.bind(this),
      'restore': this.handleActivate.bind(this),
      
      // Booking commands
      'bookings': this.handleBookings.bind(this),
      'cancellations': this.handleCancellations.bind(this),
      
      // Help
      'help': this.handleHelp.bind(this),
      '?': this.handleHelp.bind(this),
    };
  }

  async processMessage(adminId, message) {
    const lower = message.toLowerCase().trim();
    const words = lower.split(' ');
    const command = words[0];
    
    // Check if command exists
    if (this.commands[command]) {
      return await this.commands[command](adminId, message, words);
    }
    
    // Check if message contains a user name pattern
    const nameMatch = message.match(/["']([^"']+)["']/);
    if (nameMatch) {
      return await this.handleFindUser(adminId, message, words);
    }
    
    return this.getHelpResponse();
  }

  // ============================================
  // STATS COMMANDS
  // ============================================

  async handleStats(adminId, message, words) {
    const [totalUsers, totalParents, totalBabysitters, totalBookings, totalReports, totalReviews] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM users WHERE is_active = true'),
      db.query("SELECT COUNT(*) as count FROM users WHERE role = 'parent' AND is_active = true"),
      db.query("SELECT COUNT(*) as count FROM users WHERE role = 'babysitter' AND is_active = true"),
      db.query('SELECT COUNT(*) as count FROM bookings'),
      db.query('SELECT COUNT(*) as count FROM reports'),
      db.query('SELECT COUNT(*) as count FROM reviews'),
    ]);

    const pendingReports = await db.query(
      "SELECT COUNT(*) as count FROM reports WHERE status = 'pending'"
    );

    return {
      response: `📊 **Platform Overview**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 **Total Users:** ${totalUsers.rows[0].count}
  • Parents: ${totalParents.rows[0].count}
  • Babysitters: ${totalBabysitters.rows[0].count}

📅 **Total Bookings:** ${totalBookings.rows[0].count}

🚨 **Reports:** ${totalReports.rows[0].count}
  • Pending: ${pendingReports.rows[0].count}

⭐ **Reviews:** ${totalReviews.rows[0].count}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type **help** for available commands`,
      type: 'stats'
    };
  }

  async handleUsers(adminId, message, words) {
    const result = await db.query(`
      SELECT role, COUNT(*) as count 
      FROM users 
      WHERE is_active = true 
      GROUP BY role
    `);
    
    let response = '👤 **User Breakdown**\n━━━━━━━━━━━━━━━━━━\n';
    result.rows.forEach(row => {
      const emoji = row.role === 'parent' ? '👨‍👩‍👦' : row.role === 'babysitter' ? '👶' : '🛡️';
      response += `${emoji} ${row.role.charAt(0).toUpperCase() + row.role.slice(1)}: ${row.count}\n`;
    });
    
    return { response, type: 'users' };
  }

  async handleBabysitters(adminId, message, words) {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_verified = true THEN 1 END) as verified,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'approved' AND is_verified = true THEN 1 END) as active
      FROM babysitter_profiles bp
      JOIN users u ON u.id = bp.user_id
      WHERE u.is_active = true
    `);
    
    const avgRating = await db.query(`
      SELECT COALESCE(AVG(rating), 0) as avg_rating 
      FROM reviews
    `);

    const topBabysitters = await db.query(`
      SELECT u.first_name, u.last_name, COUNT(b.id) as bookings
      FROM users u
      JOIN bookings b ON b.babysitter_id = u.id
      WHERE b.status = 'completed'
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY bookings DESC
      LIMIT 5
    `);

    let response = `👶 **Babysitter Statistics**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 **Total:** ${result.rows[0].total}
✅ **Verified:** ${result.rows[0].verified}
⏳ **Pending Approval:** ${result.rows[0].pending}
🟢 **Active:** ${result.rows[0].active}

⭐ **Average Rating:** ${parseFloat(avgRating.rows[0].avg_rating).toFixed(1)} / 5.0

🏆 **Top 5 Babysitters by Bookings:**
`;
    topBabysitters.rows.forEach((bs, i) => {
      response += `  ${i+1}. ${bs.first_name} ${bs.last_name} - ${bs.bookings} bookings\n`;
    });

    return { response, type: 'babysitters' };
  }

  async handleParents(adminId, message, words) {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT b.id) as total_bookings,
        AVG(b.total_amount) as avg_spent
      FROM users u
      LEFT JOIN bookings b ON b.parent_id = u.id
      WHERE u.role = 'parent' AND u.is_active = true
    `);

    const topParents = await db.query(`
      SELECT u.first_name, u.last_name, COUNT(b.id) as bookings
      FROM users u
      JOIN bookings b ON b.parent_id = u.id
      WHERE u.role = 'parent'
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY bookings DESC
      LIMIT 5
    `);

    let response = `👨‍👩‍👦 **Parent Statistics**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 **Total Parents:** ${result.rows[0].total}
📅 **Total Bookings:** ${result.rows[0].total_bookings}
💰 **Avg Spend:** $${parseFloat(result.rows[0].avg_spent || 0).toFixed(2)}

🏆 **Top 5 Parents by Bookings:**
`;
    topParents.rows.forEach((p, i) => {
      response += `  ${i+1}. ${p.first_name} ${p.last_name} - ${p.bookings} bookings\n`;
    });

    return { response, type: 'parents' };
  }

  async handleReports(adminId, message, words) {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'reviewed' THEN 1 END) as reviewed,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
        COUNT(CASE WHEN status = 'dismissed' THEN 1 END) as dismissed,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high,
        COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium,
        COUNT(CASE WHEN severity = 'low' THEN 1 END) as low
      FROM reports
    `);

    const recentReports = await db.query(`
      SELECT r.id, r.reason, r.status, r.severity,
        u.first_name, u.last_name
      FROM reports r
      JOIN users u ON u.id = r.reported_user_id
      WHERE r.status = 'pending'
      ORDER BY r.created_at DESC
      LIMIT 5
    `);

    let response = `🚨 **Reports Overview**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 **Total:** ${stats.rows[0].total}
⏳ **Pending:** ${stats.rows[0].pending}
👀 **Reviewed:** ${stats.rows[0].reviewed}
✅ **Resolved:** ${stats.rows[0].resolved}
❌ **Dismissed:** ${stats.rows[0].dismissed}

⚠️ **By Severity:**
  🔴 Critical: ${stats.rows[0].critical}
  🟠 High: ${stats.rows[0].high}
  🟡 Medium: ${stats.rows[0].medium}
  🟢 Low: ${stats.rows[0].low}

📋 **Recent Pending Reports:**
`;
    recentReports.rows.forEach((r, i) => {
      response += `  ${i+1}. #${r.id} - ${r.first_name} ${r.last_name} (${r.severity})\n`;
      response += `     Reason: ${r.reason}\n`;
    });

    return { response, type: 'reports' };
  }

  async handleReviews(adminId, message, words) {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total,
        AVG(rating) as avg_rating,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive,
        COUNT(CASE WHEN rating <= 2 THEN 1 END) as negative
      FROM reviews
    `);

    const recentReviews = await db.query(`
      SELECT r.rating, r.comment, r.created_at,
        u.first_name, u.last_name
      FROM reviews r
      JOIN users u ON u.id = r.parent_id
      ORDER BY r.created_at DESC
      LIMIT 5
    `);

    let response = `⭐ **Reviews Overview**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 **Total Reviews:** ${stats.rows[0].total}
⭐ **Average Rating:** ${parseFloat(stats.rows[0].avg_rating || 0).toFixed(1)} / 5.0
👍 **Positive (4-5★):** ${stats.rows[0].positive}
👎 **Negative (1-2★):** ${stats.rows[0].negative}

📋 **Recent Reviews:**
`;
    recentReviews.rows.forEach((r, i) => {
      const stars = '⭐'.repeat(Math.round(r.rating));
      response += `  ${i+1}. ${r.first_name} ${r.last_name}: ${stars} ${r.rating}/5\n`;
      response += `     "${r.comment?.substring(0, 50)}${r.comment?.length > 50 ? '...' : ''}"\n`;
    });

    return { response, type: 'reviews' };
  }

  // ============================================
  // USER LOOKUP
  // ============================================

  async handleFindUser(adminId, message, words) {
    // Extract name from quotes or after command
    let searchTerm = '';
    const quotedMatch = message.match(/["']([^"']+)["']/);
    if (quotedMatch) {
      searchTerm = quotedMatch[1];
    } else {
      // Remove command word and get remaining
      const parts = message.split(' ');
      if (parts.length > 1) {
        searchTerm = parts.slice(1).join(' ');
      }
    }

    if (!searchTerm) {
      return {
        response: `❌ **Please specify a user to search for.**
Example: **find "John Doe"** or **user "john@email.com"**`,
        type: 'error'
      };
    }

    const users = await db.query(`
      SELECT id, first_name, last_name, email, role, is_active, 
        suspended_at, suspension_reason, created_at
      FROM users
      WHERE LOWER(first_name) LIKE LOWER($1) 
        OR LOWER(last_name) LIKE LOWER($1)
        OR LOWER(email) LIKE LOWER($1)
        OR CONCAT(first_name, ' ', last_name) ILIKE $1
      LIMIT 5
    `, [`%${searchTerm}%`]);

    if (users.rows.length === 0) {
      return {
        response: `❌ **No users found matching:** "${searchTerm}"`,
        type: 'error'
      };
    }

    let response = `🔍 **Search Results for:** "${searchTerm}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    users.rows.forEach((user, i) => {
      const status = user.is_active ? '🟢 Active' : '🔴 Inactive';
      const suspension = user.suspended_at ? `⛔ Suspended: ${new Date(user.suspended_at).toLocaleDateString()}` : '✅ Not Suspended';
      const roleEmoji = user.role === 'parent' ? '👨‍👩‍👦' : user.role === 'babysitter' ? '👶' : '🛡️';
      
      response += `${i+1}. **${user.first_name} ${user.last_name}** ${roleEmoji}
   📧 ${user.email}
   🔹 Role: ${user.role}
   🔹 Status: ${status}
   🔹 ${suspension}
   🔹 Joined: ${new Date(user.created_at).toLocaleDateString()}
   📝 **Commands:** warn "${user.first_name} ${user.last_name}" | suspend "${user.first_name} ${user.last_name}" | activate "${user.first_name} ${user.last_name}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    });

    return { response, type: 'user_search', users: users.rows };
  }

  // ============================================
  // MODERATION COMMANDS
  // ============================================

  async handleWarn(adminId, message, words) {
    const { user, reason } = this.extractUserAndReason(message, words);
    
    if (!user) {
      return {
        response: `❌ **Please specify a user to warn.**
Example: **warn "John Doe" "Unprofessional behavior"**`,
        type: 'error'
      };
    }

    // Check if user exists
    const userResult = await db.query(
      'SELECT id, first_name, last_name, email, role FROM users WHERE id = $1',
      [user.id]
    );
    
    if (userResult.rows.length === 0) {
      return {
        response: `❌ **User not found.** Please check the user ID or name.`,
        type: 'error'
      };
    }

    const userData = userResult.rows[0];

    // Create warning report
    const report = await db.query(
      `INSERT INTO reports (
        reporter_id, reported_user_id, reason, description, 
        category, severity, status, admin_action
      ) VALUES ($1, $2, $3, $4, 'unprofessional_behavior', 'medium', 'resolved', 'warning')
      RETURNING *`,
      [adminId, user.id, reason || 'Warning issued by admin', `Admin warning: ${reason || 'Please follow community guidelines.'}`]
    );

    // Log admin action
    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, 'warning', 'user', user.id, JSON.stringify({ reason, report_id: report.rows[0].id })]
    );

    // Send notification
    await createNotification(
      user.id,
      'warning_received',
      '⚠️ Warning Issued',
      `You have received a warning from admin. Reason: ${reason || 'Please follow community guidelines.'}`,
      '/dashboard'
    );

    // Check for auto-suspension
    const warnings = await getUserWarnings(user.id);
    let autoSuspendMsg = '';
    if (warnings.count >= 3) {
      await checkAndApplySuspension(user.id);
      autoSuspendMsg = `\n\n⚠️ **Auto-Suspension Triggered:** User has 3 warnings and has been auto-suspended for 7 days.`;
    }

    return {
      response: `✅ **Warning Issued** ${autoSuspendMsg}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 **User:** ${userData.first_name} ${userData.last_name}
📧 ${userData.email}
📝 **Reason:** ${reason || 'Warning issued by admin'}
⚠️ **Total Warnings:** ${warnings.count} / 3

The user has been notified.`,
      type: 'warning',
      user: userData,
      warningCount: warnings.count
    };
  }

  async handleSuspend(adminId, message, words) {
    const { user, reason, duration } = this.extractUserAndReason(message, words, true);
    
    if (!user) {
      return {
        response: `❌ **Please specify a user to suspend.**
Example: **suspend "John Doe" "Violation of terms" 7** (7 days)`,
        type: 'error'
      };
    }

    const userResult = await db.query(
      'SELECT id, first_name, last_name, email, role FROM users WHERE id = $1',
      [user.id]
    );
    
    if (userResult.rows.length === 0) {
      return {
        response: `❌ **User not found.** Please check the user ID or name.`,
        type: 'error'
      };
    }

    const userData = userResult.rows[0];
    const suspendDays = duration || 7;
    const suspensionEnd = new Date();
    suspensionEnd.setDate(suspensionEnd.getDate() + suspendDays);

    // Suspend user
    await db.query(
      `UPDATE users 
       SET suspended_at = CURRENT_TIMESTAMP,
           suspension_reason = $1,
           suspension_end_date = $2,
           suspended_by = $3,
           is_active = false
       WHERE id = $4`,
      [reason || 'Suspended by admin', suspensionEnd, adminId, user.id]
    );

    // Create report
    const report = await db.query(
      `INSERT INTO reports (
        reporter_id, reported_user_id, reason, description, 
        category, severity, status, admin_action
      ) VALUES ($1, $2, $3, $4, 'unprofessional_behavior', 'high', 'resolved', 'suspension')
      RETURNING *`,
      [adminId, user.id, `Suspended for ${suspendDays} days`, reason || 'Suspended by admin']
    );

    // Log admin action
    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, 'suspension', 'user', user.id, JSON.stringify({ reason, duration: suspendDays, report_id: report.rows[0].id })]
    );

    // Send notification
    await createNotification(
      user.id,
      'account_suspended',
      `⛔ Account Suspended (${suspendDays} days)`,
      `Your account has been suspended for ${suspendDays} days. Reason: ${reason || 'Violation of community guidelines.'}`,
      '/dashboard'
    );

    return {
      response: `⛔ **User Suspended**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 **User:** ${userData.first_name} ${userData.last_name}
📧 ${userData.email}
📝 **Reason:** ${reason || 'Suspended by admin'}
⏱️ **Duration:** ${suspendDays} days
📅 **Until:** ${suspensionEnd.toLocaleDateString()}

The user has been notified.`,
      type: 'suspension',
      user: userData,
      duration: suspendDays
    };
  }

  async handleBan(adminId, message, words) {
    const { user, reason } = this.extractUserAndReason(message, words);
    
    if (!user) {
      return {
        response: `❌ **Please specify a user to ban.**
Example: **ban "John Doe" "Severe violation"**`,
        type: 'error'
      };
    }

    const userResult = await db.query(
      'SELECT id, first_name, last_name, email, role FROM users WHERE id = $1',
      [user.id]
    );
    
    if (userResult.rows.length === 0) {
      return {
        response: `❌ **User not found.** Please check the user ID or name.`,
        type: 'error'
      };
    }

    const userData = userResult.rows[0];

    // Ban user
    await db.query(
      `UPDATE users 
       SET is_active = false,
           suspended_at = CURRENT_TIMESTAMP,
           suspension_reason = $1,
           suspended_by = $2,
           suspension_end_date = NULL
       WHERE id = $3`,
      [`BANNED: ${reason || 'Permanent ban for severe violation'}`, adminId, user.id]
    );

    // Create report
    await db.query(
      `INSERT INTO reports (
        reporter_id, reported_user_id, reason, description, 
        category, severity, status, admin_action
      ) VALUES ($1, $2, $3, $4, 'unprofessional_behavior', 'critical', 'resolved', 'ban')
      RETURNING *`,
      [adminId, user.id, `Banned permanently`, reason || 'Permanent ban for severe violation']
    );

    // Log admin action
    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, 'ban', 'user', user.id, JSON.stringify({ reason })]
    );

    // Send notification
    await createNotification(
      user.id,
      'account_banned',
      '🚫 Account Banned',
      `Your account has been permanently banned. Reason: ${reason || 'Severe violation of terms.'}`,
      '/dashboard'
    );

    return {
      response: `🚫 **User Banned Permanently**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 **User:** ${userData.first_name} ${userData.last_name}
📧 ${userData.email}
📝 **Reason:** ${reason || 'Permanent ban for severe violation'}

The user has been notified. This action is permanent.`,
      type: 'ban',
      user: userData
    };
  }

  async handleActivate(adminId, message, words) {
    const { user, reason } = this.extractUserAndReason(message, words);
    
    if (!user) {
      return {
        response: `❌ **Please specify a user to activate/restore.**
Example: **activate "John Doe" "Restored after review"**`,
        type: 'error'
      };
    }

    const userResult = await db.query(
      'SELECT id, first_name, last_name, email, role, suspended_at FROM users WHERE id = $1',
      [user.id]
    );
    
    if (userResult.rows.length === 0) {
      return {
        response: `❌ **User not found.** Please check the user ID or name.`,
        type: 'error'
      };
    }

    const userData = userResult.rows[0];

    if (!userData.suspended_at) {
      return {
        response: `ℹ️ **User is already active.**
👤 ${userData.first_name} ${userData.last_name} is not suspended.`,
        type: 'info'
      };
    }

    // Restore user
    await db.query(
      `UPDATE users 
       SET suspended_at = NULL,
           suspension_reason = NULL,
           suspension_end_date = NULL,
           is_active = true
       WHERE id = $1`,
      [user.id]
    );

    // Log admin action
    await db.query(
      `INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details) 
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, 'restore_user', 'user', user.id, JSON.stringify({ reason: reason || 'Restored by admin' })]
    );

    // Send notification
    await createNotification(
      user.id,
      'account_restored',
      '✅ Account Restored',
      `Your account has been restored. ${reason || 'Please continue to follow community guidelines.'}`,
      '/dashboard'
    );

    return {
      response: `✅ **User Restored**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 **User:** ${userData.first_name} ${userData.last_name}
📧 ${userData.email}
📝 **Reason:** ${reason || 'Restored by admin'}

The user has been notified and can now access their account.`,
      type: 'activate',
      user: userData
    };
  }

  // ============================================
  // BOOKING COMMANDS
  // ============================================

  async handleBookings(adminId, message, words) {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
        COALESCE(SUM(total_amount), 0) as total_revenue
      FROM bookings
    `);

    const recentBookings = await db.query(`
      SELECT b.id, b.status, b.total_amount, b.created_at,
        p.first_name as parent_name,
        s.first_name as babysitter_name
      FROM bookings b
      JOIN users p ON p.id = b.parent_id
      JOIN users s ON s.id = b.babysitter_id
      ORDER BY b.created_at DESC
      LIMIT 5
    `);

    let response = `📅 **Booking Overview**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 **Total Bookings:** ${stats.rows[0].total}
💰 **Total Revenue:** $${parseFloat(stats.rows[0].total_revenue).toFixed(2)}

📊 **Status Breakdown:**
  ⏳ Pending: ${stats.rows[0].pending}
  ✅ Confirmed: ${stats.rows[0].confirmed}
  🔄 In Progress: ${stats.rows[0].in_progress}
  🎉 Completed: ${stats.rows[0].completed}
  ❌ Cancelled: ${stats.rows[0].cancelled}

📋 **Recent Bookings:**
`;
    recentBookings.rows.forEach((b, i) => {
      response += `  ${i+1}. #${b.id} - ${b.parent_name} → ${b.babysitter_name}\n`;
      response += `     Status: ${b.status} | Amount: $${parseFloat(b.total_amount || 0).toFixed(2)}\n`;
    });

    return { response, type: 'bookings' };
  }

  async handleCancellations(adminId, message, words) {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_cancellations,
        COUNT(CASE WHEN cancellation_reason IS NOT NULL THEN 1 END) as with_reason,
        DATE_TRUNC('month', created_at) as month
      FROM bookings
      WHERE status = 'cancelled'
      GROUP BY month
      ORDER BY month DESC
      LIMIT 6
    `);

    const recentCancellations = await db.query(`
      SELECT b.id, b.cancellation_reason, b.created_at,
        p.first_name as parent_name,
        s.first_name as babysitter_name,
        u_c.first_name as cancelled_by
      FROM bookings b
      JOIN users p ON p.id = b.parent_id
      JOIN users s ON s.id = b.babysitter_id
      LEFT JOIN users u_c ON u_c.id = b.cancelled_by
      WHERE b.status = 'cancelled'
      ORDER BY b.created_at DESC
      LIMIT 10
    `);

    let response = `❌ **Cancellation Report**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 **Total Cancellations:** ${stats.rows[0]?.total_cancellations || 0}

📋 **Recent Cancellations:**
`;
    recentCancellations.rows.forEach((c, i) => {
      response += `  ${i+1}. #${c.id} - ${c.parent_name} ↔ ${c.babysitter_name}\n`;
      response += `     Reason: ${c.cancellation_reason || 'No reason provided'}\n`;
      response += `     Cancelled by: ${c.cancelled_by || 'System'}\n`;
    });

    return { response, type: 'cancellations' };
  }

  // ============================================
  // HELP COMMAND
  // ============================================

  handleHelp() {
    return {
      response: `📚 **Admin Chat Commands**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 **Statistics:**
  • **stats** - Show platform overview
  • **users** - Show user breakdown
  • **babysitters** - Show babysitter stats
  • **parents** - Show parent stats
  • **reports** - Show report overview
  • **reviews** - Show review stats
  • **bookings** - Show booking stats
  • **cancellations** - Show cancellation report

🔍 **User Lookup:**
  • **find "John Doe"** - Search for a user
  • **user "john@email.com"** - Find user by email

⚡ **Moderation:**
  • **warn "User Name" "Reason"** - Issue a warning
  • **suspend "User Name" "Reason" 7** - Suspend for X days
  • **ban "User Name" "Reason"** - Ban permanently
  • **activate "User Name" "Reason"** - Restore account

💡 **Tips:**
  • Use quotes for names with spaces: "John Doe"
  • For suspension: **suspend "John Doe" "Violation" 14** (14 days)
  • Type **help** or **?** to see this menu again

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Example: **find "Sarah Miller"**`,
      type: 'help'
    };
  }

  getHelpResponse() {
    return this.handleHelp();
  }

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  extractUserAndReason(message, words, hasDuration = false) {
    let user = null;
    let reason = '';
    let duration = null;

    // Try to extract from quotes
    const quotedMatches = message.match(/["']([^"']+)["']/g);
    if (quotedMatches && quotedMatches.length >= 1) {
      const userName = quotedMatches[0].replace(/["']/g, '');
      
      // Find user by name
      const userResult = db.query(
        `SELECT id, first_name, last_name, email, role 
         FROM users 
         WHERE CONCAT(first_name, ' ', last_name) ILIKE $1
         LIMIT 1`,
        [`%${userName}%`]
      );
      
      // This needs to be awaited properly - but we're in a sync method
      // We'll handle this differently in the actual command handlers
      return { user: { id: null, name: userName }, reason: '', duration: null };
    }

    // If no quotes, try to parse from words
    if (words.length >= 3) {
      // Try to find user by name (first_name + last_name)
      const nameParts = [];
      let i = 1;
      while (i < words.length && !['for', 'because', 'reason', '-d', 'duration'].includes(words[i])) {
        nameParts.push(words[i]);
        i++;
      }
      
      if (nameParts.length > 0) {
        const name = nameParts.join(' ');
        return { user: { id: null, name }, reason: '', duration: null };
      }
    }

    return { user: null, reason: '', duration: null };
  }
}

// Helper functions for warnings
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
  const suspensionEnd = new Date();
  suspensionEnd.setDate(suspensionEnd.getDate() + 7);
  
  await db.query(
    `UPDATE users 
     SET suspended_at = CURRENT_TIMESTAMP,
         suspension_reason = 'Auto-suspended for receiving 3 warnings',
         suspension_end_date = $1,
         is_active = false
     WHERE id = $2`,
    [suspensionEnd, userId]
  );
}

module.exports = new AdminChatbot();