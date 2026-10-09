'use strict';
/**
 * FoodBridge – Demand Prediction Engine
 * =============================================================
 * Algorithm: Weighted Moving Average (WMA) + OLS Linear Regression
 *            with day-of-week and month seasonality adjustments.
 *
 * This module is intentionally free of Express/MySQL dependencies.
 * It accepts raw data rows and returns prediction objects.
 *
 * Input features used:
 *   1. ngo_id              – filters history to this NGO
 *   2. food_category       – filters to the requested category
 *   3. historical_qty      – accepted donation quantities over time (COMPLETED)
 *   4. historical_people   – beneficiary count per completed donation
 *   5. recency_weight      – WMA gives higher weight to recent observations
 *   6. day_of_week         – 0 (Sun)–6 (Sat), derived from targetDate
 *   7. month               – 1–12, derived from targetDate
 *   8. city                – NGO city (context only, not a numeric feature)
 *
 * Output: { status, predicted_qty, predicted_qty_low, predicted_qty_high,
 *           predicted_people, confidence, data_points, factors, message, ... }
 *
 * Minimum data threshold: MIN_OBSERVATIONS = 3
 */

const MIN_OBSERVATIONS     = 3;
const MAX_LOOK_BACK_MONTHS = 12;

/* Day-of-week demand index (Sun=0 … Sat=6). Average day = 1.0 */
const DOW_FACTOR = [0.88, 1.05, 1.08, 1.07, 1.05, 0.97, 0.90];

/* Monthly demand index (1=Jan … 12=Dec). Cold / festive months higher in India. */
const MONTH_FACTOR = [
  0.0,  // placeholder — 1-indexed
  1.05, 1.02, 1.00, 0.97, 0.95, 0.96, 0.98, 1.00, 1.02, 1.04, 1.06, 1.08,
];

/* ── Math helpers ──────────────────────────────────────────────────────────── */
function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / (arr.length - 1));
}

function weightedMovingAverage(values) {
  const n = values.length;
  if (!n) return 0;
  let ws = 0, wt = 0;
  for (let i = 0; i < n; i++) { const w = i + 1; ws += values[i] * w; wt += w; }
  return ws / wt;
}

function linearRegression(xs, ys) {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0 };
  const mx = mean(xs), my = mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i]-mx)*(ys[i]-my); den += Math.pow(xs[i]-mx,2); }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: my - slope * mx };
}

function rSquared(xs, ys, slope, intercept) {
  const my = mean(ys);
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < xs.length; i++) {
    ssTot += Math.pow(ys[i] - my, 2);
    ssRes += Math.pow(ys[i] - (intercept + slope * xs[i]), 2);
  }
  return ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
}

/* ── Main prediction function ─────────────────────────────────────────────── */
/**
 * @param {object[]} rows – DB rows with fields: accepted_at, quantity, people_served, food_category, city
 * @param {object}   params – { category, ngoName, city, targetDate }
 */
function predictDemand(rows, { category, ngoName, city, targetDate } = {}) {
  const catRows = rows.filter((r) => r.food_category === category);

  if (catRows.length < MIN_OBSERVATIONS) {
    return {
      status:          'insufficient_data',
      predicted_qty:   null,
      data_points:     catRows.length,
      required_points: MIN_OBSERVATIONS,
      algorithm:       'N/A – minimum data threshold not met',
      category, ngo: ngoName, city,
      message: catRows.length === 0
        ? `No historical data for "${category}". At least ${MIN_OBSERVATIONS} completed donations needed.`
        : `Only ${catRows.length} data point(s) for "${category}". Need at least ${MIN_OBSERVATIONS}.`,
    };
  }

  const sorted = [...catRows].sort((a, b) => new Date(a.accepted_at) - new Date(b.accepted_at));
  const qtyArr    = sorted.map((r) => parseFloat(r.quantity) || 0);
  const peopleArr = sorted.map((r) => parseInt(r.people_served, 10) || 0);
  const idxArr    = sorted.map((_, i) => i);

  const target  = targetDate || (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })();
  const dow     = target.getDay();
  const month   = target.getMonth() + 1;
  const dowAdj  = DOW_FACTOR[dow]  || 1.0;
  const monAdj  = MONTH_FACTOR[month] || 1.0;

  const wma                    = weightedMovingAverage(qtyArr);
  const wmaAdj                 = wma * dowAdj * monAdj;
  const { slope, intercept }   = linearRegression(idxArr, qtyArr);
  const trendRaw               = intercept + slope * sorted.length;
  const trendAdj               = trendRaw * dowAdj * monAdj;
  const blended                = 0.70 * wmaAdj + 0.30 * Math.max(0, trendAdj);
  const sigma                  = stddev(qtyArr);
  const r2                     = rSquared(idxArr, qtyArr, slope, intercept);
  const n                      = sorted.length;

  let confidence;
  if (n >= 10 && r2 >= 0.6 && sigma / (wma || 1) < 0.3)  confidence = 'high';
  else if (n >= 5 && r2 >= 0.3)                           confidence = 'medium';
  else                                                     confidence = 'low';

  const validPeople   = peopleArr.filter((v) => v > 0);
  const avgPeople     = mean(validPeople);
  const ratio         = wma > 0 && avgPeople > 0 ? avgPeople / wma : null;
  const predPeople    = ratio !== null ? Math.round(blended * ratio) : null;

  const pred = Math.round(blended);
  const low  = Math.max(0, Math.round(blended - sigma));
  const high = Math.round(blended + sigma);

  const DOW_LABELS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTH_LABELS = ['','January','February','March','April','May','June',
                        'July','August','September','October','November','December'];

  const targetYear = target.getFullYear();
  const targetMonthStr = String(target.getMonth() + 1).padStart(2, '0');
  const targetDayStr = String(target.getDate()).padStart(2, '0');
  const targetDateStr = `${targetYear}-${targetMonthStr}-${targetDayStr}`;

  return {
    status:             'ok',
    predicted_qty:      pred,
    predicted_qty_low:  low,
    predicted_qty_high: high,
    predicted_people:   predPeople,
    confidence,
    data_points:        n,
    r_squared:          parseFloat(r2.toFixed(3)),
    algorithm: 'Weighted Moving Average (70%) + OLS Linear Regression (30%), with day-of-week & month seasonality',
    category, ngo: ngoName, city,
    target_date: targetDateStr,
    factors: {
      wma_estimate:    parseFloat(wma.toFixed(2)),
      trend_slope:     parseFloat(slope.toFixed(4)),
      trend_estimate:  parseFloat(trendRaw.toFixed(2)),
      day_of_week:     DOW_LABELS[dow],
      day_factor:      dowAdj,
      month:           MONTH_LABELS[month],
      month_factor:    monAdj,
      std_deviation:   parseFloat(sigma.toFixed(2)),
      historical_mean: parseFloat(mean(qtyArr).toFixed(2)),
      historical_min:  Math.min(...qtyArr),
      historical_max:  Math.max(...qtyArr),
      people_per_unit: ratio !== null ? parseFloat(ratio.toFixed(2)) : null,
    },
    message: `Predicted demand for ${category} on ${DOW_LABELS[dow]}, ${MONTH_LABELS[month]}: ~${pred} units (${low}–${high} range). Confidence: ${confidence}. Based on ${n} data points.`,
  };
}

/**
 * Predict for all categories the NGO has history for.
 * @param {object[]} rows
 * @param {object}   params – { ngoName, city, targetDate }
 * @returns {object[]}
 */
function predictAllCategories(rows, params = {}) {
  const categories = [...new Set(rows.map((r) => r.food_category))];
  return categories.map((cat) => predictDemand(rows, { ...params, category: cat }));
}

module.exports = { predictDemand, predictAllCategories, MIN_OBSERVATIONS, MAX_LOOK_BACK_MONTHS };
