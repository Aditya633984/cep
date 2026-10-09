/**
 * FoodBridge – Location Helper
 * ============================
 * Provides:
 *   - haversineDistance(lat1, lng1, lat2, lng2) → km
 *   - geocodeAddress(address)  → { lat, lng, formatted_address } | null
 *
 * Geocoding uses Google Maps Geocoding API if GOOGLE_MAPS_API_KEY is set.
 * If the key is absent, returns null (callers fall back to city-string matching).
 *
 * PRIVACY NOTE: Coordinates stored in the DB are used ONLY for distance
 * calculation inside the matching engine and are never returned to the
 * public-facing API. Approximate city-level display is used in the UI.
 */

'use strict';

require('dotenv').config();

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || null;

// ─── Haversine Distance ───────────────────────────────────────────────────────

/**
 * Returns great-circle distance between two lat/lng points in kilometres.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} distance in km (rounded to 1 decimal)
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R    = 6371; // Earth radius km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

const toRad = (deg) => (deg * Math.PI) / 180;

// ─── Geocoding ────────────────────────────────────────────────────────────────

/**
 * Geocode a free-text address string using Google Maps Geocoding API.
 * Returns { lat, lng, formatted_address } on success, or null on failure /
 * when the API key is not configured.
 *
 * @param {string} address – address or city string
 * @returns {Promise<{lat: number, lng: number, formatted_address: string} | null>}
 */
async function geocodeAddress(address) {
  if (!GOOGLE_API_KEY || !address) return null;

  try {
    const encoded = encodeURIComponent(address.trim());
    const url     = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) return null;

    const json = await response.json();
    if (json.status !== 'OK' || !json.results?.length) return null;

    const { lat, lng } = json.results[0].geometry.location;
    const formatted_address = json.results[0].formatted_address;
    return { lat, lng, formatted_address };
  } catch {
    return null;
  }
}

/**
 * Check whether the Google Maps API key is configured.
 * Used by the /api/location/status endpoint.
 */
function isGoogleMapsConfigured() {
  return Boolean(GOOGLE_API_KEY);
}

module.exports = { haversineDistance, geocodeAddress, isGoogleMapsConfigured };
