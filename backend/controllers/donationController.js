'use strict';

const mockStore = require('../services/mockStore');

const MUTABLE_STATUSES = ['POSTED'];

const ALLOWED_CATEGORIES = [
  'Cooked Food', 'Packaged Food', 'Dry Ration',
  'Fruits', 'Vegetables', 'Bakery Items', 'Dairy', 'Other'
];
const ALLOWED_UNITS = [
  'kg', 'g', 'liters', 'ml', 'pieces', 'servings', 'boxes', 'packets'
];
const ALLOWED_FOOD_TYPES = ['vegetarian', 'non-vegetarian'];

// ─── POST /api/donor/donations ────────────────────────────────────────────────
const createDonation = async (req, res, next) => {
  try {
    const {
      food_name, food_category, quantity, unit, people_served,
      food_type, preparation_date, best_before,
      pickup_address, city, description, pickup_availability,
      lat, lng,
    } = req.body;

    if (!food_name || !food_category || !quantity || !unit || !food_type ||
        !preparation_date || !best_before || !pickup_address || !city) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields.',
      });
    }

    if (!ALLOWED_CATEGORIES.includes(food_category)) {
      return res.status(400).json({
        success: false,
        error: `Invalid food category. Allowed: ${ALLOWED_CATEGORIES.join(', ')}`,
      });
    }

    if (!ALLOWED_UNITS.includes(unit)) {
      return res.status(400).json({
        success: false,
        error: `Invalid unit. Allowed: ${ALLOWED_UNITS.join(', ')}`,
      });
    }

    if (!ALLOWED_FOOD_TYPES.includes(food_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid food type. Allowed: vegetarian, non-vegetarian',
      });
    }

    const parsedQty = parseFloat(quantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be a positive number.',
      });
    }

    if (best_before && new Date(best_before) < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Cannot donate expired food. Best before date must be in the future.',
      });
    }

    if (people_served !== undefined && people_served !== null && people_served !== '') {
      const ps = parseInt(people_served, 10);
      if (isNaN(ps) || ps <= 0) {
        return res.status(400).json({
          success: false,
          error: 'People served must be a positive integer.',
        });
      }
    }

    const food_image = req.file ? `/uploads/${req.file.filename}` : null;

    const donation = mockStore.createDonation({
      donor_id: req.user.id,
      food_name: food_name.trim(),
      food_category,
      quantity: parsedQty,
      unit,
      people_served: people_served ? parseInt(people_served, 10) : null,
      food_type,
      preparation_date,
      best_before,
      pickup_address: pickup_address.trim(),
      city: city.trim(),
      description: description ? description.trim() : null,
      food_image,
      pickup_availability: pickup_availability ? pickup_availability.trim() : null,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
    });

    return res.status(201).json({
      success: true,
      message: 'Donation created successfully.',
      donation: mockStore.hydrateDonation(donation),
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/donor/donations ─────────────────────────────────────────────────
const getDonations = async (req, res, next) => {
  try {
    const donorId = Number(req.user.id);
    const { status, page = 1, limit = 10 } = req.query;

    let items = mockStore.getDonations((d) => {
      if (d.donor_id !== donorId) return false;
      if (status && d.status !== status) return false;
      return true;
    });

    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = items.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = items.slice(startIndex, startIndex + limitNum).map((d) => mockStore.hydrateDonation(d));

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

// ─── GET /api/donor/donations/:id ─────────────────────────────────────────────
const getDonationById = async (req, res, next) => {
  try {
    const donation = mockStore.findDonationById(req.params.id);
    if (!donation) {
      return res.status(404).json({ success: false, error: 'Donation not found.' });
    }

    if (donation.donor_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    return res.json({
      success: true,
      donation: mockStore.hydrateDonation(donation),
    });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/donor/donations/:id ─────────────────────────────────────────────
const updateDonation = async (req, res, next) => {
  try {
    const donation = mockStore.findDonationById(req.params.id);
    if (!donation) {
      return res.status(404).json({ success: false, error: 'Donation not found.' });
    }

    if (donation.donor_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    if (!MUTABLE_STATUSES.includes(donation.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot edit a donation with status "${donation.status}".`,
      });
    }

    const {
      food_name, food_category, quantity, unit, people_served,
      food_type, preparation_date, best_before,
      pickup_address, city, description, pickup_availability,
    } = req.body;

    const updates = {};
    if (food_name) updates.food_name = food_name.trim();
    if (food_category) updates.food_category = food_category;
    if (quantity) updates.quantity = parseFloat(quantity);
    if (unit) updates.unit = unit;
    if (people_served !== undefined) updates.people_served = parseInt(people_served, 10);
    if (food_type) updates.food_type = food_type;
    if (preparation_date) updates.preparation_date = preparation_date;
    if (best_before) updates.best_before = best_before;
    if (pickup_address) updates.pickup_address = pickup_address.trim();
    if (city) updates.city = city.trim();
    if (description !== undefined) updates.description = description;
    if (pickup_availability !== undefined) updates.pickup_availability = pickup_availability;
    if (req.file) updates.food_image = `/uploads/${req.file.filename}`;

    const updated = mockStore.updateDonation(donation.id, updates);

    return res.json({
      success: true,
      message: 'Donation updated successfully.',
      donation: mockStore.hydrateDonation(updated),
    });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/donor/donations/:id ──────────────────────────────────────────
const cancelDonation = async (req, res, next) => {
  try {
    const donation = mockStore.findDonationById(req.params.id);
    if (!donation) {
      return res.status(404).json({ success: false, error: 'Donation not found.' });
    }

    if (donation.donor_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    if (!MUTABLE_STATUSES.includes(donation.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel a donation with status "${donation.status}".`,
      });
    }

    mockStore.updateDonation(donation.id, { status: 'CANCELLED' });

    return res.json({ success: true, message: 'Donation cancelled.' });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/donor/dashboard ─────────────────────────────────────────────────
const getDonorDashboard = async (req, res, next) => {
  try {
    const data = mockStore.getDonorDashboardStats(req.user.id);
    return res.json({
      success: true,
      ...data,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createDonation,
  getDonations,
  getDonationById,
  updateDonation,
  cancelDonation,
  getDonorDashboard,
};
