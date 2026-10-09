/**
 * FoodBridge – Location Routes
 * ============================
 * Routes:
 *   GET  /api/location/status           → check if Google Maps API is configured
 *   POST /api/location/geocode          → geocode an address (requires auth)
 *   GET  /api/location/donation/:id     → get pickup coords for a donation (role-restricted)
 *   GET  /api/location/ngo/:id          → get approximate NGO location (city only, not precise coords)
 */

'use strict';

const express   = require('express');
const router    = express.Router();
const { pool }  = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { geocodeAddress, haversineDistance, isGoogleMapsConfigured } = require('../utils/locationHelper');

// ─── GET /api/location/status ─────────────────────────────────────────────────
/**
 * Returns whether Google Maps API is configured.
 * Frontend uses this to show/hide the "Geocode" button.
 */
router.get('/location/status', (req, res) => {
  res.json({
    success:         true,
    google_maps_api: isGoogleMapsConfigured(),
    message:         isGoogleMapsConfigured()
      ? 'Google Maps Geocoding API is active.'
      : 'No Google Maps API key found. Location features use city/address text matching.',
  });
});

// ─── POST /api/location/geocode ───────────────────────────────────────────────
/**
 * Geocode an address string.
 * Body: { address: string }
 * Returns: { lat, lng, formatted_address } or { geocoded: false, reason: string }
 *
 * Requires auth — to prevent anonymous abuse.
 */
router.post('/location/geocode', authenticate, async (req, res) => {
  const { address } = req.body;
  if (!address || !address.trim()) {
    return res.status(400).json({ success: false, error: 'address is required.' });
  }

  if (!isGoogleMapsConfigured()) {
    return res.json({
      success:  true,
      geocoded: false,
      reason:   'Google Maps API key not configured. Coordinate-based distance unavailable.',
    });
  }

  const result = await geocodeAddress(address.trim());
  if (!result) {
    return res.json({
      success:  true,
      geocoded: false,
      reason:   'Could not geocode address. Check the address or API key quota.',
    });
  }

  return res.json({
    success:   true,
    geocoded:  true,
    lat:       result.lat,
    lng:       result.lng,
    formatted: result.formatted_address,
  });
});

// ─── GET /api/location/donation/:id ──────────────────────────────────────────
/**
 * Returns pickup location for a donation.
 * Donors see their own donation's full address.
 * NGOs / volunteers see city + pickup address (no precise coords exposed).
 * Admins see everything.
 */
router.get('/location/donation/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.id, d.donor_id, d.ngo_id, d.volunteer_id,
              d.pickup_address, d.city, d.lat, d.lng, d.status,
              u.name AS donor_name
       FROM donations d
       JOIN users u ON u.id = d.donor_id
       WHERE d.id = ?`,
      [req.params.id]
    );

    const d = rows[0];
    if (!d) return res.status(404).json({ success: false, error: 'Donation not found.' });

    const { role, id: userId } = req.user;

    // Access: donor (own), NGO assigned, volunteer assigned, admin
    const canView =
      role === 'admin' ||
      (role === 'donor' && d.donor_id === userId) ||
      (role === 'ngo' && d.ngo_id === userId) ||
      (role === 'volunteer' && d.volunteer_id === userId) ||
      (role === 'ngo' && d.status === 'POSTED'); // NGOs browsing

    if (!canView) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    // Build safe response — never expose precise coords publicly
    const response = {
      success:         true,
      donation_id:     d.id,
      pickup_address:  d.pickup_address,
      city:            d.city,
      has_coordinates: Boolean(d.lat && d.lng),
    };

    // Only return coords to admin or the donor themselves
    if ((role === 'admin' || (role === 'donor' && d.donor_id === userId)) && d.lat) {
      response.lat = parseFloat(d.lat);
      response.lng = parseFloat(d.lng);
    }

    return res.json(response);
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── GET /api/location/ngo/:id ────────────────────────────────────────────────
/**
 * Returns public location information for an NGO.
 * Returns city + address only — no precise coordinates.
 * Used by volunteers and donors to know where to deliver.
 */
router.get('/location/ngo/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT np.user_id, np.ngo_name, np.address, np.city, np.operating_area,
              np.lat AS ngo_lat, np.lng AS ngo_lng
       FROM ngo_profiles np
       WHERE np.user_id = ?`,
      [req.params.id]
    );
    const ngo = rows[0];
    if (!ngo) return res.status(404).json({ success: false, error: 'NGO not found.' });

    return res.json({
      success:         true,
      ngo_id:          ngo.user_id,
      ngo_name:        ngo.ngo_name,
      address:         ngo.address,
      city:            ngo.city,
      operating_area:  ngo.operating_area,
      has_coordinates: Boolean(ngo.ngo_lat && ngo.ngo_lng),
      // Coordinates not returned publicly for NGO privacy
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── POST /api/location/distance ─────────────────────────────────────────────
/**
 * Calculate distance between a donation and an NGO.
 * Returns distance in km if both have coordinates, else city-based estimate.
 * Body: { donation_id, ngo_id }
 */
router.post('/location/distance', authenticate, async (req, res) => {
  try {
    const { donation_id, ngo_id } = req.body;
    if (!donation_id || !ngo_id) {
      return res.status(400).json({ success: false, error: 'donation_id and ngo_id are required.' });
    }

    const [[donation]] = await pool.query(
      `SELECT city, lat, lng FROM donations WHERE id = ?`, [donation_id]
    );
    const [[ngo]] = await pool.query(
      `SELECT city, lat AS ngo_lat, lng AS ngo_lng FROM ngo_profiles WHERE user_id = ?`, [ngo_id]
    );

    if (!donation || !ngo) {
      return res.status(404).json({ success: false, error: 'Donation or NGO not found.' });
    }

    if (donation.lat && donation.lng && ngo.ngo_lat && ngo.ngo_lng) {
      const km = haversineDistance(
        parseFloat(donation.lat), parseFloat(donation.lng),
        parseFloat(ngo.ngo_lat), parseFloat(ngo.ngo_lng)
      );
      return res.json({
        success: true,
        method: 'haversine',
        distance_km: km,
        message: `${km} km (GPS-accurate)`,
      });
    }

    // Fallback city-based estimate
    const donCity = (donation.city || '').toLowerCase().trim();
    const ngoCity = (ngo.city     || '').toLowerCase().trim();
    let estimate, label;
    if (donCity && ngoCity && donCity === ngoCity) { estimate = 2;   label = 'Same city (~2 km estimated)'; }
    else if (donCity && ngoCity)                   { estimate = null; label = 'Different cities (distance unknown)'; }
    else                                           { estimate = null; label = 'Location data incomplete'; }

    return res.json({
      success:     true,
      method:      'city-text',
      distance_km: estimate,
      message:     label,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Server error.' });
  }
});

module.exports = router;
