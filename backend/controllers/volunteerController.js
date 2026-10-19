'use strict';

const mockStore = require('../services/mockStore');

// ─── GET /api/volunteer/dashboard ────────────────────────────────────────────
const getVolunteerDashboard = async (req, res, next) => {
  try {
    const data = mockStore.getVolunteerDashboardStats(req.user.id);
    return res.json({
      success: true,
      ...data,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/volunteer/profile ──────────────────────────────────────────────
const getVolunteerProfile = async (req, res, next) => {
  try {
    const user = mockStore.findUserById(req.user.id);
    let profile = mockStore.findVolunteerByUserId(req.user.id);

    if (!profile) {
      profile = mockStore.upsertVolunteerProfile(req.user.id, {
        phone: user ? user.phone : '',
      });
    }

    return res.json({
      success: true,
      profile: {
        ...profile,
        name: user ? user.name : '',
        email: user ? user.email : '',
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/volunteer/profile ──────────────────────────────────────────────
const upsertVolunteerProfile = async (req, res, next) => {
  try {
    const { phone, address, vehicle_type, service_area, availability, lat, lng } = req.body;

    const profile = mockStore.upsertVolunteerProfile(req.user.id, {
      phone,
      address,
      vehicle_type: vehicle_type || 'motorcycle',
      service_area,
      availability,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
    });

    const user = mockStore.findUserById(req.user.id);

    return res.json({
      success: true,
      message: 'Volunteer profile updated successfully.',
      profile: {
        ...profile,
        name: user ? user.name : '',
        email: user ? user.email : '',
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/volunteer/pickups/available ────────────────────────────────────
const getAvailablePickups = async (req, res, next) => {
  try {
    const { city } = req.query;

    let list = mockStore.getDonations((d) => {
      if (d.status !== 'ACCEPTED') return false;
      if (d.volunteer_id) return false;
      if (city && !d.city.toLowerCase().includes(city.toLowerCase())) return false;
      return true;
    });

    list.sort((a, b) => new Date(b.accepted_at || b.created_at) - new Date(a.accepted_at || a.created_at));

    const hydrated = list.map((d) => mockStore.hydrateDonation(d));
    return res.json({
      success: true,
      pickups: hydrated,
      total: hydrated.length,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/volunteer/pickups/:id/accept ──────────────────────────────────
const acceptPickup = async (req, res, next) => {
  try {
    const donation = mockStore.findDonationById(req.params.id);
    if (!donation) {
      return res.status(404).json({ success: false, error: 'Donation not found.' });
    }

    if (donation.volunteer_id && Number(donation.volunteer_id) !== Number(req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Another volunteer is already assigned to this pickup.',
      });
    }

    const active = mockStore.donations.find(
      (d) => Number(d.volunteer_id) === Number(req.user.id) && ['VOLUNTEER_ASSIGNED', 'PICKED_UP'].includes(d.status)
    );
    if (active) {
      return res.status(400).json({
        success: false,
        error: 'You already have an active pickup in progress.',
      });
    }

    if (donation.status !== 'ACCEPTED') {
      return res.status(400).json({
        success: false,
        error: `Cannot accept pickup for donation with status "${donation.status}".`,
      });
    }

    const updated = mockStore.updateDonation(donation.id, {
      status: 'VOLUNTEER_ASSIGNED',
      volunteer_id: req.user.id,
      volunteer_assigned_at: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: 'Pickup accepted and assigned to you successfully.',
      pickup: mockStore.hydrateDonation(updated),
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/volunteer/pickups/:id/pickup ──────────────────────────────────
const markPickedUp = async (req, res, next) => {
  try {
    const donation = mockStore.findDonationById(req.params.id);
    if (!donation) {
      return res.status(404).json({ success: false, error: 'Donation not found.' });
    }

    if (Number(donation.volunteer_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Access denied: You are not assigned to this pickup.' });
    }

    const updated = mockStore.updateDonation(donation.id, {
      status: 'PICKED_UP',
      picked_up_at: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: 'Donation marked as picked up and in transit.',
      pickup: mockStore.hydrateDonation(updated),
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/volunteer/pickups/:id/deliver ─────────────────────────────────
const markDelivered = async (req, res, next) => {
  try {
    const donation = mockStore.findDonationById(req.params.id);
    if (!donation) {
      return res.status(404).json({ success: false, error: 'Donation not found.' });
    }

    if (Number(donation.volunteer_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Access denied: You are not assigned to this pickup.' });
    }

    if (donation.status !== 'PICKED_UP') {
      return res.status(400).json({ success: false, error: 'Donation is not in PICKED_UP status.' });
    }

    const updated = mockStore.updateDonation(donation.id, {
      status: 'DELIVERED',
      delivered_at: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: 'Delivery marked as completed successfully.',
      pickup: mockStore.hydrateDonation(updated),
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/admin/volunteers ───────────────────────────────────────────────
const adminListVolunteers = async (req, res, next) => {
  try {
    const profiles = mockStore.getVolunteerProfiles();
    const list = profiles.map((p) => {
      const u = mockStore.findUserById(p.user_id);
      return {
        ...p,
        name: u ? u.name : '',
        email: u ? u.email : '',
      };
    });
    return res.json({ success: true, volunteers: list });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getVolunteerDashboard,
  getVolunteerProfile,
  upsertVolunteerProfile,
  getAvailablePickups,
  acceptPickup,
  markPickedUp,
  markDelivered,
  adminListVolunteers,
};
