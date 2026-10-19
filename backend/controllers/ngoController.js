'use strict';

const mockStore = require('../services/mockStore');

// ─── GET /api/ngo/dashboard ───────────────────────────────────────────────────
const getNgoDashboard = async (req, res, next) => {
  try {
    const data = mockStore.getNgoDashboardStats(req.user.id);
    return res.json({
      success: true,
      ...data,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/ngo/profile ─────────────────────────────────────────────────────
const getNgoProfile = async (req, res, next) => {
  try {
    const user = mockStore.findUserById(req.user.id);
    let profile = mockStore.findNgoByUserId(req.user.id);

    if (!profile) {
      profile = mockStore.upsertNgoProfile(req.user.id, {
        ngo_name: user ? user.name : 'My NGO',
        phone: user ? user.phone : '',
        email: user ? user.email : '',
      });
    }

    return res.json({
      success: true,
      profile: {
        ...profile,
        name: user ? user.name : '',
        user_email: user ? user.email : '',
        user_phone: user ? user.phone : '',
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/ngo/profile ─────────────────────────────────────────────────────
const upsertNgoProfile = async (req, res, next) => {
  try {
    const {
      ngo_name, founder, address, city, phone, email,
      food_types, operating_area, max_food_capacity, lat, lng,
    } = req.body;

    const profile = mockStore.upsertNgoProfile(req.user.id, {
      ngo_name, founder, address, city, phone, email,
      food_types, operating_area,
      max_food_capacity: max_food_capacity ? parseFloat(max_food_capacity) : 100,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
    });

    const user = mockStore.findUserById(req.user.id);

    return res.json({
      success: true,
      message: 'NGO profile updated successfully.',
      profile: {
        ...profile,
        name: user ? user.name : '',
        user_email: user ? user.email : '',
        user_phone: user ? user.phone : '',
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/ngo/availability ──────────────────────────────────────────────
const toggleAvailability = async (req, res, next) => {
  try {
    const rawVal = mockStore.toggleNgoAvailability(req.user.id);
    const is_available = rawVal === 1 || rawVal === true;
    return res.json({
      success: true,
      message: `Availability updated to ${is_available ? 'Available' : 'Unavailable'}.`,
      is_available,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/ngo/donations/available ─────────────────────────────────────────
const getAvailableDonations = async (req, res, next) => {
  try {
    const { category, food_type, min_qty, max_qty, city } = req.query;

    let list = mockStore.getDonations((d) => {
      if (d.status !== 'POSTED') return false;
      if (category && d.food_category !== category) return false;
      if (food_type && d.food_type !== food_type) return false;
      if (city && !d.city.toLowerCase().includes(city.toLowerCase())) return false;
      if (min_qty && d.quantity < parseFloat(min_qty)) return false;
      if (max_qty && d.quantity > parseFloat(max_qty)) return false;
      return true;
    });

    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const hydrated = list.map((d) => mockStore.hydrateDonation(d));
    return res.json({
      success: true,
      donations: hydrated,
      total: hydrated.length,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/ngo/donations/accepted ──────────────────────────────────────────
const getAcceptedDonations = async (req, res, next) => {
  try {
    const ngoId = Number(req.user.id);
    const { status } = req.query;

    let list = mockStore.getDonations((d) => {
      if (d.ngo_id !== ngoId) return false;
      if (status && d.status !== status) return false;
      return true;
    });

    list.sort((a, b) => new Date(b.accepted_at || b.created_at) - new Date(a.accepted_at || a.created_at));

    const hydrated = list.map((d) => mockStore.hydrateDonation(d));
    return res.json({
      success: true,
      donations: hydrated,
      total: hydrated.length,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/ngo/donations/:id ───────────────────────────────────────────────
const getDonationDetail = async (req, res, next) => {
  try {
    const donation = mockStore.findDonationById(req.params.id);
    if (!donation) {
      return res.status(404).json({ success: false, error: 'Donation not found.' });
    }

    return res.json({
      success: true,
      donation: mockStore.hydrateDonation(donation),
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/ngo/donations/:id/accept ───────────────────────────────────────
const acceptDonation = async (req, res, next) => {
  try {
    const donation = mockStore.findDonationById(req.params.id);
    if (!donation) {
      return res.status(404).json({ success: false, error: 'Donation not found.' });
    }

    const profile = mockStore.findNgoByUserId(req.user.id);
    if (profile && profile.verification_status === 'rejected') {
      return res.status(403).json({ success: false, error: 'NGO verification was rejected.' });
    }

    if (profile && (profile.is_available === 0 || profile.is_available === false)) {
      return res.status(400).json({ success: false, error: 'NGO is currently marked as unavailable.' });
    }

    if (donation.status !== 'POSTED') {
      return res.status(400).json({
        success: false,
        error: `Donation is not available for acceptance (current status: "${donation.status}").`,
      });
    }

    if (donation.best_before && new Date(donation.best_before) < new Date()) {
      return res.status(400).json({ success: false, error: 'Cannot accept expired donation.' });
    }

    if (donation.food_type === 'non-vegetarian' && profile && profile.food_types) {
      const ft = profile.food_types.toLowerCase();
      if (ft.includes('vegetarian') && !ft.includes('non-vegetarian') && !ft.includes('meat') && !ft.includes('all')) {
        return res.status(400).json({ success: false, error: 'Incompatible food type: NGO only accepts vegetarian food.' });
      }
    }

    const updated = mockStore.updateDonation(donation.id, {
      status: 'ACCEPTED',
      ngo_id: req.user.id,
      accepted_at: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: 'Donation accepted successfully.',
      donation: mockStore.hydrateDonation(updated),
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/ngo/donations/:id/reject ───────────────────────────────────────
const rejectDonation = async (req, res, next) => {
  try {
    const donation = mockStore.findDonationById(req.params.id);
    if (!donation) {
      return res.status(404).json({ success: false, error: 'Donation not found.' });
    }

    const updated = mockStore.updateDonation(donation.id, {
      status: 'POSTED',
      ngo_id: null,
      reject_reason: req.body.reason || 'Declined by NGO',
    });

    return res.json({
      success: true,
      message: 'Donation rejected and made available again.',
      donation: mockStore.hydrateDonation(updated),
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/ngo/donations/:id/received ─────────────────────────────────────
const markReceived = async (req, res, next) => {
  try {
    const donation = mockStore.findDonationById(req.params.id);
    if (!donation) {
      return res.status(404).json({ success: false, error: 'Donation not found.' });
    }

    if (donation.ngo_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    const updated = mockStore.updateDonation(donation.id, {
      status: 'COMPLETED',
      received_at: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: 'Donation marked as received and completed.',
      donation: mockStore.hydrateDonation(updated),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Admin list and verification ─────────────────────────────────────────────
const adminListNgos = async (req, res, next) => {
  try {
    const profiles = mockStore.getNgoProfiles();
    const list = profiles.map((p) => {
      const u = mockStore.findUserById(p.user_id);
      return {
        ...p,
        name: u ? u.name : '',
        email: u ? u.email : '',
      };
    });
    return res.json({ success: true, ngos: list });
  } catch (err) {
    next(err);
  }
};

const adminVerifyNgo = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value. Allowed: pending, verified, rejected.' });
    }

    const updated = mockStore.updateNgoVerification(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'NGO profile not found.' });
    }

    return res.json({
      success: true,
      message: `NGO status updated to ${status}.`,
      ngo: updated,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
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
};
