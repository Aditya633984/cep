'use strict';

/**
 * FoodBridge – Demand Prediction Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * Endpoints:
 *   GET /api/ngo/predict              – predict for all categories (default: tomorrow)
 *   GET /api/ngo/predict?category=X  – predict for a specific category
 *   GET /api/ngo/predict?date=YYYY-MM-DD – predict for a specific future date
 */

const { pool }              = require('../config/db');
const { predictDemand, predictAllCategories, MAX_LOOK_BACK_MONTHS } = require('../ml/demandPredictor');

/* ── GET /api/ngo/predict ──────────────────────────────────────────────────── */
const predictNgoDemand = async (req, res, next) => {
  try {
    const ngoId = req.user.id;
    const { category, date: dateStr } = req.query;

    // ── Target date ────────────────────────────────────────────────────────────
    let targetDate;
    if (dateStr) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD.' });
      }
      targetDate = new Date(`${dateStr}T00:00:00`);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD.' });
      }
      // Clamp: do not allow past dates (would mislead about future demand)
      const today = new Date(); today.setHours(0,0,0,0);
      if (targetDate < today) {
        return res.status(400).json({ success: false, error: 'Target date must be today or in the future.' });
      }
    }

    // ── Fetch NGO profile ──────────────────────────────────────────────────────
    const [[ngo]] = await pool.query(
      `SELECT u.name, np.ngo_name, np.city, np.verification_status
       FROM users u
       LEFT JOIN ngo_profiles np ON np.user_id = u.id
       WHERE u.id = ?`,
      [ngoId]
    );

    if (!ngo) return res.status(404).json({ success: false, error: 'NGO not found.' });

    const ngoName = ngo.ngo_name || ngo.name;
    const city    = ngo.city || 'Unknown';

    // ── Fetch historical donation data ─────────────────────────────────────────
    // We use COMPLETED/DELIVERED donations accepted by this NGO within the
    // look-back window. These represent actual food handled by the NGO.
    const [rows] = await pool.query(
      `SELECT
          d.food_category,
          d.quantity,
          d.unit,
          d.people_served,
          d.city      AS donation_city,
          d.accepted_at,
          d.received_at
       FROM donations d
       WHERE d.ngo_id = ?
         AND d.status IN ('COMPLETED','DELIVERED','PICKED_UP')
         AND d.accepted_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
       ORDER BY d.accepted_at ASC`,
      [ngoId, MAX_LOOK_BACK_MONTHS]
    );

    // ── Summary metadata ───────────────────────────────────────────────────────
    const totalRecords = rows.length;
    const categorySet  = [...new Set(rows.map((r) => r.food_category))];

    // ── Run predictions ────────────────────────────────────────────────────────
    const params = { ngoName, city, targetDate };
    let predictions;

    if (category) {
      // Single category prediction
      predictions = [predictDemand(rows, { ...params, category })];
    } else {
      // All categories the NGO has history for
      if (totalRecords === 0) {
        // No data at all
        predictions = [];
      } else {
        predictions = predictAllCategories(rows, params);
      }
    }

    // ── Response ───────────────────────────────────────────────────────────────
    return res.json({
      success:        true,
      ngo_name:       ngoName,
      city,
      total_records:  totalRecords,
      categories_with_data: categorySet,
      look_back_months: MAX_LOOK_BACK_MONTHS,
      predictions,
      generated_at:   new Date().toISOString(),
    });

  } catch (err) { next(err); }
};

/* ── GET /api/ngo/predict/categories ─────────────────────────────────────────
   Returns available food categories with their data-point counts, so the
   frontend can show which categories have enough data before making a request.  */
const getPredictionMeta = async (req, res, next) => {
  try {
    const ngoId = req.user.id;

    const [rows] = await pool.query(
      `SELECT food_category, COUNT(*) AS count,
              COALESCE(SUM(quantity), 0) AS total_qty,
              COALESCE(SUM(people_served), 0) AS total_people,
              MIN(accepted_at) AS first_donation,
              MAX(accepted_at) AS last_donation
       FROM donations
       WHERE ngo_id = ?
         AND status IN ('COMPLETED','DELIVERED','PICKED_UP')
         AND accepted_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
       GROUP BY food_category
       ORDER BY count DESC`,
      [ngoId, MAX_LOOK_BACK_MONTHS]
    );

    const categories = rows.map((r) => ({
      category:        r.food_category,
      data_points:     Number(r.count),
      total_qty:       parseFloat(r.total_qty),
      total_people:    parseInt(r.total_people, 10),
      has_enough_data: Number(r.count) >= 3,
      first_donation:  r.first_donation,
      last_donation:   r.last_donation,
    }));

    return res.json({
      success:    true,
      categories,
      look_back_months: MAX_LOOK_BACK_MONTHS,
    });
  } catch (err) { next(err); }
};

module.exports = { predictNgoDemand, getPredictionMeta };
