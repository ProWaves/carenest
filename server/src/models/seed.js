// ==========================================================================
// Database Seed Script
// ==========================================================================
// Populates the database with sample data for development and testing:
//   5 parents, 9 children, 8 babysitters with profiles/availability/docs,
//   8 bookings across all statuses, reviews, favorites, messages, and
//   notifications. Run via: npm run db:seed
//
// All seed users share the password: Password123!
// The admin user (admin@carenest.com / Admin123!) is NOT recreated by seed.
// ==========================================================================

const db = require('../config/database');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const seed = async () => {
  try {
    console.log('🌱 Seeding database...');
    const hash = (pw) => bcrypt.hashSync(pw, 10);

    // Clear all existing non-admin data (order respects foreign key constraints)
    await db.query('DELETE FROM notifications');
    await db.query('DELETE FROM messages');
    await db.query('DELETE FROM reviews');
    await db.query('DELETE FROM favorites');
    await db.query('DELETE FROM babysitter_images');
    await db.query('DELETE FROM babysitter_documents');
    await db.query('DELETE FROM babysitter_availability');
    await db.query('DELETE FROM bookings');
    await db.query('DELETE FROM children');
    await db.query('DELETE FROM babysitter_profiles');
    await db.query("DELETE FROM users WHERE role != 'admin'");
    console.log('✅ Cleared existing data');

    // ─── PARENTS ──────────────────────────────────────────────────────────────
    const parentsData = [
      { first_name: 'Maria', last_name: 'Lopez', email: 'maria@test.com', city: 'Tunis', language: 'en' },
      { first_name: 'Ahmed', last_name: 'Khalil', email: 'ahmed@test.com', city: 'Sfax', language: 'fr' },
      { first_name: 'Sophie', last_name: 'Brown', email: 'sophie@test.com', city: 'Sousse', language: 'en' },
      { first_name: 'Karim', last_name: 'Ben Ali', email: 'karim@test.com', city: 'Tunis', language: 'fr' },
      { first_name: 'Emma', last_name: 'Wilson', email: 'emma@test.com', city: 'Nabeul', language: 'en' },
    ];
    const parentIds = [];
    for (const p of parentsData) {
      const r = await db.query(
        `INSERT INTO users (email, password, role, first_name, last_name, city, language) VALUES ($1, $2, 'parent', $3, $4, $5, $6) RETURNING id`,
        [p.email, hash('Password123!'), p.first_name, p.last_name, p.city, p.language]
      );
      parentIds.push(r.rows[0].id);
    }
    console.log(`✅ Created ${parentIds.length} parents`);

    // ─── CHILDREN ─────────────────────────────────────────────────────────────
    const childrenData = [
      { parent_id: parentIds[0], name: 'Luna', age: 4, notes: 'Allergic to peanuts' },
      { parent_id: parentIds[0], name: 'Leo', age: 7, notes: 'Loves reading' },
      { parent_id: parentIds[1], name: 'Yasmine', age: 2, notes: 'Naptime at 1pm' },
      { parent_id: parentIds[1], name: 'Adam', age: 5, notes: 'In preschool' },
      { parent_id: parentIds[2], name: 'Oliver', age: 3, notes: null },
      { parent_id: parentIds[3], name: 'Nour', age: 6, notes: 'Plays piano' },
      { parent_id: parentIds[3], name: 'Sami', age: 1, notes: 'Diaper changes needed' },
      { parent_id: parentIds[4], name: 'Ella', age: 8, notes: 'Soccer on Saturdays' },
      { parent_id: parentIds[4], name: 'Mia', age: 4, notes: null },
    ];
    const childIds = [];
    for (const c of childrenData) {
      const r = await db.query(
        `INSERT INTO children (parent_id, name, age, notes) VALUES ($1, $2, $3, $4) RETURNING id`,
        [c.parent_id, c.name, c.age, c.notes]
      );
      childIds.push(r.rows[0].id);
    }
    console.log(`✅ Created ${childrenData.length} children`);

    // ─── BABYSITTERS ──────────────────────────────────────────────────────────
    const babysittersData = [
      { first_name: 'Sarah', last_name: 'Miller', email: 'sarah@test.com', city: 'Tunis', language: 'en', bio: 'Loving and experienced babysitter with 5 years of childcare experience. CPR certified and fluent in English and French.', hourly_rate: 15, experience_years: 5, skills: ['First Aid', 'Infant Care', 'CPR Certified', 'Toddler Experience'], status: 'approved' },
      { first_name: 'Leila', last_name: 'Mansour', email: 'leila@test.com', city: 'Sfax', language: 'fr', bio: 'Babysitter passionnée avec 3 ans d\'expérience. Je parle français et anglais. Activités éducatives pour enfants.', hourly_rate: 12, experience_years: 3, skills: ['Infant Care', 'Cooking', 'Arts & Crafts', 'Homework Help'], status: 'approved' },
      { first_name: 'John', last_name: 'Davis', email: 'john@test.com', city: 'Sousse', language: 'en', bio: 'Fun and energetic babysitter! I love outdoor activities and creative play. 4 years of experience with kids of all ages.', hourly_rate: 18, experience_years: 4, skills: ['First Aid', 'CPR Certified', 'Outdoor Activities', 'Sports Coaching'], status: 'approved' },
      { first_name: 'Amina', last_name: 'Trabelsi', email: 'amina@test.com', city: 'Tunis', language: 'fr', bio: 'Éducatrice de jeunes enfants avec 7 ans d\'expérience. Spécialisée dans la garde de nourrissons et tout-petits.', hourly_rate: 20, experience_years: 7, skills: ['Infant Care', 'First Aid', 'Special Needs', 'Early Childhood Education'], status: 'approved' },
      { first_name: 'David', last_name: 'Chen', email: 'david@test.com', city: 'Nabeul', language: 'en', bio: 'Patient and responsible babysitter. I help with homework and enjoy cooking healthy meals for kids.', hourly_rate: 14, experience_years: 2, skills: ['Cooking', 'Homework Help', 'First Aid', 'Music'], status: 'pending' },
      { first_name: 'Fatma', last_name: 'Jemli', email: 'fatma@test.com', city: 'Sousse', language: 'fr', bio: 'Babysitter disponible et souriante. Activités manuelles et sorties au parc. 6 ans d\'expérience.', hourly_rate: 16, experience_years: 6, skills: ['Arts & Crafts', 'Outdoor Activities', 'Toddler Experience', 'First Aid'], status: 'approved' },
      { first_name: 'Michael', last_name: 'Taylor', email: 'michael@test.com', city: 'Tunis', language: 'en', bio: 'Former elementary school teacher turned babysitter. I make learning fun! Bilingual English/Arabic.', hourly_rate: 22, experience_years: 8, skills: ['Homework Help', 'CPR Certified', 'Special Needs', 'Music', 'Early Childhood Education'], status: 'approved' },
      { first_name: 'Nadia', last_name: 'Ben Salah', email: 'nadia@test.com', city: 'Sfax', language: 'fr', bio: 'Jeune babysitter dynamique et créative. Je propose des activités éducatives et des jeux en plein air.', hourly_rate: 10, experience_years: 1, skills: ['Arts & Crafts', 'Cooking', 'Outdoor Activities'], status: 'pending' },
    ];
    const babysitterIds = [];
    for (const b of babysittersData) {
      const r = await db.query(
        `INSERT INTO users (email, password, role, first_name, last_name, city, language) VALUES ($1, $2, 'babysitter', $3, $4, $5, $6) RETURNING id`,
        [b.email, hash('Password123!'), b.first_name, b.last_name, b.city, b.language]
      );
      const uid = r.rows[0].id;
      babysitterIds.push(uid);
      await db.query(
        `INSERT INTO babysitter_profiles (user_id, bio, hourly_rate, experience_years, skills, status, is_verified) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uid, b.bio, b.hourly_rate, b.experience_years, b.skills, b.status, b.status === 'approved']
      );
    }
    console.log(`✅ Created ${babysittersData.length} babysitters`);

    // ─── AVAILABILITY ─────────────────────────────────────────────────────────
    for (let i = 0; i < babysitterIds.length; i++) {
      const pid = await db.query('SELECT id FROM babysitter_profiles WHERE user_id = $1', [babysitterIds[i]]);
      const pidVal = pid.rows[0].id;
      const days = i % 2 === 0 ? [1, 2, 3, 4, 5] : [1, 3, 5, 6];
      for (const d of days) {
        await db.query(
          `INSERT INTO babysitter_availability (babysitter_id, day_of_week, start_time, end_time, is_available) 
           VALUES ($1, $2, $3, $4, true)`,
          [pidVal, d, '09:00', d === 6 ? '16:00' : '18:00']
        );
      }
    }
    console.log('✅ Created availability');

    // ─── DOCUMENTS ────────────────────────────────────────────────────────────
    for (let i = 0; i < Math.min(5, babysitterIds.length); i++) {
      const pid = await db.query('SELECT id FROM babysitter_profiles WHERE user_id = $1', [babysitterIds[i]]);
      await db.query(
        `INSERT INTO babysitter_documents (babysitter_id, document_type, document_url, is_verified) 
         VALUES ($1, 'id_card', '/uploads/seed/sample_id.pdf', $2)`,
        [pid.rows[0].id, i < 4]
      );
      if (i < 4) {
        await db.query(
          `INSERT INTO babysitter_documents (babysitter_id, document_type, document_url, is_verified) 
           VALUES ($1, 'cv', '/uploads/seed/sample_cv.pdf', $2)`,
          [pid.rows[0].id, i < 3]
        );
      }
    }
    console.log('✅ Created documents');

    // ─── BOOKINGS ─────────────────────────────────────────────────────────────
    const statuses = ['completed', 'completed', 'completed', 'confirmed', 'in_progress', 'pending', 'completed', 'cancelled'];
    const bookingIds = [];
    const now = new Date();
    for (let i = 0; i < statuses.length; i++) {
      const s = statuses[i];
      const parentIdx = i % parentIds.length;
      const bsIdx = i % babysitterIds.length;
      const childIdx = i % childIds.length;
      const pastDays = s === 'cancelled' ? 5 : s === 'pending' ? -3 : s === 'in_progress' ? -1 : s === 'confirmed' ? -7 : 15 + i;
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - pastDays);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (i % 2 === 0 ? 0 : 1));
      const startTime = '09:00';
      const endTime = '17:00';
      const totalHours = 8;
      const rate = babysittersData[bsIdx].hourly_rate;
      const totalAmount = totalHours * rate;

      const r = await db.query(
        `INSERT INTO bookings (parent_id, babysitter_id, child_id, start_date, end_date, start_time, end_time, status, total_hours, total_amount, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [parentIds[parentIdx], babysitterIds[bsIdx], childIds[childIdx],
         startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0], 
         startTime, endTime, s, totalHours, totalAmount, 'Great babysitter!']
      );
      bookingIds.push(r.rows[0].id);
    }
    console.log(`✅ Created ${bookingIds.length} bookings`);

    // ─── REVIEWS ──────────────────────────────────────────────────────────────
    const reviewTexts = [
      'Amazing babysitter! My kids absolutely love her. Very professional and caring.',
      'Great experience. Punctual, friendly, and very good with children.',
      'Highly recommend! Very trustworthy and our daughter had a wonderful time.',
      'Excellent babysitter. Very patient and attentive to our child\'s needs.',
      'Super expérience! Les enfants l\'adorent et elle est très professionnelle.',
      'Très bonne babysitter, ponctuelle et douce avec les enfants.',
      'Wonderful caregiver. Kept us updated throughout the day.',
    ];
    for (let i = 0; i < Math.min(5, bookingIds.length); i++) {
      const b = await db.query('SELECT * FROM bookings WHERE id = $1', [bookingIds[i]]);
      if (b.rows.length > 0) {
        await db.query(
          `INSERT INTO reviews (booking_id, parent_id, babysitter_id, rating, comment) 
           VALUES ($1, $2, $3, $4, $5)`,
          [bookingIds[i], b.rows[0].parent_id, b.rows[0].babysitter_id, 4 + (i % 2), reviewTexts[i]]
        );
      }
    }
    console.log('✅ Created reviews');

    // ─── FAVORITES ────────────────────────────────────────────────────────────
    for (let i = 0; i < parentIds.length; i++) {
      for (let j = 0; j < 2; j++) {
        const bsIdx = (i + j) % babysitterIds.length;
        await db.query(
          `INSERT INTO favorites (parent_id, babysitter_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [parentIds[i], babysitterIds[bsIdx]]
        );
      }
    }
    console.log('✅ Created favorites');

    // ─── MESSAGES ─────────────────────────────────────────────────────────────
    const convoMessages = [
      { sender: 0, receiver: 0, text: 'Hello! Are you available this weekend?' },
      { sender: 0, receiver: 0, text: 'Hi! Yes, I am available on Saturday. What time?' },
      { sender: 0, receiver: 0, text: 'Great! Would 10am work?' },
      { sender: 0, receiver: 0, text: 'Perfect, see you Saturday!' },
      { sender: 1, receiver: 1, text: 'Bonjour, êtes-vous disponible lundi?' },
      { sender: 1, receiver: 1, text: 'Oui, je suis disponible à partir de 14h.' },
      { sender: 1, receiver: 1, text: 'Parfait, je vous réserve!' },
    ];
    for (const m of convoMessages) {
      await db.query(
        `INSERT INTO messages (sender_id, receiver_id, content, is_read) VALUES ($1, $2, $3, true)`,
        [parentIds[m.sender], babysitterIds[m.receiver], m.text]
      );
    }
    await db.query(
      `INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3)`,
      [parentIds[0], babysitterIds[0], 'Hi, just confirming our booking for tomorrow!']
    );
    console.log('✅ Created messages');

    // ─── NOTIFICATIONS ────────────────────────────────────────────────────────
    for (let i = 0; i < parentIds.length; i++) {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read) 
         VALUES ($1, 'booking_confirmed', 'Booking Confirmed', 'Your booking has been confirmed by the babysitter.', $2)`,
        [parentIds[i], i < 3]
      );
    }
    for (let i = 0; i < Math.min(3, babysitterIds.length); i++) {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, is_read) 
         VALUES ($1, 'new_booking', 'New Booking Request', 'You have received a new booking request from a parent.', $2)`,
        [babysitterIds[i], i < 2]
      );
    }
    console.log('✅ Created notifications');

    console.log('\n=== ✅ Seed Complete ===');
    console.log('Login credentials (password: Password123!):');
    for (const p of parentsData) console.log(`  Parent: ${p.email}`);
    for (const b of babysittersData) console.log(`  Babysitter: ${b.email}`);
    console.log('  Admin: admin@carenest.com / Admin123!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seed();