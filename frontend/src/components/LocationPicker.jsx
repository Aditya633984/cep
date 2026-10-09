/**
 * LocationPicker — Address input with optional geocoding.
 *
 * Props:
 *   address       {string}   — current address value
 *   city          {string}   — city for context
 *   lat           {number|null}
 *   lng           {number|null}
 *   onAddressChange(val)  — when address text changes
 *   onCoordsChange({lat, lng, formatted}) — when geocoding succeeds
 *   placeholder   {string}
 *   label         {string}
 *   required      {boolean}
 *   className     {string}
 *
 * Behaviour:
 *   - Always shows address text input
 *   - Shows "📍 Geocode" button
 *   - If Google Maps API unavailable (detected from /api/location/status),
 *     button shows an info tooltip instead of geocoding
 *   - Shows a small coordinate badge when lat/lng is stored
 *   - Does NOT show raw coordinates to the user (only a "✅ Location saved" indicator)
 */

import { useState, useEffect } from 'react';
import { api } from '../utils/api';

// Check API availability once and cache it
let _mapsAvailable = null;
async function checkMapsAvailable() {
  if (_mapsAvailable !== null) return _mapsAvailable;
  try {
    const data = await api.get('/location/status');
    _mapsAvailable = data.google_maps_api === true;
  } catch {
    _mapsAvailable = false;
  }
  return _mapsAvailable;
}

export default function LocationPicker({
  address = '',
  city = '',
  lat = null,
  lng = null,
  onAddressChange,
  onCoordsChange,
  placeholder = 'Enter full address',
  label = 'Address',
  required = false,
  className = '',
}) {
  const [geocoding,    setGeocoding]    = useState(false);
  const [mapsReady,   setMapsReady]    = useState(false);
  const [statusMsg,   setStatusMsg]    = useState('');
  const [hasCoords,   setHasCoords]    = useState(Boolean(lat && lng));

  useEffect(() => {
    checkMapsAvailable().then(setMapsReady);
  }, []);

  useEffect(() => {
    setHasCoords(Boolean(lat && lng));
  }, [lat, lng]);

  const handleGeocode = async () => {
    const query = [address, city].filter(Boolean).join(', ');
    if (!query.trim()) {
      setStatusMsg('Enter an address first.');
      return;
    }

    if (!mapsReady) {
      setStatusMsg('Maps API not configured. Your address is saved as text — city-level matching will be used.');
      return;
    }

    setGeocoding(true);
    setStatusMsg('');
    try {
      const data = await api.post('/location/geocode', { address: query });
      if (data.geocoded) {
        setHasCoords(true);
        setStatusMsg('✅ Location coordinates saved.');
        if (onCoordsChange) onCoordsChange({ lat: data.lat, lng: data.lng, formatted: data.formatted });
      } else {
        setStatusMsg(`ℹ️ ${data.reason || 'Could not geocode address.'}`);
      }
    } catch {
      setStatusMsg('Could not reach geocoding service.');
    } finally {
      setGeocoding(false);
      setTimeout(() => setStatusMsg(''), 4000);
    }
  };

  return (
    <div className={`location-picker ${className}`} style={{ width: '100%' }}>
      {label && (
        <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem' }}>
          {label} {required && <span style={{ color: '#DC2626' }}>*</span>}
        </label>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <textarea
          className="form-textarea"
          value={address}
          onChange={(e) => onAddressChange && onAddressChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          rows={2}
          style={{ flex: 1, minWidth: 0, resize: 'vertical' }}
        />

        <button
          type="button"
          onClick={handleGeocode}
          disabled={geocoding || !address.trim()}
          title={
            mapsReady
              ? 'Geocode address to enable distance-based matching'
              : 'Google Maps API not configured — address saved as text'
          }
          style={{
            flexShrink: 0,
            padding: '0.45rem 0.75rem',
            fontSize: '0.78rem',
            fontWeight: 600,
            borderRadius: '0.5rem',
            border: `1.5px solid ${mapsReady ? '#2563EB' : '#9CA3AF'}`,
            background: mapsReady ? '#EFF6FF' : '#F9FAFB',
            color: mapsReady ? '#1D4ED8' : '#6B7280',
            cursor: geocoding ? 'wait' : 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
            marginTop: '0.1rem',
          }}
        >
          {geocoding ? '⏳' : '📍 Locate'}
        </button>
      </div>

      {/* Status & coordinate indicator */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.3rem', flexWrap: 'wrap' }}>
        {hasCoords && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            fontSize: '0.72rem', fontWeight: 600, color: '#16A34A',
            background: '#F0FDF4', border: '1px solid #86EFAC',
            borderRadius: '999px', padding: '0.2rem 0.6rem',
          }}>
            ✅ Location coordinates saved
          </span>
        )}
        {!mapsReady && !hasCoords && (
          <span style={{ fontSize: '0.7rem', color: '#6B7280' }}>
            ℹ️ City-level matching (no Maps API key)
          </span>
        )}
        {statusMsg && (
          <span style={{
            fontSize: '0.72rem',
            color: statusMsg.startsWith('✅') ? '#16A34A' : '#6B7280',
          }}>
            {statusMsg}
          </span>
        )}
      </div>
    </div>
  );
}
