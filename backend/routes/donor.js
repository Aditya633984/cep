const express    = require('express');
const router     = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload     = require('../middleware/upload');
const {
  createDonation,
  getDonations,
  getDonationById,
  updateDonation,
  cancelDonation,
  getDonorDashboard,
} = require('../controllers/donationController');

const donorOnly = [authenticate, authorize('donor')];

// ─── Dashboard ────────────────────────────────────────────────────────────────
// GET /api/donor/dashboard  (overrides the basic one in dashboard.js)
router.get('/donor/dashboard', authenticate, authorize('donor', 'admin'), getDonorDashboard);

// ─── Donations CRUD ───────────────────────────────────────────────────────────
// POST   /api/donor/donations          – create
// GET    /api/donor/donations          – list (with ?status=&page=&limit=)
// GET    /api/donor/donations/:id      – detail
// PUT    /api/donor/donations/:id      – edit (POSTED only)
// DELETE /api/donor/donations/:id      – cancel (POSTED only)

router.post(
  '/donor/donations',
  ...donorOnly,
  upload.single('food_image'),
  createDonation
);

router.get('/donor/donations',       ...donorOnly, getDonations);
router.get('/donor/donations/:id',   ...donorOnly, getDonationById);

router.put(
  '/donor/donations/:id',
  ...donorOnly,
  upload.single('food_image'),
  updateDonation
);

router.delete('/donor/donations/:id', ...donorOnly, cancelDonation);

module.exports = router;
