const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { pool } = require('../config/db');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const signToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured in environment variables.');
  }
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
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
    const { name, email, phone, password, role,
            ngo_name, founder, address, food_types,
            vehicle_type, service_area, availability } = req.body;

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
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?', [cleanEmail]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists.',
      });
    }

    // ── Hash password ─────────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 12);

    // ── Insert user ───────────────────────────────────────────────────────────
    const [result] = await pool.query(
      `INSERT INTO users (name, email, phone, password, role)
       VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), email.toLowerCase().trim(), phone || null, hashedPassword, role]
    );

    const userId = result.insertId;

    // ── Insert NGO profile ────────────────────────────────────────────────────
    if (role === 'ngo') {
      await pool.query(
        `INSERT INTO ngo_profiles (user_id, ngo_name, founder, address, food_types)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, ngo_name.trim(), founder || null, address || null, food_types || null]
      );
    }

    // ── Insert Volunteer profile ──────────────────────────────────────────────
    if (role === 'volunteer') {
      await pool.query(
        `INSERT INTO volunteer_profiles (user_id, phone, vehicle_type, service_area, availability)
         VALUES (?, ?, ?, ?, ?)`,
        [
          userId,
          phone || null,
          vehicle_type || 'motorcycle',
          service_area || null,
          availability || null,
        ]
      );
    }

    // ── Return token ──────────────────────────────────────────────────────────
    const userObj = { id: userId, name: name.trim(), email: email.toLowerCase().trim(), role };
    const token   = signToken(userObj);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
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

    // ── Find user ─────────────────────────────────────────────────────────────
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, password, role FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
      });
    }

    const user = rows[0];

    // ── Compare password ──────────────────────────────────────────────────────
    const isMatch = await bcrypt.compare(password, user.password);
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
      message: 'Login successful.',
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
 * Stateless JWT – client is responsible for discarding the token.
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
    const [rows] = await pool.query(
      'SELECT id, name, email, phone, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    return res.status(200).json({ success: true, user: rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, logout, getMe };
