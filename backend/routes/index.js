const express       = require('express');
const router        = express.Router();
const authRoutes    = require('./auth');

// ─── Health Check ─────────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    message: 'FoodBridge API is running',
    timestamp: new Date().toISOString(),
  });
});

// ─── Auth Routes (/api/auth/...) ──────────────────────────────────────────────
router.use('/auth', authRoutes);

// ─── Placeholder Route Stubs (to be implemented in later stages) ─────────────
router.use('/users', (req, res) => {
  res.status(501).json({ success: false, message: 'User routes not yet implemented' });
});

router.use('/ngos', (req, res) => {
  res.status(501).json({ success: false, message: 'NGO routes not yet implemented' });
});

module.exports = router;
