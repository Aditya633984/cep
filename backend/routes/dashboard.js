'use strict';

const express         = require('express');
const router          = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const mockStore       = require('../services/mockStore');

const dashboardResponse = (role, user, extra = {}) => ({
  success: true,
  role,
  user: {
    id:    user.id,
    name:  user.name || user.email,
    email: user.email,
    role:  user.role,
  },
  message: `Welcome to the ${role.charAt(0).toUpperCase() + role.slice(1)} Dashboard`,
  ...extra,
});

// ─── Donor Dashboard ──────────────────────────────────────────────────────────
router.get(
  '/donor/dashboard-basic',
  authenticate,
  authorize('donor'),
  async (req, res, next) => {
    try {
      const user = mockStore.findUserById(req.user.id);
      res.json(dashboardResponse('donor', user));
    } catch (err) { next(err); }
  }
);

// ─── NGO Dashboard ────────────────────────────────────────────────────────────
router.get(
  '/ngo/dashboard-basic',
  authenticate,
  authorize('ngo'),
  async (req, res, next) => {
    try {
      const user = mockStore.findUserById(req.user.id);
      const profile = mockStore.findNgoByUserId(req.user.id);
      res.json(dashboardResponse('ngo', user, { ngo_profile: profile }));
    } catch (err) { next(err); }
  }
);

// ─── Volunteer Dashboard ──────────────────────────────────────────────────────
router.get(
  '/volunteer/dashboard-basic',
  authenticate,
  authorize('volunteer'),
  async (req, res, next) => {
    try {
      const user = mockStore.findUserById(req.user.id);
      res.json(dashboardResponse('volunteer', user));
    } catch (err) { next(err); }
  }
);

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
router.get(
  '/admin/dashboard',
  authenticate,
  authorize('admin'),
  async (req, res, next) => {
    try {
      const user = mockStore.findUserById(req.user.id);
      const stats = mockStore.getAdminStats();
      const users = mockStore.getUsers().map(({ password, ...u }) => u);
      const donations = mockStore.getDonations().map((d) => mockStore.hydrateDonation(d));

      res.json(dashboardResponse('admin', user, {
        stats: stats.totals,
        users,
        donations,
      }));
    } catch (err) { next(err); }
  }
);

module.exports = router;
