/**
 * SmartMatchPanel – displays ranked NGO recommendations for a donation.
 *
 * Props:
 *   donation     {object}   – donation object { id, food_name, food_category, food_type, quantity, unit, city, best_before, status }
 *   userRole     {string}   – 'donor' | 'ngo' | 'admin'
 *   currentNgoId {number}   – only when role === 'ngo', highlights "You"
 *   onClose      {function} – called when the panel is dismissed
 *   onAccepted   {function} – called after an NGO accepts (for state refresh)
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import '../styles/SmartMatch.css';

// ─── Factor Icon Map ──────────────────────────────────────────────────────────
const FACTOR_ICONS = {
  distance:      '📍',
  foodCategory:  '🍽️',
  freshness:     '⏰',
  capacity:      '🏋️',
  vegetarian:    '🥗',
  operatingArea: '🗺️',
  availability:  '🟢',
};

// ─── Score ring SVG ───────────────────────────────────────────────────────────
function ScoreRing({ score, color }) {
  const r   = 26;
  const c   = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const offset = c * (1 - pct);

  return (
    <div className="sm-score-ring">
      <svg viewBox="0 0 64 64">
        <circle className="sm-score-ring__track" cx="32" cy="32" r={r} />
        <circle
          className="sm-score-ring__fill"
          cx="32" cy="32" r={r}
          stroke={color}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="sm-score-ring__value">
        {score}
        <span className="sm-score-ring__label">/ 100</span>
      </div>
    </div>
  );
}

// ─── Factor bar color ─────────────────────────────────────────────────────────
function barClass(score) {
  if (score >= 80) return 'sm-bar-excellent';
  if (score >= 60) return 'sm-bar-good';
  if (score >= 40) return 'sm-bar-fair';
  return 'sm-bar-poor';
}

// ─── Single NGO match card ────────────────────────────────────────────────────
function MatchCard({ match, rank, donation, userRole, currentNgoId, onAccepted }) {
  const [expanded,  setExpanded]  = useState(rank <= 1);
  const [accepting, setAccepting] = useState(false);
  const [accepted,  setAccepted]  = useState(false);
  const [acceptErr, setAcceptErr] = useState('');

  const rankClass = rank === 1 ? 'sm-rank--1' : rank === 2 ? 'sm-rank--2' : rank === 3 ? 'sm-rank--3' : 'sm-rank--n';
  const isMe = userRole === 'ngo' && String(currentNgoId) === String(match.ngo_id);
  const canAccept = userRole === 'ngo' && isMe && donation.status === 'POSTED' && !accepted;

  const handleAccept = async () => {
    setAccepting(true);
    setAcceptErr('');
    try {
      const data = await api.post(`/matching/donations/${donation.id}/ngos/${match.ngo_id}/accept`, {});
      if (!data.success) throw new Error(data.error || 'Failed to accept');
      setAccepted(true);
      if (onAccepted) onAccepted();
    } catch (e) {
      setAcceptErr(e.message);
    } finally {
      setAccepting(false);
    }
  };

  // Top reason from highest weighted factor with a good score
  const topFactor = match.factors
    ? [...match.factors].sort((a, b) => (b.score * b.weight) - (a.score * a.weight))[0]
    : null;

  return (
    <div className={`sm-card${rank === 1 ? ' sm-card--top' : ''}`}>
      {/* Rank badge */}
      <div className={`sm-rank ${rankClass}`}>#{rank}</div>

      {/* Info */}
      <div className="sm-card__info">
        {/* NGO name + badges row */}
        <div className="sm-card__name-row">
          <span className="sm-card__name">
            {match.ngo_name}
            {isMe && <span className="sm-you-badge">You</span>}
          </span>
          <div className="sm-card__badges">
            {match.verification_status === 'verified' && (
              <span className="sm-badge sm-badge--verified">✅ Verified</span>
            )}
            {match.ngo_is_available === false ? (
              <span className="sm-badge sm-badge--unavail">🔴 Unavailable</span>
            ) : (
              <span className="sm-badge sm-badge--avail">🟢 Available</span>
            )}
          </div>
        </div>

        {/* Meta pills */}
        <div className="sm-card__meta">
          {match.estimated_distance && (
            <span className="sm-meta-pill">
              📍 ~{match.estimated_distance} km
              {match.distance_method === 'haversine' && (
                <span
                  title="GPS-accurate distance"
                  style={{ marginLeft: '0.2rem', fontSize: '0.65rem', color: '#16A34A' }}
                >✅</span>
              )}
              {' · '}{match.ngo_city || '—'}
            </span>
          )}
          {match.ngo_capacity && (
            <span className="sm-meta-pill">🏋️ Capacity: {match.ngo_capacity} kg</span>
          )}
          {match.hours_until_expiry !== null && (
            <span className={`sm-meta-pill${match.hours_until_expiry < 4 ? ' sm-meta-pill--urgent' : ''}`}>
              ⏰ {match.hours_until_expiry}h until expiry
            </span>
          )}
          {match.ngo_food_types && (
            <span className="sm-meta-pill">🍽️ {match.ngo_food_types}</span>
          )}
          {match.ngo_operating_area && (
            <span className="sm-meta-pill">🗺️ {match.ngo_operating_area}</span>
          )}
          {match.ngo_address && (
            <span className="sm-meta-pill">🏢 {match.ngo_address}</span>
          )}
        </div>

        {/* Top recommendation reason */}
        {topFactor && (
          <div className="sm-reason-callout">
            <span className="sm-reason-callout__icon">💡</span>
            <span>{topFactor.reason}</span>
          </div>
        )}

        {/* Factor breakdown (expandable) */}
        {expanded && (
          <div className="sm-factors">
            {match.factors?.map((f) => (
              <div key={f.key} className="sm-factor-row">
                <div className="sm-factor-row__header">
                  <span className="sm-factor-icon">{FACTOR_ICONS[f.key] || '•'}</span>
                  <span className="sm-factor-row__label">{f.label}</span>
                  <div className="sm-factor-bar">
                    <div
                      className={`sm-factor-bar__fill ${barClass(f.score)}`}
                      style={{ width: `${f.score}%` }}
                    />
                  </div>
                  <span className="sm-factor-score">{f.score}</span>
                  <span className="sm-factor-weight">wt:{f.weight}%</span>
                </div>
                <div className="sm-factor-reason">{f.reason}</div>
              </div>
            ))}
          </div>
        )}

        {/* Controls row */}
        <div className="sm-card__actions">
          <button className="sm-expand-btn" onClick={() => setExpanded((x) => !x)}>
            {expanded ? '▲ Hide breakdown' : '▼ Show 7-factor breakdown'}
          </button>
          {acceptErr && <span className="sm-accept-err">{acceptErr}</span>}
        </div>
      </div>

      {/* Score ring + accept button */}
      <div className="sm-score-col">
        <ScoreRing score={match.score} color={match.tierColor} />
        <span className="sm-tier-badge" style={{ color: match.tierColor, borderColor: match.tierColor }}>
          {match.tier}
        </span>

        {canAccept && !accepted && (
          <button className="sm-accept-btn" onClick={handleAccept} disabled={accepting}>
            {accepting ? '⏳…' : '✅ Accept'}
          </button>
        )}
        {accepted && (
          <div className="sm-accepted-notice">✅ Accepted!</div>
        )}
      </div>
    </div>
  );
}

// ─── Weight chip ──────────────────────────────────────────────────────────────
function WeightChip({ label, value }) {
  return (
    <span className="sm-weight-chip">
      {label} <strong>{value}</strong>
    </span>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function SmartMatchPanel({ donation, userRole, currentNgoId, onClose, onAccepted }) {
  const [matches,      setMatches]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [algorithm,    setAlgorithm]    = useState(null);
  const [totalEval,    setTotalEval]    = useState(0);
  const [showAlgo,     setShowAlgo]     = useState(false);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs  = onlyVerified ? '?only_verified=true&limit=10' : '?limit=10';
      const data = await api.get(`/matching/donations/${donation.id}/ngos${qs}`);
      if (!data.success) throw new Error(data.error || 'Failed to load matches');
      setMatches(data.matches || []);
      setAlgorithm(data.algorithm);
      setTotalEval(data.total_ngos_evaluated || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [donation.id, onlyVerified]);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  const formatBestBefore = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const hoursLeft = donation.best_before
    ? Math.max(0, (new Date(donation.best_before) - Date.now()) / 3600000).toFixed(1)
    : null;

  const isUrgent = hoursLeft !== null && Number(hoursLeft) <= 4;

  return (
    <div className="sm-panel">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sm-panel__header">
        <div>
          <h3 className="sm-panel__title">
            🧠 Smart Food Matching
            {isUrgent && <span className="sm-urgent-badge">🚨 Urgent</span>}
          </h3>
          <div className="sm-panel__subtitle">
            Recommended NGOs for <strong>{donation.food_name}</strong>
          </div>
        </div>
        <div className="sm-panel__header-right">
          <span className="sm-panel__algo-badge">⚙️ Rule-Based Algorithm v1.0</span>
          <button className="sm-panel__close" onClick={onClose}>✕ Close</button>
        </div>
      </div>

      {/* ── Donation summary strip ──────────────────────────────────────────── */}
      <div className="sm-donation-strip">
        <span>🍽️ <strong>{donation.food_category}</strong></span>
        <span>📦 <strong>{donation.quantity} {donation.unit}</strong></span>
        <span>{donation.food_type === 'vegetarian' ? '🌿' : '🍗'} <strong>{donation.food_type}</strong></span>
        <span>📍 <strong>{donation.city}</strong></span>
        {hoursLeft !== null && (
          <span style={{ color: isUrgent ? '#B91C1C' : '#5B21B6', fontWeight: 700 }}>
            ⏰ {hoursLeft}h remaining · Best before: {formatBestBefore(donation.best_before)}
          </span>
        )}
      </div>

      {/* ── Controls ───────────────────────────────────────────────────────── */}
      <div className="sm-controls">
        <label>
          <input
            type="checkbox"
            checked={onlyVerified}
            onChange={(e) => setOnlyVerified(e.target.checked)}
          />
          Verified NGOs only
        </label>
        <button
          className="sm-refresh-btn"
          onClick={fetchMatches}
          disabled={loading}
        >
          🔄 Refresh
        </button>
        {!loading && matches.length > 0 && (
          <span className="sm-count">
            Top {matches.length} of {totalEval} NGO{totalEval !== 1 ? 's' : ''} evaluated
          </span>
        )}
        {algorithm && (
          <button className="sm-algo-toggle" onClick={() => setShowAlgo((x) => !x)}>
            {showAlgo ? '▲ Hide algo' : '📊 Algorithm Info'}
          </button>
        )}
      </div>

      {/* ── Algorithm Info (expandable) ────────────────────────────────────── */}
      {showAlgo && algorithm && (
        <div className="sm-algo-info">
          <div className="sm-algo-info__title">⚙️ Algorithm v{algorithm.version} · {algorithm.type}</div>
          <p className="sm-algo-info__desc">{algorithm.description}</p>
          <div className="sm-algo-info__weights">
            {Object.entries(algorithm.weights).map(([k, v]) => (
              <WeightChip key={k} label={k.replace(/([A-Z])/g, ' $1').trim()} value={v} />
            ))}
          </div>
          <p className="sm-algo-info__note">🔮 {algorithm.note}</p>
          {isUrgent && (
            <p className="sm-algo-info__urgent">
              🚨 <strong>Urgency mode active:</strong> Proximity and availability weights have been increased because this donation expires in &lt;4 hours.
            </p>
          )}
        </div>
      )}

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="sm-loading">
          <div className="sm-spinner" />
          <div>Analysing {donation.city} NGOs…</div>
          <div style={{ fontSize: '0.74rem', marginTop: '0.4rem', opacity: 0.7 }}>
            Running 7-factor rule-based scoring algorithm
          </div>
        </div>
      ) : error ? (
        <div className="sm-error">❌ {error}</div>
      ) : matches.length === 0 ? (
        <div className="sm-empty">
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏢</div>
          <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No NGOs found</p>
          <p style={{ fontSize: '0.82rem' }}>
            {onlyVerified ? 'Try disabling the "verified only" filter.' : 'No NGO profiles are registered yet.'}
          </p>
        </div>
      ) : (
        <>
          {/* Top match callout */}
          {matches[0] && (
            <div className="sm-top-callout">
              <span className="sm-top-callout__label">🏆 Best Match</span>
              <span className="sm-top-callout__name">{matches[0].ngo_name}</span>
              <span className="sm-top-callout__score" style={{ color: matches[0].tierColor }}>
                Score: {matches[0].score}/100 — {matches[0].tier}
              </span>
            </div>
          )}

          <div className="sm-list">
            {matches.map((m, i) => (
              <MatchCard
                key={m.ngo_id}
                match={m}
                rank={i + 1}
                donation={donation}
                userRole={userRole}
                currentNgoId={currentNgoId}
                onAccepted={() => { if (onAccepted) onAccepted(); fetchMatches(); }}
              />
            ))}
          </div>

          {/* Footer transparency note */}
          <div className="sm-footer">
            <span>
              📊 Scored across <strong>7 factors</strong>:
              Proximity (28%) · Food Compatibility (23%) · Freshness (18%) ·
              Capacity (12%) · Dietary Match (8%) · Availability (6%) · Operating Area (5%)
            </span>
            <span style={{ marginTop: '0.3rem', display: 'block', fontSize: '0.7rem', opacity: 0.7 }}>
              📍 Distance uses GPS coordinates (Haversine) when available, city matching otherwise
            </span>
          </div>
        </>
      )}
    </div>
  );
}
