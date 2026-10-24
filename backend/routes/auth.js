const express    = require('express');
const router     = express.Router();
const {
  register,
  login,
  logout,
  getMe,
  verifyEmail,
  resendVerification,
  getSmtpStatus,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const {
  registerLimiter,
  loginLimiter,
  verifyEmailLimiter,
  resendVerificationLimiter,
} = require('../middleware/rateLimiter');

// GET /api/auth/smtp-status (controlled SMTP diagnostic status)
router.get('/smtp-status', getSmtpStatus);

// POST /api/auth/register
router.post('/register', registerLimiter, register);

// GET /api/auth/verify-email?token=...
router.get('/verify-email', verifyEmailLimiter, verifyEmail);

// POST /api/auth/resend-verification
router.post('/resend-verification', resendVerificationLimiter, resendVerification);

// POST /api/auth/login
router.post('/login', loginLimiter, login);

// POST /api/auth/logout
router.post('/logout', logout);

// GET  /api/auth/me  (protected)
router.get('/me', authenticate, getMe);

module.exports = router;
