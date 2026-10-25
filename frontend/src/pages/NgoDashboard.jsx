import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import '../styles/NgoDashboard.css';
import '../styles/SmartMatch.css';
import '../styles/LocationMap.css';
import '../styles/Analytics.css';
import DemandPredictionPanel from '../components/DemandPredictionPanel';

// ─── Sidebar Nav ──────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { icon: '🏠', label: 'Overview',             view: 'overview'  },
  { icon: '📊', label: 'Analytics',            view: 'analytics' },
  { icon: '🤖', label: 'AI Demand Forecast',   view: 'predict'   },
  { icon: '🍱', label: 'Available Donations',  view: 'available' },
  { icon: '✅', label: 'Accepted Donations',   view: 'accepted'  },
  { icon: '📦', label: 'Received Donations',   view: 'received'  },
  { icon: '🏢', label: 'NGO Profile',          view: 'profile'   },
];

const CATEGORIES = [
  'Cooked Food','Packaged Food','Dry Ration',
  'Fruits','Vegetables','Bakery Items','Dairy','Other',
];

// ─── Root Component ───────────────────────────────────────────────────────────
export default function NgoDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [view,      setView]      = useState('overview');
  const [stats,     setStats]     = useState(null);
  const [chartData, setChartData] = useState(null);
  const [profile,   setProfile]   = useState(null);
  const [recent,    setRecent]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [matchDonation, setMatchDonation] = useState(null); // Smart match panel trigger

  const initials = user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase() || '?';

  const fetchDashboard = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await api.get('/ngo/dashboard');
      if (data.success) {
        setStats(data.stats);
        setChartData(data.chart_data || null);
        setProfile(data.profile);
        setRecent(data.recentAccepted || []);
      } else { setError(data.error || 'Failed to load dashboard.'); }
    } catch { setError('Could not connect to server.'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleLogout = async () => { await logout(); navigate('/', { replace: true }); };

  const statCards = stats ? [
    { icon: '🍱', value: stats.available,              label: 'Available Now'  },
    { icon: '✅', value: stats.accepted,               label: 'Accepted'       },
    { icon: '📦', value: stats.received,               label: 'Received'       },
    { icon: '🌾', value: `${stats.totalFood ?? 0} kg`, label: 'Food Received'  },
    { icon: '👥', value: stats.totalPeople ?? 0,       label: 'People Served'  },
  ] : [];

  return (
    <main id="ngo-dashboard" className="dashboard-page">
      <div className="dashboard-layout">

        {/* ── Sidebar ─────────────────────────────────────────── */}
        <aside className="dashboard-sidebar">
          <div className="dashboard-profile-card">
            <div className="dashboard-avatar" style={{ background: 'linear-gradient(135deg, #16A34A, #15803D)' }}>
              {initials}
            </div>
            <p className="dashboard-user-name">{profile?.ngo_name || user?.name}</p>
            <p className="dashboard-user-email">{user?.email}</p>
            <span className="role-badge role-badge--ngo">🏢 NGO</span>
            {profile && (
              <div style={{ marginTop: '0.6rem' }}>
                <VerifyBadge status={profile.verification_status} />
              </div>
            )}
          </div>

          <nav className="dashboard-nav" aria-label="NGO navigation">
            {NAV_ITEMS.map(({ icon, label, view: v }) => (
              <button
                key={v}
                className={'dashboard-nav__item' + (view === v ? ' active' : '')}
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

        {/* ── Main ────────────────────────────────────────────── */}
        <div className="dashboard-main">
          {/* Smart Match Panel (full-width overlay when triggered) */}
          {matchDonation && (
            <SmartMatchPanel
              donation={matchDonation}
              userRole="ngo"
              currentNgoId={user?.id}
              onClose={() => setMatchDonation(null)}
              onAccepted={() => { fetchDashboard(); setMatchDonation(null); }}
            />
          )}

          {!matchDonation && view === 'overview'  && <OverviewPanel user={user} profile={profile} statCards={statCards} recent={recent} loading={loading} error={error} onNavigate={setView} />}
          {!matchDonation && view === 'analytics' && <NgoAnalyticsPanel stats={stats} chartData={chartData} loading={loading} />}
          {!matchDonation && view === 'available' && <AvailablePanel onRefresh={fetchDashboard} onSmartMatch={(d) => setMatchDonation(d)} />}
          {!matchDonation && view === 'accepted'  && <AcceptedPanel  onRefresh={fetchDashboard} />}
          {!matchDonation && view === 'received'  && <ReceivedPanel />}
          {!matchDonation && view === 'profile'   && <ProfilePanel profile={profile} onSaved={fetchDashboard} />}
          {!matchDonation && view === 'predict'   && (
            <div className="dashboard-card">
              <DemandPredictionPanel />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NGO ANALYTICS PANEL
   ═══════════════════════════════════════════════════════════════════════ */
function NgoAnalyticsPanel({ stats, chartData, loading }) {
  if (loading) return <div className="dashboard-card"><div className="dd-loading">Loading analytics…</div></div>;
  if (!stats)  return <div className="dashboard-card"><div className="dd-error">No data available.</div></div>;

  const n = (v) => Number(v ?? 0).toLocaleString('en-IN');

  const impactStats = [
    { icon: '🍱', color: 'amber',  value: n(stats.available),                    label: 'Available Now'       },
    { icon: '✅', color: 'blue',   value: n(stats.accepted),                     label: 'Total Accepted'      },
    { icon: '📦', color: 'green',  value: n(stats.received),                     label: 'Successfully Received'},
    { icon: '🌾', color: 'teal',   value: `${n(Math.round(stats.totalFood ?? 0))} kg`, label: 'Food Received' },
    { icon: '👥', color: 'purple', value: n(stats.totalPeople),                  label: 'People Fed'          },
  ];

  const active = Math.max(0, stats.accepted - stats.received);

  return (
    <div className="dashboard-card">
      {/* Banner */}
      <div className="analytics-banner">
        <div>
          <div className="analytics-banner__title">📊 NGO Impact Analytics</div>
          <div className="analytics-banner__sub">Your NGO's food distribution statistics — from real database records</div>
        </div>
        <div className="analytics-banner__icon">🏢</div>
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

      <div className="analytics-section">
        <div className="analytics-section__title">📈 Trends</div>
        <div className="analytics-grid">
          <DonationsByMonthChart data={chartData?.donations_by_month} label="Donations Accepted" />
          <CategoryDistributionChart data={chartData?.category_distribution} />
        </div>
        <div className="analytics-grid">
          <FoodOverTimeChart data={chartData?.food_over_time} label="Food Received (kg)" />
          <PeopleOverTimeChart data={chartData?.people_over_time} />
        </div>
        <div className="analytics-grid--full analytics-grid">
          <CompletedVsActiveChart
            completed={stats.received}
            active={active}
            posted={0}
            cancelled={0}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Verification badge ─────────────────────────────────────────────────── */
function VerifyBadge({ status }) {
  const map = {
    pending:  { cls: 'nd-verify-banner--pending',  icon: '⏳', label: 'Pending Verification' },
    verified: { cls: 'nd-verify-banner--verified', icon: '✅', label: 'Verified NGO'          },
    rejected: { cls: 'nd-verify-banner--rejected', icon: '❌', label: 'Verification Rejected' },
  };
  const m = map[status] || map.pending;
  return (
    <div className={'nd-verify-banner ' + m.cls} style={{ justifyContent: 'center', marginBottom: 0 }}>
      {m.icon} {m.label}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   AI FORECAST WIDGET — shown inside OverviewPanel
   ═══════════════════════════════════════════════════════════════════════ */
function AiForecastWidget({ onNavigate }) {
  const [pred, setPred]     = useState(null);  // best prediction
  const [status, setStatus] = useState('loading'); // loading | ok | insufficient | error

  useEffect(() => {
    api.get('/ngo/predict')
      .then((d) => {
        if (!d.success) { setStatus('error'); return; }
        const ok = (d.predictions || []).filter(p => p.status === 'ok');
        if (ok.length === 0) { setStatus('insufficient'); return; }
        // Sort by predicted_qty descending, show the highest-demand category
        ok.sort((a, b) => b.predicted_qty - a.predicted_qty);
        setPred(ok[0]);
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
  }, []);

  const CONF_COLOR = { high: '#22C55E', medium: '#FBBF24', low: '#F43F5E' };
  const CONF_ICON  = { high: '🟢', medium: '🟡', low: '🔴' };

  return (
    <div className="ai-forecast-widget">
      <div className="ai-forecast-widget__header">
        <span className="ai-forecast-widget__icon">🤖</span>
        <div>
          <div className="ai-forecast-widget__title">AI Demand Forecast</div>
          <div className="ai-forecast-widget__sub">Tomorrow's predicted food requirement</div>
        </div>
        <button
          className="ai-forecast-widget__cta"
          onClick={() => onNavigate('predict')}
        >
          Full Forecast →
        </button>
      </div>

      {status === 'loading' && (
        <div className="ai-forecast-widget__body ai-forecast-widget__body--muted">
          <span className="ai-fw-spinner" /> Analysing historical data…
        </div>
      )}

      {status === 'error' && (
        <div className="ai-forecast-widget__body ai-forecast-widget__body--muted">
          ⚠️ Could not load forecast. <button className="nd-link" onClick={() => onNavigate('predict')}>Try manually →</button>
        </div>
      )}

      {status === 'insufficient' && (
        <div className="ai-forecast-widget__body ai-forecast-widget__body--muted">
          📉 Insufficient data for prediction.&nbsp;
          <span style={{ fontSize: '0.75rem' }}>Accept &amp; complete at least 3 donations per category to unlock forecasts.</span>
        </div>
      )}

      {status === 'ok' && pred && (
        <div className="ai-forecast-widget__body">
          <div className="ai-fw-category">{pred.category}</div>
          <div className="ai-fw-qty">
            <span className="ai-fw-qty__main">{pred.predicted_qty}</span>
            <span className="ai-fw-qty__unit">units</span>
            <span className="ai-fw-qty__range">({pred.predicted_qty_low}–{pred.predicted_qty_high})</span>
          </div>
          {pred.predicted_people != null && (
            <div className="ai-fw-people">≈ {pred.predicted_people} people</div>
          )}
          <div className="ai-fw-meta">
            <span style={{ color: CONF_COLOR[pred.confidence] }}>
              {CONF_ICON[pred.confidence]} {pred.confidence} confidence
            </span>
            <span className="ai-fw-meta__sep">·</span>
            <span>{pred.data_points} data pts</span>
            <span className="ai-fw-meta__sep">·</span>
            <span>{pred.factors?.day_of_week}, {pred.factors?.month}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OVERVIEW PANEL
   ═══════════════════════════════════════════════════════════════════════ */
function OverviewPanel({ user, profile, statCards, recent, loading, error, onNavigate }) {
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';
  return (
    <>
      {/* Welcome */}
      <div className="dashboard-welcome dashboard-welcome--ngo">
        <div className="dashboard-welcome__text">
          <h2>Welcome, {profile?.ngo_name || user?.name?.split(' ')[0]}! 🌱</h2>
          <p>Manage incoming food donations, accept suitable ones, and confirm deliveries — all in one place.</p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button className="btn btn-outline-white" onClick={() => onNavigate('available')}>Browse Donations</button>
            {!profile && <button className="btn btn-outline-white" onClick={() => onNavigate('profile')}>Complete Profile</button>}
          </div>
        </div>
        <div className="dashboard-welcome__emoji">🏢</div>
      </div>

      {/* Stat cards */}
      {loading ? <div className="nd-loading">Loading stats…</div>
        : error ? <div className="nd-error">{error}</div>
        : (
          <div className="dashboard-stats nd-stats-5" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {statCards.map(({ icon, value, label }) => (
              <div className="stat-card" key={label}>
                <div className="stat-card__icon">{icon}</div>
                <div className="stat-card__value">{value}</div>
                <div className="stat-card__label">{label}</div>
              </div>
            ))}
          </div>
        )
      }

      {/* Profile incomplete notice */}
      {!loading && !profile && (
        <div className="nd-verify-banner nd-verify-banner--pending">
          ⚠️ Your NGO profile is incomplete.&nbsp;
          <button className="nd-link" style={{ color: '#D97706', fontWeight: 700 }} onClick={() => onNavigate('profile')}>
            Complete it now →
          </button>
        </div>
      )}
      {!loading && profile?.verification_status === 'pending' && (
        <div className="nd-verify-banner nd-verify-banner--pending">
          ⏳ Your profile is <strong>pending admin verification</strong>. You can still browse and accept donations.
        </div>
      )}
      {!loading && profile?.verification_status === 'rejected' && (
        <div className="nd-verify-banner nd-verify-banner--rejected">
          ❌ Verification <strong>rejected</strong>. Please update your profile.&nbsp;
          <button className="nd-link" style={{ color: '#DC2626', fontWeight: 700 }} onClick={() => onNavigate('profile')}>Update →</button>
        </div>
      )}

      {/* AI Forecast Widget */}
      {!loading && <AiForecastWidget onNavigate={onNavigate} />}

      {/* Recent accepted */}
      <div className="dashboard-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="dashboard-card__title" style={{ margin: 0 }}>✅ Recently Accepted</h3>
          <button className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={() => onNavigate('accepted')}>View All</button>
        </div>
        {loading ? <div className="nd-loading">Loading…</div>
          : recent.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📭</div>
              <p className="empty-state__title">No accepted donations yet</p>
              <p className="empty-state__desc">Browse available donations and accept ones that match your needs.</p>
            </div>
          ) : (
            <div>
              {recent.map((d) => (
                <div key={d.id} className="nd-recent-row">
                  <div className="nd-recent-row__info">
                    <div className="nd-recent-row__name">{d.food_name}</div>
                    <div className="nd-recent-row__meta">{d.food_category} · {d.quantity} {d.unit} · {d.city} · by {d.donor_name} · {fmtDate(d.accepted_at)}</div>
                  </div>
                  <DonationStatusBadge status={d.status} />
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* Quick guide */}
      <div className="dashboard-card">
        <h3 className="dashboard-card__title">📋 How It Works</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '1rem' }}>
          {[
            { step: '1', icon: '🔍', title: 'Browse',    desc: 'View all available food donations posted by donors.' },
            { step: '2', icon: '🎯', title: 'Filter',    desc: 'Filter by category, food type, quantity, city, and expiry.' },
            { step: '3', icon: '✅', title: 'Accept',    desc: 'Accept suitable donations and coordinate with the donor.' },
            { step: '4', icon: '📦', title: 'Confirm',   desc: 'Mark donations as received to track your total impact.' },
          ].map(({ step, icon, title, desc }) => (
            <div key={step} style={{ padding: '1rem', background: 'var(--color-bg-subtle)', borderRadius: '0.75rem', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <span style={{ background: '#16A34A', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>{step}</span>
                <span style={{ fontSize: '1.15rem' }}>{icon}</span>
                <strong style={{ fontSize: '0.85rem' }}>{title}</strong>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   AVAILABLE DONATIONS PANEL
   ═══════════════════════════════════════════════════════════════════════ */
function AvailablePanel({ onRefresh, onSmartMatch }) {
  const [donations, setDonations] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [toast,     setToast]     = useState('');
  const [detailId,  setDetailId]  = useState(null);
  const [filters, setFilters] = useState({
    category: '', food_type: '', min_qty: '', max_qty: '', city: '', expiry_hours: '',
  });

  const buildQuery = () => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v); });
    return p.toString() ? '?' + p : '';
  };

  const fetchAvailable = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await api.get('/ngo/donations/available' + buildQuery());
      if (data.success) {
        setDonations(data.donations || []);
      } else {
        if (data.status === 403) {
          setError(data.error || 'Access denied. This section requires an active NGO account.');
        } else if (data.status === 401 || data.expired) {
          setError('Session expired. Redirecting to login…');
        } else {
          setError(data.error || 'Failed to load available donations.');
        }
      }
    } catch {
      setError('Could not connect to server. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  useEffect(() => { fetchAvailable(); }, [fetchAvailable]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const handleAccept = async (id) => {
    if (!window.confirm('Are you sure you want to accept this food donation?')) return;
    const data = await api.post('/ngo/donations/' + id + '/accept', {});
    if (data.success) { showToast('Donation accepted successfully! ✅'); fetchAvailable(); onRefresh(); }
    else alert(data.error || 'Failed to accept.');
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';
  const fmtDt   = (d) => d ? new Date(d).toLocaleString('en-IN',  { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  const handleFilter = (e) => { const { name, value } = e.target; setFilters((p) => ({ ...p, [name]: value })); };
  const resetFilters = () => setFilters({ category: '', food_type: '', min_qty: '', max_qty: '', city: '', expiry_hours: '' });
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  if (detailId) {
    return (
      <DonationDetailView
        id={detailId}
        onBack={() => setDetailId(null)}
        onAccept={async (id) => { await handleAccept(id); setDetailId(null); }}
        showAcceptButton
      />
    );
  }

  return (
    <div className="dashboard-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 className="dashboard-card__title" style={{ margin: 0 }}>🍱 Available Donations</h3>
        {!loading && (
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', background: 'var(--color-bg-muted)', padding: '0.25rem 0.75rem', borderRadius: '999px' }}>
            {donations.length} result{donations.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {toast && <div className="nd-success" style={{ marginBottom: '1rem' }}>{toast}</div>}

      {/* Filters */}
      <div className="nd-filters">
        <div className="nd-filter-group">
          <label>Category</label>
          <select name="category" value={filters.category} onChange={handleFilter}>
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="nd-filter-group">
          <label>Food Type</label>
          <select name="food_type" value={filters.food_type} onChange={handleFilter}>
            <option value="">All Types</option>
            <option value="vegetarian">🌿 Vegetarian</option>
            <option value="non-vegetarian">🍗 Non-Vegetarian</option>
          </select>
        </div>
        <div className="nd-filter-group" style={{ minWidth: '90px' }}>
          <label>Min Qty (kg)</label>
          <input type="number" name="min_qty" value={filters.min_qty} onChange={handleFilter} placeholder="0" min="0" />
        </div>
        <div className="nd-filter-group" style={{ minWidth: '90px' }}>
          <label>Max Qty (kg)</label>
          <input type="number" name="max_qty" value={filters.max_qty} onChange={handleFilter} placeholder="Any" min="0" />
        </div>
        <div className="nd-filter-group">
          <label>City</label>
          <input type="text" name="city" value={filters.city} onChange={handleFilter} placeholder="e.g. Mumbai" />
        </div>
        <div className="nd-filter-group" style={{ minWidth: '110px' }}>
          <label>Expiry Within</label>
          <select name="expiry_hours" value={filters.expiry_hours} onChange={handleFilter}>
            <option value="">Any Time</option>
            <option value="4">4 hours</option>
            <option value="8">8 hours</option>
            <option value="24">24 hours</option>
            <option value="48">48 hours</option>
          </select>
        </div>
        <button className="nd-action-btn nd-action-btn--view" style={{ alignSelf: 'flex-end' }} onClick={resetFilters}>
          Clear{activeFilterCount > 0 ? ' (' + activeFilterCount + ')' : ''}
        </button>
      </div>

      {loading ? (
        <div className="nd-loading">Loading donations…</div>
      ) : error ? (
        <div
          className="nd-error-state"
          style={{
            background: 'var(--color-bg-card, #fff)',
            border: '1px solid #FCA5A5',
            borderRadius: '12px',
            padding: '2rem 1.5rem',
            textAlign: 'center',
            margin: '1.5rem 0',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
          <p style={{ color: '#DC2626', fontWeight: 600, fontSize: '1rem', margin: '0 0 0.5rem 0' }}>{error}</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
            {error.includes('expired')
              ? 'Your authentication session has ended. Redirecting to login…'
              : 'Please check your connection and try again.'}
          </p>
          {!error.includes('expired') && (
            <button
              className="btn btn-outline"
              style={{ padding: '0.5rem 1.5rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={() => fetchAvailable()}
            >
              <span>🔄</span> Retry
            </button>
          )}
        </div>
      ) : donations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🔍</div>
            <p className="empty-state__title">No donations found</p>
            <p className="empty-state__desc">
              {activeFilterCount > 0 ? 'Try adjusting your filters to see more results.' : 'No donations are currently available. Check back later.'}
            </p>
            {activeFilterCount > 0 && (
              <button className="btn btn-outline" style={{ marginTop: '1rem', padding: '0.5rem 1.5rem' }} onClick={resetFilters}>Clear Filters</button>
            )}
          </div>
        ) : (
          <div className="nd-card-grid">
            {donations.map((d) => (
              <DonationCard key={d.id} donation={d} fmtDate={fmtDate} fmtDt={fmtDt} onView={() => setDetailId(d.id)} onAccept={() => handleAccept(d.id)} onSmartMatch={onSmartMatch} />
            ))}
          </div>
        )
      }
    </div>
  );
}

/* ─── Donation Card ──────────────────────────────────────────────────────── */
function DonationCard({ donation: d, fmtDate, fmtDt, onView, onAccept, onSmartMatch }) {
  const now = new Date();
  const bestBefore = d.best_before ? new Date(d.best_before) : null;
  const msLeft = bestBefore ? (bestBefore - now) : Infinity;
  const isExpiringSoon = msLeft < 8 * 3600 * 1000 && msLeft > 0;
  const isExpired = msLeft <= 0;

  return (
    <div className="nd-donation-card">
      {d.food_image ? (
        <img className="nd-donation-card__img" src={BACKEND_URL + d.food_image} alt={d.food_name} />
      ) : (
        <div className="nd-donation-card__img-placeholder">🍱</div>
      )}
      <div className="nd-donation-card__body">
        <div className="nd-donation-card__name">{d.food_name}</div>
        <div className="nd-donation-card__meta">
          <span>🏷️ {d.food_category}</span>
          <span>⚖️ {d.quantity} {d.unit}</span>
          {d.people_served && <span>👥 {d.people_served} people</span>}
          <span>{d.food_type === 'vegetarian' ? '🌿 Veg' : '🍗 Non-Veg'}</span>
          <span>📍 {d.city}</span>
          <span>👤 {d.donor_name}</span>
        </div>
        {isExpired ? (
          <span style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 700, background: '#FEF2F2', padding: '0.15rem 0.5rem', borderRadius: '999px', display: 'inline-block', marginTop: '0.25rem' }}>
            ⛔ Expired: {fmtDt(d.best_before)}
          </span>
        ) : isExpiringSoon ? (
          <span style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 700, background: '#FEF2F2', padding: '0.15rem 0.5rem', borderRadius: '999px', display: 'inline-block', marginTop: '0.25rem' }}>
            ⚠️ Expiring soon: {fmtDt(d.best_before)}
          </span>
        ) : bestBefore ? (
          <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>🕐 Best before: {fmtDt(d.best_before)}</span>
        ) : null}
        {d.description && <p className="nd-donation-card__desc">{d.description}</p>}
      </div>
      <div className="nd-donation-card__footer">
        <span style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>Posted {fmtDate(d.created_at)}</span>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {onSmartMatch && (
            <button
              className="sm-trigger-btn"
              onClick={() => onSmartMatch(d)}
              title="See your compatibility score"
            >
              🧠 My Score
            </button>
          )}
          <button className="nd-action-btn nd-action-btn--view" onClick={onView}>Details</button>
          <button className="nd-action-btn nd-action-btn--accept" onClick={onAccept} disabled={isExpired}>Accept</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACCEPTED DONATIONS PANEL
   ═══════════════════════════════════════════════════════════════════════ */
function AcceptedPanel({ onRefresh }) {
  const [donations,    setDonations]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [toast,        setToast]        = useState({ msg: '', type: '' });
  const [filterStatus, setFilterStatus] = useState('');
  const [detailId,     setDetailId]     = useState(null);
  const [rejectId,     setRejectId]     = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const ACCEPTED_STATUSES = ['', 'ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'DELIVERED'];

  const fetchAccepted = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const path = filterStatus ? '/ngo/donations/accepted?status=' + filterStatus : '/ngo/donations/accepted';
      const data = await api.get(path);
      if (data.success) {
        // Show only active (non-completed) unless a specific status filter is set
        const filtered = filterStatus ? data.donations : data.donations.filter((d) => d.status !== 'COMPLETED');
        setDonations(filtered);
      } else { setError(data.error || 'Failed to load.'); }
    } catch { setError('Could not connect.'); }
    finally  { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { fetchAccepted(); }, [fetchAccepted]);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast({ msg: '', type: '' }), 3500); };

  const handleReceived = async (id) => {
    if (!window.confirm('Confirm that you have received this food donation?')) return;
    const data = await api.post('/ngo/donations/' + id + '/received', {});
    if (data.success) { showToast('✅ Food received confirmed! Donation moved to Received tab.'); fetchAccepted(); onRefresh(); }
    else alert(data.error || 'Failed.');
  };

  const handleReject = async () => {
    const data = await api.post('/ngo/donations/' + rejectId + '/reject', { reason: rejectReason });
    if (data.success) {
      showToast('Donation rejected and made available again for other NGOs.', 'success');
      setRejectId(null); setRejectReason('');
      fetchAccepted(); onRefresh();
    } else alert(data.error || 'Failed.');
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';

  if (detailId) {
    return (
      <DonationDetailView
        id={detailId}
        onBack={() => setDetailId(null)}
        showAcceptButton={false}
        onReceived={handleReceived}
        onReject={(id) => { setDetailId(null); setRejectId(id); }}
      />
    );
  }

  return (
    <div className="dashboard-card">
      {/* Reject modal */}
      {rejectId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: '1rem', padding: '2rem', maxWidth: '440px', width: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.18)' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '1.1rem' }}>❌ Reject Donation?</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              This donation will be made available again for other NGOs. Optionally provide a reason:
            </p>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Reason for rejection (optional)…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button className="nd-action-btn nd-action-btn--reject" style={{ padding: '0.55rem 1.25rem' }} onClick={handleReject}>Confirm Reject</button>
              <button className="btn btn-outline" style={{ padding: '0.5rem 1rem' }} onClick={() => { setRejectId(null); setRejectReason(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h3 className="dashboard-card__title" style={{ margin: 0 }}>✅ Accepted Donations</h3>
        <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
          {ACCEPTED_STATUSES.map((s) => <option key={s} value={s}>{s || 'Active (All)'}</option>)}
        </select>
      </div>

      {toast.msg && <div className={toast.type === 'success' ? 'nd-success' : 'nd-error'} style={{ marginBottom: '1rem' }}>{toast.msg}</div>}

      {loading ? <div className="nd-loading">Loading…</div>
        : error ? <div className="nd-error">{error}</div>
        : donations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📭</div>
            <p className="empty-state__title">No active accepted donations</p>
            <p className="empty-state__desc">Accept available donations to see them here. Completed donations appear in the Received tab.</p>
          </div>
        ) : (
          <div className="nd-table-wrap">
            <table className="nd-table">
              <thead>
                <tr>
                  <th>Food Name</th><th>Category</th><th>Qty</th><th>City</th>
                  <th>Donor</th><th>Status</th><th>Accepted On</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d) => (
                  <tr key={d.id}>
                    <td><button className="nd-link" onClick={() => setDetailId(d.id)}>{d.food_name}</button></td>
                    <td>{d.food_category}</td>
                    <td>{d.quantity} {d.unit}</td>
                    <td>{d.city}</td>
                    <td>{d.donor_name}</td>
                    <td><DonationStatusBadge status={d.status} /></td>
                    <td>{fmtDate(d.accepted_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button className="nd-action-btn nd-action-btn--view" onClick={() => setDetailId(d.id)}>View</button>
                        {d.status === 'ACCEPTED' && <button className="nd-action-btn nd-action-btn--reject" onClick={() => setRejectId(d.id)}>Reject</button>}
                        {['ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'DELIVERED'].includes(d.status) && (
                          <button className="nd-action-btn nd-action-btn--received" onClick={() => handleReceived(d.id)}>Received</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RECEIVED DONATIONS PANEL
   ═══════════════════════════════════════════════════════════════════════ */
function ReceivedPanel() {
  const [donations, setDonations] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [detailId,  setDetailId]  = useState(null);
  const [summary,   setSummary]   = useState({ totalFood: 0, totalPeople: 0, count: 0 });

  const fetchReceived = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await api.get('/ngo/donations/accepted?status=COMPLETED');
      if (data.success) {
        setDonations(data.donations);
        const totalFood   = data.donations.reduce((s, d) => s + parseFloat(d.quantity || 0), 0);
        const totalPeople = data.donations.reduce((s, d) => s + parseInt(d.people_served || 0), 0);
        setSummary({ totalFood: totalFood.toFixed(1), totalPeople, count: data.donations.length });
      } else { setError(data.error || 'Failed to load.'); }
    } catch { setError('Could not connect.'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { fetchReceived(); }, [fetchReceived]);

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';

  if (detailId) {
    return <DonationDetailView id={detailId} onBack={() => setDetailId(null)} showAcceptButton={false} />;
  }

  return (
    <div className="dashboard-card">
      <h3 className="dashboard-card__title">📦 Received Donations</h3>

      {/* Summary strip */}
      {!loading && !error && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { icon: '📦', value: summary.count,              label: 'Total Received' },
            { icon: '🌾', value: summary.totalFood + ' kg',  label: 'Food Received'  },
            { icon: '👥', value: summary.totalPeople,        label: 'People Served'  },
          ].map(({ icon, value, label }) => (
            <div key={label} style={{ flex: '1', minWidth: '120px', textAlign: 'center', padding: '1rem', background: '#F0FDF4', borderRadius: '0.75rem', border: '1px solid #BBF7D0' }}>
              <div style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>{icon}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#16A34A' }}>{value}</div>
              <div style={{ fontSize: '0.72rem', color: '#15803D', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? <div className="nd-loading">Loading received donations…</div>
        : error ? <div className="nd-error">{error}</div>
        : donations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🌾</div>
            <p className="empty-state__title">No received donations yet</p>
            <p className="empty-state__desc">After confirming receipt of accepted donations, they appear here to track your impact.</p>
          </div>
        ) : (
          <div className="nd-table-wrap">
            <table className="nd-table">
              <thead>
                <tr>
                  <th>Food Name</th><th>Category</th><th>Qty</th><th>People Served</th>
                  <th>City</th><th>Donor</th><th>Accepted On</th><th>Received On</th><th></th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d) => (
                  <tr key={d.id}>
                    <td><button className="nd-link" onClick={() => setDetailId(d.id)}>{d.food_name}</button></td>
                    <td>{d.food_category}</td>
                    <td>{d.quantity} {d.unit}</td>
                    <td>{d.people_served ?? '—'}</td>
                    <td>{d.city}</td>
                    <td>{d.donor_name}</td>
                    <td>{fmtDate(d.accepted_at)}</td>
                    <td><span style={{ color: '#16A34A', fontWeight: 600, fontSize: '0.85rem' }}>✅ {fmtDate(d.received_at)}</span></td>
                    <td><button className="nd-action-btn nd-action-btn--view" onClick={() => setDetailId(d.id)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DONATION DETAIL VIEW
   ═══════════════════════════════════════════════════════════════════════ */
function DonationDetailView({ id, onBack, showAcceptButton, onAccept, onReceived, onReject }) {
  const [donation, setDonation] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await api.get('/ngo/donations/' + id);
        if (data.success) setDonation(data.donation);
        else setError(data.error || 'Not found.');
      } catch { setError('Could not connect.'); }
      setLoading(false);
    })();
  }, [id]);

  const fmt     = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';

  if (loading) return <div className="dashboard-card"><div className="nd-loading">Loading donation details…</div></div>;
  if (error)   return <div className="dashboard-card"><div className="nd-error">{error}</div></div>;
  if (!donation) return null;

  const d = donation;
  const ALL_STATUSES = ['POSTED', 'ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'DELIVERED', 'COMPLETED'];
  const currentIdx  = ALL_STATUSES.indexOf(d.status);
  const isCancelled = d.status === 'CANCELLED';
  const canAccept   = showAcceptButton && d.status === 'POSTED';
  const canReject   = onReject && d.status === 'ACCEPTED';
  const canReceived = onReceived && ['ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'DELIVERED'].includes(d.status);

  return (
    <div className="dashboard-card">
      {/* Back + actions */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-outline" style={{ padding: '0.4rem 1rem', fontSize: '0.82rem' }} onClick={onBack}>← Back</button>
        {canAccept   && <button className="nd-action-btn nd-action-btn--accept"   style={{ padding: '0.5rem 1.1rem' }} onClick={() => onAccept(id)}>✅ Accept Donation</button>}
        {canReject   && <button className="nd-action-btn nd-action-btn--reject"   style={{ padding: '0.5rem 1.1rem' }} onClick={() => onReject(id)}>❌ Reject</button>}
        {canReceived && <button className="nd-action-btn nd-action-btn--received" style={{ padding: '0.5rem 1.1rem' }} onClick={() => onReceived(id).then(onBack)}>📦 Confirm Received</button>}
      </div>

      {/* Title + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.3rem' }}>{d.food_name}</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            Donated by <strong>{d.donor_name}</strong>
            {d.donor_email && ' · ' + d.donor_email}
            {' · Posted ' + fmtDate(d.created_at) + ' · #D-' + d.id}
          </p>
        </div>
        <DonationStatusBadge status={d.status} />
      </div>

      {/* Status timeline */}
      {!isCancelled && (
        <div style={{ marginBottom: '1.75rem' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Progress</p>
          <div className="dd-timeline">
            {ALL_STATUSES.map((s, i) => {
              const done   = i <= currentIdx;
              const active = i === currentIdx;
              return (
                <div key={s} className={'dd-timeline__step' + (done ? ' done' : '') + (active ? ' active' : '')}>
                  <div className="dd-timeline__dot" />
                  <div className="dd-timeline__label">{s.replace(/_/g, ' ')}</div>
                  {i < ALL_STATUSES.length - 1 && <div className="dd-timeline__line" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {isCancelled && (
        <div className="nd-verify-banner nd-verify-banner--rejected" style={{ marginBottom: '1.5rem' }}>
          ⛔ This donation has been cancelled.
        </div>
      )}

      {/* Food image */}
      {d.food_image && (
        <div style={{ marginBottom: '1.5rem' }}>
          <img src={BACKEND_URL + d.food_image} alt={d.food_name} style={{ width: '100%', maxHeight: '260px', objectFit: 'cover', borderRadius: '0.75rem', border: '1px solid var(--color-border)' }} />
        </div>
      )}

      {/* Location map — pickup and NGO delivery point */}
      <LocationMap
        pickup={{
          address: d.pickup_address,
          city: d.city,
          label: 'Pickup from Donor',
        }}
        delivery={{
          address: d.ngo_address || null,
          city: d.ngo_city || d.city,
          label: 'Deliver to NGO',
        }}
      />

      {/* Fields */}
      <div className="nd-detail-grid">
        <NdField label="Food Category"       value={d.food_category} />
        <NdField label="Food Type"           value={d.food_type === 'vegetarian' ? '🌿 Vegetarian' : '🍗 Non-Vegetarian'} />
        <NdField label="Quantity"            value={d.quantity + ' ' + d.unit} />
        <NdField label="People Served"       value={d.people_served ?? '—'} />
        <NdField label="Preparation Date"    value={fmtDate(d.preparation_date)} />
        <NdField label="Best Before"         value={fmt(d.best_before)} />
        <NdField label="City"                value={d.city} />
        <NdField label="Donor Phone"         value={d.donor_phone || '—'} />
        <NdField label="Pickup Address"      value={d.pickup_address} wide />
        <NdField label="Pickup Availability" value={d.pickup_availability || '—'} wide />
        {d.description   && <NdField label="Description"          value={d.description}   wide />}
        {d.accepted_at   && <NdField label="Accepted On"          value={fmt(d.accepted_at)} />}
        {d.received_at   && <NdField label="Received On"          value={fmt(d.received_at)} />}
        {d.reject_reason && <NdField label="Last Rejection Reason" value={d.reject_reason} wide />}
      </div>
    </div>
  );
}

function NdField({ label, value, wide }) {
  return (
    <div className={'nd-detail-field' + (wide ? ' nd-wide' : '')}>
      <label>{label}</label>
      <p>{value}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NGO PROFILE PANEL
   ═══════════════════════════════════════════════════════════════════════ */
const FOOD_TYPE_OPTIONS = [
  'All types', 'Cooked Food', 'Packaged Food',
  'Dry Ration', 'Fruits', 'Vegetables', 'Bakery Items', 'Dairy',
];

function ProfilePanel({ profile, onSaved }) {
  const [form, setForm] = useState({
    ngo_name: '', founder: '', address: '', city: '', phone: '', email: '',
    food_types: '', operating_area: '', max_food_capacity: '', is_available: true,
    lat: null, lng: null,  // geocoded NGO address coordinates
  });
  const [submitting,    setSubmitting]    = useState(false);
  const [toggling,      setToggling]      = useState(false);
  const [error,         setError]         = useState('');
  const [success,       setSuccess]       = useState('');
  const [availSuccess,  setAvailSuccess]  = useState('');

  useEffect(() => {
    if (profile) {
      setForm({
        ngo_name:          profile.ngo_name          || '',
        founder:           profile.founder           || '',
        address:           profile.address           || '',
        city:              profile.city              || '',
        phone:             profile.phone             || '',
        email:             profile.email             || '',
        food_types:        profile.food_types        || '',
        operating_area:    profile.operating_area    || '',
        max_food_capacity: profile.max_food_capacity || '',
        is_available:      profile.is_available !== undefined ? !!profile.is_available : true,
        lat:               profile.lat               || null,
        lng:               profile.lng               || null,
      });
    }
  }, [profile]);

  const handleAvailToggle = async () => {
    setToggling(true);
    setAvailSuccess('');
    const next = !form.is_available;
    try {
      const data = await api.patch('/ngo/availability', { is_available: next });
      if (data.success) {
        setForm((p) => ({ ...p, is_available: next }));
        setAvailSuccess(data.message);
        setTimeout(() => setAvailSuccess(''), 3500);
        onSaved();
      } else {
        setError(data.error || 'Failed to toggle availability.');
      }
    } catch { setError('Could not connect to server.'); }
    finally  { setToggling(false); }
  };

  const handleChange = (e) => { const { name, value } = e.target; setForm((p) => ({ ...p, [name]: value })); };

  const toggleFoodType = (ft) => {
    const arr = form.food_types ? form.food_types.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const selected = arr.includes(ft);
    const next = selected ? arr.filter((x) => x !== ft) : [...arr, ft];
    setForm((p) => ({ ...p, food_types: next.join(', ') }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.ngo_name.trim()) { setError('NGO Name is required.'); return; }
    setSubmitting(true);
    try {
      const data = await api.put('/ngo/profile', form);
      if (data.success) { setSuccess('Profile saved successfully! ✅'); onSaved(); }
      else setError(data.error || 'Failed to save profile.');
    } catch { setError('Could not connect to server.'); }
    finally  { setSubmitting(false); }
  };

  const selectedTypes = form.food_types ? form.food_types.split(',').map((s) => s.trim()).filter(Boolean) : [];

  return (
    <div className="dashboard-card">
      {/* Header with availability quick-toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 className="dashboard-card__title" style={{ margin: 0 }}>🏢 NGO Profile</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            {profile ? 'Update your NGO information below.' : 'Complete your profile to start accepting donations.'}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          {profile && <VerifyBadge status={profile.verification_status} />}
          {/* Availability quick-toggle */}
          {profile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: form.is_available ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${form.is_available ? '#86EFAC' : '#FECACA'}`, borderRadius: '0.5rem', padding: '0.35rem 0.75rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: form.is_available ? '#15803D' : '#DC2626' }}>
                {form.is_available ? '🟢 Accepting Donations' : '🔴 Not Accepting'}
              </span>
              <button
                type="button"
                onClick={handleAvailToggle}
                disabled={toggling}
                style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, borderRadius: '0.375rem', border: '1.5px solid', borderColor: form.is_available ? '#16A34A' : '#DC2626', background: form.is_available ? '#DCFCE7' : '#FEE2E2', color: form.is_available ? '#15803D' : '#B91C1C', cursor: 'pointer', transition: 'all 0.15s' }}
              >
                {toggling ? '…' : form.is_available ? 'Pause' : 'Resume'}
              </button>
            </div>
          )}
        </div>
      </div>

      {(!profile || profile.verification_status === 'pending') && (
        <div className="nd-verify-banner nd-verify-banner--pending" style={{ marginBottom: '1.25rem' }}>
          ⏳ {profile ? 'Your profile is pending admin verification. You can still browse and accept donations.' : 'After creating your profile, an admin will verify your NGO details.'}
        </div>
      )}
      {profile?.verification_status === 'rejected' && (
        <div className="nd-verify-banner nd-verify-banner--rejected" style={{ marginBottom: '1.25rem' }}>
          ❌ Your verification was rejected. Please update your details and contact support.
        </div>
      )}
      {profile?.verification_status === 'verified' && (
        <div className="nd-verify-banner nd-verify-banner--verified" style={{ marginBottom: '1.25rem' }}>
          ✅ Your NGO is verified! You have full access to all platform features.
        </div>
      )}

      {error        && <div className="nd-error"   style={{ marginBottom: '1rem' }}>{error}</div>}
      {success      && <div className="nd-success" style={{ marginBottom: '1rem' }}>{success}</div>}
      {availSuccess && <div className="nd-success" style={{ marginBottom: '1rem' }}>🟢 {availSuccess}</div>}

      <form onSubmit={handleSubmit}>
        <div className="nd-form-grid">
          <div className="form-group">
            <label className="form-label">NGO Name <span className="nd-required">*</span></label>
            <input className="form-input" name="ngo_name" value={form.ngo_name} onChange={handleChange} placeholder="Official registered NGO name" required />
          </div>
          <div className="form-group">
            <label className="form-label">Founder / Contact Person</label>
            <input className="form-input" name="founder" value={form.founder} onChange={handleChange} placeholder="Founder or key contact name" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" name="email" value={form.email} onChange={handleChange} placeholder="ngo@example.org" />
          </div>
          <div className="form-group">
            <label className="form-label">City</label>
            <input className="form-input" name="city" value={form.city} onChange={handleChange} placeholder="e.g. Mumbai" />
          </div>
          <div className="form-group">
            <label className="form-label">Max Food Capacity (kg)</label>
            <input className="form-input" type="number" name="max_food_capacity" value={form.max_food_capacity} onChange={handleChange} placeholder="e.g. 100" min="0" />
          </div>
          <div className="form-group nd-span-2">
            <LocationPicker
              address={form.address}
              city={form.city}
              lat={form.lat}
              lng={form.lng}
              label="Address"
              placeholder="Full registered address of your NGO"
              onAddressChange={(val) => setForm((p) => ({ ...p, address: val }))}
              onCoordsChange={({ lat, lng }) => setForm((p) => ({ ...p, lat, lng }))}
            />
          </div>
          <div className="form-group nd-span-2">
            <label className="form-label">Operating Area / Service Locations</label>
            <input className="form-input" name="operating_area" value={form.operating_area} onChange={handleChange} placeholder="e.g. Andheri, Bandra, Juhu, Malad" />
          </div>
          <div className="form-group nd-span-2">
            <label className="form-label">Food Types Accepted</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
              {FOOD_TYPE_OPTIONS.map((ft) => {
                const isSelected = selectedTypes.includes(ft);
                return (
                  <button key={ft} type="button"
                    style={{ padding: '0.35rem 0.875rem', borderRadius: '999px', border: '1.5px solid', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', borderColor: isSelected ? '#16A34A' : 'var(--color-border-dark)', background: isSelected ? '#F0FDF4' : 'var(--color-bg)', color: isSelected ? '#16A34A' : 'var(--color-text-secondary)' }}
                    onClick={() => toggleFoodType(ft)}
                  >
                    {isSelected ? '✓ ' : ''}{ft}
                  </button>
                );
              })}
            </div>
            <input className="form-input" name="food_types" value={form.food_types} onChange={handleChange} placeholder="Or type manually: Cooked Food, Dry Ration…" />
          </div>
        </div>

        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button type="submit" className="btn btn-accent btn-lg" disabled={submitting}>
            {submitting ? 'Saving…' : profile ? '💾 Update Profile' : '🏢 Create Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
