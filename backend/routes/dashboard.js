const express         = require('express');
const router          = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { pool }        = require('../config/db');

// ─── Helper to build a dashboard response ─────────────────────────────────────
const dashboardResponse = (role, user, extra = {}) => ({
  success: true,
  role,
  user: {
    id:    user.id,
    name:  user.name || user.email,
    email: user.email,
    role:  user.role,
  },
  message: `Welcome to the ${role.charAt(0).toUpperCase() + role.slice(1)} Dashboard`,
  ...extra,
});

// ─── Donor Dashboard ──────────────────────────────────────────────────────────
// GET /api/donor/dashboard
router.get(
  '/donor/dashboard',
  authenticate,
  authorize('donor'),
  async (req, res, next) => {
    try {
      const [rows] = await pool.query(
        'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
        [req.user.id]
      );
      res.json(dashboardResponse('donor', rows[0]));
    } catch (err) { next(err); }
  }
);

// ─── NGO Dashboard ────────────────────────────────────────────────────────────
// GET /api/ngo/dashboard
router.get(
  '/ngo/dashboard',
  authenticate,
  authorize('ngo'),
  async (req, res, next) => {
    try {
      const [rows] = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.created_at,
                n.ngo_name, n.founder, n.address, n.food_types
         FROM users u
         LEFT JOIN ngo_profiles n ON n.user_id = u.id
         WHERE u.id = ?`,
        [req.user.id]
      );
      res.json(dashboardResponse('ngo', rows[0], { ngo_profile: rows[0] }));
    } catch (err) { next(err); }
  }
);

// ─── Volunteer Dashboard ──────────────────────────────────────────────────────
// GET /api/volunteer/dashboard
router.get(
  '/volunteer/dashboard',
  authenticate,
  authorize('volunteer'),
  async (req, res, next) => {
    try {
      const [rows] = await pool.query(
        'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
        [req.user.id]
      );
      res.json(dashboardResponse('volunteer', rows[0]));
    } catch (err) { next(err); }
  }
);

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
// GET /api/admin/dashboard
router.get(
  '/admin/dashboard',
  authenticate,
  authorize('admin'),
  async (req, res, next) => {
    try {
      const [userCount] = await pool.query('SELECT COUNT(*) AS total FROM users');
      const [roleCounts] = await pool.query(
        'SELECT role, COUNT(*) AS count FROM users GROUP BY role'
      );
      const [users] = await pool.query(
        'SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC'
      );
      // Recent donations with donor name for admin view
      const [donations] = await pool.query(
        `SELECT d.id, d.food_name, d.food_category, d.food_type,
                d.quantity, d.unit, d.city, d.best_before, d.status,
                d.created_at, d.pickup_address, d.people_served,
                u.name AS donor_name, u.email AS donor_email
         FROM donations d
         JOIN users u ON u.id = d.donor_id
         ORDER BY d.created_at DESC
         LIMIT 100`
      );
      res.json(dashboardResponse('admin', req.user, {
        stats: {
          totalUsers: userCount[0].total,
          byRole: roleCounts,
        },
        users,
        donations,
      }));
    } catch (err) { next(err); }
  }
);

module.exports = router;
