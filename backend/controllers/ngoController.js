const { pool } = require('../config/db');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch the NGO profile row for the authenticated user */
const getProfile = async (userId) => {
  const [rows] = await pool.query(
    `SELECT p.*, u.name, u.email AS user_email, u.phone AS user_phone
     FROM ngo_profiles p
     JOIN users u ON u.id = p.user_id
     WHERE p.user_id = ?`,
    [userId]
  );
  return rows[0] || null;
};

// ─── GET /api/ngo/dashboard ───────────────────────────────────────────────────
const getNgoDashboard = async (req, res, next) => {
  try {
    const ngoId = req.user.id;

    const [userRows] = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?', [ngoId]
    );
    const user = userRows[0];
    const profile = await getProfile(ngoId);

    // Stats
    const [[accepted]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM donations WHERE ngo_id = ? AND status NOT IN ('CANCELLED')`,
      [ngoId]
    );
    const [[received]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM donations WHERE ngo_id = ? AND status IN ('DELIVERED','COMPLETED')`,
      [ngoId]
    );
    const [[available]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM donations WHERE status = 'POSTED'`
    );
    const [[foodStats]] = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total_qty FROM donations
       WHERE ngo_id = ? AND status IN ('DELIVERED','COMPLETED')`,
      [ngoId]
    );
    const [[peopleStats]] = await pool.query(
      `SELECT COALESCE(SUM(people_served), 0) AS total_people FROM donations
       WHERE ngo_id = ? AND status IN ('DELIVERED','COMPLETED')`,
      [ngoId]
    );

    // Recent accepted (last 5)
    const [recentAccepted] = await pool.query(
      `SELECT d.id, d.food_name, d.food_category, d.quantity, d.unit, d.city,
              d.status, d.accepted_at, d.food_image,
              u.name AS donor_name
       FROM donations d
       JOIN users u ON u.id = d.donor_id
       WHERE d.ngo_id = ?
       ORDER BY d.accepted_at DESC LIMIT 5`,
      [ngoId]
    );

    // Chart: donations received by month (last 12 months)
    const [donationsByMonth] = await pool.query(
      `SELECT DATE_FORMAT(accepted_at, '%Y-%m') AS month, COUNT(*) AS count
       FROM donations WHERE ngo_id = ?
         AND accepted_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month ASC`,
      [ngoId]
    );

    // Chart: food category distribution
    const [categoryDist] = await pool.query(
      `SELECT food_category, COUNT(*) AS count, COALESCE(SUM(quantity),0) AS total_qty
       FROM donations WHERE ngo_id = ?
       GROUP BY food_category ORDER BY count DESC`,
      [ngoId]
    );

    // Chart: food received over time
    const [foodOverTime] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
              COALESCE(SUM(quantity),0) AS total_qty
       FROM donations WHERE ngo_id = ? AND status IN ('COMPLETED','DELIVERED')
         AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month ASC`,
      [ngoId]
    );

    // Chart: people served over time
    const [peopleOverTime] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
              COALESCE(SUM(people_served),0) AS total_people
       FROM donations WHERE ngo_id = ? AND status IN ('COMPLETED','DELIVERED')
         AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month ASC`,
      [ngoId]
    );

    return res.json({
      success: true,
      user,
      profile,
      stats: {
        available:    Number(available.cnt),
        accepted:     Number(accepted.cnt),
        received:     Number(received.cnt),
        totalFood:    parseFloat(foodStats.total_qty),
        totalPeople:  parseInt(peopleStats.total_people),
      },
      recentAccepted,
      chart_data: {
        donations_by_month: donationsByMonth,
        category_distribution: categoryDist,
        food_over_time: foodOverTime,
        people_over_time: peopleOverTime,
      },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/ngo/profile ─────────────────────────────────────────────────────
const getNgoProfile = async (req, res, next) => {
  try {
    const profile = await getProfile(req.user.id);
    return res.json({ success: true, profile });
  } catch (err) { next(err); }
};

// ─── PUT /api/ngo/profile ─────────────────────────────────────────────────────
/**
 * Create or update NGO profile (upsert).
 * NGO name is required; all other fields are optional updates.
 */
const upsertNgoProfile = async (req, res, next) => {
  try {
    const {
      ngo_name, founder, address, city, phone, email,
      food_types, operating_area, max_food_capacity, is_available,
      lat, lng,  // optional geocoded coordinates
    } = req.body;

    if (!ngo_name) {
      return res.status(400).json({ success: false, error: 'NGO Name is required.' });
    }

    if (max_food_capacity !== undefined && max_food_capacity !== null && String(max_food_capacity).trim() !== '') {
      const cap = parseFloat(max_food_capacity);
      if (isNaN(cap) || cap <= 0) {
        return res.status(400).json({ success: false, error: 'Max food capacity must be a positive number.' });
      }
    }

    const existing = await getProfile(req.user.id);
    // Convert is_available to 0/1; default to 1 if not supplied
    const availVal = is_available === undefined ? 1 : (is_available ? 1 : 0);

    // Validate coordinates if provided
    const coordLat = lat ? parseFloat(lat) : null;
    const coordLng = lng ? parseFloat(lng) : null;
    const validCoords = coordLat && coordLng &&
      coordLat >= -90 && coordLat <= 90 &&
      coordLng >= -180 && coordLng <= 180;

    if (existing) {
      await pool.query(
        `UPDATE ngo_profiles SET
           ngo_name=?, founder=?, address=?, city=?, phone=?, email=?,
           food_types=?, operating_area=?, max_food_capacity=?, is_available=?,
           lat=?, lng=?
         WHERE user_id=?`,
        [
          ngo_name.trim(), founder || null, address || null, city || null,
          phone || null, email || null, food_types || null,
          operating_area || null,
          max_food_capacity ? parseFloat(max_food_capacity) : null,
          availVal,
          validCoords ? coordLat : (existing.lat || null),
          validCoords ? coordLng : (existing.lng || null),
          req.user.id,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO ngo_profiles
           (user_id, ngo_name, founder, address, city, phone, email,
            food_types, operating_area, max_food_capacity, is_available, lat, lng)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id, ngo_name.trim(), founder || null, address || null,
          city || null, phone || null, email || null, food_types || null,
          operating_area || null,
          max_food_capacity ? parseFloat(max_food_capacity) : null,
          availVal,
          validCoords ? coordLat : null,
          validCoords ? coordLng : null,
        ]
      );
    }

    const updated = await getProfile(req.user.id);
    return res.json({ success: true, message: 'Profile saved.', profile: updated });
  } catch (err) { next(err); }
};

// ─── PATCH /api/ngo/availability ────────────────────────────────────────────────
/**
 * Quickly toggle whether an NGO is currently accepting donations.
 * Body: { is_available: true|false }
 */
const toggleAvailability = async (req, res, next) => {
  try {
    const { is_available } = req.body;
    if (is_available === undefined) {
      return res.status(400).json({ success: false, error: 'is_available is required.' });
    }
    const availVal = is_available ? 1 : 0;
    const [result] = await pool.query(
      `UPDATE ngo_profiles SET is_available = ? WHERE user_id = ?`,
      [availVal, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'NGO profile not found. Create a profile first.' });
    }
    return res.json({
      success: true,
      is_available: !!availVal,
      message: availVal ? 'You are now accepting donations.' : 'You are now marked as unavailable.',
    });
  } catch (err) { next(err); }
};

// ─── GET /api/ngo/donations/available ─────────────────────────────────────────
/**
 * Browse all POSTED donations with optional filters.
 * Query params: category, food_type, min_qty, max_qty, city, expiry_hours, page, limit
 */
const getAvailableDonations = async (req, res, next) => {
  try {
    const {
      category, food_type, min_qty, max_qty, city,
      expiry_hours, page = 1, limit = 20,
    } = req.query;

    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (p - 1) * l;
    const conditions = [`d.status = 'POSTED'`];
    const params = [];

    if (category) { conditions.push(`d.food_category = ?`); params.push(category); }
    if (food_type) { conditions.push(`d.food_type = ?`);   params.push(food_type); }
    if (min_qty)   { conditions.push(`d.quantity >= ?`);   params.push(parseFloat(min_qty)); }
    if (max_qty)   { conditions.push(`d.quantity <= ?`);   params.push(parseFloat(max_qty)); }
    if (city)      { conditions.push(`d.city LIKE ?`);     params.push(`%${city}%`); }
    if (expiry_hours) {
      conditions.push(`d.best_before <= DATE_ADD(NOW(), INTERVAL ? HOUR)`);
      params.push(parseInt(expiry_hours, 10));
    }

    const where = conditions.join(' AND ');

    const countParams = [...params];
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM donations d WHERE ${where}`,
      countParams
    );

    const queryParams = [...params, l, offset];
    const [donations] = await pool.query(
      `SELECT d.*, u.name AS donor_name, u.phone AS donor_phone
       FROM donations d
       JOIN users u ON u.id = d.donor_id
       WHERE ${where}
       ORDER BY d.created_at DESC
       LIMIT ? OFFSET ?`,
      queryParams
    );

    return res.json({
      success: true,
      donations,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/ngo/donations/accepted ──────────────────────────────────────────
/** All donations this NGO has accepted */
const getAcceptedDonations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const ngoId = req.user.id;

    const conditions = ['d.ngo_id = ?'];
    const params = [ngoId];

    if (status) { conditions.push('d.status = ?'); params.push(status.toUpperCase()); }
    else { conditions.push(`d.status NOT IN ('CANCELLED','POSTED')`); }

    const where = conditions.join(' AND ');
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM donations d WHERE ${where}`, params
    );

    const [donations] = await pool.query(
      `SELECT d.*, u.name AS donor_name, u.phone AS donor_phone
       FROM donations d
       JOIN users u ON u.id = d.donor_id
       WHERE ${where}
       ORDER BY d.accepted_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    return res.json({
      success: true,
      donations,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/ngo/donations/:id ───────────────────────────────────────────────
/** Detail of any donation (available or accepted by this NGO) */
const getDonationDetail = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.*, u.name AS donor_name, u.phone AS donor_phone, u.email AS donor_email
       FROM donations d
       JOIN users u ON u.id = d.donor_id
       WHERE d.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Donation not found.' });
    return res.json({ success: true, donation: rows[0] });
  } catch (err) { next(err); }
};

// ─── POST /api/ngo/donations/:id/accept ───────────────────────────────────────
/** Accept a POSTED donation */
const acceptDonation = async (req, res, next) => {
  try {
    const ngoId = req.user.id;
    const [rows] = await pool.query(
      'SELECT * FROM donations WHERE id = ? AND status = ?',
      [req.params.id, 'POSTED']
    );
    if (!rows[0]) {
      return res.status(400).json({ success: false, error: 'Donation not available for acceptance.' });
    }

    const donation = rows[0];

    // Check if donation has expired
    if (new Date(donation.best_before).getTime() <= Date.now()) {
      return res.status(400).json({ success: false, error: 'Cannot accept an expired donation.' });
    }

    // Check NGO profile and availability
    const profile = await getProfile(ngoId);
    if (profile && profile.verification_status === 'rejected') {
      return res.status(403).json({
        success: false,
        error: 'Cannot accept donation: Your NGO verification was rejected. Please contact support.',
      });
    }
    if (profile && profile.is_available === 0) {
      return res.status(400).json({ success: false, error: 'Cannot accept donation: You are currently marked as unavailable.' });
    }

    // Check dietary compatibility: vegetarian NGO accepting non-vegetarian donation
    if (profile && profile.food_types) {
      const types = profile.food_types.toLowerCase();
      const acceptsNonVeg =
        types.includes('non-veg') ||
        types.includes('non veg') ||
        types.includes('meat') ||
        types.includes('chicken') ||
        types.includes('all') ||
        types.includes('any');

      if (donation.food_type === 'non-vegetarian' && !acceptsNonVeg && (types.includes('veg') || types.includes('vegetarian'))) {
        return res.status(400).json({
          success: false,
          error: 'Incompatible food type: NGO accepts vegetarian food only.',
        });
      }
    }

    await pool.query(
      `UPDATE donations SET status = 'ACCEPTED', ngo_id = ?, accepted_at = NOW()
       WHERE id = ? AND status = 'POSTED'`,
      [ngoId, req.params.id]
    );

    return res.json({ success: true, message: 'Donation accepted.' });
  } catch (err) { next(err); }
};

// ─── POST /api/ngo/donations/:id/reject ───────────────────────────────────────
/**
 * Reject a donation that was accepted by this NGO.
 * Moves status back to POSTED so other NGOs can pick it up.
 * Body: { reason? }
 */
const rejectDonation = async (req, res, next) => {
  try {
    const ngoId = req.user.id;
    const { reason } = req.body;

    const [rows] = await pool.query('SELECT * FROM donations WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ success: false, error: 'Donation not found.' });
    }
    const donation = rows[0];
    if (donation.ngo_id !== ngoId) {
      return res.status(403).json({ success: false, error: 'Access denied: You are not assigned to this donation.' });
    }
    if (donation.status !== 'ACCEPTED') {
      return res.status(400).json({ success: false, error: `Cannot reject: donation is in "${donation.status}" state.` });
    }

    await pool.query(
      `UPDATE donations SET status = 'POSTED', ngo_id = NULL, accepted_at = NULL,
       reject_reason = ?, updated_at = NOW()
       WHERE id = ? AND ngo_id = ?`,
      [reason || null, req.params.id, ngoId]
    );

    return res.json({ success: true, message: 'Donation rejected and made available again.' });
  } catch (err) { next(err); }
};

// ─── POST /api/ngo/donations/:id/received ─────────────────────────────────────
/** Mark donation as received / confirm food received by NGO */
const markReceived = async (req, res, next) => {
  try {
    const ngoId = req.user.id;
    const RECEIVABLE = ['ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'DELIVERED'];

    const [rows] = await pool.query('SELECT * FROM donations WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, error: 'Donation not found.' });
    const donation = rows[0];
    if (donation.ngo_id !== ngoId) {
      return res.status(403).json({ success: false, error: 'Access denied: You are not assigned to this donation.' });
    }
    if (!RECEIVABLE.includes(donation.status)) {
      return res.status(400).json({ success: false, error: `Cannot mark received: status is "${donation.status}".` });
    }

    await pool.query(
      `UPDATE donations SET status = 'COMPLETED', received_at = NOW()
       WHERE id = ? AND ngo_id = ?`,
      [req.params.id, ngoId]
    );

    return res.json({ success: true, message: 'Food received confirmed. Donation marked as COMPLETED.' });
  } catch (err) { next(err); }
};

// ─── Admin: GET /api/admin/ngos ───────────────────────────────────────────────
const adminListNgos = async (req, res, next) => {
  try {
    const [ngos] = await pool.query(
      `SELECT p.*, u.name, u.email AS user_email, u.created_at AS registered_at
       FROM ngo_profiles p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.id DESC`
    );
    return res.json({ success: true, ngos });
  } catch (err) { next(err); }
};

// ─── Admin: PATCH /api/admin/ngos/:id/verify ─────────────────────────────────
const adminVerifyNgo = async (req, res, next) => {
  try {
    const { status } = req.body;
    const VALID = ['pending', 'verified', 'rejected'];
    if (!VALID.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status. Use: pending, verified, rejected.' });
    }

    const [result] = await pool.query(
      `UPDATE ngo_profiles SET verification_status = ? WHERE user_id = ?`,
      [status, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'NGO profile not found.' });
    }
    return res.json({ success: true, message: `NGO verification status set to "${status}".` });
  } catch (err) { next(err); }
};

module.exports = {
  getNgoDashboard,
  getNgoProfile,
  upsertNgoProfile,
  toggleAvailability,
  getAvailableDonations,
  getAcceptedDonations,
  getDonationDetail,
  acceptDonation,
  rejectDonation,
  markReceived,
  adminListNgos,
  adminVerifyNgo,
};
