// server/src/ai/parent/tools/parentTools.js
// Parent-facing tools. Read-only access to the user's OWN data + public babysitter data.

const db = require('../../../config/database');

module.exports = {

  // ============================================
  // FIND & BROWSE BABYSITTERS (public data)
  // ============================================
  async find_babysitters({ query, city, min_rate, max_rate, min_rating, limit = 10 }) {
    const params = [];
    const conditions = [
      "u.role = 'babysitter'",
      "u.is_active = true",
      "u.suspended_at IS NULL",
      "bp.status = 'approved'",
    ];

    if (query) {
      params.push(`%${query}%`);
      conditions.push(`(
        LOWER(u.first_name) LIKE LOWER($${params.length})
        OR LOWER(u.last_name) LIKE LOWER($${params.length})
        OR CONCAT(u.first_name, ' ', u.last_name) ILIKE $${params.length}
      )`);
    }

    if (city) {
      params.push(`%${city}%`);
      conditions.push(`LOWER(u.city) LIKE LOWER($${params.length})`);
    }

    if (min_rate != null) {
      params.push(min_rate);
      conditions.push(`bp.hourly_rate >= $${params.length}`);
    }

    if (max_rate != null) {
      params.push(max_rate);
      conditions.push(`bp.hourly_rate <= $${params.length}`);
    }

    if (min_rating != null) {
      params.push(min_rating);
      conditions.push(`(
        SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE babysitter_id = u.id
      ) >= $${params.length}`);
    }

    const lim = Math.min(Math.max(parseInt(limit) || 10, 1), 30);
    params.push(lim);

    const r = await db.query(`
      SELECT u.id, u.first_name, u.last_name, u.city, u.language,
             bp.hourly_rate, bp.experience_years, bp.is_verified, bp.skills,
             (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE babysitter_id = u.id) AS avg_rating,
             (SELECT COUNT(*) FROM reviews WHERE babysitter_id = u.id) AS review_count
      FROM users u
      JOIN babysitter_profiles bp ON bp.user_id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY bp.is_verified DESC, avg_rating DESC
      LIMIT $${params.length}
    `, params);

    return {
      count: r.rows.length,
      babysitters: r.rows.map(b => ({
        id: b.id,
        name: `${b.first_name} ${b.last_name}`,
        city: b.city,
        hourly_rate: parseFloat(b.hourly_rate || 0),
        experience_years: b.experience_years,
        is_verified: b.is_verified,
        avg_rating: parseFloat(b.avg_rating || 0).toFixed(1),
        review_count: b.review_count,
        skills: b.skills || [],
      })),
      note: r.rows.length === 0
        ? 'No babysitters matched those filters.'
        : undefined,
    };
  },

  async get_babysitter_profile({ babysitter_id }) {
    const u = await db.query(`
      SELECT u.id, u.first_name, u.last_name, u.city, u.language,
             u.is_active, u.suspended_at,
             bp.bio, bp.hourly_rate, bp.experience_years, bp.is_verified,
             bp.skills, bp.status
      FROM users u
      JOIN babysitter_profiles bp ON bp.user_id = u.id
      WHERE u.id = $1 AND u.role = 'babysitter'
    `, [babysitter_id]);

    if (u.rows.length === 0) return { error: 'Babysitter not found.' };
    const b = u.rows[0];

    const reviews = await db.query(`
      SELECT r.rating, r.comment, r.created_at,
             p.first_name AS reviewer_first, p.last_name AS reviewer_last
      FROM reviews r
      JOIN users p ON p.id = r.parent_id
      WHERE r.babysitter_id = $1
      ORDER BY r.created_at DESC
      LIMIT 5
    `, [babysitter_id]);

    const availability = await db.query(`
      SELECT day_of_week, start_time, end_time
      FROM babysitter_availability
      WHERE babysitter_id = (SELECT id FROM babysitter_profiles WHERE user_id = $1)
        AND is_available = true
        AND is_published = true
      ORDER BY day_of_week
    `, [babysitter_id]);

    const avg = await db.query(`
      SELECT COALESCE(AVG(rating),0) AS avg, COUNT(*) AS count
      FROM reviews WHERE babysitter_id = $1
    `, [babysitter_id]);

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return {
      id: b.id,
      name: `${b.first_name} ${b.last_name}`,
      city: b.city,
      bio: b.bio,
      hourly_rate: parseFloat(b.hourly_rate || 0),
      experience_years: b.experience_years,
      is_verified: b.is_verified,
      skills: b.skills || [],
      avg_rating: parseFloat(avg.rows[0].avg).toFixed(1),
      review_count: parseInt(avg.rows[0].count),
      availability: availability.rows.map(a => ({
        day: days[a.day_of_week],
        time: `${a.start_time?.slice(0,5)} - ${a.end_time?.slice(0,5)}`,
      })),
      recent_reviews: reviews.rows.map(r => ({
        from: `${r.reviewer_first} ${r.reviewer_last}`,
        rating: r.rating,
        comment: r.comment,
      })),
    };
  },

  // ============================================
  // MY BOOKINGS (own data only)
  // ============================================
  async get_my_bookings({ status, limit = 10 }, user) {
    const params = [user.id];
    let where = 'b.parent_id = $1';
    if (status) {
      params.push(status);
      where += ` AND b.status = $${params.length}`;
    }
    const lim = Math.min(Math.max(parseInt(limit) || 10, 1), 30);
    params.push(lim);

    const r = await db.query(`
      SELECT b.id, b.status, b.total_amount, b.start_date, b.end_date,
             b.start_time, b.end_time, b.created_at,
             s.first_name || ' ' || s.last_name AS babysitter_name,
             s.id AS babysitter_id
      FROM bookings b
      JOIN users s ON s.id = b.babysitter_id
      WHERE ${where}
      ORDER BY b.created_at DESC
      LIMIT $${params.length}
    `, params);

    return {
      count: r.rows.length,
      bookings: r.rows.map(b => ({
        id: b.id,
        babysitter: b.babysitter_name,
        babysitter_id: b.babysitter_id,
        status: b.status,
        date: b.start_date,
        time: `${b.start_time?.slice(0,5)} - ${b.end_time?.slice(0,5)}`,
        amount: parseFloat(b.total_amount || 0).toFixed(2),
      })),
    };
  },

  // ============================================
  // MY CHILDREN
  // ============================================
  async get_my_children(args, user) {
    const r = await db.query(`
      SELECT id, name, age, notes
      FROM children
      WHERE parent_id = $1
      ORDER BY created_at DESC
    `, [user.id]);

    return {
      count: r.rows.length,
      children: r.rows,
    };
  },

  // ============================================
  // MY FAVORITES
  // ============================================
  async get_my_favorites(args, user) {
    const r = await db.query(`
      SELECT u.id, u.first_name, u.last_name, u.city,
             bp.hourly_rate, bp.is_verified,
             (SELECT COALESCE(AVG(rating),0) FROM reviews WHERE babysitter_id = u.id) AS avg_rating
      FROM favorites f
      JOIN users u ON u.id = f.babysitter_id
      LEFT JOIN babysitter_profiles bp ON bp.user_id = u.id
      WHERE f.parent_id = $1
      ORDER BY f.created_at DESC
    `, [user.id]);

    return {
      count: r.rows.length,
      favorites: r.rows.map(f => ({
        id: f.id,
        name: `${f.first_name} ${f.last_name}`,
        city: f.city,
        hourly_rate: parseFloat(f.hourly_rate || 0),
        is_verified: f.is_verified,
        avg_rating: parseFloat(f.avg_rating || 0).toFixed(1),
      })),
    };
  },
};