const jwt = require('jsonwebtoken');

const MOCK_USERS = {
  admin: {
    id: 1,
    name: 'Platform Admin',
    email: 'admin@foodbridge.org',
    role: 'admin',
  },
  donor: {
    id: 2,
    name: 'Grand Plaza Hotel',
    email: 'donor@foodbridge.org',
    role: 'donor',
  },
  ngo: {
    id: 4,
    name: 'Feeding Hope Foundation',
    email: 'ngo@hope.org',
    role: 'ngo',
  },
  volunteer: {
    id: 7,
    name: 'Alex Courier',
    email: 'volunteer@foodbridge.org',
    role: 'volunteer',
  },
};

/**
 * determineMockUser
 * Infers mock user from header, URL path, or defaults to donor.
 */
const determineMockUser = (req) => {
  const headerRole = (req.headers['x-user-role'] || '').toLowerCase();
  if (MOCK_USERS[headerRole]) {
    return MOCK_USERS[headerRole];
  }

  const url = (req.originalUrl || req.url || '').toLowerCase();
  if (url.includes('/admin')) return MOCK_USERS.admin;
  if (url.includes('/volunteer')) return MOCK_USERS.volunteer;
  if (url.includes('/ngo')) return MOCK_USERS.ngo;
  if (url.includes('/donor')) return MOCK_USERS.donor;

  return MOCK_USERS.donor;
};

/**
 * authenticate
 * Authentication is disabled.
 * Automatically attaches an active mock user to req.user so all routes are open.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const secret = process.env.JWT_SECRET || 'foodbridge_demo_jwt_secret_key_2026';
      req.user = jwt.verify(token, secret);
      return next();
    } catch {
      // Token invalid/expired - continue to mock user
    }
  }

  req.user = determineMockUser(req);
  next();
};

/**
 * authorize(...roles)
 * Enforces or switches to required role context so requests succeed without blocking.
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      req.user = determineMockUser(req);
    }

    if (!roles.includes(req.user.role)) {
      // Seamlessly switch to the first allowed role mock user
      const targetRole = roles[0];
      req.user = MOCK_USERS[targetRole] || req.user;
    }

    next();
  };
};

module.exports = { authenticate, authorize, MOCK_USERS };

