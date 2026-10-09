const { pool }        = require('../config/db');
const { rankNGOs }    = require('../matching/matchingEngine');

// ─── GET /api/matching/donations/:id/ngos ────────────────────────────────────
/**
 * Return a ranked list of NGOs for a specific donation.
 *
 * Query params:
 *   only_verified=true   – limit to verified NGOs
 *   limit=N              – return top N results (default 10)
 *
 * Access: donor who owns the donation, or any NGO browsing available donations,
 *         or admin. The controller checks ownership / role.
 */
const getMatchedNGOs = async (req, res, next) => {
  try {
    const donationId   = req.params.id;
    const onlyVerified = req.query.only_verified === 'true';
    const limit        = Math.min(parseInt(req.query.limit) || 10, 50);

    // ── Fetch the donation ──────────────────────────────────────────────────
    const [donRows] = await pool.query(
      `SELECT * FROM donations WHERE id = ?`,
      [donationId]
    );
    const donation = donRows[0];
    if (!donation) {
      return res.status(404).json({ success: false, error: 'Donation not found.' });
    }

    // ── Access control ──────────────────────────────────────────────────────
    // Allow: the donor who owns it, any NGO (so they see their own score), or admin
    const { role, id: userId } = req.user;
    if (role === 'donor' && donation.donor_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }
    // Volunteers not allowed
    if (role === 'volunteer') {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    // ── Fetch all NGO profiles ──────────────────────────────────────────────
    const [ngos] = await pool.query(
      `SELECT np.*, u.name, u.email AS user_email
       FROM ngo_profiles np
       JOIN users u ON u.id = np.user_id
       ORDER BY np.id ASC`
    );

    // ── Fetch active donation counts per NGO ────────────────────────────────
    const [activeCounts] = await pool.query(
      `SELECT ngo_id, COUNT(*) AS cnt
       FROM donations
       WHERE status NOT IN ('COMPLETED','CANCELLED','POSTED')
         AND ngo_id IS NOT NULL
       GROUP BY ngo_id`
    );
    const countMap = new Map(activeCounts.map((r) => [r.ngo_id, Number(r.cnt)]));

    // ── Run the matching engine ─────────────────────────────────────────────
    const ranked = rankNGOs(donation, ngos, countMap, { onlyVerified });

    // Return top N
    const results = ranked.slice(0, limit);

    return res.json({
      success:  true,
      donation: {
        id:             donation.id,
        food_name:      donation.food_name,
        food_category:  donation.food_category,
        food_type:      donation.food_type,
        quantity:       donation.quantity,
        unit:           donation.unit,
        city:           donation.city,
        best_before:    donation.best_before,
        status:         donation.status,
        pickup_address: donation.pickup_address,
      },
      total_ngos_evaluated: ngos.length,
      matches: results,
      algorithm: {
        version:     '1.0',
        type:        'rule-based',
        description: 'Weighted rule-based scoring across 7 factors: proximity, food compatibility, freshness, capacity, dietary match, operating area, and NGO availability.',
        weights: {
          distance:      '28%',
          foodCategory:  '23%',
          freshness:     '18%',
          capacity:      '12%',
          vegetarian:     '8%',
          operatingArea:  '5%',
          availability:   '6%',
        },
        note: 'Architecture is modular — individual factor functions can be replaced with ML model outputs in a future version.',
      },
    });
  } catch (err) { next(err); }
};

// ─── GET /api/matching/donations/:id/top-ngo ─────────────────────────────────
/** Quick endpoint: returns just the single best NGO. */
const getTopNGO = async (req, res, next) => {
  try {
    req.query.limit = '1';
    req.query.only_verified = req.query.only_verified ?? 'false';

    // Re-use the main matching function by running the logic directly
    const donationId = req.params.id;
    const [donRows]  = await pool.query('SELECT * FROM donations WHERE id = ?', [donationId]);
    const donation   = donRows[0];
    if (!donation) return res.status(404).json({ success: false, error: 'Donation not found.' });

    const [ngos] = await pool.query(
      `SELECT np.*, u.name, u.email AS user_email FROM ngo_profiles np JOIN users u ON u.id = np.user_id`
    );
    const [activeCounts] = await pool.query(
      `SELECT ngo_id, COUNT(*) AS cnt FROM donations WHERE status NOT IN ('COMPLETED','CANCELLED','POSTED') AND ngo_id IS NOT NULL GROUP BY ngo_id`
    );
    const countMap = new Map(activeCounts.map((r) => [r.ngo_id, Number(r.cnt)]));
    const ranked   = rankNGOs(donation, ngos, countMap, {});

    return res.json({ success: true, top: ranked[0] || null });
  } catch (err) { next(err); }
};

// ─── POST /api/matching/donations/:id/ngos/:ngoId/accept ─────────────────────
/**
 * NGO accepts a donation directly from the matching results page.
 * Delegates to the same logic as /api/ngo/donations/:id/accept.
 */
const acceptFromMatch = async (req, res, next) => {
  try {
    const { id: donationId, ngoId } = req.params;

    // Must be the NGO making the request
    if (req.user.role !== 'ngo' || String(req.user.id) !== String(ngoId)) {
      return res.status(403).json({ success: false, error: 'Only the matching NGO can accept this donation.' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM donations WHERE id = ? AND status = ?',
      [donationId, 'POSTED']
    );
    if (!rows[0]) {
      return res.status(400).json({ success: false, error: 'Donation not available for acceptance.' });
    }

    const donation = rows[0];

    // Check if donation has expired
    if (new Date(donation.best_before).getTime() <= Date.now()) {
      return res.status(400).json({ success: false, error: 'Cannot accept an expired donation.' });
    }

    // Check NGO profile and availability
    const [ngoProfiles] = await pool.query('SELECT * FROM ngo_profiles WHERE user_id = ?', [ngoId]);
    const profile = ngoProfiles[0] || null;
    if (profile && profile.is_available === 0) {
      return res.status(400).json({ success: false, error: 'Cannot accept donation: NGO is currently marked as unavailable.' });
    }

    // Check dietary compatibility
    if (profile && profile.food_types) {
      const types = profile.food_types.toLowerCase();
      const acceptsNonVeg =
        types.includes('non-veg') ||
        types.includes('non veg') ||
        types.includes('meat') ||
        types.includes('chicken') ||
        types.includes('all') ||
        types.includes('any');

      if (donation.food_type === 'non-vegetarian' && !acceptsNonVeg && (types.includes('veg') || types.includes('vegetarian'))) {
        return res.status(400).json({
          success: false,
          error: 'Incompatible food type: NGO accepts vegetarian food only.',
        });
      }
    }

    await pool.query(
      `UPDATE donations SET status = 'ACCEPTED', ngo_id = ?, accepted_at = NOW() WHERE id = ? AND status = 'POSTED'`,
      [ngoId, donationId]
    );

    return res.json({ success: true, message: 'Donation accepted successfully via Smart Match.' });
  } catch (err) { next(err); }
};

module.exports = { getMatchedNGOs, getTopNGO, acceptFromMatch };
