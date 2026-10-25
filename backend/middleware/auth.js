const jwt = require('jsonwebtoken');
const mockStore = require('../services/mockStore');

/**
 * authenticate
 * Verifies the Bearer token in the Authorization header.
 * Attaches the verified user payload and backend-checked role to req.user.
 * Returns 401 if token is missing, invalid, or expired.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No token provided.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET || 'foodbridge_demo_jwt_secret_key_2026';
    const decoded = jwt.verify(token, secret);

    // Verify against trusted backend data store if user exists
    let resolvedRole = decoded.role ? String(decoded.role).trim().toLowerCase() : '';
    let dbUser = null;
    if (decoded.id) {
      const userById = mockStore.findUserById(decoded.id);
      if (userById && (!decoded.email || (userById.email && userById.email.toLowerCase() === decoded.email.toLowerCase()))) {
        dbUser = userById;
      } else if (decoded.email) {
        dbUser = mockStore.findUserByEmail(decoded.email);
      }
    } else if (decoded.email) {
      dbUser = mockStore.findUserByEmail(decoded.email);
    }

    if (dbUser && dbUser.role) {
      resolvedRole = String(dbUser.role).trim().toLowerCase();
    }

    req.user = {
      ...decoded,
      ...(dbUser ? { id: dbUser.id, email: dbUser.email, name: dbUser.name } : {}),
      role: resolvedRole,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, error: 'Invalid token.' });
  }
};

/**
 * authorize(...roles)
 * Factory that returns a middleware enforcing role-based access.
 * Must be used AFTER authenticate.
 *
 * Normalizes roles to lowercase before comparison.
 * Returns 401 if unauthenticated, 403 if authenticated but wrong role.
 */
const authorize = (...roles) => {
  const normalizedAllowedRoles = roles.map((r) => String(r).trim().toLowerCase());
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated.' });
    }

    const userRole = String(req.user.role || '').trim().toLowerCase();
    if (!normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. This route requires one of: [${normalizedAllowedRoles.join(', ')}].`,
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
