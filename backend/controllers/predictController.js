'use strict';

const mockStore = require('../services/mockStore');
const { predictDemand, predictAllCategories, MAX_LOOK_BACK_MONTHS } = require('../ml/demandPredictor');

/* ── GET /api/ngo/predict ──────────────────────────────────────────────────── */
const predictNgoDemand = async (req, res, next) => {
  try {
    const ngoId = req.user.id;
    const { category, date: dateStr } = req.query;

    let targetDate;
    if (dateStr) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD.' });
      }
      targetDate = new Date(`${dateStr}T00:00:00`);
      if (isNaN(targetDate.getTime())) {
        return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD.' });
      }
      const today = new Date(); today.setHours(0,0,0,0);
      if (targetDate < today) {
        return res.status(400).json({ success: false, error: 'Target date must be today or in the future.' });
      }
    }

    const user = mockStore.findUserById(ngoId);
    const profile = mockStore.findNgoByUserId(ngoId);

    if (!user) return res.status(404).json({ success: false, error: 'NGO not found.' });

    const ngoName = profile ? profile.ngo_name : user.name;
    const city    = profile ? profile.city : 'Bangalore';

    const history = mockStore.getPredictionHistory(ngoId, category);

    let predictions = [];
    if (category) {
      const single = predictDemand(history, {
        ngoId,
        category,
        targetDate,
        ngoName,
        city,
      });
      predictions = [single];
    } else {
      predictions = predictAllCategories(history, {
        ngoId,
        targetDate,
        ngoName,
        city,
      });
    }

    return res.json({
      success: true,
      ngo_id: ngoId,
      total_records: history.length,
      predictions,
    });
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/ngo/predict/categories ──────────────────────────────────────── */
const getPredictionMeta = async (req, res, next) => {
  try {
    const ngoId = req.user.id;
    const history = mockStore.getPredictionHistory(ngoId);

    const counts = {};
    history.forEach((r) => {
      counts[r.food_category] = (counts[r.food_category] || 0) + 1;
    });

    const categories = Object.keys(counts).map((category) => ({
      category,
      completed_count: counts[category],
      has_sufficient_data: counts[category] >= 3,
    }));

    return res.json({
      success: true,
      ngo_id: ngoId,
      look_back_months: MAX_LOOK_BACK_MONTHS,
      categories,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  predictNgoDemand,
  getPredictionMeta,
};
