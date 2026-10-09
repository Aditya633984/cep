const { pool } = require('../config/db');

// ─── Helper: fetch volunteer profile ─────────────────────────────────────────
const getProfile = async (userId) => {
  const [rows] = await pool.query(
    `SELECT vp.*, u.name, u.email AS user_email
     FROM volunteer_profiles vp
     JOIN users u ON u.id = vp.user_id
     WHERE vp.user_id = ?`,
    [userId]
  );
  return rows[0] || null;
};

// ─── GET /api/volunteer/dashboard ────────────────────────────────────────────
const getVolunteerDashboard = async (req, res, next) => {
  try {
    const volId = req.user.id;

    const [[user]] = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [volId]
    );
    const profile = await getProfile(volId);

    // Stats
    const [[activeRow]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM donations
       WHERE volunteer_id = ? AND status IN ('VOLUNTEER_ASSIGNED','PICKED_UP','DELIVERED')`,
      [volId]
    );
    const [[completedRow]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM donations
       WHERE volunteer_id = ? AND status = 'COMPLETED'`,
      [volId]
    );
    const [[availableRow]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM donations WHERE status = 'ACCEPTED'`
    );
    const [[foodRow]] = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total_qty FROM donations
       WHERE volunteer_id = ? AND status = 'COMPLETED'`,
      [volId]
    );
    const [[peopleRow]] = await pool.query(
      `SELECT COALESCE(SUM(people_served), 0) AS total_people FROM donations
       WHERE volunteer_id = ? AND status = 'COMPLETED'`,
      [volId]
    );

    // Available pickup requests (ACCEPTED by NGO, not yet assigned)
    const [available] = await pool.query(
      `SELECT d.id, d.food_name, d.food_category, d.quantity, d.unit,
              d.pickup_address, d.city, d.best_before, d.food_image, d.status,
              d.description, d.people_served, d.food_type,
              u_donor.name  AS donor_name,  u_donor.phone  AS donor_phone,
              np.ngo_name,
              u_ngo.name    AS ngo_contact_name, u_ngo.phone AS ngo_phone,
              np.address    AS ngo_address, np.city AS ngo_city
       FROM donations d
       JOIN users u_donor ON u_donor.id = d.donor_id
       JOIN users u_ngo   ON u_ngo.id   = d.ngo_id
       LEFT JOIN ngo_profiles np ON np.user_id = d.ngo_id
       WHERE d.status = 'ACCEPTED'
       ORDER BY d.accepted_at DESC`,
      []
    );

    // My active pickup (one at a time)
    const [activePickups] = await pool.query(
      `SELECT d.id, d.food_name, d.food_category, d.quantity, d.unit,
              d.pickup_address, d.city, d.best_before, d.food_image,
              d.status, d.description, d.people_served,
              d.volunteer_assigned_at, d.picked_up_at, d.delivered_at,
              u_donor.name  AS donor_name,  u_donor.phone  AS donor_phone,
              np.ngo_name,
              u_ngo.name    AS ngo_contact_name, u_ngo.phone AS ngo_phone,
              np.address    AS ngo_address, np.city AS ngo_city
       FROM donations d
       JOIN users u_donor ON u_donor.id = d.donor_id
       JOIN users u_ngo   ON u_ngo.id   = d.ngo_id
       LEFT JOIN ngo_profiles np ON np.user_id = d.ngo_id
       WHERE d.volunteer_id = ? AND d.status IN ('VOLUNTEER_ASSIGNED','PICKED_UP','DELIVERED')
       ORDER BY d.volunteer_assigned_at DESC`,
      [volId]
    );

    // Completed pickups (last 20)
    const [completed] = await pool.query(
      `SELECT d.id, d.food_name, d.food_category, d.quantity, d.unit,
              d.pickup_address, d.city, d.status,
              d.volunteer_assigned_at, d.picked_up_at, d.delivered_at, d.received_at,
              np.ngo_name, u_ngo.name AS ngo_contact_name
       FROM donations d
       JOIN users u_ngo   ON u_ngo.id = d.ngo_id
       LEFT JOIN ngo_profiles np ON np.user_id = d.ngo_id
       WHERE d.volunteer_id = ? AND d.status = 'COMPLETED'
       ORDER BY d.received_at DESC LIMIT 20`,
      [volId]
    );

    // Chart: pickups by month (last 12 months)
    const [pickupsByMonth] = await pool.query(
      `SELECT DATE_FORMAT(volunteer_assigned_at, '%Y-%m') AS month, COUNT(*) AS count
       FROM donations WHERE volunteer_id = ?
         AND volunteer_assigned_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month ASC`,
      [volId]
    );

    // Chart: food delivered over time
    const [foodOverTime] = await pool.query(
      `SELECT DATE_FORMAT(delivered_at, '%Y-%m') AS month,
              COALESCE(SUM(quantity),0) AS total_qty
       FROM donations WHERE volunteer_id = ? AND status IN ('COMPLETED','DELIVERED')
         AND delivered_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY month ORDER BY month ASC`,
      [volId]
    );

    // Chart: food category distribution (deliveries)
    const [categoryDist] = await pool.query(
      `SELECT food_category, COUNT(*) AS count, COALESCE(SUM(quantity),0) AS total_qty
       FROM donations WHERE volunteer_id = ?
       GROUP BY food_category ORDER BY count DESC`,
      [volId]
    );

    return res.json({
      success: true,
      user,
      profile,
      stats: {
        available:    Number(availableRow.cnt),
        active:       Number(activeRow.cnt),
        completed:    Number(completedRow.cnt),
        totalFood:    parseFloat(foodRow.total_qty),
        totalPeople:  parseInt(peopleRow.total_people),
      },
      available,
      activePickups,
      completed,
      chart_data: {
        pickups_by_month: pickupsByMonth,
        food_over_time: foodOverTime,
        category_distribution: categoryDist,
      },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/volunteer/profile ───────────────────────────────────────────────
const getVolunteerProfile = async (req, res, next) => {
  try {
    const profile = await getProfile(req.user.id);
    return res.json({ success: true, profile });
  } catch (err) { next(err); }
};

// ─── PUT /api/volunteer/profile ───────────────────────────────────────────────
const upsertVolunteerProfile = async (req, res, next) => {
  try {
    const { phone, address, vehicle_type, availability, service_area, lat, lng } = req.body;

    // Also update users.phone if provided
    if (phone) {
      await pool.query('UPDATE users SET phone = ? WHERE id = ?', [phone, req.user.id]);
    }

    // Validate coordinates if provided
    const coordLat = lat ? parseFloat(lat) : null;
    const coordLng = lng ? parseFloat(lng) : null;
    const validCoords = coordLat && coordLng &&
      coordLat >= -90 && coordLat <= 90 &&
      coordLng >= -180 && coordLng <= 180;

    const existing = await getProfile(req.user.id);
    if (existing) {
      await pool.query(
        `UPDATE volunteer_profiles
         SET phone=?, address=?, vehicle_type=?, availability=?, service_area=?,
             lat=?, lng=?, updated_at=NOW()
         WHERE user_id=?`,
        [
          phone || existing.phone,
          address || existing.address,
          vehicle_type || existing.vehicle_type,
          availability !== undefined ? availability : existing.availability,
          service_area || existing.service_area,
          validCoords ? coordLat : (existing.lat || null),
          validCoords ? coordLng : (existing.lng || null),
          req.user.id,
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO volunteer_profiles (user_id, phone, address, vehicle_type, availability, service_area, lat, lng)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          phone || null,
          address || null,
          vehicle_type || 'motorcycle',
          availability || null,
          service_area || null,
          validCoords ? coordLat : null,
          validCoords ? coordLng : null,
        ]
      );
    }

    const updated = await getProfile(req.user.id);
    return res.json({ success: true, message: 'Profile saved.', profile: updated });
  } catch (err) { next(err); }
};

// ─── GET /api/volunteer/pickups/available ─────────────────────────────────────
const getAvailablePickups = async (req, res, next) => {
  try {
    const { city, page = 1, limit = 20 } = req.query;
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (p - 1) * l;
    const conditions = [`d.status = 'ACCEPTED'`];
    const params = [];

    if (city) { conditions.push('d.city LIKE ?'); params.push(`%${city}%`); }

    const where = conditions.join(' AND ');
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM donations d WHERE ${where}`, params
    );

    const [pickups] = await pool.query(
      `SELECT d.id, d.food_name, d.food_category, d.quantity, d.unit,
              d.pickup_address, d.city, d.best_before, d.food_image,
              d.description, d.people_served, d.food_type, d.pickup_availability,
              u_donor.name AS donor_name, u_donor.phone AS donor_phone,
              np.ngo_name,
              u_ngo.name   AS ngo_contact_name, u_ngo.phone AS ngo_phone,
              np.address   AS ngo_address, np.city AS ngo_city
       FROM donations d
       JOIN users u_donor ON u_donor.id = d.donor_id
       JOIN users u_ngo   ON u_ngo.id   = d.ngo_id
       LEFT JOIN ngo_profiles np ON np.user_id = d.ngo_id
       WHERE ${where}
       ORDER BY d.accepted_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    return res.json({ success: true, pickups, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
};

// ─── POST /api/volunteer/pickups/:id/accept ───────────────────────────────────
/** Volunteer accepts a pickup request → status becomes VOLUNTEER_ASSIGNED */
const acceptPickup = async (req, res, next) => {
  try {
    const volId = req.user.id;

    // Check for existing active pickup
    const [[activeCheck]] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM donations
       WHERE volunteer_id = ? AND status IN ('VOLUNTEER_ASSIGNED','PICKED_UP','DELIVERED')`,
      [volId]
    );
    if (Number(activeCheck.cnt) > 0) {
      return res.status(400).json({
        success: false,
        error: 'You already have an active pickup. Complete it before accepting a new one.',
      });
    }

    const [rows] = await pool.query('SELECT * FROM donations WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ success: false, error: 'Donation not found.' });
    }
    const donation = rows[0];

    if (donation.volunteer_id && donation.volunteer_id !== volId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: Another volunteer is already assigned to this pickup.',
      });
    }

    if (donation.status !== 'ACCEPTED') {
      return res.status(400).json({
        success: false,
        error: `Pickup request not available (status: ${donation.status}).`,
      });
    }

    await pool.query(
      `UPDATE donations
       SET status = 'VOLUNTEER_ASSIGNED', volunteer_id = ?, volunteer_assigned_at = NOW()
       WHERE id = ? AND status = 'ACCEPTED'`,
      [volId, req.params.id]
    );

    return res.json({ success: true, message: 'Pickup accepted. You are now assigned to this delivery.' });
  } catch (err) { next(err); }
};

// ─── POST /api/volunteer/pickups/:id/pickup ───────────────────────────────────
/** Volunteer has collected the food → status becomes PICKED_UP */
const markPickedUp = async (req, res, next) => {
  try {
    const volId = req.user.id;
    const [rows] = await pool.query('SELECT * FROM donations WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ success: false, error: 'Donation not found.' });
    }
    const donation = rows[0];

    if (donation.volunteer_id !== volId) {
      return res.status(403).json({
        success: false,
        error: "Access denied: You are not assigned to this pickup.",
      });
    }

    if (donation.status !== 'VOLUNTEER_ASSIGNED') {
      return res.status(400).json({
        success: false,
        error: `Donation is not in VOLUNTEER_ASSIGNED status (current status: ${donation.status}).`,
      });
    }

    await pool.query(
      `UPDATE donations SET status = 'PICKED_UP', picked_up_at = NOW() WHERE id = ? AND volunteer_id = ?`,
      [req.params.id, volId]
    );

    return res.json({ success: true, message: 'Food picked up! Head to the NGO to deliver.' });
  } catch (err) { next(err); }
};

// ─── POST /api/volunteer/pickups/:id/deliver ──────────────────────────────────
/** Volunteer has delivered the food → status becomes DELIVERED */
const markDelivered = async (req, res, next) => {
  try {
    const volId = req.user.id;
    const [rows] = await pool.query('SELECT * FROM donations WHERE id = ?', [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({ success: false, error: 'Donation not found.' });
    }
    const donation = rows[0];

    if (donation.volunteer_id !== volId) {
      return res.status(403).json({
        success: false,
        error: "Access denied: You are not assigned to this pickup.",
      });
    }

    if (donation.status !== 'PICKED_UP') {
      return res.status(400).json({
        success: false,
        error: `Donation is not in PICKED_UP status (current status: ${donation.status}).`,
      });
    }

    await pool.query(
      `UPDATE donations SET status = 'DELIVERED', delivered_at = NOW() WHERE id = ? AND volunteer_id = ?`,
      [req.params.id, volId]
    );

    return res.json({ success: true, message: 'Delivery marked! Awaiting NGO confirmation.' });
  } catch (err) { next(err); }
};

// ─── Admin: GET /api/admin/volunteers ─────────────────────────────────────────
const adminListVolunteers = async (req, res, next) => {
  try {
    const [volunteers] = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.created_at,
              vp.vehicle_type, vp.availability, vp.service_area, vp.address,
              (SELECT COUNT(*) FROM donations d WHERE d.volunteer_id = u.id AND d.status = 'COMPLETED') AS completed_count
       FROM users u
       LEFT JOIN volunteer_profiles vp ON vp.user_id = u.id
       WHERE u.role = 'volunteer'
       ORDER BY u.created_at DESC`
    );
    return res.json({ success: true, volunteers });
  } catch (err) { next(err); }
};

module.exports = {
  getVolunteerDashboard,
  getVolunteerProfile,
  upsertVolunteerProfile,
  getAvailablePickups,
  acceptPickup,
  markPickedUp,
  markDelivered,
  adminListVolunteers,
};
