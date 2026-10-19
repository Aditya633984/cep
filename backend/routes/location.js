'use strict';

const express   = require('express');
const router    = express.Router();
const mockStore = require('../services/mockStore');
const { authenticate } = require('../middleware/auth');
const { geocodeAddress, haversineDistance, isGoogleMapsConfigured } = require('../utils/locationHelper');

// ─── GET /api/location/status ─────────────────────────────────────────────────
router.get('/location/status', (_req, res) => {
  res.json({
    success:         true,
    google_maps_api: isGoogleMapsConfigured(),
    message:         isGoogleMapsConfigured()
      ? 'Google Maps Geocoding API is active.'
      : 'No Google Maps API key found. Location features use city/address text matching.',
  });
});

// ─── POST /api/location/geocode ───────────────────────────────────────────────
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
      reason:   'Geocoding returned no results for this address.',
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
router.get('/location/donation/:id', authenticate, async (req, res) => {
  try {
    const d = mockStore.findDonationById(req.params.id);
    if (!d) return res.status(404).json({ success: false, error: 'Donation not found.' });

    const { role, id: userId } = req.user;

    const canView =
      role === 'admin' ||
      (role === 'donor' && d.donor_id === userId) ||
      (role === 'ngo' && d.ngo_id === userId) ||
      (role === 'volunteer' && d.volunteer_id === userId) ||
      (role === 'ngo' && d.status === 'POSTED');

    if (!canView) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    const response = {
      success:         true,
      donation_id:     d.id,
      pickup_address:  d.pickup_address,
      city:            d.city,
      has_coordinates: Boolean(d.lat && d.lng),
    };

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
router.get('/location/ngo/:id', authenticate, async (req, res) => {
  try {
    const ngo = mockStore.findNgoByUserId(req.params.id) || mockStore.findNgoById(req.params.id);
    if (!ngo) return res.status(404).json({ success: false, error: 'NGO not found.' });

    return res.json({
      success:         true,
      ngo_id:          ngo.user_id,
      ngo_name:        ngo.ngo_name,
      address:         ngo.address,
      city:            ngo.city,
      operating_area:  ngo.operating_area,
      has_coordinates: Boolean(ngo.lat && ngo.lng),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// ─── POST /api/location/distance ─────────────────────────────────────────────
router.post('/location/distance', authenticate, async (req, res) => {
  try {
    const { donation_id, ngo_id } = req.body;
    if (!donation_id || !ngo_id) {
      return res.status(400).json({ success: false, error: 'donation_id and ngo_id are required.' });
    }

    const donation = mockStore.findDonationById(donation_id);
    const ngo = mockStore.findNgoByUserId(ngo_id) || mockStore.findNgoById(ngo_id);

    if (!donation || !ngo) {
      return res.status(404).json({ success: false, error: 'Donation or NGO not found.' });
    }

    if (donation.lat && donation.lng && ngo.lat && ngo.lng) {
      const km = haversineDistance(
        parseFloat(donation.lat), parseFloat(donation.lng),
        parseFloat(ngo.lat), parseFloat(ngo.lng)
      );
      return res.json({
        success: true,
        method: 'haversine',
        distance_km: km,
        message: `${km} km (GPS-accurate)`,
      });
    }

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
