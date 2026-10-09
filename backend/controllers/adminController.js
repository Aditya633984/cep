'use strict';

/**
 * FoodBridge – Admin Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles all admin-only data queries. All routes require authenticate +
 * authorize('admin') middleware (enforced in routes/admin.js).
 *
 * Endpoints (relative to /api):
 *
 *   GET  /admin/stats                  – platform statistics
 *   GET  /admin/users                  – all users (with role filter + search)
 *   GET  /admin/users/:id              – user detail
 *   GET  /admin/ngos                   – all NGOs (with status filter)
 *   GET  /admin/ngos/:id               – NGO detail
 *   PATCH /admin/ngos/:id/verify       – update verification status
 *   GET  /admin/donations              – all donations (filter + search + paginate)
 *   GET  /admin/donations/:id          – donation detail
 *   GET  /admin/volunteers             – all volunteer profiles
 */

const { pool } = require('../config/db');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtPage = (p, size = 50) => {
  const page  = Math.max(1, parseInt(p) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(size) || 50));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

// ─── GET /admin/stats ─────────────────────────────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    const [[totals]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users)                                        AS total_users,
        (SELECT COUNT(*) FROM users WHERE role='donor')                    AS total_donors,
        (SELECT COUNT(*) FROM users WHERE role='ngo')                      AS total_ngos,
        (SELECT COUNT(*) FROM users WHERE role='volunteer')                AS total_volunteers,
        (SELECT COUNT(*) FROM donations)                                   AS total_donations,
        (SELECT COUNT(*) FROM donations WHERE status='COMPLETED')          AS completed_donations,
        (SELECT COUNT(*) FROM donations WHERE status='POSTED')             AS posted_donations,
        (SELECT COUNT(*) FROM donations WHERE status='ACCEPTED')           AS accepted_donations,
        (SELECT COUNT(*) FROM donations WHERE status='VOLUNTEER_ASSIGNED') AS assigned_donations,
        (SELECT COUNT(*) FROM donations WHERE status='PICKED_UP')          AS picked_up_donations,
        (SELECT COUNT(*) FROM donations WHERE status='DELIVERED')          AS delivered_donations,
        (SELECT COUNT(*) FROM donations WHERE status='CANCELLED')          AS cancelled_donations,
        (SELECT COALESCE(SUM(quantity),0) FROM donations WHERE status='COMPLETED')   AS total_kg_donated,
        (SELECT COALESCE(SUM(people_served),0) FROM donations WHERE status='COMPLETED') AS total_people_served,
        (SELECT COUNT(*) FROM ngo_profiles WHERE verification_status='pending')  AS ngo_pending,
        (SELECT COUNT(*) FROM ngo_profiles WHERE verification_status='verified') AS ngo_verified,
        (SELECT COUNT(*) FROM ngo_profiles WHERE verification_status='rejected') AS ngo_rejected
    `);

    // Active donations = in-progress (not yet completed or cancelled)
    const active_donations = Number(totals.accepted_donations) +
      Number(totals.assigned_donations) +
      Number(totals.picked_up_donations) +
      Number(totals.delivered_donations) +
      Number(totals.posted_donations);

    // Registrations by month (last 6 months)
    const [monthly] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
      FROM users
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month
      ORDER BY month ASC
    `);

    // Donations by status
    const [donByStatus] = await pool.query(`
      SELECT status, COUNT(*) AS count FROM donations GROUP BY status ORDER BY count DESC
    `);

    // Donations by month (last 12 months)
    const [donationsByMonth] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
      FROM donations
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY month
      ORDER BY month ASC
    `);

    // Food category distribution (all time)
    const [categoryDist] = await pool.query(`
      SELECT food_category, COUNT(*) AS count, COALESCE(SUM(quantity),0) AS total_qty
      FROM donations
      GROUP BY food_category
      ORDER BY count DESC
    `);

    // Food donated over time (kg per month, last 12 months, completed only)
    const [foodOverTime] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
             COALESCE(SUM(quantity), 0) AS total_qty
      FROM donations
      WHERE status IN ('COMPLETED','DELIVERED')
        AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY month
      ORDER BY month ASC
    `);

    // People served over time (per month, last 12 months)
    const [peopleOverTime] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
             COALESCE(SUM(people_served), 0) AS total_people
      FROM donations
      WHERE status IN ('COMPLETED','DELIVERED')
        AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY month
      ORDER BY month ASC
    `);

    return res.json({
      success: true,
      stats: { ...totals, active_donations },
      chart_data: {
        donations_by_month:    donationsByMonth,
        category_distribution: categoryDist,
        food_over_time:        foodOverTime,
        people_over_time:      peopleOverTime,
        monthly_registrations: monthly,
        donations_by_status:   donByStatus,
      },
    });
  } catch (err) { next(err); }
};

// ─── GET /admin/users ─────────────────────────────────────────────────────────
const getUsers = async (req, res, next) => {
  try {
    const { role, search, page: p, limit: l } = req.query;
    const { limit, offset } = fmtPage(p, l);

    let where = 'WHERE 1=1';
    const params = [];

    if (role && ['donor','ngo','volunteer','admin'].includes(role)) {
      where += ' AND u.role = ?'; params.push(role);
    }
    if (search) {
      where += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users u ${where}`, params
    );

    const [users] = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
              np.ngo_name, np.verification_status AS ngo_status,
              vp.vehicle_type, vp.service_area
       FROM users u
       LEFT JOIN ngo_profiles     np ON np.user_id = u.id AND u.role = 'ngo'
       LEFT JOIN volunteer_profiles vp ON vp.user_id = u.id AND u.role = 'volunteer'
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({ success: true, users, total, page: fmtPage(p, l).page, limit });
  } catch (err) { next(err); }
};

// ─── GET /admin/users/:id ─────────────────────────────────────────────────────
const getUserDetail = async (req, res, next) => {
  try {
    const [[user]] = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
              np.ngo_name, np.founder, np.address, np.city, np.phone AS ngo_phone,
              np.food_types, np.operating_area, np.max_food_capacity,
              np.is_available, np.verification_status,
              vp.vehicle_type, vp.availability, vp.service_area, vp.address AS vol_address
       FROM users u
       LEFT JOIN ngo_profiles np ON np.user_id = u.id
       LEFT JOIN volunteer_profiles vp ON vp.user_id = u.id
       WHERE u.id = ?`,
      [req.params.id]
    );
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    // Donations (if donor)
    let donations = [];
    if (user.role === 'donor') {
      [donations] = await pool.query(
        `SELECT id, food_name, food_category, quantity, unit, status, city, created_at
         FROM donations WHERE donor_id = ? ORDER BY created_at DESC LIMIT 20`,
        [req.params.id]
      );
    }

    return res.json({ success: true, user, donations });
  } catch (err) { next(err); }
};

// ─── GET /admin/ngos ─────────────────────────────────────────────────────────
const getNgos = async (req, res, next) => {
  try {
    const { status, search, page: p, limit: l } = req.query;
    const { limit, offset } = fmtPage(p, l);

    let where = 'WHERE 1=1';
    const params = [];

    if (status && ['pending','verified','rejected'].includes(status)) {
      where += ' AND np.verification_status = ?'; params.push(status);
    }
    if (search) {
      where += ' AND (np.ngo_name LIKE ? OR u.name LIKE ? OR np.city LIKE ? OR u.email LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM ngo_profiles np JOIN users u ON u.id = np.user_id ${where}`,
      params
    );

    const [ngos] = await pool.query(
      `SELECT np.*, u.name, u.email AS user_email, u.created_at AS registered_at
       FROM ngo_profiles np
       JOIN users u ON u.id = np.user_id
       ${where}
       ORDER BY np.verification_status ASC, u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({ success: true, ngos, total, page: fmtPage(p, l).page, limit });
  } catch (err) { next(err); }
};

// ─── GET /admin/ngos/:id ──────────────────────────────────────────────────────
const getNgoDetail = async (req, res, next) => {
  try {
    const [[ngo]] = await pool.query(
      `SELECT np.*, u.name, u.email AS user_email, u.created_at AS registered_at
       FROM ngo_profiles np
       JOIN users u ON u.id = np.user_id
       WHERE np.user_id = ?`,
      [req.params.id]
    );
    if (!ngo) return res.status(404).json({ success: false, error: 'NGO not found.' });

    // Accepted donations count
    const [[{ accepted_count }]] = await pool.query(
      `SELECT COUNT(*) AS accepted_count FROM donations WHERE ngo_id = ?`,
      [req.params.id]
    );
    const [[{ completed_count }]] = await pool.query(
      `SELECT COUNT(*) AS completed_count FROM donations WHERE ngo_id = ? AND status = 'COMPLETED'`,
      [req.params.id]
    );

    return res.json({ success: true, ngo: { ...ngo, accepted_count, completed_count } });
  } catch (err) { next(err); }
};

// ─── PATCH /admin/ngos/:id/verify ────────────────────────────────────────────
const updateNgoVerification = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending','verified','rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status. Must be pending, verified, or rejected.' });
    }
    const [result] = await pool.query(
      'UPDATE ngo_profiles SET verification_status = ? WHERE user_id = ?',
      [status, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'NGO not found.' });
    }
    return res.json({ success: true, message: `NGO verification status updated to "${status}".` });
  } catch (err) { next(err); }
};

// ─── GET /admin/donations ─────────────────────────────────────────────────────
const getDonations = async (req, res, next) => {
  try {
    const { status, search, city, page: p, limit: l } = req.query;
    const { page, limit, offset } = fmtPage(p, l);

    let where = 'WHERE 1=1';
    const params = [];

    if (status) { where += ' AND d.status = ?'; params.push(status); }
    if (city)   { where += ' AND d.city LIKE ?'; params.push(`%${city}%`); }
    if (search) {
      where += ' AND (d.food_name LIKE ? OR d.city LIKE ? OR donor.name LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM donations d
       JOIN users donor ON donor.id = d.donor_id
       ${where}`,
      params
    );

    const [donations] = await pool.query(
      `SELECT d.id, d.food_name, d.food_category, d.food_type,
              d.quantity, d.unit, d.people_served,
              d.city, d.pickup_address,
              d.best_before, d.preparation_date, d.status,
              d.created_at, d.accepted_at, d.picked_up_at, d.delivered_at,
              d.description,
              donor.id AS donor_id, donor.name AS donor_name, donor.email AS donor_email,
              donor.phone AS donor_phone,
              np.ngo_name, np.city AS ngo_city, np.address AS ngo_address,
              ngo_user.name AS ngo_contact_name,
              vol_user.name AS volunteer_name, vp.vehicle_type
       FROM donations d
       JOIN users donor ON donor.id = d.donor_id
       LEFT JOIN ngo_profiles np ON np.user_id = d.ngo_id
       LEFT JOIN users ngo_user ON ngo_user.id = d.ngo_id
       LEFT JOIN users vol_user ON vol_user.id = d.volunteer_id
       LEFT JOIN volunteer_profiles vp ON vp.user_id = d.volunteer_id
       ${where}
       ORDER BY d.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({ success: true, donations, total, page, limit });
  } catch (err) { next(err); }
};

// ─── GET /admin/donations/:id ─────────────────────────────────────────────────
const getDonationDetail = async (req, res, next) => {
  try {
    const [[donation]] = await pool.query(
      `SELECT d.*,
              donor.name AS donor_name, donor.email AS donor_email, donor.phone AS donor_phone,
              np.ngo_name, np.city AS ngo_city, np.address AS ngo_address, np.phone AS ngo_phone,
              ngo_user.name AS ngo_contact_name,
              vol_user.name AS volunteer_name, vol_user.email AS volunteer_email,
              vp.vehicle_type, vp.phone AS volunteer_phone
       FROM donations d
       JOIN users donor ON donor.id = d.donor_id
       LEFT JOIN ngo_profiles np ON np.user_id = d.ngo_id
       LEFT JOIN users ngo_user ON ngo_user.id = d.ngo_id
       LEFT JOIN users vol_user ON vol_user.id = d.volunteer_id
       LEFT JOIN volunteer_profiles vp ON vp.user_id = d.volunteer_id
       WHERE d.id = ?`,
      [req.params.id]
    );
    if (!donation) return res.status(404).json({ success: false, error: 'Donation not found.' });
    return res.json({ success: true, donation });
  } catch (err) { next(err); }
};

// ─── GET /admin/volunteers ────────────────────────────────────────────────────
const getVolunteers = async (req, res, next) => {
  try {
    const { search, page: p, limit: l } = req.query;
    const { page, limit, offset } = fmtPage(p, l);

    let where = "WHERE u.role = 'volunteer'";
    const params = [];
    if (search) {
      where += ' AND (u.name LIKE ? OR u.email LIKE ? OR vp.service_area LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users u LEFT JOIN volunteer_profiles vp ON vp.user_id = u.id ${where}`,
      params
    );

    const [volunteers] = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.created_at,
              vp.vehicle_type, vp.availability, vp.service_area, vp.address,
              (SELECT COUNT(*) FROM donations WHERE volunteer_id = u.id AND status='COMPLETED') AS completed_pickups,
              (SELECT COUNT(*) FROM donations WHERE volunteer_id = u.id AND status NOT IN ('COMPLETED','CANCELLED') AND volunteer_id IS NOT NULL) AS active_pickups
       FROM users u
       LEFT JOIN volunteer_profiles vp ON vp.user_id = u.id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({ success: true, volunteers, total, page, limit });
  } catch (err) { next(err); }
};

module.exports = {
  getStats,
  getUsers,
  getUserDetail,
  getNgos,
  getNgoDetail,
  updateNgoVerification,
  getDonations,
  getDonationDetail,
  getVolunteers,
};
