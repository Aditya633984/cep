import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, BACKEND_URL } from '../utils/api';
import DonationStatusBadge from '../components/DonationStatusBadge';
import SmartMatchPanel from '../components/SmartMatchPanel';
import LocationPicker from '../components/LocationPicker';
import LocationMap from '../components/LocationMap';
import {
  DonationsByMonthChart,
  CategoryDistributionChart,
  CompletedVsActiveChart,
  FoodOverTimeChart,
  PeopleOverTimeChart,
} from '../components/AnalyticsCharts';
import '../styles/Dashboard.css';
import '../styles/DonorDashboard.css';
import '../styles/SmartMatch.css';
import '../styles/LocationMap.css';
import '../styles/Analytics.css';

// ─── Sidebar navigation items ─────────────────────────────────────────────────
const NAV_ITEMS = [
  { icon: '🏠', label: 'Overview',      view: 'overview'   },
  { icon: '📊', label: 'Analytics',     view: 'analytics'  },
  { icon: '🍱', label: 'My Donations',  view: 'donations'  },
  { icon: '➕', label: 'Add Donation',  view: 'add'        },
  { icon: '⚙️', label: 'Settings',      view: 'settings'   },
];

export default function DonorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [view,       setView]       = useState('overview');
  const [stats,      setStats]      = useState(null);
  const [chartData,  setChartData]  = useState(null);
  const [recent,     setRecent]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [matchDonation, setMatchDonation] = useState(null); // donation being matched

  const initials = user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase() || '?';

  // ── Fetch dashboard data ───────────────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/donor/dashboard');
      if (data.success) {
        setStats(data.stats);
        setChartData(data.chart_data || null);
        setRecent(data.recentDonations || []);
      } else {
        setError(data.error || 'Failed to load dashboard.');
      }
    } catch {
      setError('Could not connect to server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  // ── Stat cards ─────────────────────────────────────────────────────────────
  const statCards = stats
    ? [
        { icon: '🍽️', value: stats.total,        label: 'Total Donations'  },
        { icon: '⚡',  value: stats.active,       label: 'Active'           },
        { icon: '✅',  value: stats.completed,    label: 'Completed'        },
        { icon: '🌾',  value: `${stats.totalFood ?? 0} kg`, label: 'Food Donated' },
        { icon: '👥',  value: stats.totalPeople ?? 0, label: 'People Served'  },
      ]
    : [];

  return (
    <main id="donor-dashboard" className="dashboard-page">
      <div className="dashboard-layout">

        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <aside className="dashboard-sidebar">
          <div className="dashboard-profile-card">
            <div className="dashboard-avatar">{initials}</div>
            <p className="dashboard-user-name">{user?.name}</p>
            <p className="dashboard-user-email">{user?.email}</p>
            <span className="role-badge role-badge--donor">🍱 Donor</span>
          </div>

          <nav className="dashboard-nav" aria-label="Donor navigation">
            {NAV_ITEMS.map(({ icon, label, view: v }) => (
              <button
                key={v}
                className={`dashboard-nav__item${view === v ? ' active' : ''}`}
                onClick={() => setView(v)}
              >
                <span className="dashboard-nav__icon">{icon}</span>
                {label}
              </button>
            ))}
            <div style={{ borderTop: '1px solid var(--color-border)', margin: '0.5rem 0' }} />
            <button className="dashboard-nav__item" onClick={handleLogout}>
              <span className="dashboard-nav__icon">🚪</span>
              Log Out
            </button>
          </nav>
        </aside>

        {/* ── Main Content ─────────────────────────────────────────── */}
        <div className="dashboard-main">
          {/* Smart Match Panel (overlay-style, full width) */}
          {matchDonation && (
            <SmartMatchPanel
              donation={matchDonation}
              userRole="donor"
              onClose={() => setMatchDonation(null)}
              onAccepted={() => { fetchDashboard(); setMatchDonation(null); }}
            />
          )}

          {!matchDonation && view === 'overview' && (
            <OverviewPanel
              user={user}
              stats={stats}
              statCards={statCards}
              recent={recent}
              loading={loading}
              error={error}
              onAddDonation={() => setView('add')}
              onViewAll={() => setView('donations')}
              onAnalytics={() => setView('analytics')}
            />
          )}
          {!matchDonation && view === 'analytics' && (
            <DonorAnalyticsPanel stats={stats} chartData={chartData} loading={loading} />
          )}
          {!matchDonation && view === 'donations' && (
            <DonationsPanel
              onAdd={() => setView('add')}
              onRefreshDashboard={fetchDashboard}
              onSmartMatch={(donation) => setMatchDonation(donation)}
            />
          )}
          {!matchDonation && view === 'add' && (
            <DonationForm
              onSuccess={() => { setView('donations'); fetchDashboard(); }}
              onCancel={() => setView('overview')}
            />
          )}
          {view === 'settings' && <SettingsPanel user={user} />}
        </div>
      </div>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   OVERVIEW PANEL
   ═══════════════════════════════════════════════════════════════════════════ */
function OverviewPanel({ user, statCards, recent, loading, error, onAddDonation, onViewAll }) {
  const fmt = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <>
      {/* Welcome banner */}
      <div className="dashboard-welcome">
        <div className="dashboard-welcome__text">
          <h2>Welcome back, {user?.name?.split(' ')[0]}! 👋</h2>
          <p>Thank you for being a food donor. Your contributions help feed families across your community.</p>
          <button className="btn btn-outline-white" style={{ marginTop: '1rem' }} onClick={onAddDonation}>
            + Add New Donation
          </button>
        </div>
        <div className="dashboard-welcome__emoji">🍱</div>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="dd-loading">Loading stats…</div>
      ) : error ? (
        <div className="dd-error">{error}</div>
      ) : (
        <div className="dashboard-stats" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {statCards.map(({ icon, value, label }) => (
            <div className="stat-card" key={label}>
              <div className="stat-card__icon">{icon}</div>
              <div className="stat-card__value">{value}</div>
              <div className="stat-card__label">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Recent donations */}
      <div className="dashboard-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="dashboard-card__title" style={{ margin: 0 }}>🍱 Recent Donations</h3>
          <button className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={onViewAll}>
            View All
          </button>
        </div>
        {loading ? (
          <div className="dd-loading">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📭</div>
            <p className="empty-state__title">No donations yet</p>
            <p className="empty-state__desc">Click "Add New Donation" to make your first donation.</p>
          </div>
        ) : (
          <div className="dd-donation-list">
            {recent.map((d) => (
              <RecentDonationRow key={d.id} donation={d} fmt={fmt} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function RecentDonationRow({ donation: d, fmt }) {
  return (
    <div className="dd-donation-row">
      <div className="dd-donation-row__left">
        <span className="dd-donation-row__name">{d.food_name}</span>
        <span className="dd-donation-row__meta">
          {d.food_category} · {d.quantity} kg · {d.city}
        </span>
        <span className="dd-donation-row__date">{fmt(d.created_at)}</span>
      </div>
      <DonationStatusBadge status={d.status} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   DONOR ANALYTICS PANEL
   ═══════════════════════════════════════════════════════════════════════════ */
function DonorAnalyticsPanel({ stats, chartData, loading }) {
  if (loading) return <div className="dashboard-card"><div className="dd-loading">Loading analytics…</div></div>;
  if (!stats)  return <div className="dashboard-card"><div className="dd-error">No data available.</div></div>;

  const n = (v) => Number(v ?? 0).toLocaleString('en-IN');

  const impactStats = [
    { icon: '🍽️', color: 'blue',   value: n(stats.total),                    label: 'Total Donations'  },
    { icon: '⚡',  color: 'amber',  value: n(stats.active),                    label: 'Active Donations' },
    { icon: '✅',  color: 'green',  value: n(stats.completed),                 label: 'Completed'        },
    { icon: '🌾',  color: 'teal',   value: `${n(Math.round(stats.totalFood ?? 0))} kg`, label: 'Food Donated' },
    { icon: '👥',  color: 'purple', value: n(stats.totalPeople),               label: 'People Served'    },
    { icon: '❌',  color: 'rose',   value: n(stats.cancelled),                 label: 'Cancelled'        },
  ];

  return (
    <div className="dashboard-card">
      {/* Banner */}
      <div className="analytics-banner">
        <div>
          <div className="analytics-banner__title">📊 My Impact Analytics</div>
          <div className="analytics-banner__sub">Your personal donation statistics — calculated from real data</div>
        </div>
        <div className="analytics-banner__icon">🍱</div>
      </div>

      {/* Impact stats strip */}
      <div className="impact-strip" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
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

      {/* Charts grid */}
      <div className="analytics-section">
        <div className="analytics-section__title">📈 Donation Trends</div>
        <div className="analytics-grid">
          <DonationsByMonthChart data={chartData?.donations_by_month} />
          <CategoryDistributionChart data={chartData?.category_distribution} />
        </div>
        <div className="analytics-grid">
          <FoodOverTimeChart data={chartData?.food_over_time} />
          <PeopleOverTimeChart data={chartData?.people_over_time} />
        </div>
        <div className="analytics-grid--full analytics-grid">
          <CompletedVsActiveChart
            completed={stats.completed}
            active={stats.active}
            posted={0}
            cancelled={stats.cancelled}
          />
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════════
   DONATIONS PANEL  (full list with detail view, edit, cancel)
   ═══════════════════════════════════════════════════════════════════════════ */
function DonationsPanel({ onAdd, onRefreshDashboard, onSmartMatch }) {
  const [donations, setDonations] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [detailId,  setDetailId]  = useState(null);
  const [editId,    setEditId]    = useState(null);

  const statuses = ['', 'POSTED','ACCEPTED','VOLUNTEER_ASSIGNED','PICKED_UP','DELIVERED','COMPLETED','CANCELLED'];

  const fetchDonations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const path = filterStatus ? `/donor/donations?status=${filterStatus}` : '/donor/donations';
      const data = await api.get(path);
      if (data.success) setDonations(data.donations);
      else setError(data.error || 'Failed to load donations.');
    } catch {
      setError('Could not connect to server.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchDonations(); }, [fetchDonations]);

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this donation?')) return;
    const data = await api.delete(`/donor/donations/${id}`);
    if (data.success) { fetchDonations(); onRefreshDashboard(); }
    else alert(data.error || 'Failed to cancel.');
  };

  const fmt = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  if (detailId) {
    return (
      <DonationDetail
        id={detailId}
        onBack={() => setDetailId(null)}
        onEdit={(id) => { setDetailId(null); setEditId(id); }}
        onCancel={handleCancel}
        onSmartMatch={onSmartMatch}
      />
    );
  }

  if (editId) {
    return (
      <DonationForm
        donationId={editId}
        onSuccess={() => { setEditId(null); fetchDonations(); onRefreshDashboard(); }}
        onCancel={() => setEditId(null)}
      />
    );
  }

  return (
    <div className="dashboard-card">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h3 className="dashboard-card__title" style={{ margin: 0 }}>🍱 My Donations</h3>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select
            className="form-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>{s || 'All Statuses'}</option>
            ))}
          </select>
          <button className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={onAdd}>
            + Add Donation
          </button>
        </div>
      </div>

      {loading ? (
        <div className="dd-loading">Loading donations…</div>
      ) : error ? (
        <div className="dd-error">{error}</div>
      ) : donations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">📭</div>
          <p className="empty-state__title">No donations found</p>
          <p className="empty-state__desc">
            {filterStatus ? `No donations with status "${filterStatus}".` : 'Make your first donation!'}
          </p>
        </div>
      ) : (
        <div className="dd-table-wrap">
          <table className="dd-table">
            <thead>
              <tr>
                <th>Food Name</th>
                <th>Category</th>
                <th>Qty</th>
                <th>City</th>
                <th>Status</th>
                <th>Posted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d) => (
                <tr key={d.id}>
                  <td>
                    <button className="dd-link" onClick={() => setDetailId(d.id)}>{d.food_name}</button>
                  </td>
                  <td>{d.food_category}</td>
                  <td>{d.quantity} {d.unit}</td>
                  <td>{d.city}</td>
                  <td><DonationStatusBadge status={d.status} /></td>
                  <td>{fmt(d.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button className="dd-action-btn dd-action-btn--view" onClick={() => setDetailId(d.id)}>View</button>
                      {d.status === 'POSTED' && (
                        <>
                          <button
                            className="sm-trigger-btn"
                            onClick={() => onSmartMatch && onSmartMatch(d)}
                            title="Find best matching NGOs"
                          >
                            🧠 Find NGOs
                          </button>
                          <button className="dd-action-btn dd-action-btn--edit" onClick={() => setEditId(d.id)}>Edit</button>
                          <button className="dd-action-btn dd-action-btn--cancel" onClick={() => handleCancel(d.id)}>Cancel</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   DONATION DETAIL
   ═══════════════════════════════════════════════════════════════════════════ */
function DonationDetail({ id, onBack, onEdit, onCancel, onSmartMatch }) {
  const [donation, setDonation] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await api.get(`/donor/donations/${id}`);
      if (data.success) setDonation(data.donation);
      else setError(data.error || 'Not found.');
      setLoading(false);
    })();
  }, [id]);

  const fmt = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';

  if (loading) return <div className="dashboard-card"><div className="dd-loading">Loading…</div></div>;
  if (error)   return <div className="dashboard-card"><div className="dd-error">{error}</div></div>;
  if (!donation) return null;

  // Build status timeline
  const ALL_STATUSES = ['POSTED','ACCEPTED','VOLUNTEER_ASSIGNED','PICKED_UP','DELIVERED','COMPLETED'];
  const currentIdx = ALL_STATUSES.indexOf(donation.status);
  const isCancelled = donation.status === 'CANCELLED';

  return (
    <div className="dashboard-card">
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.82rem' }} onClick={onBack}>
          ← Back
        </button>
        {donation.status === 'POSTED' && (
          <>
            <button
              className="sm-trigger-btn"
              style={{ fontSize: '0.82rem', padding: '0.4rem 1rem' }}
              onClick={() => onSmartMatch && onSmartMatch(donation)}
            >
              🧠 Smart Match NGOs
            </button>
            <button className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.82rem' }} onClick={() => onEdit(id)}>
              ✏️ Edit
            </button>
            <button className="dd-action-btn dd-action-btn--cancel" style={{ padding: '0.4rem 0.9rem' }} onClick={() => onCancel(id).then(onBack)}>
              ❌ Cancel Donation
            </button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>{donation.food_name}</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Posted on {fmtDate(donation.created_at)} · #{donation.id}
          </p>
        </div>
        <DonationStatusBadge status={donation.status} />
      </div>

      {/* Status Timeline */}
      {!isCancelled && (
        <div className="dd-timeline" style={{ marginBottom: '1.75rem' }}>
          {ALL_STATUSES.map((s, i) => {
            const done    = i <= currentIdx;
            const active  = i === currentIdx;
            return (
              <div key={s} className={`dd-timeline__step${done ? ' done' : ''}${active ? ' active' : ''}`}>
                <div className="dd-timeline__dot" />
                <div className="dd-timeline__label">{s.replace('_', ' ')}</div>
                {i < ALL_STATUSES.length - 1 && <div className="dd-timeline__line" />}
              </div>
            );
          })}
        </div>
      )}
      {isCancelled && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1.5rem', color: '#DC2626', fontSize: '0.875rem', fontWeight: 600 }}>
          ❌ This donation was cancelled.
        </div>
      )}

      {/* Food image */}
      {donation.food_image && (
        <div style={{ marginBottom: '1.5rem' }}>
          <img
            src={`${BACKEND_URL}${donation.food_image}`}
            alt={donation.food_name}
            style={{ width: '100%', maxHeight: '280px', objectFit: 'cover', borderRadius: '0.75rem', border: '1px solid var(--color-border)' }}
          />
        </div>
      )}

      {/* Location map */}
      <LocationMap
        pickup={{
          address: donation.pickup_address,
          city: donation.city,
          lat: donation.lat,
          lng: donation.lng,
          label: 'Pickup Location',
        }}
        distance={
          donation.estimated_distance
            ? { km: donation.estimated_distance, method: donation.distance_method || 'city-match' }
            : null
        }
      />

      {/* Detail grid */}
      <div className="dd-detail-grid">
        <DetailField label="Food Category"    value={donation.food_category} />
        <DetailField label="Food Type"        value={donation.food_type === 'vegetarian' ? '🌿 Vegetarian' : '🍗 Non-Vegetarian'} />
        <DetailField label="Quantity"         value={`${donation.quantity} ${donation.unit}`} />
        <DetailField label="People Served"    value={donation.people_served ?? '—'} />
        <DetailField label="Preparation Date" value={fmtDate(donation.preparation_date)} />
        <DetailField label="Best Before"      value={fmt(donation.best_before)} />
        <DetailField label="City"             value={donation.city} />
        <DetailField label="Pickup Availability" value={donation.pickup_availability || '—'} />
        {donation.description && (
          <DetailField label="Description" value={donation.description} wide />
        )}
      </div>
    </div>
  );
}

function DetailField({ label, value, wide }) {
  return (
    <div className={`dd-detail-field${wide ? ' wide' : ''}`}>
      <label>{label}</label>
      <p>{value}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   DONATION FORM  (create + edit)
   ═══════════════════════════════════════════════════════════════════════════ */

const CATEGORIES = ['Cooked Food','Packaged Food','Dry Ration','Fruits','Vegetables','Bakery Items','Dairy','Other'];
const UNITS = ['kg','g','liters','ml','pieces','servings','boxes','packets'];

function DonationForm({ donationId, onSuccess, onCancel }) {
  const isEdit = Boolean(donationId);
  const [form, setForm] = useState({
    food_name: '', food_category: 'Cooked Food', quantity: '', unit: 'kg',
    people_served: '', food_type: 'vegetarian', preparation_date: '',
    best_before: '', pickup_address: '', city: '', description: '',
    pickup_availability: '',
    lat: null, lng: null,  // geocoded coordinates
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [existingImage, setExistingImage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Load existing data when editing
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const data = await api.get(`/donor/donations/${donationId}`);
      if (data.success) {
        const d = data.donation;
        // Format dates for input fields
        const prepDate = d.preparation_date ? d.preparation_date.substring(0, 10) : '';
        const bestBefore = d.best_before ? d.best_before.substring(0, 16) : '';
        setForm({
          food_name: d.food_name, food_category: d.food_category,
          quantity: d.quantity, unit: d.unit,
          people_served: d.people_served ?? '', food_type: d.food_type,
          preparation_date: prepDate, best_before: bestBefore,
          pickup_address: d.pickup_address, city: d.city,
          description: d.description || '', pickup_availability: d.pickup_availability || '',
          lat: d.lat || null, lng: d.lng || null,
        });
        if (d.food_image) setExistingImage(`${BACKEND_URL}${d.food_image}`);
      }
    })();
  }, [donationId, isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate required
    if (!form.food_name || !form.food_category || !form.quantity || !form.unit ||
        !form.food_type || !form.preparation_date || !form.best_before ||
        !form.pickup_address || !form.city) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v !== '') fd.append(k, v); });
      if (imageFile) fd.append('food_image', imageFile);

      const data = isEdit
        ? await api.putForm(`/donor/donations/${donationId}`, fd)
        : await api.postForm('/donor/donations', fd);

      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || 'Something went wrong.');
      }
    } catch {
      setError('Could not connect to server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dashboard-card">
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        <button className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.82rem' }} onClick={onCancel}>
          ← Back
        </button>
        <h3 className="dashboard-card__title" style={{ margin: 0 }}>
          {isEdit ? '✏️ Edit Donation' : '➕ Add New Donation'}
        </h3>
      </div>

      {error && <div className="dd-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <form onSubmit={handleSubmit} className="dd-form">
        <div className="dd-form-grid">
          {/* Food Name */}
          <div className="form-group">
            <label className="form-label">Food Name <span className="dd-required">*</span></label>
            <input className="form-input" name="food_name" value={form.food_name} onChange={handleChange} placeholder="e.g. Dal Chawal, Biryani" required />
          </div>

          {/* Food Category */}
          <div className="form-group">
            <label className="form-label">Food Category <span className="dd-required">*</span></label>
            <select className="form-select" name="food_category" value={form.food_category} onChange={handleChange} required>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Quantity */}
          <div className="form-group">
            <label className="form-label">Quantity <span className="dd-required">*</span></label>
            <input className="form-input" type="number" name="quantity" value={form.quantity} onChange={handleChange} min="0.01" step="0.01" placeholder="e.g. 5" required />
          </div>

          {/* Unit */}
          <div className="form-group">
            <label className="form-label">Unit <span className="dd-required">*</span></label>
            <select className="form-select" name="unit" value={form.unit} onChange={handleChange} required>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {/* People Served */}
          <div className="form-group">
            <label className="form-label">Number of People Served</label>
            <input className="form-input" type="number" name="people_served" value={form.people_served} onChange={handleChange} min="1" placeholder="e.g. 20" />
          </div>

          {/* Food Type */}
          <div className="form-group">
            <label className="form-label">Food Type <span className="dd-required">*</span></label>
            <div className="dd-radio-group">
              <label className={`dd-radio${form.food_type === 'vegetarian' ? ' checked' : ''}`}>
                <input type="radio" name="food_type" value="vegetarian" checked={form.food_type === 'vegetarian'} onChange={handleChange} />
                🌿 Vegetarian
              </label>
              <label className={`dd-radio${form.food_type === 'non-vegetarian' ? ' checked' : ''}`}>
                <input type="radio" name="food_type" value="non-vegetarian" checked={form.food_type === 'non-vegetarian'} onChange={handleChange} />
                🍗 Non-Vegetarian
              </label>
            </div>
          </div>

          {/* Preparation Date */}
          <div className="form-group">
            <label className="form-label">Preparation Date <span className="dd-required">*</span></label>
            <input className="form-input" type="date" name="preparation_date" value={form.preparation_date} onChange={handleChange} required />
          </div>

          {/* Best Before */}
          <div className="form-group">
            <label className="form-label">Best Before / Expiry <span className="dd-required">*</span></label>
            <input className="form-input" type="datetime-local" name="best_before" value={form.best_before} onChange={handleChange} required />
          </div>

          {/* City */}
          <div className="form-group">
            <label className="form-label">City <span className="dd-required">*</span></label>
            <input className="form-input" name="city" value={form.city} onChange={handleChange} placeholder="e.g. Mumbai" required />
          </div>

          {/* Pickup Address with Location Picker */}
          <div className="form-group dd-span-2">
            <LocationPicker
              address={form.pickup_address}
              city={form.city}
              lat={form.lat}
              lng={form.lng}
              label="Pickup Address"
              required
              placeholder="Full address for food pickup (e.g. 12 Main St, Andheri West)"
              onAddressChange={(val) => setForm((p) => ({ ...p, pickup_address: val }))}
              onCoordsChange={({ lat, lng }) => setForm((p) => ({ ...p, lat, lng }))}
            />
          </div>

          {/* Pickup Availability */}
          <div className="form-group dd-span-2">
            <label className="form-label">Pickup Availability / Timings</label>
            <input className="form-input" name="pickup_availability" value={form.pickup_availability} onChange={handleChange} placeholder="e.g. Mon-Fri, 9 AM – 12 PM" />
          </div>

          {/* Description */}
          <div className="form-group dd-span-2">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" name="description" value={form.description} onChange={handleChange} rows={3} placeholder="Additional details about the food…" />
          </div>

          {/* Food Image */}
          <div className="form-group dd-span-2">
            <label className="form-label">Food Image</label>
            <div className="dd-image-upload" onClick={() => document.getElementById('food-image-input').click()}>
              {imagePreview || existingImage ? (
                <img
                  src={imagePreview || existingImage}
                  alt="Preview"
                  style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '0.5rem' }}
                />
              ) : (
                <div className="dd-image-upload__placeholder">
                  <span style={{ fontSize: '2.5rem' }}>📷</span>
                  <p>Click to upload food image</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>JPG, PNG, WebP · Max 5 MB</p>
                </div>
              )}
              <input id="food-image-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
            </div>
            {(imagePreview || existingImage) && (
              <button type="button" style={{ color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', marginTop: '0.25rem' }}
                onClick={() => { setImageFile(null); setImagePreview(''); setExistingImage(''); }}>
                Remove image
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Post Donation'}
          </button>
          <button type="button" className="btn btn-outline btn-lg" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SETTINGS PANEL (placeholder)
   ═══════════════════════════════════════════════════════════════════════════ */
function SettingsPanel({ user }) {
  return (
    <div className="dashboard-card">
      <h3 className="dashboard-card__title">⚙️ Settings</h3>
      <div className="dd-detail-grid">
        <DetailField label="Full Name"     value={user?.name}  />
        <DetailField label="Email"         value={user?.email} />
        <DetailField label="Role"          value="Donor"       />
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '1.5rem' }}>
        Profile editing will be available in a future update.
      </p>
    </div>
  );
}
