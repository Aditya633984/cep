const jwt = require('jsonwebtoken');

/**
 * authenticate
 * Verifies the Bearer token in the Authorization header.
 * Attaches the decoded payload to req.user on success.
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role, iat, exp }
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
 * Usage:  router.get('/donor/dashboard', authenticate, authorize('donor'), handler)
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. This route requires one of: [${roles.join(', ')}].`,
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
