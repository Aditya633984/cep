const { pool } = require('../config/db');
const path     = require('path');
const fs       = require('fs');

// ─── Editable / Cancellable only when in these statuses ──────────────────────
const MUTABLE_STATUSES = ['POSTED'];

// ─── Valid enum values matching database schema ──────────────────────────────
const ALLOWED_CATEGORIES = [
  'Cooked Food', 'Packaged Food', 'Dry Ration',
  'Fruits', 'Vegetables', 'Bakery Items', 'Dairy', 'Other'
];
const ALLOWED_UNITS = [
  'kg', 'g', 'liters', 'ml', 'pieces', 'servings', 'boxes', 'packets'
];
const ALLOWED_FOOD_TYPES = ['vegetarian', 'non-vegetarian'];

const formatDateTime = (d) => {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

const formatDate = (d) => {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

// ─── Helper: fetch a single donation ensuring ownership / existence ──
const findDonation = async (donationId, donorId) => {
  const [rows] = await pool.query('SELECT * FROM donations WHERE id = ?', [donationId]);
  if (!rows[0]) {
    return { error: 404, message: 'Donation not found.' };
  }
  if (rows[0].donor_id !== donorId) {
    return { error: 403, message: 'Access denied: You do not have permission for this donation.' };
  }
  return { donation: rows[0] };
};

// ─── POST /api/donor/donations ────────────────────────────────────────────────
/**
 * Create a new donation.
 * Accepts multipart/form-data (handled by multer middleware).
 */
const createDonation = async (req, res, next) => {
  try {
    const {
      food_name, food_category, quantity, unit, people_served,
      food_type, preparation_date, best_before,
      pickup_address, city, description, pickup_availability,
      lat, lng,  // optional geocoded coordinates
    } = req.body;

    // ── Basic required field validation ───────────────────────────────────────
    if (!food_name || !food_category || !quantity || !unit || !food_type ||
        !preparation_date || !best_before || !pickup_address || !city) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Missing required fields.',
      });
    }

    // ── Enum validation ───────────────────────────────────────────────────────
    if (!ALLOWED_CATEGORIES.includes(food_category)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: `Invalid food category. Allowed: ${ALLOWED_CATEGORIES.join(', ')}`,
      });
    }

    if (!ALLOWED_UNITS.includes(unit)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: `Invalid unit. Allowed: ${ALLOWED_UNITS.join(', ')}`,
      });
    }

    if (!ALLOWED_FOOD_TYPES.includes(food_type)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Invalid food type. Allowed: vegetarian, non-vegetarian',
      });
    }

    // ── Quantity validation ───────────────────────────────────────────────────
    const parsedQty = parseFloat(quantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Quantity must be a positive number.',
      });
    }

    let parsedPeople = null;
    if (people_served !== undefined && people_served !== null && String(people_served).trim() !== '') {
      parsedPeople = parseInt(people_served, 10);
      if (isNaN(parsedPeople) || parsedPeople <= 0) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'People served must be a positive integer.',
        });
      }
    }

    // ── Date and expiry validation ───────────────────────────────────────────
    const prepDate = new Date(preparation_date);
    const bestBeforeDate = new Date(best_before);
    if (isNaN(prepDate.getTime()) || isNaN(bestBeforeDate.getTime())) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Invalid preparation or best-before date format.',
      });
    }

    if (bestBeforeDate.getTime() <= Date.now()) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Best-before date and time must be in the future. Cannot donate expired food.',
      });
    }

    if (bestBeforeDate < prepDate) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Best-before date cannot be before preparation date.',
      });
    }

    const food_image = req.file ? `/uploads/${req.file.filename}` : null;

    // Validate coordinates if provided
    const coordLat = lat ? parseFloat(lat) : null;
    const coordLng = lng ? parseFloat(lng) : null;
    const validCoords = coordLat && coordLng &&
      coordLat >= -90 && coordLat <= 90 &&
      coordLng >= -180 && coordLng <= 180;

    const formattedPrepDate = formatDate(prepDate);
    const formattedBestBefore = formatDateTime(bestBeforeDate);

    const [result] = await pool.query(
      `INSERT INTO donations
         (donor_id, food_name, food_category, quantity, unit, people_served,
          food_type, preparation_date, best_before, pickup_address, city,
          description, food_image, pickup_availability, lat, lng, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'POSTED')`,
      [
        req.user.id, food_name.trim(), food_category, parsedQty,
        unit, parsedPeople, food_type,
        formattedPrepDate, formattedBestBefore,
        pickup_address.trim(), city.trim(),
        description || null, food_image, pickup_availability || null,
        validCoords ? coordLat : null, validCoords ? coordLng : null,
      ]
    );

    const [rows] = await pool.query('SELECT * FROM donations WHERE id = ?', [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Donation posted successfully.',
      donation: rows[0],
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/donor/donations ─────────────────────────────────────────────────
/** List all donations for the logged-in donor. */
const getDonations = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (p - 1) * l;

    let baseQuery = 'SELECT * FROM donations WHERE donor_id = ?';
    const params  = [req.user.id];

    if (status) {
      baseQuery += ' AND status = ?';
      params.push(status.toUpperCase());
    }

    baseQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(l, offset);

    const [donations] = await pool.query(baseQuery, params);

    // Total count for pagination
    let countQuery = 'SELECT COUNT(*) AS total FROM donations WHERE donor_id = ?';
    const countParams = [req.user.id];
    if (status) { countQuery += ' AND status = ?'; countParams.push(status.toUpperCase()); }
    const [[{ total }]] = await pool.query(countQuery, countParams);

    return res.json({
      success: true,
      donations,
      pagination: { total, page: p, limit: l },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/donor/donations/:id ─────────────────────────────────────────────
/** Get single donation detail. */
const getDonationById = async (req, res, next) => {
  try {
    const found = await findDonation(req.params.id, req.user.id);
    if (found.error) {
      return res.status(found.error).json({ success: false, error: found.message });
    }
    return res.json({ success: true, donation: found.donation });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/donor/donations/:id ─────────────────────────────────────────────
/** Edit a donation that hasn't been accepted yet. */
const updateDonation = async (req, res, next) => {
  try {
    const found = await findDonation(req.params.id, req.user.id);
    if (found.error) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(found.error).json({ success: false, error: found.message });
    }
    const donation = found.donation;

    if (!MUTABLE_STATUSES.includes(donation.status)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: `Cannot edit a donation with status "${donation.status}".`,
      });
    }

    const {
      food_name, food_category, quantity, unit, people_served,
      food_type, preparation_date, best_before,
      pickup_address, city, description, pickup_availability,
      lat, lng,  // optional geocoded coordinates
    } = req.body;

    // Validate enums if provided
    if (food_category && !ALLOWED_CATEGORIES.includes(food_category)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: `Invalid food category. Allowed: ${ALLOWED_CATEGORIES.join(', ')}`,
      });
    }

    if (unit && !ALLOWED_UNITS.includes(unit)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: `Invalid unit. Allowed: ${ALLOWED_UNITS.join(', ')}`,
      });
    }

    if (food_type && !ALLOWED_FOOD_TYPES.includes(food_type)) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Invalid food type. Allowed: vegetarian, non-vegetarian',
      });
    }

    // Validate quantity if provided
    let updatedQty = donation.quantity;
    if (quantity !== undefined && quantity !== null && quantity !== '') {
      const parsedQty = parseFloat(quantity);
      if (isNaN(parsedQty) || parsedQty <= 0) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'Quantity must be a positive number.',
        });
      }
      updatedQty = parsedQty;
    }

    // Validate people_served if provided
    let updatedPeople = donation.people_served;
    if (people_served !== undefined && people_served !== null && String(people_served).trim() !== '') {
      const parsedPeople = parseInt(people_served, 10);
      if (isNaN(parsedPeople) || parsedPeople <= 0) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'People served must be a positive integer.',
        });
      }
      updatedPeople = parsedPeople;
    }

    // Validate dates if updated
    const targetBestBefore = best_before || donation.best_before;
    const targetPrepDate = preparation_date || donation.preparation_date;
    if (best_before || preparation_date) {
      const bb = new Date(targetBestBefore);
      const pd = new Date(targetPrepDate);
      if (isNaN(bb.getTime()) || isNaN(pd.getTime())) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'Invalid preparation date or best-before date format.',
        });
      }
      if (bb.getTime() <= Date.now()) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'Best-before date and time must be in the future. Cannot donate expired food.',
        });
      }
      if (bb < pd) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: 'Best-before date cannot be before preparation date.',
        });
      }
    }

    // Handle image: keep old if no new file uploaded
    let food_image = donation.food_image;
    if (req.file) {
      // Delete old image if exists
      if (donation.food_image) {
        const oldPath = path.join(__dirname, '..', 'public', donation.food_image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      food_image = `/uploads/${req.file.filename}`;
    }

    // Validate new coordinates if provided
    const coordLat = lat ? parseFloat(lat) : null;
    const coordLng = lng ? parseFloat(lng) : null;
    const validCoords = coordLat && coordLng &&
      coordLat >= -90 && coordLat <= 90 &&
      coordLng >= -180 && coordLng <= 180;

    const formattedPrepDate = formatDate(targetPrepDate);
    const formattedBestBefore = formatDateTime(targetBestBefore);

    await pool.query(
      `UPDATE donations SET
         food_name=?, food_category=?, quantity=?, unit=?, people_served=?,
         food_type=?, preparation_date=?, best_before=?,
         pickup_address=?, city=?, description=?, food_image=?, pickup_availability=?,
         lat=?, lng=?
       WHERE id = ? AND donor_id = ?`,
      [
        food_name?.trim() || donation.food_name,
        food_category || donation.food_category,
        updatedQty,
        unit || donation.unit,
        updatedPeople,
        food_type || donation.food_type,
        formattedPrepDate,
        formattedBestBefore,
        pickup_address?.trim() || donation.pickup_address,
        city?.trim() || donation.city,
        description !== undefined ? description : donation.description,
        food_image,
        pickup_availability !== undefined ? pickup_availability : donation.pickup_availability,
        validCoords ? coordLat : (lat === '' ? null : donation.lat),
        validCoords ? coordLng : (lng === '' ? null : donation.lng),
        req.params.id,
        req.user.id,
      ]
    );

    const [rows] = await pool.query('SELECT * FROM donations WHERE id = ?', [req.params.id]);
    return res.json({ success: true, message: 'Donation updated.', donation: rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/donor/donations/:id ─────────────────────────────────────────
/** Cancel a donation that hasn't been accepted yet (sets status=CANCELLED). */
const cancelDonation = async (req, res, next) => {
  try {
    const found = await findDonation(req.params.id, req.user.id);
    if (found.error) {
      return res.status(found.error).json({ success: false, error: found.message });
    }
    const donation = found.donation;

    if (!MUTABLE_STATUSES.includes(donation.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel a donation with status "${donation.status}".`,
      });
    }

    await pool.query(
      'UPDATE donations SET status = ? WHERE id = ? AND donor_id = ?',
      ['CANCELLED', req.params.id, req.user.id]
    );

    return res.json({ success: true, message: 'Donation cancelled.' });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/donor/dashboard ─────────────────────────────────────────────────
/** Donor dashboard stats + recent donations + chart data. */
const getDonorDashboard = async (req, res, next) => {
  try {
    const donorId = req.user.id;

    // User info
    const [[user]] = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [donorId]
    );

    // Counts by status
    const [statusCounts] = await pool.query(
      `SELECT status, COUNT(*) AS count FROM donations WHERE donor_id = ? GROUP BY status`,
      [donorId]
    );

    const counts = {
      total: 0, active: 0, completed: 0, cancelled: 0,
    };
    const ACTIVE_STATUSES = ['POSTED', 'ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'DELIVERED'];

    statusCounts.forEach(({ status, count }) => {
      counts.total += Number(count);
      if (ACTIVE_STATUSES.includes(status)) counts.active += Number(count);
      if (status === 'COMPLETED') counts.completed = Number(count);
      if (status === 'CANCELLED') counts.cancelled = Number(count);
    });

    // Total food donated (sum of quantity for COMPLETED + DELIVERED)
    const [[foodStats]] = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total_quantity
       FROM donations
       WHERE donor_id = ? AND status IN ('COMPLETED','DELIVERED')`,
      [donorId]
    );

    // People served
    const [[peopleStats]] = await pool.query(
      `SELECT COALESCE(SUM(people_served), 0) AS total_people
       FROM donations
       WHERE donor_id = ? AND status IN ('COMPLETED','DELIVERED')`,
      [donorId]
    );

    // Recent 5 donations
    const [recent] = await pool.query(
      `SELECT id, food_name, food_category, quantity, unit, status, city, created_at, food_image
       FROM donations WHERE donor_id = ?
       ORDER BY created_at DESC LIMIT 5`,
      [donorId]
    );

    // Chart: donations by month (last 12 months)
    const [donationsByMonth] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count
       FROM donations WHERE donor_id = ?
         AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month ASC`,
      [donorId]
    );

    // Chart: food category distribution
    const [categoryDist] = await pool.query(
      `SELECT food_category, COUNT(*) AS count, COALESCE(SUM(quantity),0) AS total_qty
       FROM donations WHERE donor_id = ?
       GROUP BY food_category ORDER BY count DESC`,
      [donorId]
    );

    // Chart: food donated over time (kg per month, completed/delivered)
    const [foodOverTime] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
              COALESCE(SUM(quantity),0) AS total_qty
       FROM donations WHERE donor_id = ? AND status IN ('COMPLETED','DELIVERED')
         AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month ASC`,
      [donorId]
    );

    // Chart: people served over time
    const [peopleOverTime] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
              COALESCE(SUM(people_served),0) AS total_people
       FROM donations WHERE donor_id = ? AND status IN ('COMPLETED','DELIVERED')
         AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month ASC`,
      [donorId]
    );

    return res.json({
      success: true,
      user,
      stats: {
        total:        counts.total,
        active:       counts.active,
        completed:    counts.completed,
        cancelled:    counts.cancelled,
        totalFood:    parseFloat(foodStats.total_quantity),
        totalPeople:  parseInt(peopleStats.total_people),
      },
      recentDonations: recent,
      chart_data: {
        donations_by_month: donationsByMonth,
        category_distribution: categoryDist,
        food_over_time: foodOverTime,
        people_over_time: peopleOverTime,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createDonation,
  getDonations,
  getDonationById,
  updateDonation,
  cancelDonation,
  getDonorDashboard,
};
