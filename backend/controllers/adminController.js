'use strict';

const mockStore = require('../services/mockStore');

// ─── GET /api/admin/stats ────────────────────────────────────────────────────
const getStats = async (_req, res, next) => {
  try {
    const stats = mockStore.getAdminStats();
    return res.json({
      success: true,
      stats,
      ...stats,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/admin/users ────────────────────────────────────────────────────
const getUsers = async (req, res, next) => {
  try {
    const { role, search } = req.query;
    let users = mockStore.getUsers();

    if (role) {
      users = users.filter((u) => u.role === role);
    }

    if (search) {
      const q = search.toLowerCase();
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.phone && u.phone.includes(q))
      );
    }

    users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const safeUsers = users.map(({ password, ...u }) => u);
    return res.json({ success: true, users: safeUsers, total: safeUsers.length });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/admin/users/:id ────────────────────────────────────────────────
const getUserDetail = async (req, res, next) => {
  try {
    const user = mockStore.findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const { password, ...safeUser } = user;
    let profile = null;
    if (user.role === 'ngo') {
      profile = mockStore.findNgoByUserId(user.id);
    } else if (user.role === 'volunteer') {
      profile = mockStore.findVolunteerByUserId(user.id);
    }

    return res.json({ success: true, user: safeUser, profile });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/admin/ngos ─────────────────────────────────────────────────────
const getNgos = async (req, res, next) => {
  try {
    const { status } = req.query;
    let profiles = mockStore.getNgoProfiles();

    if (status) {
      profiles = profiles.filter((p) => p.verification_status === status);
    }

    const list = profiles.map((p) => {
      const u = mockStore.findUserById(p.user_id);
      return {
        ...p,
        name: u ? u.name : '',
        email: u ? u.email : '',
      };
    });

    return res.json({ success: true, ngos: list, total: list.length });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/admin/ngos/:id ─────────────────────────────────────────────────
const getNgoDetail = async (req, res, next) => {
  try {
    const profile = mockStore.findNgoById(req.params.id);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'NGO profile not found.' });
    }

    const user = mockStore.findUserById(profile.user_id);
    return res.json({
      success: true,
      ngo: {
        ...profile,
        name: user ? user.name : '',
        email: user ? user.email : '',
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/admin/ngos/:id/verify ────────────────────────────────────────
const updateNgoVerification = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value. Allowed: pending, verified, rejected.' });
    }

    const updated = mockStore.updateNgoVerification(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'NGO not found.' });
    }

    return res.json({
      success: true,
      message: `NGO verification status updated to "${status}".`,
      ngo: updated,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/admin/donations ────────────────────────────────────────────────
const getDonations = async (req, res, next) => {
  try {
    const { status, category, search, page = 1, limit = 50 } = req.query;

    let list = mockStore.getDonations((d) => {
      if (status && d.status !== status) return false;
      if (category && d.food_category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !d.food_name.toLowerCase().includes(q) &&
          !d.city.toLowerCase().includes(q) &&
          !(d.description && d.description.toLowerCase().includes(q))
        ) {
          return false;
        }
      }
      return true;
    });

    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = list.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 50);
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = list.slice(startIndex, startIndex + limitNum).map((d) => mockStore.hydrateDonation(d));

    return res.json({
      success: true,
      donations: paginated,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/admin/donations/:id ────────────────────────────────────────────
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

// ─── GET /api/admin/volunteers ───────────────────────────────────────────────
const getVolunteers = async (_req, res, next) => {
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
    return res.json({ success: true, volunteers: list, total: list.length });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getStats,
  getUsers,
  getUserDetail,
  getNgos,
  getNgoDetail,
  updateNgoVerification,
  getDonations,
  getDonationDetail,
  getVolunteers,
};
