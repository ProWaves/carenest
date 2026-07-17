// ==========================================================================
// Database Initialization Script
// ==========================================================================
// Creates all tables (if they don't already exist) and seeds the default
// admin user. Run via: npm run db:init
// ==========================================================================

const db = require('../config/database');
require('dotenv').config();

const initDB = async () => {
  try {
    console.log('Initializing database...');

    // Users — shared by parents, babysitters, and admins
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('parent', 'babysitter', 'admin')),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        city VARCHAR(100),
        language VARCHAR(10) DEFAULT 'en',
        gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Users table ready');

    // Babysitter profiles — extends users with bio, rate, verification status
    await db.query(`
      CREATE TABLE IF NOT EXISTS babysitter_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        bio TEXT,
        experience_years INTEGER DEFAULT 0,
        hourly_rate DECIMAL(10,2),
        is_verified BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        skills TEXT[] DEFAULT '{}',
        emergency_contact_name VARCHAR(100),
        emergency_contact_phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Babysitter profiles table ready');

    // Documents uploaded by babysitters (ID card, CV, certificates)
    await db.query(`
      CREATE TABLE IF NOT EXISTS babysitter_documents (
        id SERIAL PRIMARY KEY,
        babysitter_id INTEGER REFERENCES babysitter_profiles(id) ON DELETE CASCADE,
        document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('id_card', 'cv', 'certificate')),
        document_url TEXT NOT NULL,
        is_verified BOOLEAN DEFAULT false,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Babysitter documents table ready');

    // Weekly availability slots for each babysitter
    await db.query(`
      CREATE TABLE IF NOT EXISTS babysitter_availability (
        id SERIAL PRIMARY KEY,
        babysitter_id INTEGER REFERENCES babysitter_profiles(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_available BOOLEAN DEFAULT true
      );
    `);
    console.log('Babysitter availability table ready');

    // Gallery images uploaded by babysitters
    await db.query(`
      CREATE TABLE IF NOT EXISTS babysitter_images (
        id SERIAL PRIMARY KEY,
        babysitter_id INTEGER REFERENCES babysitter_profiles(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        caption VARCHAR(255),
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Babysitter images table ready');

    // Children — linked to parent accounts
    await db.query(`
      CREATE TABLE IF NOT EXISTS children (
        id SERIAL PRIMARY KEY,
        parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        age INTEGER NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Children table ready');

    // Bookings — link a parent, babysitter, child, date range, and status
    await db.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        babysitter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        child_id INTEGER REFERENCES children(id) ON DELETE SET NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
        total_hours DECIMAL(10,2),
        total_amount DECIMAL(10,2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Bookings table ready');

    // Reviews — ratings (1-5) and comments left by parents after completed bookings
    await db.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        babysitter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Reviews table ready');

    // Favorites — parents can bookmark babysitters
    await db.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        babysitter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(parent_id, babysitter_id)
      );
    `);
    console.log('Favorites table ready');

    // Messages — chat between parents and babysitters
    await db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Messages table ready');

    // Reports — users can report others for policy violations
    await db.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        reporter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        reported_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        reason VARCHAR(100) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Reports table ready');

    // Notifications — in-app alerts for users
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        is_read BOOLEAN DEFAULT false,
        link TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Notifications table ready');

    // Create default admin account if it doesn't exist yet
    const adminCheck = await db.query('SELECT id FROM users WHERE email = $1', ['admin@carenest.com']);
    if (adminCheck.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('Admin123!', 10);
      await db.query(
        'INSERT INTO users (email, password, role, first_name, last_name, city) VALUES ($1, $2, $3, $4, $5, $6)',
        ['admin@carenest.com', hashedPassword, 'admin', 'Admin', 'CareNest', 'Tunis']
      );
      console.log('Admin user created: admin@carenest.com / Admin123!');
    }

    console.log('Database initialization complete.');
    process.exit(0);
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
};

initDB();
