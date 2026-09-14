// server/src/ai/admin/tools/writeTools.js
// Write / action tools.
// These modify data. The AI is instructed to be careful with destructive ones.

const db = require('../../../config/database');
const { createNotification } = require('../../../routes/notifications');

module.exports = {

  // ============================================
  // MODERATION
  // ============================================
  async warn_user({ user_id, reason }) {
    const u = await db.query(
      `SELECT id, first_name, last_name, email FROM users WHERE id = $1`, [user_id]
    );
    if (u.rows.length === 0) return { error: 'User not found' };
    const user = u.rows[0];

    const rep = await db.query(`
      INSERT INTO reports (reporter_id, reported_user_id, reason, description,
                           category, severity, status, admin_action)
      VALUES ($1,$2,$3,$4,'unprofessional_behavior','medium','resolved','warning')
      RETURNING id
    `, [1, user_id, reason || 'Warning issued by admin',
        `Admin warning: ${reason || 'Please follow community guidelines.'}`]);

    await db.query(`
      INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details)
      VALUES ($1,'warning','user',$2,$3)
    `, [1, user_id, JSON.stringify({ reason, report_id: rep.rows[0].id })]);

    await createNotification(
      user_id, 'warning_received', '⚠️ Warning Issued',
      `You have received a warning. Reason: ${reason || 'Please follow community guidelines.'}`,
      '/dashboard'
    );

    const count = await db.query(`
      SELECT COUNT(*) AS c FROM reports
      WHERE reported_user_id = $1 AND admin_action='warning' AND status='resolved'
        AND created_at > NOW() - INTERVAL '90 days'
    `, [user_id]);

    return {
      ok: true,
      user: { id: user.id, name: `${user.first_name} ${user.last_name}` },
      total_warnings_90d: parseInt(count.rows[0].c),
      message: `Warning issued to ${user.first_name} ${user.last_name}.`,
    };
  },

  async suspend_user({ user_id, reason, days = 7 }) {
    const u = await db.query(
      `SELECT id, first_name, last_name, email FROM users WHERE id = $1`, [user_id]
    );
    if (u.rows.length === 0) return { error: 'User not found' };
    const user = u.rows[0];

    const end = new Date();
    end.setDate(end.getDate() + days);

    await db.query(`
      UPDATE users
      SET suspended_at = CURRENT_TIMESTAMP,
          suspension_reason = $1,
          suspension_end_date = $2,
          is_active = false
      WHERE id = $3
    `, [reason || 'Suspended by admin', end, user_id]);

    await db.query(`
      INSERT INTO reports (reporter_id, reported_user_id, reason, description,
                           category, severity, status, admin_action)
      VALUES ($1,$2,$3,$4,'unprofessional_behavior','high','resolved','suspension')
    `, [1, user_id, `Suspended for ${days} days`, reason || 'Suspended by admin']);

    await db.query(`
      INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details)
      VALUES ($1,'suspension','user',$2,$3)
    `, [1, user_id, JSON.stringify({ reason, days })]);

    await createNotification(
      user_id, 'account_suspended', `⛔ Suspended (${days} days)`,
      `Your account is suspended for ${days} days. Reason: ${reason || 'Violation of guidelines.'}`,
      '/dashboard'
    );

    return {
      ok: true,
      user: { id: user.id, name: `${user.first_name} ${user.last_name}` },
      days,
      until: end.toISOString(),
      message: `Suspended ${user.first_name} ${user.last_name} for ${days} days.`,
    };
  },

  async ban_user({ user_id, reason }) {
    const u = await db.query(
      `SELECT id, first_name, last_name, email FROM users WHERE id = $1`, [user_id]
    );
    if (u.rows.length === 0) return { error: 'User not found' };
    const user = u.rows[0];

    await db.query(`
      UPDATE users
      SET is_active = false,
          suspended_at = CURRENT_TIMESTAMP,
          suspension_reason = $1,
          suspension_end_date = NULL
      WHERE id = $2
    `, [`BANNED: ${reason || 'Permanent ban'}`, user_id]);

    await db.query(`
      INSERT INTO reports (reporter_id, reported_user_id, reason, description,
                           category, severity, status, admin_action)
      VALUES ($1,$2,'Banned permanently',$3,'unprofessional_behavior','critical','resolved','ban')
    `, [1, user_id, reason || 'Permanent ban']);

    await db.query(`
      INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details)
      VALUES ($1,'ban','user',$2,$3)
    `, [1, user_id, JSON.stringify({ reason })]);

    await createNotification(
      user_id, 'account_banned', '🚫 Account Banned',
      `Your account is permanently banned. Reason: ${reason || 'Severe violation.'}`,
      '/dashboard'
    );

    return {
      ok: true,
      user: { id: user.id, name: `${user.first_name} ${user.last_name}` },
      message: `Banned ${user.first_name} ${user.last_name} permanently.`,
    };
  },

  async activate_user({ user_id, reason }) {
    const u = await db.query(
      `SELECT id, first_name, last_name, suspended_at FROM users WHERE id = $1`,
      [user_id]
    );
    if (u.rows.length === 0) return { error: 'User not found' };
    const user = u.rows[0];

    if (!user.suspended_at) {
      return { ok: false, message: 'User is already active.' };
    }

    await db.query(`
      UPDATE users
      SET suspended_at = NULL, suspension_reason = NULL,
          suspension_end_date = NULL, is_active = true
      WHERE id = $1
    `, [user_id]);

    await db.query(`
      INSERT INTO admin_activity_log (admin_id, action, target_type, target_id, details)
      VALUES ($1,'restore_user','user',$2,$3)
    `, [1, user_id, JSON.stringify({ reason: reason || 'Restored by admin' })]);

    await createNotification(
      user_id, 'account_restored', '✅ Account Restored',
      `Your account has been restored. ${reason || ''}`,
      '/dashboard'
    );

    return {
      ok: true,
      user: { id: user.id, name: `${user.first_name} ${user.last_name}` },
      message: `Restored ${user.first_name} ${user.last_name}.`,
    };
  },

  // ============================================
  // BABYSITTER APPROVAL
  // ============================================
  async approve_babysitter({ user_id }) {
    const r = await db.query(`
      UPDATE babysitter_profiles
      SET status='approved', is_verified=true, updated_at=CURRENT_TIMESTAMP
      WHERE user_id = $1 RETURNING id
    `, [user_id]);
    if (r.rows.length === 0) return { error: 'Babysitter profile not found' };

    await createNotification(
      user_id, 'profile_update', '🎉 Profile Approved',
      'Your babysitter profile has been approved.', '/dashboard'
    );

    return { ok: true, message: `Approved babysitter profile for user ${user_id}.` };
  },

  async reject_babysitter({ user_id, reason }) {
    const r = await db.query(`
      UPDATE babysitter_profiles
      SET status='rejected', updated_at=CURRENT_TIMESTAMP
      WHERE user_id = $1 RETURNING id
    `, [user_id]);
    if (r.rows.length === 0) return { error: 'Babysitter profile not found' };

    await createNotification(
      user_id, 'profile_update', 'Profile Rejected',
      `Your profile was rejected. Reason: ${reason || 'See admin notes.'}`, '/dashboard'
    );

    return { ok: true, message: `Rejected babysitter profile for user ${user_id}.` };
  },

  // ============================================
  // BOOKINGS
  // ============================================
  async refund_booking({ booking_id, amount, reason }) {
    const b = await db.query(
      `SELECT id, total_amount, parent_id, babysitter_id FROM bookings WHERE id = $1`,
      [booking_id]
    );
    if (b.rows.length === 0) return { error: 'Booking not found' };
    const bk = b.rows[0];
    const refundAmount = amount ?? bk.total_amount;

    try {
      await db.query(`
        INSERT INTO refunds (booking_id, user_id, amount, reason, status, processed_at)
        VALUES ($1, $2, $3, $4, 'approved', CURRENT_TIMESTAMP)
      `, [booking_id, bk.parent_id, refundAmount, reason || 'Admin refund']);

      await createNotification(
        bk.parent_id, 'refund_approved', '💰 Refund Approved',
        `Your refund of $${refundAmount} for booking #${booking_id} was approved.`,
        '/dashboard'
      );

      return {
        ok: true,
        booking_id,
        amount: parseFloat(refundAmount),
        message: `Refunded $${refundAmount} to parent for booking #${booking_id}.`,
      };
    } catch (e) {
      return { error: 'Refund failed: ' + e.message };
    }
  },

  async delete_booking({ booking_id }) {
    const b = await db.query(
      `SELECT id FROM bookings WHERE id = $1`, [booking_id]
    );
    if (b.rows.length === 0) return { error: 'Booking not found' };

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE babysitter_availability
         SET is_booked=false, booked_booking_id=NULL, booked_at=NULL
         WHERE booked_booking_id = $1`,
        [booking_id]
      );
      await client.query(`DELETE FROM bookings WHERE id = $1`, [booking_id]);
      await client.query('COMMIT');
      return { ok: true, booking_id, message: `Deleted booking #${booking_id}.` };
    } catch (e) {
      await client.query('ROLLBACK');
      return { error: e.message };
    } finally {
      client.release();
    }
  },

  // ============================================
  // USERS — DESTRUCTIVE
  // ============================================
  async delete_user({ user_id }) {
    const u = await db.query(
      `SELECT id, first_name, last_name, email, role FROM users WHERE id = $1`,
      [user_id]
    );
    if (u.rows.length === 0) return { error: 'User not found' };
    const user = u.rows[0];

    if (user.role === 'admin') {
      return { error: 'Refusing to delete an admin account.' };
    }

    await db.query(`DELETE FROM users WHERE id = $1`, [user_id]);

    return {
      ok: true,
      deleted: { id: user.id, name: `${user.first_name} ${user.last_name}`, email: user.email },
      message: `Deleted user ${user.first_name} ${user.last_name} (${user.email}).`,
    };
  },

  // ============================================
  // NOTIFICATIONS
  // ============================================
  async send_notification({ user_id, title, message }) {
    if (!title || !message) {
      return { error: 'Title and message are required.' };
    }

    const u = await db.query(`SELECT id, first_name FROM users WHERE id = $1`, [user_id]);
    if (u.rows.length === 0) return { error: 'User not found' };

    await createNotification(
      user_id,
      'admin_message',
      title,
      message,
      '/dashboard'
    );

    return {
      ok: true,
      message: `Notification sent to user ${user_id} (${u.rows[0].first_name}).`,
    };
  },

  // ============================================
  // WITHDRAWALS
  // ============================================
  async approve_withdrawal({ withdrawal_id }) {
    try {
      const r = await db.query(`
        UPDATE withdrawals
        SET status='approved', processed_at=CURRENT_TIMESTAMP
        WHERE id = $1 AND status='pending'
        RETURNING user_id, amount
      `, [withdrawal_id]);
      if (r.rows.length === 0) return { error: 'Withdrawal not found or not pending' };

      const w = r.rows[0];
      await createNotification(
        w.user_id, 'withdrawal_approved', '💸 Withdrawal Approved',
        `Your withdrawal of $${w.amount} has been approved.`,
        '/dashboard'
      );

      return { ok: true, message: `Approved withdrawal #${withdrawal_id} ($${w.amount}).` };
    } catch (e) {
      return { error: 'Withdrawals system not available: ' + e.message };
    }
  },

  async reject_withdrawal({ withdrawal_id, reason }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const r = await client.query(`
        SELECT id, user_id, amount FROM withdrawals
        WHERE id = $1 AND status='pending'
      `, [withdrawal_id]);
      if (r.rows.length === 0) {
        await client.query('ROLLBACK');
        return { error: 'Withdrawal not found or not pending' };
      }
      const w = r.rows[0];

      // Refund the wallet balance
      await client.query(`
        UPDATE wallets SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
      `, [w.amount, w.user_id]);

      await client.query(`
        UPDATE withdrawals
        SET status='rejected', admin_notes=$1, processed_at=CURRENT_TIMESTAMP
        WHERE id = $2
      `, [reason || 'Rejected by admin', withdrawal_id]);

      await client.query(`
        INSERT INTO wallet_transactions (user_id, type, amount, withdrawal_id, note)
        VALUES ($1, 'adjustment', $2, $3, $4)
      `, [w.user_id, w.amount, withdrawal_id, `Refunded: ${reason || 'rejected'}`]);

      await client.query('COMMIT');

      await createNotification(
        w.user_id, 'withdrawal_rejected', '❌ Withdrawal Rejected',
        `Your withdrawal was rejected and the amount returned to your wallet. Reason: ${reason || 'See admin notes.'}`,
        '/dashboard'
      );

      return { ok: true, message: `Rejected withdrawal #${withdrawal_id} and refunded $${w.amount} to wallet.` };
    } catch (e) {
      await client.query('ROLLBACK');
      return { error: e.message };
    } finally {
      client.release();
    }
  },

};