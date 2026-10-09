const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
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
} = require('../controllers/ngoController');
const { predictNgoDemand, getPredictionMeta } = require('../controllers/predictController');

const ngoOnly   = [authenticate, authorize('ngo')];
const adminOnly = [authenticate, authorize('admin')];

// ─── NGO Dashboard ────────────────────────────────────────────────────────────
// GET /api/ngo/dashboard   (overrides the stub in dashboard.js)
router.get('/ngo/dashboard', ...ngoOnly, getNgoDashboard);

// ─── NGO Profile ──────────────────────────────────────────────────────────────
// GET   /api/ngo/profile
// PUT   /api/ngo/profile        (create or update)
// PATCH /api/ngo/availability   (quick availability toggle)
router.get('/ngo/profile',        ...ngoOnly, getNgoProfile);
router.put('/ngo/profile',        ...ngoOnly, upsertNgoProfile);
router.patch('/ngo/availability', ...ngoOnly, toggleAvailability);

// ─── Browse available donations ───────────────────────────────────────────────
// GET /api/ngo/donations/available?category=&food_type=&min_qty=&max_qty=&city=&expiry_hours=
router.get('/ngo/donations/available', ...ngoOnly, getAvailableDonations);

// ─── Accepted donations ───────────────────────────────────────────────────────
// GET /api/ngo/donations/accepted?status=
router.get('/ngo/donations/accepted',  ...ngoOnly, getAcceptedDonations);

// ─── Single donation detail ───────────────────────────────────────────────────
// GET /api/ngo/donations/:id
router.get('/ngo/donations/:id', ...ngoOnly, getDonationDetail);

// ─── Actions ──────────────────────────────────────────────────────────────────
// POST /api/ngo/donations/:id/accept
// POST /api/ngo/donations/:id/reject    body: { reason? }
// POST /api/ngo/donations/:id/received
router.post('/ngo/donations/:id/accept',   ...ngoOnly, acceptDonation);
router.post('/ngo/donations/:id/reject',   ...ngoOnly, rejectDonation);
router.post('/ngo/donations/:id/received', ...ngoOnly, markReceived);

// ─── Demand Prediction (AI/ML) ───────────────────────────────────────────────
// GET /api/ngo/predict                        – predict all categories (default: tomorrow)
// GET /api/ngo/predict?category=X            – predict a specific category
// GET /api/ngo/predict?date=YYYY-MM-DD       – predict for a specific future date
// GET /api/ngo/predict/categories             – metadata: data points per category
router.get('/ngo/predict/categories', ...ngoOnly, getPredictionMeta);
router.get('/ngo/predict',            ...ngoOnly, predictNgoDemand);

// ─── Admin – NGO management ───────────────────────────────────────────────────
// GET   /api/admin/ngos
// PATCH /api/admin/ngos/:id/verify   body: { status: 'pending'|'verified'|'rejected' }
router.get('/admin/ngos',               ...adminOnly, adminListNgos);
router.patch('/admin/ngos/:id/verify',  ...adminOnly, adminVerifyNgo);

module.exports = router;
