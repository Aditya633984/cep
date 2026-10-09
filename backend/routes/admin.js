'use strict';

const express  = require('express');
const router   = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getStats,
  getUsers,
  getUserDetail,
  getNgos,
  getNgoDetail,
  updateNgoVerification,
  getDonations,
  getDonationDetail,
  getVolunteers,
} = require('../controllers/adminController');

// All admin routes require authentication AND admin role
const adminOnly = [authenticate, authorize('admin')];

// ─── Stats ────────────────────────────────────────────────────────────────────
router.get('/admin/stats',               ...adminOnly, getStats);

// ─── Users ────────────────────────────────────────────────────────────────────
router.get('/admin/users',               ...adminOnly, getUsers);
router.get('/admin/users/:id',           ...adminOnly, getUserDetail);

// ─── NGOs ─────────────────────────────────────────────────────────────────────
router.get('/admin/ngos',                ...adminOnly, getNgos);
router.get('/admin/ngos/:id',            ...adminOnly, getNgoDetail);
router.patch('/admin/ngos/:id/verify',   ...adminOnly, updateNgoVerification);

// ─── Donations ────────────────────────────────────────────────────────────────
router.get('/admin/donations',           ...adminOnly, getDonations);
router.get('/admin/donations/:id',       ...adminOnly, getDonationDetail);

// ─── Volunteers ───────────────────────────────────────────────────────────────
router.get('/admin/volunteers',          ...adminOnly, getVolunteers);

module.exports = router;
