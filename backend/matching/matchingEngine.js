/**
 * FoodBridge – Smart Food Matching Engine  (v1 – Rule-Based)
 * =============================================================
 * Architecture: each factor is a pure scoring function with the signature:
 *   scoreFactor(donation, ngo) → { score: 0-100, weight: number, reason: string }
 *
 * The top-level `scoreMatch` aggregates all factors via weighted average.
 * To add an ML model later: replace individual factor functions or the
 * `scoreMatch` entry-point while keeping the same return shape.
 */

'use strict';

const { haversineDistance } = require('../utils/locationHelper');

// ─── Weights (must sum to 100) ────────────────────────────────────────────────
const WEIGHTS = {
  distance:         28,   // Proximity is the dominant factor
  foodCategory:     23,   // NGO must be able to handle the food type
  freshness:        18,   // More urgent = higher priority for nearby NGOs
  capacity:         12,   // NGO should have enough room
  vegetarian:        8,   // Dietary compatibility
  operatingArea:     5,   // Explicit operating area match
  availability:      6,   // NGO must be currently available to accept donations
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Distance scoring function.
 *
 * Priority:
 *   1. Haversine (real GPS distance) – when both lat/lng are stored
 *   2. City-string fuzzy match       – fallback when coords are unavailable
 *
 * Haversine score thresholds (km → score):
 *   ≤ 2 km  → 100    ≤ 5 km  → 90    ≤ 10 km → 75
 *   ≤ 20 km → 55     ≤ 40 km → 35    > 40 km → 10
 *
 * City-string fallback (unchanged behaviour):
 *   Same city → 100 | In operating area → 80 | Partial → 60 | Different → 10
 */
function distanceScore(donationCity, ngoCity, ngoOperatingArea, donLat, donLng, ngoLat, ngoLng) {
  // ── Haversine path ──────────────────────────────────────────────────────────
  if (donLat && donLng && ngoLat && ngoLng) {
    const km = haversineDistance(
      parseFloat(donLat), parseFloat(donLng),
      parseFloat(ngoLat), parseFloat(ngoLng)
    );

    let score, reason;
    if      (km <= 2)  { score = 100; reason = `Very close — only ${km} km away`; }
    else if (km <= 5)  { score = 90;  reason = `Close — ${km} km away`; }
    else if (km <= 10) { score = 75;  reason = `Nearby — ${km} km away`; }
    else if (km <= 20) { score = 55;  reason = `Moderate distance — ${km} km away`; }
    else if (km <= 40) { score = 35;  reason = `Somewhat far — ${km} km away`; }
    else               { score = 10;  reason = `Far away — ${km} km`; }

    return { estimatedKm: km, score, reason, method: 'haversine' };
  }

  // ── City-string fallback ────────────────────────────────────────────────────
  const normalize = (s) => (s || '').toLowerCase().trim();
  const dc  = normalize(donationCity);
  const nc  = normalize(ngoCity);
  const oa  = normalize(ngoOperatingArea);

  // Exact city match → ~2 km proxy
  if (dc && nc && dc === nc) {
    return { estimatedKm: 2, score: 100, reason: 'Same city as donor', method: 'city-match' };
  }
  // Operating area explicitly mentions the donation city
  if (oa && dc && oa.includes(dc)) {
    return { estimatedKm: 5, score: 80, reason: 'Donation city is in NGO operating area', method: 'city-match' };
  }
  // Partial word overlap (e.g. "Mumbai" vs "Mumbai Suburban")
  const dcWords = dc.split(/\s+/);
  const ncWords = nc.split(/\s+/);
  const overlap = dcWords.filter((w) => w.length > 2 && ncWords.includes(w));
  if (overlap.length > 0) {
    return { estimatedKm: 10, score: 60, reason: 'Nearby area (partial city match)', method: 'city-match' };
  }
  // No location info at all – neutral
  if (!dc || !nc) {
    return { estimatedKm: null, score: 50, reason: 'Location data incomplete', method: 'city-match' };
  }
  // Different cities
  return { estimatedKm: '>15', score: 10, reason: 'Different city', method: 'city-match' };
}

/**
 * Food category compatibility.
 * Checks whether the NGO's food_types field mentions the donation's category.
 */
function categoryScore(donationCategory, ngoFoodTypes) {
  if (!ngoFoodTypes) {
    return { score: 50, reason: 'NGO has no food-type preference listed (accepts all)' };
  }
  const normalize = (s) => (s || '').toLowerCase();
  const types  = normalize(ngoFoodTypes);
  const cat    = normalize(donationCategory);

  // Direct keyword matches
  const ALIASES = {
    'cooked food':    ['cooked', 'hot food', 'ready', 'meals', 'food'],
    'packaged food':  ['packaged', 'processed', 'canned', 'sealed'],
    'dry ration':     ['dry', 'ration', 'groceries', 'grain', 'rice', 'wheat', 'dal', 'lentil'],
    'fruits':         ['fruit', 'fresh produce', 'produce'],
    'vegetables':     ['vegetable', 'veggie', 'fresh produce', 'produce'],
    'bakery items':   ['bakery', 'bread', 'baked', 'pastry'],
    'dairy':          ['dairy', 'milk', 'cheese', 'curd', 'paneer'],
    'other':          [],
  };

  const keywords = [cat, ...(ALIASES[cat] || [])];
  const matched  = keywords.some((k) => types.includes(k));

  if (matched) return { score: 100, reason: `NGO explicitly accepts ${donationCategory}` };

  // Generic "all food" or "any food" signals
  if (types.includes('all') || types.includes('any') || types.includes('everything')) {
    return { score: 85, reason: 'NGO accepts all food types' };
  }

  return { score: 15, reason: `NGO may not accept ${donationCategory} — check compatibility` };
}

/**
 * Freshness / urgency score.
 * Donations expiring soon should be matched with higher urgency.
 * Returns higher score for donations with longer remaining shelf life
 * (they are "easier" to handle), but also boosts urgency for nearby NGOs.
 */
function freshnessScore(bestBefore) {
  if (!bestBefore) return { score: 50, hoursLeft: null, reason: 'Expiry date unknown' };

  const now       = Date.now();
  const expiryMs  = new Date(bestBefore).getTime();
  const hoursLeft = (expiryMs - now) / (1000 * 3600);

  if (hoursLeft <= 0)   return { score: 0,  hoursLeft: 0,           reason: 'Food has already expired' };
  if (hoursLeft <= 2)   return { score: 30, hoursLeft: hoursLeft,   reason: `Very urgent – only ${hoursLeft.toFixed(1)}h left` };
  if (hoursLeft <= 6)   return { score: 60, hoursLeft: hoursLeft,   reason: `Urgent – ${hoursLeft.toFixed(1)}h remaining` };
  if (hoursLeft <= 12)  return { score: 80, hoursLeft: hoursLeft,   reason: `Fresh – ${hoursLeft.toFixed(1)}h remaining` };
  if (hoursLeft <= 24)  return { score: 90, hoursLeft: hoursLeft,   reason: `Good freshness – ${hoursLeft.toFixed(1)}h remaining` };
  return               { score: 95, hoursLeft: hoursLeft,           reason: `Excellent freshness – ${Math.round(hoursLeft)}h remaining` };
}

/**
 * Capacity compatibility.
 * Compares donation quantity (in kg proxy) against NGO max_food_capacity.
 */
function capacityScore(donationQty, donationUnit, ngoCapacity, ngoActiveCount) {
  if (!ngoCapacity) {
    return { score: 50, reason: 'NGO capacity not specified' };
  }

  // Normalise donation quantity to kg-equivalent
  const KG_FACTORS = {
    kg: 1, g: 0.001, liters: 1, ml: 0.001,
    pieces: 0.3, servings: 0.4, boxes: 2, packets: 0.5,
  };
  const factor   = KG_FACTORS[donationUnit] ?? 1;
  const qtyKg    = parseFloat(donationQty) * factor;
  const capacity = parseFloat(ngoCapacity);

  // Estimate remaining capacity (each active donation uses ~20% of capacity)
  const usedFraction   = Math.min(0.9, (ngoActiveCount || 0) * 0.2);
  const remainingCapacity = capacity * (1 - usedFraction);

  if (qtyKg <= 0) return { score: 50, reason: 'Quantity not specified' };

  const ratio = qtyKg / remainingCapacity;
  if (ratio <= 0.25)  return { score: 100, reason: `Easily within capacity (${qtyKg.toFixed(1)} kg / ${remainingCapacity.toFixed(0)} kg available)` };
  if (ratio <= 0.60)  return { score: 85,  reason: `Fits comfortably (${qtyKg.toFixed(1)} kg / ${remainingCapacity.toFixed(0)} kg available)` };
  if (ratio <= 0.90)  return { score: 65,  reason: `Near capacity limit (${qtyKg.toFixed(1)} kg / ${remainingCapacity.toFixed(0)} kg available)` };
  if (ratio <= 1.00)  return { score: 40,  reason: `At capacity limit — tight fit` };
  return               { score: 10,  reason: `Exceeds available capacity (${qtyKg.toFixed(1)} kg needed, ${remainingCapacity.toFixed(0)} kg available)` };
}

/**
 * Vegetarian / dietary compatibility.
 */
function dietaryScore(donationFoodType, ngoFoodTypes) {
  if (!ngoFoodTypes) return { score: 70, reason: 'NGO dietary preference not specified' };

  const types = (ngoFoodTypes || '').toLowerCase();
  const isNonVeg = donationFoodType === 'non-vegetarian';

  if (isNonVeg) {
    if (types.includes('non-veg') || types.includes('non veg') || types.includes('meat') ||
        types.includes('chicken') || types.includes('all')) {
      return { score: 100, reason: 'NGO accepts non-vegetarian food' };
    }
    if (types.includes('veg') && !types.includes('non')) {
      return { score: 10, reason: 'NGO is vegetarian-only — non-veg donation may not be suitable' };
    }
    return { score: 60, reason: 'NGO dietary preference unclear for non-vegetarian food' };
  } else {
    // Vegetarian food is almost universally compatible
    return { score: 95, reason: 'Vegetarian food is compatible with all NGOs' };
  }
}

/**
 * Operating area score.
 * Does the NGO explicitly list the donation city in its operating area?
 */
function operatingAreaScore(donationCity, ngoOperatingArea) {
  if (!ngoOperatingArea) return { score: 50, reason: 'Operating area not specified' };
  const city = (donationCity || '').toLowerCase().trim();
  const area = (ngoOperatingArea || '').toLowerCase();
  if (city && area.includes(city)) {
    return { score: 100, reason: `${donationCity} is in NGO's operating area` };
  }
  return { score: 30, reason: `NGO's operating area may not cover ${donationCity}` };
}

/**
 * NGO Availability score.
 * Checks whether the NGO is currently marked as available to accept donations.
 * NGOs can toggle their availability off (e.g. capacity full, on break, etc.)
 */
function availabilityScore(isAvailable) {
  // is_available is stored as TINYINT(1) — truthy = 1, falsy = 0
  if (isAvailable === null || isAvailable === undefined) {
    return { score: 70, reason: 'NGO availability not specified — assumed available' };
  }
  if (isAvailable === true || isAvailable === 1 || isAvailable === '1') {
    return { score: 100, reason: 'NGO is currently available to accept donations' };
  }
  return { score: 0, reason: 'NGO has marked itself as unavailable — may not accept right now' };
}

// ─── Main Scoring Function ────────────────────────────────────────────────────

/**
 * Score a single (donation, ngo) pair.
 * Returns a rich result object that explains every factor.
 *
 * @param {object} donation  - Row from donations table
 * @param {object} ngo       - Row from ngo_profiles JOIN users
 * @param {number} ngoActiveCount - How many active donations the NGO has
 * @returns {MatchResult}
 */
function scoreMatch(donation, ngo, ngoActiveCount = 0) {
  const dist    = distanceScore(
    donation.city, ngo.city, ngo.operating_area,
    donation.lat, donation.lng, ngo.lat, ngo.lng  // coords if available
  );
  const cat     = categoryScore(donation.food_category, ngo.food_types);
  const fresh   = freshnessScore(donation.best_before);
  const cap     = capacityScore(donation.quantity, donation.unit, ngo.max_food_capacity, ngoActiveCount);
  const diet    = dietaryScore(donation.food_type, ngo.food_types);
  const opArea  = operatingAreaScore(donation.city, ngo.operating_area);
  const avail   = availabilityScore(ngo.is_available);

  // ── Freshness modifier: if food is expiring very soon, distance becomes more important
  let adjustedWeights = { ...WEIGHTS };
  if (fresh.hoursLeft !== null && fresh.hoursLeft <= 4) {
    // Urgency mode: boost distance weight, reduce others proportionally
    adjustedWeights.distance     = 38;
    adjustedWeights.freshness    = 8;
    adjustedWeights.foodCategory = 20;
    adjustedWeights.capacity     = 12;
    adjustedWeights.vegetarian   = 7;
    adjustedWeights.operatingArea = 5;
    adjustedWeights.availability  = 10; // availability becomes critical when urgent
  }

  const factors = [
    { key: 'distance',      label: 'Proximity',         ...dist,  weight: adjustedWeights.distance      },
    { key: 'foodCategory',  label: 'Food Compatibility', ...cat,   weight: adjustedWeights.foodCategory  },
    { key: 'freshness',     label: 'Food Freshness',    ...fresh,  weight: adjustedWeights.freshness     },
    { key: 'capacity',      label: 'Capacity',          ...cap,    weight: adjustedWeights.capacity      },
    { key: 'vegetarian',    label: 'Dietary Match',     ...diet,   weight: adjustedWeights.vegetarian    },
    { key: 'operatingArea', label: 'Operating Area',    ...opArea, weight: adjustedWeights.operatingArea },
    { key: 'availability',  label: 'Availability',      ...avail,  weight: adjustedWeights.availability  },
  ];

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const rawScore    = factors.reduce((s, f) => s + (f.score * f.weight), 0) / totalWeight;
  const finalScore  = Math.round(Math.max(0, Math.min(100, rawScore)));

  // ── Human-readable recommendation tier
  let tier, tierColor;
  if (finalScore >= 80)      { tier = 'Excellent Match';  tierColor = '#16A34A'; }
  else if (finalScore >= 60) { tier = 'Good Match';       tierColor = '#2563EB'; }
  else if (finalScore >= 40) { tier = 'Fair Match';       tierColor = '#D97706'; }
  else                       { tier = 'Poor Match';       tierColor = '#DC2626'; }

  return {
    ngo_id:           ngo.user_id,
    ngo_name:         ngo.ngo_name,
    ngo_contact:      ngo.name,           // user.name
    ngo_email:        ngo.user_email,
    ngo_phone:        ngo.phone,
    ngo_city:         ngo.city,
    ngo_address:      ngo.address,
    ngo_food_types:   ngo.food_types,
    ngo_operating_area: ngo.operating_area,
    ngo_capacity:     ngo.max_food_capacity,
    ngo_is_available: !!ngo.is_available,
    verification_status: ngo.verification_status,
    score:            finalScore,
    tier,
    tierColor,
    estimated_distance:  dist.estimatedKm,
    distance_method:     dist.method || 'city-match',  // 'haversine' | 'city-match'
    hours_until_expiry:  fresh.hoursLeft ? parseFloat(fresh.hoursLeft.toFixed(1)) : null,
    factors: factors.map((f) => ({
      key:    f.key,
      label:  f.label,
      score:  f.score,
      weight: f.weight,
      reason: f.reason,
    })),
  };
}

/**
 * Rank all candidate NGOs for a donation.
 * Filters out: expired food, unverified NGOs (optional), NGOs with no city match if urgent.
 *
 * @param {object}   donation        - Donation row
 * @param {object[]} ngos            - Array of NGO profile rows with user join
 * @param {Map}      ngoActiveCounts - Map<ngo_user_id, activeCount>
 * @param {object}   options
 * @param {boolean}  options.onlyVerified - Filter to verified NGOs only (default: false)
 * @returns {MatchResult[]} sorted descending by score
 */
function rankNGOs(donation, ngos, ngoActiveCounts = new Map(), options = {}) {
  const { onlyVerified = false } = options;

  const scored = ngos
    .filter((ngo) => {
      if (onlyVerified && ngo.verification_status !== 'verified') return false;
      return true;
    })
    .map((ngo) => {
      const activeCount = ngoActiveCounts.get(ngo.user_id) || 0;
      return scoreMatch(donation, ngo, activeCount);
    });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored;
}

module.exports = { rankNGOs, scoreMatch, distanceScore, categoryScore, freshnessScore, capacityScore, availabilityScore };

