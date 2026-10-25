import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  PickupsByMonthChart,
  CategoryDistributionChart,
  FoodOverTimeChart,
  CompletedVsActiveChart,
} from '../components/AnalyticsCharts';
import '../styles/Dashboard.css';
import '../styles/VolunteerDashboard.css';
import '../styles/LocationMap.css';
import '../styles/Analytics.css';
import LocationPicker from '../components/LocationPicker';
import LocationMap from '../components/LocationMap';

import { api, BACKEND_URL } from '../utils/api';
import DashboardTabs from '../components/DashboardTabs';

const VEHICLE_LABELS = {
  bicycle: '🚲 Bicycle',
  motorcycle: '🏍️ Motorcycle',
  car: '🚗 Car',
  van: '🚐 Van',
  truck: '🚚 Truck',
  other: '🚛 Other',
};

const STATUS_STEPS = [
  { key: 'ACCEPTED',           label: 'Requested'   },
  { key: 'VOLUNTEER_ASSIGNED', label: 'Assigned'    },
  { key: 'PICKED_UP',          label: 'Picked Up'   },
  { key: 'DELIVERED',          label: 'Delivered'   },
  { key: 'COMPLETED',          label: 'Confirmed'   },
];

function getStepState(status, stepKey) {
  const order = STATUS_STEPS.map((s) => s.key);
  const cur = order.indexOf(status);
  const pos = order.indexOf(stepKey);
  if (pos < cur) return 'done';
  if (pos === cur) return 'active';
  return '';
}

function StatusTimeline({ status }) {
  return (
    <div className="vd-timeline">
      {STATUS_STEPS.map((step, i) => {
        const state = getStepState(status, step.key);
        return (
          <div key={step.key} className={`vd-timeline__step ${state}`}>
            {i < STATUS_STEPS.length - 1 && <div className="vd-timeline__line" />}
            <div className="vd-timeline__dot" />
            <div className="vd-timeline__label">{step.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }) {
  const MAP = {
    ACCEPTED:           { cls: 'accepted',  label: '⏳ Requested'  },
    VOLUNTEER_ASSIGNED: { cls: 'assigned',  label: '🚗 Assigned'   },
    PICKED_UP:          { cls: 'picked',    label: '📦 Picked Up'  },
    DELIVERED:          { cls: 'delivered', label: '🏢 Delivered'  },
    COMPLETED:          { cls: 'completed', label: '✅ Completed'  },
  };
  const info = MAP[status] || { cls: 'accepted', label: status };
  return <span className={`vd-status-badge vd-status--${info.cls}`}>{info.label}</span>;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDateShort(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

// ─── Pickup Card (Available) ──────────────────────────────────────────────────
function PickupCard({ pickup, onAccept, hasActive, accepting }) {
  return (
    <div className="vd-pickup-card">
      {pickup.food_image ? (
        <img
          src={`${BACKEND_URL}${pickup.food_image}`}
          alt={pickup.food_name}
          className="vd-pickup-card__img"
        />
      ) : (
        <div className="vd-pickup-card__img-placeholder">🍱</div>
      )}
      <div className="vd-pickup-card__body">
        <div className="vd-pickup-card__name">{pickup.food_name}</div>
        <div className="vd-pickup-card__meta">
          <span>📦 {pickup.quantity} {pickup.unit}</span>
          <span>🏷️ {pickup.food_category}</span>
          {pickup.people_served && <span>👥 {pickup.people_served} people</span>}
          <span>🌿 {pickup.food_type}</span>
        </div>

        {/* Expiry */}
        <div className="vd-pickup-card__meta" style={{ color: '#DC2626' }}>
          <span>⏰ Best before: {formatDate(pickup.best_before)}</span>
        </div>

        {/* Addresses */}
        <div className="vd-address-block" style={{ marginTop: '0.5rem' }}>
          <div className="vd-address-item">
            <span className="vd-address-item__icon">📍</span>
            <div className="vd-address-item__content">
              <span className="vd-address-item__label">Pickup from Donor</span>
              <span className="vd-address-item__value">{pickup.pickup_address}</span>
              <span className="vd-address-item__sub">{pickup.city}</span>
              {pickup.donor_phone && (
                <span className="vd-address-item__sub">📞 {pickup.donor_phone}</span>
              )}
            </div>
          </div>
          <div className="vd-address-arrow">Deliver to NGO ↓</div>
          <div className="vd-address-item">
            <span className="vd-address-item__icon">🏢</span>
            <div className="vd-address-item__content">
              <span className="vd-address-item__label">Deliver to NGO</span>
              <span className="vd-address-item__value">
                {pickup.ngo_name || pickup.ngo_contact_name}
              </span>
              <span className="vd-address-item__sub">
                {pickup.ngo_address ? `${pickup.ngo_address}, ` : ''}
                {pickup.ngo_city || pickup.city}
              </span>
              {pickup.ngo_phone && (
                <span className="vd-address-item__sub">📞 {pickup.ngo_phone}</span>
              )}
            </div>
          </div>
        </div>

        {pickup.description && (
          <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            {pickup.description}
          </p>
        )}
      </div>

      <div className="vd-pickup-card__footer">
        <StatusBadge status="ACCEPTED" />
        <button
          className={`vd-btn vd-btn--accept${hasActive ? ' vd-btn--disabled' : ''}`}
          onClick={() => !hasActive && onAccept(pickup.id)}
          disabled={accepting || hasActive}
          title={hasActive ? 'Complete your active pickup first' : 'Accept this pickup'}
        >
          {accepting ? '⏳ Accepting…' : '✋ Accept Pickup'}
        </button>
      </div>
    </div>
  );
}

// ─── Active Pickup Card ───────────────────────────────────────────────────────
function ActivePickupCard({ pickup, onUpdateStatus, updating }) {
  const canPickup  = pickup.status === 'VOLUNTEER_ASSIGNED';
  const canDeliver = pickup.status === 'PICKED_UP';

  return (
    <div className="vd-active-card">
      <div className="vd-active-card__header">
        <div>
          <div className="vd-active-card__title">{pickup.food_name}</div>
          <div className="vd-active-card__subtitle">
            {pickup.quantity} {pickup.unit} · {pickup.food_category}
            {pickup.people_served ? ` · ${pickup.people_served} people` : ''}
          </div>
        </div>
        <StatusBadge status={pickup.status} />
      </div>

      {/* Status Timeline */}
      <StatusTimeline status={pickup.status} />

      {/* Addresses */}
      <div className="vd-active-card__addresses">
        <div className="vd-address-box">
          <div className="vd-address-box__label">
            <span>📍</span> Pickup Address (Donor)
          </div>
          <div className="vd-address-box__text">{pickup.pickup_address}</div>
          <div className="vd-address-box__sub">{pickup.city}</div>
          {pickup.donor_name && (
            <div className="vd-address-box__sub">Donor: {pickup.donor_name}</div>
          )}
          {pickup.donor_phone && (
            <div className="vd-address-box__sub">📞 {pickup.donor_phone}</div>
          )}
        </div>

        <div className="vd-address-box">
          <div className="vd-address-box__label">
            <span>🏢</span> Delivery Address (NGO)
          </div>
          <div className="vd-address-box__text">
            {pickup.ngo_name || pickup.ngo_contact_name}
          </div>
          <div className="vd-address-box__sub">
            {pickup.ngo_address ? `${pickup.ngo_address}, ` : ''}
            {pickup.ngo_city || pickup.city}
          </div>
          {pickup.ngo_phone && (
            <div className="vd-address-box__sub">📞 {pickup.ngo_phone}</div>
          )}
        </div>
      </div>

      {/* Location Map — pickup route */}
      <LocationMap
        pickup={{
          address: pickup.pickup_address,
          city: pickup.city,
          label: `Pickup from ${pickup.donor_name || 'Donor'}`,
        }}
        delivery={{
          address: pickup.ngo_address || null,
          city: pickup.ngo_city || pickup.city,
          label: `Deliver to ${pickup.ngo_name || pickup.ngo_contact_name || 'NGO'}`,
        }}
        compact
      />

      {/* Timestamps */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1.5rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
        {pickup.volunteer_assigned_at && (
          <span>🕐 Assigned: {formatDate(pickup.volunteer_assigned_at)}</span>
        )}
        {pickup.picked_up_at && (
          <span>📦 Picked up: {formatDate(pickup.picked_up_at)}</span>
        )}
        {pickup.delivered_at && (
          <span>🏢 Delivered: {formatDate(pickup.delivered_at)}</span>
        )}
      </div>

      {/* Actions */}
      <div className="vd-active-card__actions">
        {canPickup && (
          <button
            className="vd-btn vd-btn--pickup"
            onClick={() => onUpdateStatus(pickup.id, 'pickup')}
            disabled={updating}
          >
            {updating ? '⏳ Updating…' : '📦 Mark Food Collected'}
          </button>
        )}
        {canDeliver && (
          <button
            className="vd-btn vd-btn--deliver"
            onClick={() => onUpdateStatus(pickup.id, 'deliver')}
            disabled={updating}
          >
            {updating ? '⏳ Updating…' : '🏢 Mark Delivered to NGO'}
          </button>
        )}
        {pickup.status === 'DELIVERED' && (
          <p style={{ fontSize: '0.82rem', color: '#16A34A', fontWeight: 600 }}>
            ✅ Delivered! Waiting for NGO to confirm receipt.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Profile Panel ────────────────────────────────────────────────────────────
function ProfilePanel({ profile, user, onSaved }) {
  const [form, setForm] = useState({
    phone:        profile?.phone        || user?.phone || '',
    address:      profile?.address      || '',
    vehicle_type: profile?.vehicle_type || 'motorcycle',
    availability: profile?.availability || '',
    service_area: profile?.service_area || '',
    lat:          profile?.lat          || null,
    lng:          profile?.lng          || null,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState(null);
  const [err, setErr]       = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setMsg(null); setErr(null);
    try {
      const data = await api.put('/volunteer/profile', form);
      if (!data.success) throw new Error(data.error || 'Failed to save');
      setMsg('Profile saved successfully!');
      onSaved(data.profile);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {msg && <div className="vd-success" style={{ marginBottom: '1rem' }}>✅ {msg}</div>}
      {err && <div className="vd-error" style={{ marginBottom: '1rem' }}>❌ {err}</div>}

      <form onSubmit={handleSave}>
        <div className="vd-form-grid">
          {/* Name (read-only) */}
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" value={user?.name || ''} disabled />
          </div>

          {/* Email (read-only) */}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" value={user?.email || ''} disabled />
          </div>

          {/* Phone */}
          <div className="form-group">
            <label className="form-label">
              Phone <span className="vd-required">*</span>
            </label>
            <input
              className="form-input"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              required
            />
          </div>

          {/* Vehicle Type */}
          <div className="form-group">
            <label className="form-label">
              Vehicle Type <span className="vd-required">*</span>
            </label>
            <select
              className="form-input"
              value={form.vehicle_type}
              onChange={(e) => set('vehicle_type', e.target.value)}
              required
            >
              <option value="bicycle">🚲 Bicycle</option>
              <option value="motorcycle">🏍️ Motorcycle</option>
              <option value="car">🚗 Car</option>
              <option value="van">🚐 Van</option>
              <option value="truck">🚚 Truck</option>
              <option value="other">🚛 Other</option>
            </select>
          </div>

          {/* Address with Location Picker */}
          <div className="form-group vd-span-2">
            <LocationPicker
              address={form.address}
              lat={form.lat}
              lng={form.lng}
              label="Your Base Address"
              placeholder="Your home or base address for service area matching"
              onAddressChange={(val) => set('address', val)}
              onCoordsChange={({ lat, lng }) => { set('lat', lat); set('lng', lng); }}
            />
          </div>

          {/* Service Area */}
          <div className="form-group">
            <label className="form-label">Service Area</label>
            <input
              className="form-input"
              placeholder="e.g. Andheri, Bandra, Juhu"
              value={form.service_area}
              onChange={(e) => set('service_area', e.target.value)}
            />
          </div>

          {/* Availability */}
          <div className="form-group">
            <label className="form-label">Availability</label>
            <input
              className="form-input"
              placeholder="e.g. Weekdays 9AM–6PM"
              value={form.availability}
              onChange={(e) => set('availability', e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <button className="btn btn--primary" type="submit" disabled={saving}>
            {saving ? '⏳ Saving…' : '💾 Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'overview',   icon: '🏠', label: 'Overview'         },
  { id: 'analytics',  icon: '📊', label: 'Analytics'        },
  { id: 'available',  icon: '📋', label: 'Available Pickups' },
  { id: 'active',     icon: '🚗', label: 'My Active Pickup'  },
  { id: 'history',    icon: '✅', label: 'Completed'         },
  { id: 'profile',    icon: '👤', label: 'My Profile'        },
];

export default function VolunteerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData]           = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [actionMsg, setActionMsg] = useState(null);
  const [actionErr, setActionErr] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [updating,  setUpdating]  = useState(false);

  // City filter for available pickups
  const [cityFilter, setCityFilter] = useState('');

  const fetchDashboard = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await api.get('/volunteer/dashboard');
      if (!d.success) throw new Error(d.error || 'Failed to load dashboard');
      setData(d);
      setChartData(d.chart_data || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const clearMessages = () => { setActionMsg(null); setActionErr(null); };

  // Accept a pickup
  const handleAccept = async (donationId) => {
    if (!window.confirm('Are you sure you want to accept this food pickup request?')) return;
    clearMessages();
    setAccepting(true);
    try {
      const d = await api.post(`/volunteer/pickups/${donationId}/accept`);
      if (!d.success) throw new Error(d.error);
      setActionMsg(d.message);
      await fetchDashboard();
      setActiveTab('active');
    } catch (e) {
      setActionErr(e.message);
    } finally {
      setAccepting(false);
    }
  };

  // Update status: pickup | deliver
  const handleUpdateStatus = async (donationId, action) => {
    const actionDesc = action === 'pickup'
      ? 'confirm that you have collected this food donation from the donor'
      : 'confirm that you have delivered this food donation to the NGO';
    if (!window.confirm(`Are you sure you want to ${actionDesc}?`)) return;
    clearMessages();
    setUpdating(true);
    try {
      const d = await api.post(`/volunteer/pickups/${donationId}/${action}`);
      if (!d.success) throw new Error(d.error);
      setActionMsg(d.message);
      await fetchDashboard();
    } catch (e) {
      setActionErr(e.message);
    } finally {
      setUpdating(false);
    }
  };

  const initials = user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase() || '?';
  const hasActive = (data?.activePickups?.length || 0) > 0;

  const filteredAvailable = (data?.available || []).filter((p) =>
    !cityFilter || p.city?.toLowerCase().includes(cityFilter.toLowerCase())
  );

  // ── Render ──────────────────────────────────────────────────
  return (
    <main id="volunteer-dashboard" className="dashboard-page">
      <DashboardTabs activeRole="volunteer" />
      <div className="dashboard-layout">

        {/* ── Sidebar ───────────────────────────────── */}
        <aside className="dashboard-sidebar">
          <div className="dashboard-profile-card">
            <div
              className="dashboard-avatar"
              style={{ background: 'linear-gradient(135deg, #EA580C, #C2410C)' }}
            >
              {initials}
            </div>
            <p className="dashboard-user-name">{user?.name}</p>
            <p className="dashboard-user-email">{user?.email}</p>
            <span className="role-badge role-badge--volunteer">🚗 Volunteer</span>
            {data?.profile?.vehicle_type && (
              <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--color-text-muted)' }}>
                {VEHICLE_LABELS[data.profile.vehicle_type]}
              </p>
            )}
            {data?.profile?.service_area && (
              <p style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                📍 {data.profile.service_area}
              </p>
            )}
          </div>

          <nav className="dashboard-nav" aria-label="Volunteer Dashboard navigation">
            {NAV_ITEMS.map(({ id, icon, label }) => (
              <button
                key={id}
                className={`dashboard-nav__item${activeTab === id ? ' active' : ''}`}
                onClick={() => { clearMessages(); setActiveTab(id); }}
              >
                <span className="dashboard-nav__icon">{icon}</span>
                {label}
                {id === 'active' && hasActive && (
                  <span style={{
                    marginLeft: 'auto',
                    background: '#EA580C',
                    color: '#fff',
                    borderRadius: '999px',
                    fontSize: '0.65rem',
                    padding: '0.1rem 0.45rem',
                    fontWeight: 700,
                  }}>
                    {data.activePickups.length}
                  </span>
                )}
                {id === 'available' && data?.stats?.available > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    background: '#F59E0B',
                    color: '#fff',
                    borderRadius: '999px',
                    fontSize: '0.65rem',
                    padding: '0.1rem 0.45rem',
                    fontWeight: 700,
                  }}>
                    {data.stats.available}
                  </span>
                )}
              </button>
            ))}
            <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.5rem 0' }} />
            <button className="dashboard-nav__item" onClick={handleLogout}>
              <span className="dashboard-nav__icon">🚪</span>
              Log Out
            </button>
          </nav>
        </aside>

        {/* ── Main Content ──────────────────────────── */}
        <div className="dashboard-main">
          {/* Welcome Banner */}
          <div className="dashboard-welcome dashboard-welcome--volunteer">
            <div className="dashboard-welcome__text">
              <h2>Ready to deliver, {user?.name?.split(' ')[0]}? 🚗</h2>
              <p>
                You are the backbone of FoodBridge. Accept pickup requests, collect food
                from donors, and deliver it to NGOs — every delivery makes a difference.
              </p>
            </div>
            <div className="dashboard-welcome__emoji">🚗</div>
          </div>

          {/* Global messages */}
          {actionMsg && (
            <div className="vd-success">✅ {actionMsg}</div>
          )}
          {actionErr && (
            <div className="vd-error">❌ {actionErr}</div>
          )}

          {loading ? (
            <div className="vd-loading">Loading dashboard…</div>
          ) : error ? (
            <div className="vd-error">❌ {error}</div>
          ) : (
            <>
              {/* ── ANALYTICS ─────────────────────── */}
              {activeTab === 'analytics' && (
                <VolunteerAnalyticsPanel stats={data?.stats} chartData={chartData} loading={loading} />
              )}

              {/* ── OVERVIEW ──────────────────────── */}
              {activeTab === 'overview' && (
                <>
                  {/* Stats */}
                  <div className="dashboard-stats vd-stats-4">
                    {[
                      { icon: '📋', value: data.stats.available,  label: 'Pickup Requests' },
                      { icon: '🚗', value: data.stats.active,     label: 'Active Pickups'  },
                      { icon: '✅', value: data.stats.completed,  label: 'Completed'       },
                      { icon: '🍱', value: `${data.stats.totalFood} kg`, label: 'Food Delivered' },
                    ].map(({ icon, value, label }) => (
                      <div className="stat-card" key={label}>
                        <div className="stat-card__icon">{icon}</div>
                        <div className="stat-card__value">{value}</div>
                        <div className="stat-card__label">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Active pickup preview */}
                  {hasActive && (
                    <div className="dashboard-card">
                      <h3 className="dashboard-card__title">🚗 My Active Pickup</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {data.activePickups.map((p) => (
                          <ActivePickupCard
                            key={p.id}
                            pickup={p}
                            onUpdateStatus={handleUpdateStatus}
                            updating={updating}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Available pickups teaser */}
                  <div className="dashboard-card">
                    <h3 className="dashboard-card__title">
                      📋 Available Pickup Requests
                      <button
                        onClick={() => setActiveTab('available')}
                        style={{
                          marginLeft: 'auto',
                          background: '#FFF7ED',
                          color: '#EA580C',
                          border: '1.5px solid #FDBA74',
                          borderRadius: '0.375rem',
                          padding: '0.25rem 0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        View All ({data.stats.available})
                      </button>
                    </h3>
                    {data.available.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-state__icon">📭</div>
                        <p className="empty-state__title">No pickup requests available</p>
                        <p className="empty-state__desc">
                          When an NGO accepts a donation, it will appear here for volunteers to pick up.
                        </p>
                      </div>
                    ) : (
                      <div className="vd-card-grid">
                        {data.available.slice(0, 3).map((p) => (
                          <PickupCard
                            key={p.id}
                            pickup={p}
                            onAccept={handleAccept}
                            hasActive={hasActive}
                            accepting={accepting}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent completed */}
                  <div className="dashboard-card">
                    <h3 className="dashboard-card__title">✅ Recent Completed Deliveries</h3>
                    {data.completed.length === 0 ? (
                      <div className="empty-state">
                        <div className="empty-state__icon">📭</div>
                        <p className="empty-state__title">No deliveries yet</p>
                        <p className="empty-state__desc">Your completed deliveries will be listed here.</p>
                      </div>
                    ) : (
                      <div className="vd-table-wrap">
                        <table className="vd-table">
                          <thead>
                            <tr>
                              <th>Food</th>
                              <th>Quantity</th>
                              <th>NGO</th>
                              <th>Delivered</th>
                              <th>Confirmed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.completed.slice(0, 5).map((c) => (
                              <tr key={c.id}>
                                <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                  {c.food_name}
                                </td>
                                <td>{c.quantity} {c.unit}</td>
                                <td>{c.ngo_name || c.ngo_contact_name}</td>
                                <td>{formatDateShort(c.delivered_at)}</td>
                                <td><StatusBadge status="COMPLETED" /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ── AVAILABLE PICKUPS ─────────────── */}
              {activeTab === 'available' && (
                <div className="dashboard-card">
                  <h3 className="dashboard-card__title">📋 Available Pickup Requests</h3>
                  {hasActive && (
                    <div className="vd-error" style={{ marginBottom: '1rem' }}>
                      ⚠️ You have an active pickup. Complete it before accepting a new one.
                    </div>
                  )}

                  {/* Filter */}
                  <div className="vd-filters">
                    <div className="vd-filter-group">
                      <label>City</label>
                      <input
                        type="text"
                        placeholder="Filter by city…"
                        value={cityFilter}
                        onChange={(e) => setCityFilter(e.target.value)}
                      />
                    </div>
                    {cityFilter && (
                      <button
                        className="vd-btn vd-btn--accept"
                        style={{ alignSelf: 'flex-end' }}
                        onClick={() => setCityFilter('')}
                      >
                        ✕ Clear
                      </button>
                    )}
                  </div>

                  {filteredAvailable.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state__icon">📭</div>
                      <p className="empty-state__title">No pickup requests available</p>
                      <p className="empty-state__desc">
                        Check back soon — once an NGO accepts a donation, it will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="vd-card-grid">
                      {filteredAvailable.map((p) => (
                        <PickupCard
                          key={p.id}
                          pickup={p}
                          onAccept={handleAccept}
                          hasActive={hasActive}
                          accepting={accepting}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── ACTIVE PICKUP ─────────────────── */}
              {activeTab === 'active' && (
                <div className="dashboard-card">
                  <h3 className="dashboard-card__title">🚗 My Active Pickup</h3>
                  {data.activePickups.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state__icon">🚗</div>
                      <p className="empty-state__title">No active pickup</p>
                      <p className="empty-state__desc">
                        Accept a pickup request from the{' '}
                        <button
                          onClick={() => setActiveTab('available')}
                          style={{ background: 'none', border: 'none', color: '#EA580C', fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                        >
                          Available Pickups
                        </button>
                        {' '}tab.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {data.activePickups.map((p) => (
                        <ActivePickupCard
                          key={p.id}
                          pickup={p}
                          onUpdateStatus={handleUpdateStatus}
                          updating={updating}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── HISTORY ───────────────────────── */}
              {activeTab === 'history' && (
                <div className="dashboard-card">
                  <h3 className="dashboard-card__title">✅ Completed Deliveries</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                    Total food delivered: <strong>{data.stats.totalFood} kg</strong> across{' '}
                    <strong>{data.stats.completed}</strong> deliveries.
                  </p>
                  {data.completed.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state__icon">📭</div>
                      <p className="empty-state__title">No completed deliveries yet</p>
                      <p className="empty-state__desc">Your delivery history will appear here.</p>
                    </div>
                  ) : (
                    <div className="vd-table-wrap">
                      <table className="vd-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Food Item</th>
                            <th>Qty</th>
                            <th>Pickup Address</th>
                            <th>NGO</th>
                            <th>Delivered</th>
                            <th>Confirmed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.completed.map((c, i) => (
                            <tr key={c.id}>
                              <td style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                {i + 1}
                              </td>
                              <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                {c.food_name}
                                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                                  {c.food_category} · {c.city}
                                </div>
                              </td>
                              <td>{c.quantity} {c.unit}</td>
                              <td style={{ fontSize: '0.8rem' }}>
                                {c.pickup_address}
                              </td>
                              <td>{c.ngo_name || c.ngo_contact_name}</td>
                              <td>{formatDateShort(c.delivered_at)}</td>
                              <td><StatusBadge status="COMPLETED" /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── PROFILE ───────────────────────── */}
              {activeTab === 'profile' && (
                <div className="dashboard-card">
                  <h3 className="dashboard-card__title">👤 My Profile</h3>
                  <ProfilePanel
                    profile={data?.profile}
                    user={user}
                    onSaved={(p) => setData((d) => ({ ...d, profile: p }))}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VOLUNTEER ANALYTICS PANEL
   ═══════════════════════════════════════════════════════════════════════ */
function VolunteerAnalyticsPanel({ stats, chartData, loading }) {
  if (loading) return <div className="dashboard-card"><div className="vd-loading">Loading analytics…</div></div>;
  if (!stats)  return <div className="dashboard-card"><div className="vd-error">No data available.</div></div>;

  const n = (v) => Number(v ?? 0).toLocaleString('en-IN');

  const impactStats = [
    { icon: '📋', color: 'amber',  value: n(stats.available),                    label: 'Pickup Requests'  },
    { icon: '🚗', color: 'blue',   value: n(stats.active),                       label: 'Active Pickups'   },
    { icon: '✅', color: 'green',  value: n(stats.completed),                    label: 'Completed'        },
    { icon: '🌾', color: 'teal',   value: `${n(Math.round(stats.totalFood ?? 0))} kg`, label: 'Food Delivered' },
    { icon: '👥', color: 'purple', value: n(stats.totalPeople ?? 0),             label: 'People Served'    },
  ];

  return (
    <div className="dashboard-card">
      {/* Banner */}
      <div className="analytics-banner">
        <div>
          <div className="analytics-banner__title">📊 My Delivery Analytics</div>
          <div className="analytics-banner__sub">Your personal volunteer statistics — calculated from real database records</div>
        </div>
        <div className="analytics-banner__icon">🚗</div>
      </div>

      {/* Impact stats strip */}
      <div className="impact-strip" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {impactStats.map(({ icon, color, value, label }) => (
          <div className="impact-stat" key={label}>
            <div className={`impact-stat__icon impact-stat__icon--${color}`}>{icon}</div>
            <div className="impact-stat__body">
              <div className="impact-stat__value">{value}</div>
              <div className="impact-stat__label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="analytics-section">
        <div className="analytics-section__title">📈 Delivery Trends</div>
        <div className="analytics-grid">
          <PickupsByMonthChart data={chartData?.pickups_by_month} />
          <CategoryDistributionChart data={chartData?.category_distribution} />
        </div>
        <div className="analytics-grid">
          <FoodOverTimeChart data={chartData?.food_over_time} label="Food Delivered (kg)" />
          <CompletedVsActiveChart
            completed={stats.completed}
            active={stats.active}
            posted={0}
            cancelled={0}
          />
        </div>
      </div>
    </div>
  );
}
