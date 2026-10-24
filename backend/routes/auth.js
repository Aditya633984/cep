'use strict';

const express    = require('express');
const router     = express.Router();
const {
  register,
  login,
  logout,
  getMe,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const {
  registerLimiter,
  loginLimiter,
} = require('../middleware/rateLimiter');

// POST /api/auth/register
router.post('/register', registerLimiter, register);

// POST /api/auth/login
router.post('/login', loginLimiter, login);

// POST /api/auth/logout
router.post('/logout', logout);

// GET  /api/auth/me  (protected)
router.get('/me', authenticate, getMe);

module.exports = router;
