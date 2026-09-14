// server/src/ai/parent/tools/sharedTools.js
// Tools both parents and babysitters use.
// For babysitters: their own jobs, earnings, profile status.

const db = require('../../../config/database');

module.exports = {

  // ============================================
  // BABYSITTER — MY ASSIGNED BOOKINGS
  // ============================================
  async get_my_sitter_bookings({ status, limit = 10 }, user) {
    if (user.role !== 'babysitter') {
      return { error: 'Only babysitters can use this tool.' };
    }

    const params = [user.id];
    let where = 'b.babysitter_id = $1';
    if (status) {
      params.push(status);
      where += ` AND b.status = $${params.length}`;
    }
    const lim = Math.min(Math.max(parseInt(limit) || 10, 1), 30);
    params.push(lim);

    const r = await db.query(`
      SELECT b.id, b.status, b.total_amount, b.start_date, b.end_date,
             b.start_time, b.end_time,
             p.first_name || ' ' || p.last_name AS parent_name,
             p.id AS parent_id
      FROM bookings b
      JOIN users p ON p.id = b.parent_id
      WHERE ${where}
      ORDER BY b.created_at DESC
      LIMIT $${params.length}
    `, params);

    return {
      count: r.rows.length,
      bookings: r.rows.map(b => ({
        id: b.id,
        parent: b.parent_name,
        parent_id: b.parent_id,
        status: b.status,
        date: b.start_date,
        time: `${b.start_time?.slice(0,5)} - ${b.end_time?.slice(0,5)}`,
        amount: parseFloat(b.total_amount || 0).toFixed(2),
      })),
    };
  },

  // ============================================
  // BABYSITTER — MY EARNINGS
  // ============================================
  async get_my_earnings(args, user) {
    if (user.role !== 'babysitter') {
      return { error: 'Only babysitters can use this tool.' };
    }

    const summary = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='completed') AS completed,
        COUNT(*) FILTER (WHERE status='pending')   AS pending,
        COALESCE(SUM(total_amount) FILTER (WHERE status='completed'),0) AS total_earned,
        COALESCE(AVG(total_amount) FILTER (WHERE status='completed'),0) AS avg_per_booking
      FROM bookings WHERE babysitter_id = $1
    `, [user.id]);

    const monthly = await db.query(`
      SELECT TO_CHAR(start_date, 'YYYY-MM') AS month,
             COUNT(*) AS bookings,
             COALESCE(SUM(total_amount),0) AS earned
      FROM bookings
      WHERE babysitter_id = $1 AND status='completed'
      GROUP BY month
      ORDER BY month DESC
      LIMIT 6
    `, [user.id]);

    const s = summary.rows[0];
    return {
      completed_bookings: parseInt(s.completed || 0),
      pending_bookings: parseInt(s.pending || 0),
      total_earned: parseFloat(s.total_earned || 0).toFixed(2),
      avg_per_booking: parseFloat(s.avg_per_booking || 0).toFixed(2),
      monthly: monthly.rows.map(m => ({
        month: m.month,
        bookings: parseInt(m.bookings),
        earned: parseFloat(m.earned).toFixed(2),
      })),
    };
  },

  // ============================================
  // BABYSITTER — MY PROFILE STATUS
  // ============================================
  async get_my_profile_status(args, user) {
    if (user.role !== 'babysitter') {
      return { error: 'Only babysitters can use this tool.' };
    }

    const r = await db.query(`
      SELECT status, is_verified, hourly_rate, experience_years, bio,
             skills,
             (SELECT COUNT(*) FROM babysitter_documents WHERE babysitter_id = bp.id) AS document_count,
             (SELECT COUNT(*) FROM babysitter_availability WHERE babysitter_id = bp.id AND is_published = true) AS published_slots
      FROM babysitter_profiles bp
      WHERE user_id = $1
    `, [user.id]);

    if (r.rows.length === 0) return { error: 'No profile found.' };
    const p = r.rows[0];

    return {
      status: p.status,
      is_verified: p.is_verified,
      hourly_rate: parseFloat(p.hourly_rate || 0),
      experience_years: p.experience_years,
      has_bio: !!(p.bio && p.bio.length > 20),
      skills: p.skills || [],
      document_count: parseInt(p.document_count || 0),
      published_slots: parseInt(p.published_slots || 0),
    };
  },

  // ============================================
  // SHARED — GET MY USER PROFILE
  // ============================================
  async get_my_profile(args, user) {
    const r = await db.query(`
      SELECT id, first_name, last_name, email, role, phone, city, language,
             is_active, created_at
      FROM users WHERE id = $1
    `, [user.id]);

    if (r.rows.length === 0) return { error: 'User not found.' };
    return r.rows[0];
  },
};