'use strict';

const mockStore    = require('../services/mockStore');
const { rankNGOs } = require('../matching/matchingEngine');

// ─── GET /api/matching/donations/:id/ngos ────────────────────────────────────
const getMatchedNGOs = async (req, res, next) => {
  try {
    const donationId   = req.params.id;
    const onlyVerified = req.query.only_verified === 'true';
    const limit        = Math.min(parseInt(req.query.limit, 10) || 10, 50);

    const donation = mockStore.findDonationById(donationId);
    if (!donation) {
      return res.status(404).json({ success: false, error: 'Donation not found.' });
    }

    const { role, id: userId } = req.user;
    if (role === 'donor' && donation.donor_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }
    if (role === 'volunteer') {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    let ngos = mockStore.getNgoProfiles().map((np) => {
      const u = mockStore.findUserById(np.user_id);
      return {
        ...np,
        name: u ? u.name : '',
        email: u ? u.email : '',
      };
    });

    if (onlyVerified) {
      ngos = ngos.filter((n) => n.verification_status === 'verified');
    }

    // Active donation counts per NGO
    const countMap = new Map();
    mockStore.getDonations().forEach((d) => {
      if (d.ngo_id && !['COMPLETED', 'CANCELLED', 'POSTED'].includes(d.status)) {
        countMap.set(d.ngo_id, (countMap.get(d.ngo_id) || 0) + 1);
      }
    });

    const ranked = rankNGOs(donation, ngos, countMap).slice(0, limit);

    return res.json({
      success: true,
      donation: {
        id: donation.id,
        food_name: donation.food_name,
        food_category: donation.food_category,
        quantity: donation.quantity,
        unit: donation.unit,
        city: donation.city,
        pickup_address: donation.pickup_address,
      },
      matches: ranked,
      ranked_ngos: ranked,
      total_ngos_evaluated: ngos.length,
      total_candidates: ngos.length,
      algorithm: {
        name: '7-Factor Weighted Rule Engine',
        version: '1.0.0',
        weights: {
          distance: 28,
          foodCategory: 23,
          freshness: 18,
          capacity: 12,
          vegetarian: 8,
          operatingArea: 5,
          availability: 6,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/matching/donations/:id/top-ngo ─────────────────────────────────
const getTopNGO = async (req, res, next) => {
  try {
    const donationId = req.params.id;
    const donation = mockStore.findDonationById(donationId);
    if (!donation) {
      return res.status(404).json({ success: false, error: 'Donation not found.' });
    }

    let ngos = mockStore.getNgoProfiles().map((np) => {
      const u = mockStore.findUserById(np.user_id);
      return { ...np, name: u ? u.name : '', email: u ? u.email : '' };
    });

    const countMap = new Map();
    mockStore.getDonations().forEach((d) => {
      if (d.ngo_id && !['COMPLETED', 'CANCELLED', 'POSTED'].includes(d.status)) {
        countMap.set(d.ngo_id, (countMap.get(d.ngo_id) || 0) + 1);
      }
    });

    const ranked = rankNGOs(donation, ngos, countMap);
    const top = ranked[0] || null;

    return res.json({
      success: true,
      top_match: top,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/matching/donations/:id/ngos/:ngoId/accept ─────────────────────
const acceptFromMatch = async (req, res, next) => {
  try {
    const donationId = req.params.id;
    const ngoId      = Number(req.params.ngoId);

    if (req.user.role === 'ngo' && req.user.id !== ngoId) {
      return res.status(403).json({ success: false, error: 'You can only accept for your own NGO.' });
    }

    const donation = mockStore.findDonationById(donationId);
    if (!donation) {
      return res.status(404).json({ success: false, error: 'Donation not found.' });
    }

    if (donation.status !== 'POSTED') {
      return res.status(400).json({ success: false, error: `Donation is already ${donation.status}.` });
    }

    const updated = mockStore.updateDonation(donation.id, {
      status: 'ACCEPTED',
      ngo_id: ngoId,
      accepted_at: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: 'Donation accepted from match results.',
      donation: mockStore.hydrateDonation(updated),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMatchedNGOs,
  getTopNGO,
  acceptFromMatch,
};
