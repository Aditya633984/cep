const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getVolunteerDashboard,
  getVolunteerProfile,
  upsertVolunteerProfile,
  getAvailablePickups,
  acceptPickup,
  markPickedUp,
  markDelivered,
  adminListVolunteers,
} = require('../controllers/volunteerController');

const volunteerOnly = [authenticate, authorize('volunteer')];
const adminOnly     = [authenticate, authorize('admin')];

// ─── Volunteer Dashboard ───────────────────────────────────────────────────────
router.get('/volunteer/dashboard', ...volunteerOnly, getVolunteerDashboard);

// ─── Volunteer Profile ─────────────────────────────────────────────────────────
router.get('/volunteer/profile', ...volunteerOnly, getVolunteerProfile);
router.put('/volunteer/profile', ...volunteerOnly, upsertVolunteerProfile);

// ─── Available Pickup Requests ─────────────────────────────────────────────────
// GET /api/volunteer/pickups/available?city=
router.get('/volunteer/pickups/available', ...volunteerOnly, getAvailablePickups);

// ─── Pickup Status Updates ─────────────────────────────────────────────────────
// POST /api/volunteer/pickups/:id/accept   → VOLUNTEER_ASSIGNED
// POST /api/volunteer/pickups/:id/pickup   → PICKED_UP
// POST /api/volunteer/pickups/:id/deliver  → DELIVERED
router.post('/volunteer/pickups/:id/accept',  ...volunteerOnly, acceptPickup);
router.post('/volunteer/pickups/:id/pickup',  ...volunteerOnly, markPickedUp);
router.post('/volunteer/pickups/:id/deliver', ...volunteerOnly, markDelivered);

// ─── Admin ─────────────────────────────────────────────────────────────────────
// GET /api/admin/volunteers
router.get('/admin/volunteers', ...adminOnly, adminListVolunteers);

module.exports = router;
