const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getMatchedNGOs, getTopNGO, acceptFromMatch } = require('../controllers/matchingController');

// Accessible by: donor (own donation), ngo, admin
const anyAuth     = [authenticate];
const ngoOrAdmin  = [authenticate, authorize('ngo', 'admin')];
const ngoOnly     = [authenticate, authorize('ngo')];

// ─── GET /api/matching/donations/:id/ngos ────────────────────────────────────
// Returns ranked NGO list for a donation. Access: donor/ngo/admin.
router.get('/matching/donations/:id/ngos', ...anyAuth, getMatchedNGOs);

// ─── GET /api/matching/donations/:id/top-ngo ─────────────────────────────────
// Returns the single best NGO. Access: donor/ngo/admin.
router.get('/matching/donations/:id/top-ngo', ...anyAuth, getTopNGO);

// ─── POST /api/matching/donations/:id/ngos/:ngoId/accept ─────────────────────
// NGO accepts a donation from the match results. Access: ngo only.
router.post('/matching/donations/:id/ngos/:ngoId/accept', ...ngoOnly, acceptFromMatch);

module.exports = router;
