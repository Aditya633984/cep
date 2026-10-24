const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables reliably from backend/.env and root .env
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const apiRoutes        = require('./routes/index');
const dashboardRoutes  = require('./routes/dashboard');
const donorRoutes      = require('./routes/donor');
const ngoRoutes        = require('./routes/ngo');
const volunteerRoutes  = require('./routes/volunteer');
const matchingRoutes   = require('./routes/matching');
const locationRoutes   = require('./routes/location');
const adminRoutes      = require('./routes/admin');
const errorHandler     = require('./middleware/errorHandler');
const { testConnection } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ─── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      process.env.NODE_ENV !== 'production'
    ) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Static uploads ───────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);
app.use('/api', donorRoutes);      // donor routes
app.use('/api', ngoRoutes);        // ngo routes
app.use('/api', volunteerRoutes);  // volunteer routes
app.use('/api', matchingRoutes);   // smart matching routes
app.use('/api', locationRoutes);   // location / geocoding routes
app.use('/api', adminRoutes);      // admin-only routes
app.use('/api', dashboardRoutes);

// ─── Root ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to FoodBridge API',
    version: '1.0.0',
    docs: '/api/health',
  });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.url} not found` });
});

// ─── Error Handler (must be last) ────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`\n🚀  FoodBridge API running on http://localhost:${PORT}`);
    console.log(`📡  Environment: ${process.env.NODE_ENV || 'development'}\n`);
    await testConnection();
  });
}

module.exports = app;
