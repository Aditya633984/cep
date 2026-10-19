'use strict';

const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const mockStore = require('../services/mockStore');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const signToken = (user) => {
  const secret = process.env.JWT_SECRET || 'foodbridge_demo_jwt_secret_key_2026';
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ─── Register ─────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Body: { name, email, phone, password, role,
 *         ngo_name?, founder?, address?, food_types? }
 */
const register = async (req, res, next) => {
  try {
    const {
      name, email, phone, password, role,
      ngo_name, founder, address, food_types,
      vehicle_type, service_area, availability,
    } = req.body;

    // ── Basic validation ──────────────────────────────────────────────────────
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, password and role are required.',
      });
    }

    if (role === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin registration is not permitted via public API.',
      });
    }

    const allowed = ['donor', 'ngo', 'volunteer'];
    if (!allowed.includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address format.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters.',
      });
    }

    if (role === 'ngo' && !ngo_name) {
      return res.status(400).json({
        success: false,
        error: 'NGO Name is required for NGO registration.',
      });
    }

    // ── Check duplicate email ─────────────────────────────────────────────────
    const existing = mockStore.findUserByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists.',
      });
    }

    // ── Hash password ─────────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 10);

    // ── Create user in mock store ─────────────────────────────────────────────
    const newUser = mockStore.createUser({
      name: name.trim(),
      email: cleanEmail,
      phone: phone || null,
      password: hashedPassword,
      role,
    });

    // ── Create profile ────────────────────────────────────────────────────────
    if (role === 'ngo') {
      mockStore.upsertNgoProfile(newUser.id, {
        ngo_name: (ngo_name || name).trim(),
        founder: founder || null,
        address: address || null,
        food_types: food_types || null,
        city: 'Bangalore',
      });
    }

    if (role === 'volunteer') {
      mockStore.upsertVolunteerProfile(newUser.id, {
        phone: phone || null,
        vehicle_type: vehicle_type || 'motorcycle',
        service_area: service_area || null,
        availability: availability || null,
      });
    }

    // ── Return token ──────────────────────────────────────────────────────────
    const userObj = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role };
    const token   = signToken(userObj);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully (Demonstration Mode).',
      token,
      user: userObj,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required.',
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = mockStore.findUserByEmail(cleanEmail);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    // ── Compare password ──────────────────────────────────────────────────────
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.password);
    } catch {
      isMatch = false;
    }

    // Also support direct match for default demo passwords
    if (!isMatch) {
      if (
        (user.role === 'admin' && password === 'Admin@12345') ||
        (user.role !== 'admin' && (password === 'Password@123' || password === user.password))
      ) {
        isMatch = true;
      }
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    // ── Sign token ────────────────────────────────────────────────────────────
    const token = signToken(user);
    const userObj = { id: user.id, name: user.name, email: user.email, role: user.role };

    return res.status(200).json({
      success: true,
      message: 'Login successful (Demonstration Mode).',
      token,
      user: userObj,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 */
const logout = (_req, res) => {
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

// ─── Get Current User ─────────────────────────────────────────────────────────

/**
 * GET /api/auth/me   (protected)
 */
const getMe = async (req, res, next) => {
  try {
    const user = mockStore.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const { password, ...safeUser } = user;
    return res.status(200).json({ success: true, user: safeUser });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, logout, getMe };
