'use strict';

const jwt = require('jsonwebtoken');
const mockStore = require('../services/mockStore');

const DEFAULT_USERS = {
  donor: { id: 2, name: 'Grand Plaza Hotel', email: 'donor@foodbridge.org', role: 'donor' },
  ngo: { id: 4, name: 'Feeding Hope Foundation', email: 'ngo@hope.org', role: 'ngo' },
  volunteer: { id: 7, name: 'Alex Courier', email: 'volunteer@foodbridge.org', role: 'volunteer' },
  admin: { id: 1, name: 'Platform Admin', email: 'admin@foodbridge.org', role: 'admin' },
};

const signToken = (user) => {
  const secret = process.env.JWT_SECRET || 'foodbridge_demo_jwt_secret_key_2026';
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * POST /api/auth/register
 * Authentication is disabled. Returns direct access success.
 */
const register = async (req, res) => {
  const role = req.body?.role || 'donor';
  const user = DEFAULT_USERS[role] || DEFAULT_USERS.donor;
  const token = signToken(user);
  return res.status(200).json({
    success: true,
    message: 'Direct access enabled without registration.',
    token,
    user,
  });
};

/**
 * POST /api/auth/login
 * Authentication is disabled. Logs in directly with requested role or default user.
 */
const login = async (req, res) => {
  const email = (req.body?.email || '').toLowerCase();
  let user = mockStore.findUserByEmail(email);
  if (!user) {
    user = DEFAULT_USERS.donor;
  }
  const token = signToken(user);
  const { password, ...safeUser } = user;
  return res.status(200).json({
    success: true,
    message: 'Direct access enabled without credentials.',
    token,
    user: safeUser,
  });
};

/**
 * POST /api/auth/logout
 */
const logout = async (_req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
};

/**
 * GET /api/auth/verify-email
 */
const verifyEmail = async (_req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Email verification is no longer required. Direct access is active.',
  });
};

/**
 * POST /api/auth/resend-verification
 */
const resendVerification = async (_req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Email verification is disabled.',
  });
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const userId = req.user?.id || 2;
    const user = mockStore.findUserById(userId) || DEFAULT_USERS.donor;
    const { password, ...safeUser } = user;
    return res.status(200).json({
      success: true,
      user: safeUser,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/smtp-status
 */
const getSmtpStatus = async (_req, res) => {
  return res.status(200).json({
    success: true,
    configured: false,
    message: 'Authentication and email verification are disabled.',
  });
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  verifyEmail,
  resendVerification,
  getSmtpStatus,
};
