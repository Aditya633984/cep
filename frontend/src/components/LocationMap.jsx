/**
 * LocationMap – Map display component.
 *
 * Currently renders a clean static card showing address, city, and distance.
 * Structured to plug in Google Maps JavaScript API or Leaflet.js with
 * minimal changes — just replace the <StaticMapPlaceholder> with the
 * actual <GoogleMap> or <MapContainer> component.
 *
 * Props:
 *   pickup   { address, city, lat?, lng?, label? }
 *   delivery { address, city, lat?, lng?, label? }  (optional — NGO drop-off)
 *   distance { km, method }   (optional — computed distance info)
 *   compact  {boolean}        (optional — condensed single-location view)
 */

import { useState } from 'react';
import '../styles/LocationMap.css';

// ─── Static Placeholder (no API key needed) ───────────────────────────────────
function StaticMapPlaceholder({ pickup, delivery, hasCoords }) {
  // When Google Maps API key is added, replace this entire component with:
  //   <GoogleMap center={{ lat: pickup.lat, lng: pickup.lng }} zoom={13}>
  //     <Marker position={{ lat: pickup.lat, lng: pickup.lng }} label="P" />
  //     {delivery && <Marker position={{ lat: delivery.lat, lng: delivery.lng }} label="N" />}
  //   </GoogleMap>
  //
  // Or with Leaflet.js (open source, no API key):
  //   <MapContainer center={[pickup.lat, pickup.lng]} zoom={13}>
  //     <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  //     <Marker position={[pickup.lat, pickup.lng]} />
  //     {delivery && <Marker position={[delivery.lat, delivery.lng]} />}
  //   </MapContainer>

  return (
    <div className="lm-placeholder">
      <div className="lm-placeholder__icon">🗺️</div>
      <div className="lm-placeholder__text">
        {hasCoords
          ? 'Map ready · Add Google Maps API key to enable interactive view'
          : 'Address-based matching active'}
      </div>
      <div className="lm-placeholder__note">
        {hasCoords
          ? '✅ GPS coordinates stored — distance calculated via Haversine formula'
          : 'ℹ️ City-level proximity used for smart matching'}
      </div>
    </div>
  );
}

// ─── Location Row ──────────────────────────────────────────────────────────────
function LocationRow({ icon, label, address, city, hasCoords, color }) {
  return (
    <div className="lm-loc-row" style={{ borderLeftColor: color }}>
      <div className="lm-loc-row__icon" style={{ color }}>{icon}</div>
      <div className="lm-loc-row__content">
        <div className="lm-loc-row__label" style={{ color }}>{label}</div>
        {address && <div className="lm-loc-row__address">{address}</div>}
        <div className="lm-loc-row__city">
          {city || '—'}
          {hasCoords && (
            <span className="lm-coords-badge">📍 GPS</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Distance Badge ────────────────────────────────────────────────────────────
function DistanceBadge({ distance }) {
  if (!distance) return null;

  const { km, method } = distance;
  if (!km) return null;

  const isHaversine = method === 'haversine';
  const isClose = parseFloat(km) <= 5;

  return (
    <div className={`lm-distance-badge${isClose ? ' lm-distance-badge--close' : ''}`}>
      <span className="lm-distance-badge__icon">📏</span>
      <div>
        <div className="lm-distance-badge__km">
          {typeof km === 'number' ? `~${km} km` : `~${km}`}
        </div>
        <div className="lm-distance-badge__method">
          {isHaversine ? '✅ GPS-accurate' : '≈ City estimate'}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function LocationMap({ pickup, delivery, distance, compact = false }) {
  const [showMap, setShowMap] = useState(false);
  const hasCoords = Boolean(
    (pickup?.lat && pickup?.lng) || (delivery?.lat && delivery?.lng)
  );

  if (compact) {
    // Compact view: just a row with addresses + distance badge
    return (
      <div className="lm-compact">
        {pickup && (
          <div className="lm-compact__loc">
            <span className="lm-compact__icon">📍</span>
            <div>
              <div className="lm-compact__label">Pickup</div>
              <div className="lm-compact__address">{pickup.address}</div>
              <div className="lm-compact__city">{pickup.city}</div>
            </div>
          </div>
        )}
        {pickup && delivery && (
          <div className="lm-compact__arrow">
            ↓
            {distance?.km && (
              <span className="lm-compact__dist">
                ~{distance.km} km
                {distance.method === 'haversine' && ' 📍'}
              </span>
            )}
          </div>
        )}
        {delivery && (
          <div className="lm-compact__loc">
            <span className="lm-compact__icon">🏢</span>
            <div>
              <div className="lm-compact__label">{delivery.label || 'NGO'}</div>
              <div className="lm-compact__address">{delivery.address}</div>
              <div className="lm-compact__city">{delivery.city}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="lm-card">
      {/* Header */}
      <div className="lm-card__header">
        <span className="lm-card__title">📍 Location Details</span>
        <div className="lm-card__header-right">
          {distance && <DistanceBadge distance={distance} />}
          <button
            className="lm-toggle-btn"
            onClick={() => setShowMap((v) => !v)}
            title="Toggle map view"
          >
            {showMap ? '▲ Hide map' : '🗺️ View map'}
          </button>
        </div>
      </div>

      {/* Location rows */}
      <div className="lm-locs">
        {pickup && (
          <LocationRow
            icon="📍"
            label={pickup.label || 'Pickup Location'}
            address={pickup.address}
            city={pickup.city}
            hasCoords={Boolean(pickup.lat && pickup.lng)}
            color="#2563EB"
          />
        )}
        {pickup && delivery && (
          <div className="lm-route-line">
            <div className="lm-route-line__line" />
            {distance?.km && (
              <div className="lm-route-line__dist">
                ~{distance.km} km
                {distance.method === 'haversine' && (
                  <span title="GPS-accurate distance" style={{ marginLeft: '0.25rem' }}>📍</span>
                )}
              </div>
            )}
          </div>
        )}
        {delivery && (
          <LocationRow
            icon="🏢"
            label={delivery.label || 'NGO / Drop-off Location'}
            address={delivery.address}
            city={delivery.city}
            hasCoords={Boolean(delivery.lat && delivery.lng)}
            color="#16A34A"
          />
        )}
      </div>

      {/* Map panel */}
      {showMap && (
        <div className="lm-map-area">
          <StaticMapPlaceholder pickup={pickup} delivery={delivery} hasCoords={hasCoords} />
        </div>
      )}

      {/* Footer note */}
      {!hasCoords && (
        <div className="lm-footer-note">
          ℹ️ Add a Google Maps API key to enable GPS-accurate distance and interactive maps.
        </div>
      )}
    </div>
  );
}
