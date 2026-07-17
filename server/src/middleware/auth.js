// ==========================================================================
// Authentication & Authorization Middleware
// ==========================================================================
// - authenticate: verifies the JWT from the Authorization header, loads the
//   user from the DB, and attaches req.user (id, email, role, etc.).
// - authorize(...roles): restricts a route to specific user roles.
// ==========================================================================

const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Verifies Bearer token, fetches user, sets req.user
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await db.query('SELECT id, email, role, first_name, last_name, is_active FROM users WHERE id = $1', [decoded.id]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found.' });
    }

    if (!result.rows[0].is_active) {
      return res.status(403).json({ error: 'Account deactivated.' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    res.status(500).json({ error: 'Authentication error.' });
  }
};

// Restricts access to specified roles (e.g. authorize('admin'), authorize('parent', 'babysitter'))
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized access.' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
