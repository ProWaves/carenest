// server/src/ai/admin/tools/readTools.js
// All read-only / analysis tools.
// These never modify data. The AI can call them freely.

const db = require('../../../config/database');

module.exports = {

  // ============================================
  // PLATFORM OVERVIEW
  // ============================================
  async get_platform_snapshot() {
    const r = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM users)                                          AS total_users,
        (SELECT COUNT(*) FROM users WHERE role='parent')                      AS parents,
        (SELECT COUNT(*) FROM users WHERE role='babysitter')                  AS babysitters,
        (SELECT COUNT(*) FROM users WHERE role='babysitter' AND suspended_at IS NOT NULL) AS suspended_babysitters,
        (SELECT COUNT(*) FROM users WHERE role='parent' AND suspended_at IS NOT NULL)     AS suspended_parents,
        (SELECT COUNT(*) FROM bookings)                                       AS total_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status='pending')                AS pending_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status='confirmed')              AS confirmed_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status='in_progress')            AS active_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status='completed')              AS completed_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status='cancelled')              AS cancelled_bookings,
        (SELECT COUNT(*) FROM reports WHERE status='pending')                 AS pending_reports,
        (SELECT COUNT(*) FROM reports)                                        AS total_reports,
        (SELECT COUNT(*) FROM reviews)                                        AS total_reviews,
        (SELECT COALESCE(AVG(rating),0) FROM reviews)                         AS avg_rating,
        (SELECT COALESCE(SUM(total_amount),0) FROM bookings WHERE status='completed') AS total_revenue,
        (SELECT COUNT(*) FROM babysitter_profiles WHERE status='pending')     AS pending_approvals,
        (SELECT COUNT(*) FROM babysitter_documents WHERE is_verified=false AND (rejection_reason IS NULL OR rejection_reason='')) AS pending_documents
    `);
    return r.rows[0];
  },

  // ============================================
  // USERS
  // ============================================
  async find_users({ query, limit = 20 }) {
    const q = `%${query}%`;
    const r = await db.query(`
      SELECT id, first_name, last_name, email, role, city,
             is_active, suspended_at, suspension_reason, created_at
      FROM users
      WHERE LOWER(first_name) LIKE LOWER($1)
         OR LOWER(last_name)  LIKE LOWER($1)
         OR LOWER(email)      LIKE LOWER($1)
         OR CONCAT(first_name,' ',last_name) ILIKE $1
         OR CAST(id AS TEXT) = $2
      ORDER BY id DESC
      LIMIT $3
    `, [q, query, limit]);
    return { count: r.rows.length, users: r.rows };
  },

  async list_users_by_role({ role, status = 'all', city, limit = 20 }) {
    const params = [role];
    let where = 'role = $1';
    if (status === 'suspended') {
      where += ' AND suspended_at IS NOT NULL';
    } else if (status === 'active') {
      where += ' AND is_active = true AND suspended_at IS NULL';
    } else if (status === 'inactive') {
      where += ' AND is_active = false AND suspended_at IS NULL';
    }
    if (city) {
      params.push(`%${city}%`);
      where += ` AND LOWER(city) LIKE LOWER($${params.length})`;
    }
    params.push(limit);
    const r = await db.query(`
      SELECT id, first_name, last_name, email, city,
             is_active, suspended_at, suspension_reason, created_at
      FROM users
      WHERE ${where}
      ORDER BY id DESC
      LIMIT $${params.length}
    `, params);
    return { count: r.rows.length, users: r.rows };
  },

  async get_user_full_profile({ user_id }) {
    const user = await db.query(`
      SELECT id, first_name, last_name, email, role, phone, city,
             is_active, suspended_at, suspension_reason, suspension_end_date,
             created_at, updated_at
      FROM users WHERE id = $1
    `, [user_id]);

    if (user.rows.length === 0) return { error: 'User not found' };
    const u = user.rows[0];

    const profile = await db.query(
      `SELECT * FROM babysitter_profiles WHERE user_id = $1`,
      [user_id]
    );

    const bookingsAsParent = await db.query(`
      SELECT b.id, b.status, b.total_amount, b.start_date, b.created_at,
             s.first_name || ' ' || s.last_name AS other_party
      FROM bookings b
      JOIN users s ON s.id = b.babysitter_id
      WHERE b.parent_id = $1
      ORDER BY b.created_at DESC LIMIT 20
    `, [user_id]);

    const bookingsAsSitter = await db.query(`
      SELECT b.id, b.status, b.total_amount, b.start_date, b.created_at,
             p.first_name || ' ' || p.last_name AS other_party
      FROM bookings b
      JOIN users p ON p.id = b.parent_id
      WHERE b.babysitter_id = $1
      ORDER BY b.created_at DESC LIMIT 20
    `, [user_id]);

    const reviewsReceived = await db.query(`
      SELECT r.rating, r.comment, r.created_at,
             u.first_name || ' ' || u.last_name AS reviewer
      FROM reviews r
      JOIN users u ON u.id = r.parent_id
      WHERE r.babysitter_id = $1
      ORDER BY r.created_at DESC LIMIT 10
    `, [user_id]);

    const reportsAgainst = await db.query(`
      SELECT r.id, r.category, r.reason, r.status, r.severity, r.admin_action,
             r.created_at
      FROM reports r
      WHERE r.reported_user_id = $1
      ORDER BY r.created_at DESC LIMIT 20
    `, [user_id]);

    const reportsBy = await db.query(`
      SELECT r.id, r.category, r.reason, r.status, r.created_at
      FROM reports r
      WHERE r.reporter_id = $1
      ORDER BY r.created_at DESC LIMIT 10
    `, [user_id]);

    // Earnings (only meaningful for babysitters)
    let earnings = null;
    if (u.role === 'babysitter') {
      const e = await db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='completed') AS completed_bookings,
          COUNT(*) FILTER (WHERE status='cancelled') AS cancelled_bookings,
          COUNT(*) FILTER (WHERE status='pending')   AS pending_bookings,
          COALESCE(SUM(total_amount) FILTER (WHERE status='completed'),0) AS total_earned,
          COALESCE(AVG(total_amount) FILTER (WHERE status='completed'),0) AS avg_booking_value,
          COALESCE(MAX(total_amount),0) AS highest_booking
        FROM bookings WHERE babysitter_id = $1
      `, [user_id]);
      earnings = e.rows[0];

      const monthly = await db.query(`
        SELECT TO_CHAR(start_date,'YYYY-MM') AS month,
               COUNT(*) AS bookings,
               COALESCE(SUM(total_amount),0) AS earned
        FROM bookings
        WHERE babysitter_id = $1 AND status='completed'
        GROUP BY month
        ORDER BY month DESC LIMIT 12
      `, [user_id]);
      earnings.monthly = monthly.rows;
    }

    // Wallet
    let wallet = null;
    try {
      const w = await db.query(
        `SELECT balance, updated_at FROM wallets WHERE user_id = $1`,
        [user_id]
      );
      if (w.rows.length > 0) wallet = w.rows[0];
    } catch (e) { /* wallets table may not exist */ }

    return {
      user: u,
      profile: profile.rows[0] || null,
      wallet,
      earnings,
      bookings_as_parent: bookingsAsParent.rows,
      bookings_as_sitter: bookingsAsSitter.rows,
      reviews_received: reviewsReceived.rows,
      reports_against: reportsAgainst.rows,
      reports_filed: reportsBy.rows,
    };
  },

  async get_user_warnings({ user_id }) {
    const r = await db.query(`
      SELECT id, reason, admin_notes, created_at
      FROM reports
      WHERE reported_user_id = $1
        AND admin_action = 'warning'
        AND status = 'resolved'
        AND created_at > NOW() - INTERVAL '90 days'
      ORDER BY created_at DESC
    `, [user_id]);
    return { count: r.rows.length, warnings: r.rows };
  },

  async get_flagged_users({ limit = 20 }) {
    const r = await db.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.role,
             COUNT(r.id) AS report_count,
             COUNT(CASE WHEN r.severity IN ('high','critical') THEN 1 END) AS serious_reports,
             MAX(r.created_at) AS last_reported
      FROM users u
      JOIN reports r ON r.reported_user_id = u.id
      WHERE r.created_at > NOW() - INTERVAL '90 days'
      GROUP BY u.id
      HAVING COUNT(r.id) >= 2
      ORDER BY report_count DESC, serious_reports DESC
      LIMIT $1
    `, [limit]);
    return { count: r.rows.length, users: r.rows };
  },

  // ============================================
  // EARNINGS & MONEY
  // ============================================
  async get_babysitter_earnings({ babysitter_id }) {
    const r = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='completed') AS completed,
        COUNT(*) FILTER (WHERE status='pending')   AS pending,
        COUNT(*) FILTER (WHERE status='cancelled') AS cancelled,
        COALESCE(SUM(total_amount) FILTER (WHERE status='completed'),0) AS total_earned,
        COALESCE(AVG(total_amount) FILTER (WHERE status='completed'),0) AS avg_per_booking
      FROM bookings WHERE babysitter_id = $1
    `, [babysitter_id]);

    const monthly = await db.query(`
      SELECT TO_CHAR(start_date,'YYYY-MM') AS month,
             COUNT(*) AS bookings,
             COALESCE(SUM(total_amount),0) AS earned
      FROM bookings
      WHERE babysitter_id = $1 AND status='completed'
      GROUP BY month
      ORDER BY month DESC LIMIT 12
    `, [babysitter_id]);

    return { summary: r.rows[0], monthly: monthly.rows };
  },

  async get_platform_revenue({ period = 'month' }) {
    const intervals = {
      day: '1 day',
      week: '7 days',
      month: '30 days',
      year: '1 year',
      all: null,
    };
    const interval = intervals[period] ?? '30 days';
    const whereClause = interval
      ? `status='completed' AND created_at > NOW() - INTERVAL '${interval}'`
      : `status='completed'`;

    const r = await db.query(`
      SELECT
        COUNT(*) AS completed_bookings,
        COALESCE(SUM(total_amount),0) AS revenue,
        COALESCE(AVG(total_amount),0) AS avg_booking_value
      FROM bookings WHERE ${whereClause}
    `);

    const daily = await db.query(`
      SELECT TO_CHAR(created_at,'YYYY-MM-DD') AS date,
             COUNT(*) AS bookings,
             COALESCE(SUM(total_amount),0) AS revenue
      FROM bookings
      WHERE ${whereClause}
      GROUP BY date
      ORDER BY date DESC LIMIT 30
    `);

    return { summary: r.rows[0], daily: daily.rows };
  },

  async get_top_earners({ limit = 10, period = 'all' }) {
    const intervals = { month: '30 days', year: '1 year', all: null };
    const interval = intervals[period];
    const timeFilter = interval
      ? `AND b.created_at > NOW() - INTERVAL '${interval}'`
      : '';

    const r = await db.query(`
      SELECT u.id, u.first_name, u.last_name, u.city, u.email,
             COUNT(b.id) AS completed_bookings,
             COALESCE(SUM(b.total_amount),0) AS total_earned,
             COALESCE(AVG(b.total_amount),0) AS avg_booking_value
      FROM users u
      JOIN bookings b ON b.babysitter_id = u.id
      WHERE b.status='completed' ${timeFilter}
      GROUP BY u.id
      ORDER BY total_earned DESC
      LIMIT $1
    `, [limit]);
    return { period, count: r.rows.length, babysitters: r.rows };
  },

  async get_wallet_summary() {
    try {
      const r = await db.query(`
        SELECT
          COUNT(*) AS wallet_count,
          COALESCE(SUM(balance),0) AS total_balance,
          COALESCE(AVG(balance),0) AS avg_balance,
          COALESCE(MAX(balance),0) AS max_balance
        FROM wallets
      `);

      const top = await db.query(`
        SELECT w.user_id, w.balance,
               u.first_name, u.last_name, u.email
        FROM wallets w
        JOIN users u ON u.id = w.user_id
        ORDER BY balance DESC LIMIT 10
      `);

      return { summary: r.rows[0], top_balances: top.rows };
    } catch (e) {
      return { error: 'Wallet system not available: ' + e.message };
    }
  },

  async get_pending_withdrawals() {
    try {
      const r = await db.query(`
        SELECT w.id, w.amount, w.status, w.requested_at,
               u.first_name, u.last_name, u.email
        FROM withdrawals w
        JOIN users u ON u.id = w.user_id
        WHERE w.status = 'pending'
        ORDER BY w.requested_at ASC
      `);
      return { count: r.rows.length, withdrawals: r.rows };
    } catch (e) {
      return { error: 'Withdrawals system not available: ' + e.message };
    }
  },

  // ============================================
  // BOOKINGS
  // ============================================
  async list_bookings({ status, limit = 20 }) {
    const params = [];
    let where = '1=1';
    if (status) {
      params.push(status);
      where += ` AND b.status = $${params.length}`;
    }
    params.push(limit);
    const r = await db.query(`
      SELECT b.id, b.status, b.total_amount, b.total_hours,
             b.start_date, b.end_date, b.created_at,
             p.first_name || ' ' || p.last_name AS parent_name,
             p.id AS parent_id,
             s.first_name || ' ' || s.last_name AS babysitter_name,
             s.id AS babysitter_id
      FROM bookings b
      JOIN users p ON p.id = b.parent_id
      JOIN users s ON s.id = b.babysitter_id
      WHERE ${where}
      ORDER BY b.created_at DESC LIMIT $${params.length}
    `, params);
    return { count: r.rows.length, bookings: r.rows };
  },

  async get_booking_stats({ period = 'month' }) {
    const intervals = { week: '7 days', month: '30 days', year: '1 year', all: null };
    const interval = intervals[period] ?? '30 days';
    const whereClause = interval
      ? `created_at > NOW() - INTERVAL '${interval}'`
      : '1=1';

    const r = await db.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status='completed') AS completed,
        COUNT(*) FILTER (WHERE status='cancelled') AS cancelled,
        COUNT(*) FILTER (WHERE status='pending')   AS pending,
        COALESCE(AVG(total_hours),0) AS avg_hours,
        COALESCE(AVG(total_amount),0) AS avg_value,
        CASE WHEN COUNT(*) > 0
             THEN ROUND(COUNT(*) FILTER (WHERE status='completed') * 100.0 / COUNT(*), 1)
             ELSE 0 END AS completion_rate_pct
      FROM bookings WHERE ${whereClause}
    `);

    return { period, summary: r.rows[0] };
  },

  async get_cancellation_analysis() {
    const r = await db.query(`
      SELECT
        COUNT(*) AS total_cancellations,
        COUNT(*) FILTER (WHERE cancellation_reason IS NOT NULL) AS with_reason,
        COUNT(*) FILTER (WHERE cancelled_by IS NOT NULL) AS with_actor
      FROM bookings WHERE status='cancelled'
    `);

    const reasons = await db.query(`
      SELECT COALESCE(cancellation_reason,'(no reason)') AS reason,
             COUNT(*) AS count
      FROM bookings WHERE status='cancelled'
      GROUP BY reason ORDER BY count DESC LIMIT 10
    `);

    const byActor = await db.query(`
      SELECT
        CASE
          WHEN cancelled_by = parent_id THEN 'parent'
          WHEN cancelled_by = babysitter_id THEN 'babysitter'
          ELSE 'system/unknown'
        END AS actor,
        COUNT(*) AS count
      FROM bookings WHERE status='cancelled'
      GROUP BY actor
    `);

    const frequentCancellers = await db.query(`
      SELECT u.id, u.first_name, u.last_name, u.role,
             COUNT(*) AS cancellations
      FROM bookings b
      JOIN users u ON u.id = b.cancelled_by
      WHERE b.status='cancelled'
      GROUP BY u.id
      HAVING COUNT(*) >= 2
      ORDER BY cancellations DESC LIMIT 10
    `);

    return {
      summary: r.rows[0],
      top_reasons: reasons.rows,
      by_actor: byActor.rows,
      frequent_cancellers: frequentCancellers.rows,
    };
  },

  // ============================================
  // REVIEWS
  // ============================================
  async get_rating_distribution() {
    const r = await db.query(`
      SELECT rating, COUNT(*) AS count
      FROM reviews GROUP BY rating ORDER BY rating DESC
    `);
    const avg = await db.query(`SELECT COALESCE(AVG(rating),0) AS avg, COUNT(*) AS total FROM reviews`);
    return { distribution: r.rows, summary: avg.rows[0] };
  },

  async get_review_trends() {
    const monthly = await db.query(`
      SELECT TO_CHAR(created_at,'YYYY-MM') AS month,
             COUNT(*) AS reviews,
             ROUND(AVG(rating)::numeric, 2) AS avg_rating,
             COUNT(*) FILTER (WHERE rating >= 4) AS positive,
             COUNT(*) FILTER (WHERE rating <= 2) AS negative
      FROM reviews
      GROUP BY month ORDER BY month DESC LIMIT 12
    `);

    const lowRated = await db.query(`
      SELECT u.id, u.first_name, u.last_name,
             ROUND(AVG(r.rating)::numeric, 2) AS avg_rating,
             COUNT(*) AS review_count
      FROM users u
      JOIN reviews r ON r.babysitter_id = u.id
      WHERE u.role='babysitter'
      GROUP BY u.id
      HAVING AVG(r.rating) < 3.5 AND COUNT(*) >= 3
      ORDER BY avg_rating ASC LIMIT 10
    `);

    return { monthly: monthly.rows, low_rated_babysitters: lowRated.rows };
  },

  // ============================================
  // REPORTS
  // ============================================
  async list_reports({ status, severity, limit = 20 }) {
    const params = [];
    let where = '1=1';
    if (status) { params.push(status); where += ` AND r.status = $${params.length}`; }
    if (severity) { params.push(severity); where += ` AND r.severity = $${params.length}`; }
    params.push(limit);
    const r = await db.query(`
      SELECT r.id, r.category, r.reason, r.status, r.severity,
             r.admin_action, r.created_at,
             rep.id AS reporter_id,
             rep.first_name || ' ' || rep.last_name AS reporter_name,
             repu.id AS reported_id,
             repu.first_name || ' ' || repu.last_name AS reported_name
      FROM reports r
      LEFT JOIN users rep  ON rep.id  = r.reporter_id
      LEFT JOIN users repu ON repu.id = r.reported_user_id
      WHERE ${where}
      ORDER BY r.created_at DESC LIMIT $${params.length}
    `, params);
    return { count: r.rows.length, reports: r.rows };
  },

  // ============================================
  // ACTIVITY & ANALYSIS
  // ============================================
  async get_activity_timeline({ days = 30 }) {
    const d = Math.min(Math.max(parseInt(days) || 30, 1), 365);

    const bookings = await db.query(`
      SELECT TO_CHAR(created_at,'YYYY-MM-DD') AS date,
             COUNT(*) AS count,
             COALESCE(SUM(total_amount) FILTER (WHERE status='completed'),0) AS revenue
      FROM bookings WHERE created_at > NOW() - INTERVAL '${d} days'
      GROUP BY date ORDER BY date
    `);

    const signups = await db.query(`
      SELECT TO_CHAR(created_at,'YYYY-MM-DD') AS date, role, COUNT(*) AS count
      FROM users WHERE created_at > NOW() - INTERVAL '${d} days'
      GROUP BY date, role ORDER BY date
    `);

    const reports = await db.query(`
      SELECT TO_CHAR(created_at,'YYYY-MM-DD') AS date, COUNT(*) AS count
      FROM reports WHERE created_at > NOW() - INTERVAL '${d} days'
      GROUP BY date ORDER BY date
    `);

    const cancellations = await db.query(`
      SELECT TO_CHAR(created_at,'YYYY-MM-DD') AS date, COUNT(*) AS count
      FROM bookings
      WHERE status='cancelled' AND created_at > NOW() - INTERVAL '${d} days'
      GROUP BY date ORDER BY date
    `);

    return {
      period_days: d,
      bookings_per_day: bookings.rows,
      signups_per_day: signups.rows,
      reports_per_day: reports.rows,
      cancellations_per_day: cancellations.rows,
    };
  },

  async get_anomalies() {
    const flags = {};

    // 1. Users with many cancellations in last 30 days
    const cancellers = await db.query(`
      SELECT u.id, u.first_name, u.last_name, u.role, COUNT(*) AS cancellations
      FROM bookings b
      JOIN users u ON u.id = b.cancelled_by
      WHERE b.status='cancelled' AND b.created_at > NOW() - INTERVAL '30 days'
      GROUP BY u.id HAVING COUNT(*) >= 3
      ORDER BY cancellations DESC
    `);
    if (cancellers.rows.length) flags.frequent_cancellers = cancellers.rows;

    // 2. Babysitters with sudden activity drop (no bookings in 14 days but had 5+ before)
    const droppedActivity = await db.query(`
      SELECT u.id, u.first_name, u.last_name,
             COUNT(b.id) FILTER (WHERE b.created_at > NOW() - INTERVAL '60 days'
                                 AND b.created_at < NOW() - INTERVAL '14 days') AS prior,
             COUNT(b.id) FILTER (WHERE b.created_at > NOW() - INTERVAL '14 days') AS recent
      FROM users u
      JOIN bookings b ON b.babysitter_id = u.id
      WHERE u.role='babysitter' AND u.is_active = true
      GROUP BY u.id
      HAVING COUNT(b.id) FILTER (WHERE b.created_at > NOW() - INTERVAL '60 days'
                                 AND b.created_at < NOW() - INTERVAL '14 days') >= 5
         AND COUNT(b.id) FILTER (WHERE b.created_at > NOW() - INTERVAL '14 days') = 0
    `);
    if (droppedActivity.rows.length) flags.sudden_inactivity = droppedActivity.rows;

    // 3. Babysitters with multiple low reviews recently
    const lowRated = await db.query(`
      SELECT u.id, u.first_name, u.last_name,
             ROUND(AVG(r.rating)::numeric,2) AS avg_rating,
             COUNT(*) AS recent_reviews
      FROM users u
      JOIN reviews r ON r.babysitter_id = u.id
      WHERE r.created_at > NOW() - INTERVAL '30 days'
      GROUP BY u.id
      HAVING AVG(r.rating) < 2.5 AND COUNT(*) >= 2
    `);
    if (lowRated.rows.length) flags.recent_low_ratings = lowRated.rows;

    // 4. Users with multiple reports in last 30 days
    const heavilyReported = await db.query(`
      SELECT u.id, u.first_name, u.last_name, u.role, COUNT(*) AS reports
      FROM reports r
      JOIN users u ON u.id = r.reported_user_id
      WHERE r.created_at > NOW() - INTERVAL '30 days'
      GROUP BY u.id HAVING COUNT(*) >= 2
      ORDER BY reports DESC
    `);
    if (heavilyReported.rows.length) flags.heavily_reported = heavilyReported.rows;

    // 5. Revenue anomaly: today vs 7-day average
    const revenueCheck = await db.query(`
      WITH daily AS (
        SELECT DATE(created_at) AS day,
               COALESCE(SUM(total_amount) FILTER (WHERE status='completed'),0) AS rev
        FROM bookings
        WHERE created_at > NOW() - INTERVAL '8 days'
        GROUP BY day
      )
      SELECT
        (SELECT rev FROM daily WHERE day = CURRENT_DATE) AS today_rev,
        ROUND(AVG(rev)::numeric, 2) AS avg_7d,
        (SELECT COUNT(*) FROM daily) AS days_with_data
      FROM daily WHERE day < CURRENT_DATE
    `);
    const row = revenueCheck.rows[0];
    if (row && row.today_rev !== null && row.avg_7d && parseFloat(row.avg_7d) > 0) {
      const ratio = parseFloat(row.today_rev) / parseFloat(row.avg_7d);
      if (ratio < 0.5 || ratio > 2.0) {
        flags.revenue_deviation = {
          today: parseFloat(row.today_rev),
          avg_7d: parseFloat(row.avg_7d),
          ratio: Math.round(ratio * 100) / 100,
          note: ratio < 0.5 ? 'unusually low' : 'unusually high',
        };
      }
    }

    return {
      flags_found: Object.keys(flags).length,
      anomalies: flags,
      note: Object.keys(flags).length === 0
        ? 'No anomalies detected in the last 30 days.'
        : 'Patterns worth investigating.',
    };
  },

  async get_comparison({ metric, period_a = 'this_week', period_b = 'last_week' }) {
    const windows = {
      today:      ['CURRENT_DATE', 'CURRENT_DATE'],
      this_week:  ["DATE_TRUNC('week', CURRENT_DATE)", 'NOW()'],
      last_week:  ["DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days'",
                   "DATE_TRUNC('week', CURRENT_DATE)"],
      this_month: ["DATE_TRUNC('month', CURRENT_DATE)", 'NOW()'],
      last_month: ["DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'",
                   "DATE_TRUNC('month', CURRENT_DATE)"],
    };

    const [startA, endA] = windows[period_a] || windows.this_week;
    const [startB, endB] = windows[period_b] || windows.last_week;

    const metricSql = {
      revenue:  `COALESCE(SUM(total_amount) FILTER (WHERE status='completed'),0)`,
      bookings: `COUNT(*)`,
      signups:  `(SELECT COUNT(*) FROM users WHERE created_at >= %START% AND created_at < %END%)`,
    };

    // Simplest approach: run two separate queries per metric
    async function getVal(metric, start, end) {
      if (metric === 'revenue' || metric === 'bookings') {
        const col = metric === 'revenue'
          ? `COALESCE(SUM(total_amount) FILTER (WHERE status='completed'),0)`
          : `COUNT(*)`;
        const r = await db.query(
          `SELECT ${col} AS v FROM bookings
           WHERE created_at >= ${start} AND created_at < ${end}`
        );
        return parseFloat(r.rows[0].v) || 0;
      }
      if (metric === 'signups') {
        const r = await db.query(
          `SELECT COUNT(*) AS v FROM users
           WHERE created_at >= ${start} AND created_at < ${end}`
        );
        return parseInt(r.rows[0].v) || 0;
      }
      return null;
    }

    const a = await getVal(metric, startA, endA);
    const b = await getVal(metric, startB, endB);

    const change = b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / b) * 100;

    return {
      metric,
      period_a: { label: period_a, value: a },
      period_b: { label: period_b, value: b },
      change_pct: Math.round(change * 100) / 100,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
    };
  },

  async get_recent_events({ hours = 24 }) {
    const h = Math.min(Math.max(parseInt(hours) || 24, 1), 168);

    const users = await db.query(`
      SELECT 'signup' AS kind, id, first_name || ' ' || last_name AS name,
             role, created_at AS at
      FROM users WHERE created_at > NOW() - INTERVAL '${h} hours'
    `);

    const bookings = await db.query(`
      SELECT 'booking' AS kind, b.id,
             p.first_name || ' ' || p.last_name || ' → ' ||
             s.first_name || ' ' || s.last_name AS name,
             b.status, b.created_at AS at
      FROM bookings b
      JOIN users p ON p.id = b.parent_id
      JOIN users s ON s.id = b.babysitter_id
      WHERE b.created_at > NOW() - INTERVAL '${h} hours'
    `);

    const reports = await db.query(`
      SELECT 'report' AS kind, r.id,
             rep.first_name || ' ' || rep.last_name || ' → ' ||
             repu.first_name || ' ' || repu.last_name AS name,
             r.severity, r.created_at AS at
      FROM reports r
      JOIN users rep  ON rep.id  = r.reporter_id
      JOIN users repu ON repu.id = r.reported_user_id
      WHERE r.created_at > NOW() - INTERVAL '${h} hours'
    `);

    const all = [...users.rows, ...bookings.rows, ...reports.rows]
      .sort((a, b) => new Date(b.at) - new Date(a.at));

    return { period_hours: h, count: all.length, events: all.slice(0, 50) };
  },

  // ============================================
  // SEARCH HELPERS
  // ============================================
  async count_users_matching({ role, city, status }) {
    const params = [];
    let where = '1=1';
    if (role)   { params.push(role);   where += ` AND role = $${params.length}`; }
    if (city)   { params.push(`%${city}%`); where += ` AND LOWER(city) LIKE LOWER($${params.length})`; }
    if (status === 'inactive') where += ` AND is_active = false`;
    if (status === 'active')   where += ` AND is_active = true`;
    if (status === 'suspended') where += ` AND suspended_at IS NOT NULL`;
    const r = await db.query(`SELECT COUNT(*) AS count FROM users WHERE ${where}`, params);
    return { count: parseInt(r.rows[0].count) };
  },

};