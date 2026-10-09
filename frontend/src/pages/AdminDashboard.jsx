import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import DonationStatusBadge from '../components/DonationStatusBadge';
import SmartMatchPanel from '../components/SmartMatchPanel';
import {
  DonationsByMonthChart,
  CategoryDistributionChart,
  CompletedVsActiveChart,
  FoodOverTimeChart,
  PeopleOverTimeChart,
  StatusBreakdownChart,
  MonthlyRegistrationsChart,
} from '../components/AnalyticsCharts';
import '../styles/AdminDashboard.css';
import '../styles/SmartMatch.css';
import '../styles/Analytics.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 25;

const ACTIVE_STATUSES = ['ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'DELIVERED'];

const NAV = [
  { id: 'overview',   icon: '🏠', label: 'Overview',        section: 'GENERAL' },
  { id: 'analytics',  icon: '📊', label: 'Analytics',       section: 'GENERAL' },
  { id: 'users',      icon: '👥', label: 'All Users',       section: 'USERS' },
  { id: 'donors',     icon: '🍱', label: 'Donors',          section: 'USERS' },
  { id: 'ngos',       icon: '🏢', label: 'NGOs',            section: 'USERS' },
  { id: 'volunteers', icon: '🚗', label: 'Volunteers',      section: 'USERS' },
  { id: 'donations',  icon: '📦', label: 'All Donations',   section: 'DONATIONS' },
  { id: 'active',     icon: '⚡', label: 'Active',          section: 'DONATIONS' },
  { id: 'completed',  icon: '✅', label: 'Completed',       section: 'DONATIONS' },
  { id: 'pickups',    icon: '🚚', label: 'Pickup Requests', section: 'DONATIONS' },
  { id: 'deliveries', icon: '🏁', label: 'Deliveries',      section: 'DONATIONS' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt  = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const fmtD = (d) => d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';
const num  = (n) => Number(n ?? 0).toLocaleString('en-IN');

// ─── Shared UI Components ─────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  return <div className={`adm-toast adm-toast--${type}`}>{msg}</div>;
}

function Loading() {
  return (
    <div className="adm-loading">
      <div className="adm-loading__spinner" />
      Loading…
    </div>
  );
}

function Empty({ icon = '📭', title, desc }) {
  return (
    <div className="adm-empty">
      <div className="adm-empty__icon">{icon}</div>
      <p className="adm-empty__title">{title}</p>
      {desc && <p className="adm-empty__desc">{desc}</p>}
    </div>
  );
}

function Err({ msg }) {
  return <div className="adm-error">⚠️ {msg}</div>;
}

function Pagination({ page, total, limit, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);
  const pages = [];
  const start = Math.max(1, page - 2);
  const end   = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="adm-pagination">
      <span className="adm-pagination__info">
        Showing {from}–{to} of {num(total)} records
      </span>
      <div className="adm-pagination__controls">
        <button className="adm-page-btn" disabled={page <= 1} onClick={() => onChange(1)}>«</button>
        <button className="adm-page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹</button>
        {start > 1 && <span className="adm-page-btn" style={{ opacity: 0.4, cursor: 'default' }}>…</span>}
        {pages.map((pg) => (
          <button key={pg} className={`adm-page-btn${pg === page ? ' active' : ''}`} onClick={() => onChange(pg)}>{pg}</button>
        ))}
        {end < totalPages && <span className="adm-page-btn" style={{ opacity: 0.4, cursor: 'default' }}>…</span>}
        <button className="adm-page-btn" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>›</button>
        <button className="adm-page-btn" disabled={page >= totalPages} onClick={() => onChange(totalPages)}>»</button>
      </div>
    </div>
  );
}

function RoleBadge({ role }) {
  return <span className={`adm-role-badge adm-role-badge--${role}`}>{role}</span>;
}

function VerifyBadge({ status }) {
  const MAP = {
    pending:  { icon: '⏳', label: 'Pending'  },
    verified: { icon: '✅', label: 'Verified' },
    rejected: { icon: '❌', label: 'Rejected' },
  };
  const m = MAP[status] || MAP.pending;
  return (
    <span className={`adm-verify-badge adm-verify-badge--${status}`}>
      {m.icon} {m.label}
    </span>
  );
}

function DF({ label, value, wide }) {
  return (
    <div className={`adm-detail-field${wide ? ' adm-detail-field--wide' : ''}`}>
      <label>{label}</label>
      <p>{value || '—'}</p>
    </div>
  );
}

function StatCard({ icon, value, label, accent, onClick, sublabel }) {
  return (
    <div
      className={`adm-stat-card adm-stat-card--${accent || 'accent'}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="adm-stat-card__icon">{icon}</div>
      <div className="adm-stat-card__value">{value ?? '—'}</div>
      <div className="adm-stat-card__label">{label}</div>
      {sublabel && <div className="adm-stat-card__sublabel">{sublabel}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OVERVIEW PANEL
   ═══════════════════════════════════════════════════════════════════════ */
function OverviewPanel({ onNavigate }) {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');

  useEffect(() => {
    api.get('/admin/stats')
      .then((d) => {
        if (d.success) setStats(d.stats);
        else setErr(d.error || 'Failed to load stats.');
      })
      .catch(() => setErr('Could not connect to server.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  return (
    <>
      <div className="adm-welcome">
        <div>
          <div className="adm-welcome__title">Admin Control Panel 🛡️</div>
          <div className="adm-welcome__sub">
            Full platform visibility. Manage users, verify NGOs, track all donations and pickups.
          </div>
        </div>
        <div className="adm-welcome__emoji">⚙️</div>
      </div>

      {err && <Err msg={err} />}

      {/* 8 primary stat cards */}
      <div className="adm-stats-grid">
        <StatCard icon="👥" value={num(stats?.total_users)}     label="Total Users"          accent="accent" onClick={() => onNavigate('users')}     sublabel="Click to manage →" />
        <StatCard icon="🍱" value={num(stats?.total_donors)}    label="Donors"               accent="blue"   onClick={() => onNavigate('donors')} />
        <StatCard icon="🏢" value={num(stats?.total_ngos)}      label="NGOs"                 accent="green"  onClick={() => onNavigate('ngos')}
          sublabel={stats?.ngo_pending > 0 ? `⏳ ${stats.ngo_pending} pending` : undefined} />
        <StatCard icon="🚗" value={num(stats?.total_volunteers)} label="Volunteers"          accent="orange" onClick={() => onNavigate('volunteers')} />
        <StatCard icon="📦" value={num(stats?.total_donations)} label="Total Donations"      accent="teal"   onClick={() => onNavigate('donations')} />
        <StatCard icon="✅" value={num(stats?.completed_donations)} label="Completed Donations" accent="green" onClick={() => onNavigate('completed')} />
        <StatCard icon="⚖️" value={`${num(Math.round(stats?.total_kg_donated ?? 0))} kg`} label="Food Donated"   accent="blue" />
        <StatCard icon="🙏" value={num(stats?.total_people_served)} label="People Served"   accent="orange" />
      </div>

      {/* NGO Verification Status */}
      <div className="adm-card">
        <h3 className="adm-card__title">🏢 NGO Verification Status</h3>
        <div className="adm-mini-stats">
          <div className="adm-mini-stat">
            <div className="adm-mini-stat__val" style={{ color: '#D97706' }}>{num(stats?.ngo_pending)}</div>
            <div className="adm-mini-stat__label">⏳ Pending</div>
          </div>
          <div className="adm-mini-stat">
            <div className="adm-mini-stat__val" style={{ color: '#16A34A' }}>{num(stats?.ngo_verified)}</div>
            <div className="adm-mini-stat__label">✅ Verified</div>
          </div>
          <div className="adm-mini-stat">
            <div className="adm-mini-stat__val" style={{ color: '#DC2626' }}>{num(stats?.ngo_rejected)}</div>
            <div className="adm-mini-stat__label">❌ Rejected</div>
          </div>
        </div>
        {stats?.ngo_pending > 0 && (
          <div className="adm-alert adm-alert--warn">
            ⚠️ <strong>{stats.ngo_pending}</strong> NGO{stats.ngo_pending > 1 ? 's' : ''} awaiting verification.
            <button className="adm-alert__btn" onClick={() => onNavigate('ngos')}>Review Now →</button>
          </div>
        )}
        <button className="adm-action-btn adm-action-btn--verify" style={{ padding: '0.5rem 1.25rem', fontSize: '0.82rem', marginTop: '0.75rem' }} onClick={() => onNavigate('ngos')}>
          Manage NGO Verifications →
        </button>
      </div>

      {/* Donation Pipeline */}
      <div className="adm-card">
        <h3 className="adm-card__title">📊 Donation Pipeline</h3>
        <div className="adm-pipeline">
          {[
            { key: 'posted_donations',    label: 'Posted',    color: '#2563EB', icon: '📋', view: 'donations' },
            { key: 'accepted_donations',  label: 'Accepted',  color: '#9333EA', icon: '✔️',  view: 'active'    },
            { key: 'assigned_donations',  label: 'Assigned',  color: '#EA580C', icon: '🚗',  view: 'pickups'   },
            { key: 'picked_up_donations', label: 'Picked Up', color: '#CA8A04', icon: '📦',  view: 'pickups'   },
            { key: 'delivered_donations', label: 'Delivered', color: '#0891B2', icon: '🏢',  view: 'deliveries'},
            { key: 'completed_donations', label: 'Completed', color: '#16A34A', icon: '✅',  view: 'completed' },
            { key: 'cancelled_donations', label: 'Cancelled', color: '#9CA3AF', icon: '🚫',  view: 'donations' },
          ].map(({ key, label, color, icon, view }) => (
            <button key={key} className="adm-pipeline-step" onClick={() => onNavigate(view)}>
              <div className="adm-pipeline-step__icon" style={{ color }}>{icon}</div>
              <div className="adm-pipeline-step__val"  style={{ color }}>{num(stats?.[key])}</div>
              <div className="adm-pipeline-step__label">{label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="adm-quick-grid">
        {[
          { icon: '🏢', title: 'NGO Management',    desc: 'Verify or reject NGO registrations',    view: 'ngos',      accent: '#16A34A' },
          { icon: '👥', title: 'User Management',   desc: 'Browse all platform users by role',     view: 'users',     accent: '#2563EB' },
          { icon: '📦', title: 'All Donations',     desc: 'Track every donation on the platform',  view: 'donations', accent: '#0891B2' },
          { icon: '⚡', title: 'Active Donations',  desc: 'Monitor in-progress pickups',           view: 'active',    accent: '#EA580C' },
          { icon: '✅', title: 'Completed',         desc: 'View successfully delivered donations', view: 'completed', accent: '#16A34A' },
          { icon: '📊', title: 'Analytics',         desc: 'Platform impact charts and trends',     view: 'analytics', accent: '#7C3AED' },
        ].map(({ icon, title, desc, view, accent }) => (
          <button key={view} className="adm-quick-card" onClick={() => onNavigate(view)}>
            <div className="adm-quick-card__icon" style={{ color: accent }}>{icon}</div>
            <div className="adm-quick-card__title">{title}</div>
            <div className="adm-quick-card__desc">{desc}</div>
          </button>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ANALYTICS PANEL
   ═══════════════════════════════════════════════════════════════════════ */
function AnalyticsPanel() {
  const [stats,     setStats]     = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState('');

  useEffect(() => {
    api.get('/admin/stats')
      .then((d) => {
        if (d.success) { setStats(d.stats); setChartData(d.chart_data || null); }
        else setErr(d.error || 'Failed to load analytics.');
      })
      .catch(() => setErr('Could not connect to server.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (err)     return <Err msg={err} />;
  if (!stats)  return <Err msg="No data available." />;

  const n = (v) => Number(v ?? 0).toLocaleString('en-IN');
  const activeTotal = Number(stats.active_donations ?? 0);

  /* The 8 required platform-wide metrics from the DB */
  const impactStats = [
    { icon: '📦', color: 'blue',   value: n(stats.total_donations),                         label: 'Total Donations'    },
    { icon: '✅', color: 'green',  value: n(stats.completed_donations),                      label: 'Completed'          },
    { icon: '⚡', color: 'amber',  value: n(activeTotal),                                    label: 'Active Donations'   },
    { icon: '⚖️', color: 'teal',   value: `${n(Math.round(stats.total_kg_donated ?? 0))} kg`, label: 'Food Donated'      },
    { icon: '🏁', color: 'sky',    value: n(stats.delivered_donations),                      label: 'Food Delivered'     },
    { icon: '👥', color: 'purple', value: n(stats.total_people_served),                      label: 'People Served'      },
    { icon: '🏢', color: 'orange', value: n(stats.total_ngos),                               label: 'Total NGOs'         },
    { icon: '🚗', color: 'rose',   value: n(stats.total_volunteers),                         label: 'Total Volunteers'   },
  ];

  return (
    <div className="adm-card">
      {/* Banner */}
      <div className="analytics-banner">
        <div>
          <div className="analytics-banner__title">📊 Platform Impact Analytics</div>
          <div className="analytics-banner__sub">
            All statistics calculated in real-time from the database — no fake data
          </div>
        </div>
        <div className="analytics-banner__icon">🛡️</div>
      </div>

      {/* 8 required metrics */}
      <div className="impact-strip impact-strip--admin">
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
        <div className="analytics-section__title">📈 Donation Trends</div>
        <div className="analytics-grid">
          <DonationsByMonthChart data={chartData?.donations_by_month} label="Total Donations" theme="light" />
          <CategoryDistributionChart data={chartData?.category_distribution} theme="light" />
        </div>
        <div className="analytics-grid">
          <FoodOverTimeChart data={chartData?.food_over_time} theme="light" />
          <PeopleOverTimeChart data={chartData?.people_over_time} theme="light" />
        </div>
        <div className="analytics-grid">
          <CompletedVsActiveChart
            completed={Number(stats.completed_donations)}
            active={Number(stats.accepted_donations) + Number(stats.assigned_donations) +
                    Number(stats.picked_up_donations) + Number(stats.delivered_donations)}
            posted={Number(stats.posted_donations)}
            cancelled={Number(stats.cancelled_donations)}
            theme="light"
          />
          <StatusBreakdownChart data={chartData ? [
            { status: 'POSTED',             count: stats.posted_donations        },
            { status: 'ACCEPTED',           count: stats.accepted_donations      },
            { status: 'VOLUNTEER_ASSIGNED', count: stats.assigned_donations      },
            { status: 'PICKED_UP',          count: stats.picked_up_donations     },
            { status: 'DELIVERED',          count: stats.delivered_donations     },
            { status: 'COMPLETED',          count: stats.completed_donations     },
            { status: 'CANCELLED',          count: stats.cancelled_donations     },
          ].filter(d => Number(d.count) > 0) : []} theme="light" />
        </div>
        <div className="analytics-section__title" style={{ marginTop: '1.5rem' }}>👥 User Growth</div>
        <div className="analytics-grid--full analytics-grid">
          <MonthlyRegistrationsChart data={chartData?.monthly_registrations || []} theme="light" />
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   USERS PANEL  (all / donors)
   ═══════════════════════════════════════════════════════════════════════ */
function UsersPanel({ roleFilter }) {
  const [users,   setUsers]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');
  const [detail,  setDetail]  = useState(null);
  const searchTimer = useRef(null);

  const load = useCallback(async (pg = 1, q = search) => {
    setLoading(true); setErr('');
    try {
      const params = new URLSearchParams({ page: pg, limit: PAGE_SIZE });
      if (roleFilter) params.append('role', roleFilter);
      if (q)          params.append('search', q);
      const d = await api.get(`/admin/users?${params}`);
      if (d.success) { setUsers(d.users); setTotal(d.total); setPage(pg); }
      else setErr(d.error || 'Failed to load users.');
    } catch { setErr('Could not connect to server.'); }
    finally { setLoading(false); }
  }, [roleFilter, search]);

  useEffect(() => { setSearch(''); load(1, ''); }, [roleFilter]);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(1, val), 400);
  };

  if (detail) return <UserDetail userId={detail} onBack={() => setDetail(null)} />;

  const titles = { donor: '🍱 Donors', volunteer: '🚗 Volunteers', '': '👥 All Users' };

  return (
    <div className="adm-card">
      <h3 className="adm-card__title">{titles[roleFilter ?? ''] ?? '👥 All Users'}</h3>

      <div className="adm-toolbar">
        <input id="users-search" className="adm-search" placeholder="Search name, email, phone…"
          value={search} onChange={(e) => handleSearch(e.target.value)} />
        <button className="adm-action-btn adm-action-btn--view" onClick={() => load(page)} disabled={loading}>🔄 Refresh</button>
      </div>

      {err && <Err msg={err} />}

      {loading ? <Loading /> : users.length === 0 ? (
        <Empty icon="👤" title="No users found" desc={search ? 'No results for your search.' : 'No users registered yet.'} />
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>{['#', 'Name', 'Email', 'Phone', 'Role', 'Joined', 'Details'].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id}>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {u.name}
                      {u.ngo_name && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>{u.ngo_name}</div>}
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{u.email}</td>
                    <td style={{ fontSize: '0.82rem' }}>{u.phone || '—'}</td>
                    <td><RoleBadge role={u.role} /></td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{fmtD(u.created_at)}</td>
                    <td><button className="adm-action-btn adm-action-btn--view" onClick={() => setDetail(u.id)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={total} limit={PAGE_SIZE} onChange={(pg) => load(pg)} />
        </>
      )}
    </div>
  );
}

function UserDetail({ userId, onBack }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');

  useEffect(() => {
    api.get(`/admin/users/${userId}`)
      .then((d) => { if (d.success) setData(d); else setErr(d.error || 'Failed.'); })
      .catch(() => setErr('Could not connect.'))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="adm-card"><Loading /></div>;
  if (err)     return <div className="adm-card"><Err msg={err} /></div>;
  const { user, donations } = data;

  return (
    <div className="adm-card">
      <div className="adm-detail-back">
        <button className="adm-action-btn adm-action-btn--view" style={{ padding: '0.4rem 1rem' }} onClick={onBack}>← Back</button>
        <RoleBadge role={user.role} />
        {user.ngo_status && <VerifyBadge status={user.ngo_status} />}
      </div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.25rem' }}>{user.name}</h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
        Joined {fmtD(user.created_at)} · {user.email}
      </p>
      <div className="adm-detail-grid" style={{ marginBottom: '1.5rem' }}>
        <DF label="Full Name" value={user.name} />
        <DF label="Email"     value={user.email} />
        <DF label="Phone"     value={user.phone} />
        <DF label="Role"      value={user.role} />
        {user.role === 'ngo' && <>
          <DF label="NGO Name"       value={user.ngo_name} />
          <DF label="Founder"        value={user.founder} />
          <DF label="City"           value={user.city} />
          <DF label="Capacity (kg)"  value={user.max_food_capacity} />
          <DF label="Verification"   value={user.verification_status} />
          <DF label="Food Types"     value={user.food_types}     wide />
          <DF label="Operating Area" value={user.operating_area} wide />
          <DF label="Address"        value={user.address}        wide />
        </>}
        {user.role === 'volunteer' && <>
          <DF label="Vehicle"      value={user.vehicle_type} />
          <DF label="Service Area" value={user.service_area} />
          <DF label="Availability" value={user.availability} />
          <DF label="Address"      value={user.vol_address} wide />
        </>}
      </div>
      {donations?.length > 0 && (
        <>
          <h4 style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.9rem' }}>📦 Recent Donations ({donations.length})</h4>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr>{['Food Name', 'Category', 'Qty', 'City', 'Status', 'Posted'].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {donations.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.food_name}</td>
                    <td>{d.food_category}</td>
                    <td>{d.quantity} {d.unit}</td>
                    <td>{d.city}</td>
                    <td><DonationStatusBadge status={d.status} /></td>
                    <td style={{ fontSize: '0.75rem' }}>{fmtD(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NGO MANAGEMENT PANEL
   ═══════════════════════════════════════════════════════════════════════ */
function NgoPanel() {
  const [ngos,       setNgos]       = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState('');
  const [statusFilt, setStatusFilt] = useState('');
  const [loading,    setLoading]    = useState(true);
  const [err,        setErr]        = useState('');
  const [toast,      setToast]      = useState({ msg: '', type: 'success' });
  const [verifying,  setVerifying]  = useState(null);
  const [detail,     setDetail]     = useState(null);
  const searchTimer = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 4000);
  };

  const load = useCallback(async (pg = 1, q = search, st = statusFilt) => {
    setLoading(true); setErr('');
    try {
      const params = new URLSearchParams({ page: pg, limit: PAGE_SIZE });
      if (st) params.append('status', st);
      if (q)  params.append('search', q);
      const d = await api.get(`/admin/ngos?${params}`);
      if (d.success) { setNgos(d.ngos); setTotal(d.total); setPage(pg); }
      else setErr(d.error || 'Failed.');
    } catch { setErr('Could not connect.'); }
    finally { setLoading(false); }
  }, [search, statusFilt]);

  useEffect(() => { load(1, '', ''); }, []);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(1, val, statusFilt), 400);
  };

  const handleVerify = async (userId, status, ngoName) => {
    const actionLabels = { verified: 'verify', rejected: 'reject', pending: 'suspend (set pending)' };
    if (!window.confirm(`Are you sure you want to ${actionLabels[status] || status} "${ngoName}"?`)) return;
    setVerifying(userId);
    try {
      const d = await api.patch(`/admin/ngos/${userId}/verify`, { status });
      if (d.success) {
        showToast(`"${ngoName}" → ${status} ✅`, 'success');
        load(page, search, statusFilt);
        if (detail?.user_id === userId) setDetail((p) => ({ ...p, verification_status: status }));
      } else showToast(d.error || 'Failed.', 'error');
    } catch { showToast('Server error.', 'error'); }
    finally { setVerifying(null); }
  };

  // ── NGO Detail View ──
  if (detail) {
    const n = detail;
    const vsMap = { pending: '#D97706', verified: '#16A34A', rejected: '#DC2626' };
    const vsBg  = { pending: '#FFFBEB', verified: '#F0FDF4', rejected: '#FEF2F2' };
    const vsBdr = { pending: '#FDE68A', verified: '#BBF7D0', rejected: '#FECACA' };

    return (
      <div className="adm-card">
        <div className="adm-detail-back">
          <button className="adm-action-btn adm-action-btn--view" style={{ padding: '0.4rem 1rem' }} onClick={() => setDetail(null)}>← Back to NGOs</button>
          <VerifyBadge status={n.verification_status} />
        </div>
        <Toast msg={toast.msg} type={toast.type} />
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.2rem' }}>{n.ngo_name}</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
          By {n.name} · {n.user_email} · Registered {fmtD(n.registered_at)}
          {n.accepted_count !== undefined && ` · ${n.accepted_count} donation(s) accepted`}
        </p>

        {/* Verification Control Panel */}
        <div className="adm-verify-panel" style={{ background: vsBg[n.verification_status], borderColor: vsBdr[n.verification_status] }}>
          <div className="adm-verify-panel__label" style={{ color: vsMap[n.verification_status] }}>
            Current Status: {n.verification_status?.toUpperCase()}
          </div>
          <div className="adm-verify-panel__note">
            Verified NGOs can accept food donations. Use "Suspend" to temporarily revoke access.
            Rejected NGOs are permanently barred until restored.
          </div>
          <div className="adm-verify-panel__btns">
            {[
              { s: 'verified', label: '✅ Verify',  title: 'Allow NGO to accept donations'   },
              { s: 'pending',  label: '⏳ Suspend', title: 'Suspend – put back under review'  },
              { s: 'rejected', label: '❌ Reject',  title: 'Reject NGO permanently'           },
            ].map(({ s, label, title }) => {
              const active = n.verification_status === s;
              const colorMap = {
                verified: { border: '#16A34A', bgA: '#16A34A', bgI: '#F0FDF4', cA: '#fff', cI: '#16A34A' },
                pending:  { border: '#D97706', bgA: '#D97706', bgI: '#FFFBEB', cA: '#fff', cI: '#D97706' },
                rejected: { border: '#DC2626', bgA: '#DC2626', bgI: '#FEF2F2', cA: '#fff', cI: '#DC2626' },
              }[s];
              return (
                <button key={s} className="adm-verify-btn"
                  disabled={active || verifying === n.user_id}
                  onClick={() => handleVerify(n.user_id, s, n.ngo_name)}
                  title={title}
                  style={{ borderColor: colorMap.border, background: active ? colorMap.bgA : colorMap.bgI, color: active ? colorMap.cA : colorMap.cI }}
                >
                  {verifying === n.user_id ? '⏳ Updating…' : label}
                </button>
              );
            })}
          </div>
        </div>

        <h4 className="adm-section-heading">NGO Profile</h4>
        <div className="adm-detail-grid">
          <DF label="NGO Name"     value={n.ngo_name} />
          <DF label="Founder"      value={n.founder} />
          <DF label="Phone"        value={n.phone} />
          <DF label="Email"        value={n.user_email} />
          <DF label="City"         value={n.city} />
          <DF label="Max Capacity" value={n.max_food_capacity ? `${n.max_food_capacity} kg` : null} />
          <DF label="Availability" value={n.is_available ? '🟢 Accepting Donations' : '🔴 Not Accepting'} />
          <DF label="Accepted Donations"  value={n.accepted_count} />
          <DF label="Completed Donations" value={n.completed_count} />
          <DF label="Address"        value={n.address}        wide />
          <DF label="Operating Area" value={n.operating_area} wide />
          <DF label="Food Types"     value={n.food_types}     wide />
        </div>
      </div>
    );
  }

  // ── NGO List View ──
  const pendingCount = ngos.filter((n) => n.verification_status === 'pending').length;

  return (
    <div className="adm-card">
      <h3 className="adm-card__title">
        🏢 NGO Management
        {pendingCount > 0 && (
          <span className="adm-nav__badge adm-nav__badge--warn" style={{ marginLeft: '0.5rem' }}>{pendingCount} Pending</span>
        )}
      </h3>
      <Toast msg={toast.msg} type={toast.type} />

      {/* Status chips */}
      <div className="adm-chips">
        {[
          { label: 'All',          val: '',         cls: 'all'      },
          { label: '⏳ Pending',   val: 'pending',  cls: 'pending'  },
          { label: '✅ Verified',  val: 'verified', cls: 'verified' },
          { label: '❌ Rejected',  val: 'rejected', cls: 'rejected' },
        ].map(({ label, val, cls }) => (
          <button key={cls} className={`adm-chip${statusFilt === val ? ` active--${cls}` : ''}`}
            onClick={() => { setStatusFilt(val); load(1, search, val); }}>
            {label}
          </button>
        ))}
      </div>

      <div className="adm-toolbar">
        <input id="ngo-search" className="adm-search" placeholder="Search NGO name, city, email…"
          value={search} onChange={(e) => handleSearch(e.target.value)} />
        <button className="adm-action-btn adm-action-btn--view" onClick={() => load(page)} disabled={loading}>🔄</button>
      </div>

      {err && <Err msg={err} />}

      {loading ? <Loading /> : ngos.length === 0 ? (
        <Empty icon="🏢" title="No NGOs found" desc={search || statusFilt ? 'No NGOs match your filters.' : 'No NGOs registered yet.'} />
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>{['NGO Name', 'Founder', 'City', 'Phone', 'Food Types', 'Registered', 'Status', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {ngos.map((n) => (
                  <tr key={n.id || n.user_id}>
                    <td>
                      <button className="adm-link-btn"
                        onClick={() => {
                          api.get(`/admin/ngos/${n.user_id}`)
                            .then((d) => d.success && setDetail(d.ngo))
                            .catch(() => showToast('Failed to load NGO detail.', 'error'));
                        }}>
                        {n.ngo_name}
                      </button>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{n.founder || '—'}</td>
                    <td style={{ fontSize: '0.82rem' }}>{n.city || '—'}</td>
                    <td style={{ fontSize: '0.82rem' }}>{n.phone || '—'}</td>
                    <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.78rem' }} title={n.food_types}>{n.food_types || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{fmtD(n.registered_at)}</td>
                    <td><VerifyBadge status={n.verification_status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {n.verification_status !== 'verified' && (
                          <button className="adm-action-btn adm-action-btn--verify"
                            disabled={verifying === n.user_id}
                            onClick={() => handleVerify(n.user_id, 'verified', n.ngo_name)}>
                            ✅ Verify
                          </button>
                        )}
                        {n.verification_status === 'verified' && (
                          <button className="adm-action-btn adm-action-btn--pending"
                            disabled={verifying === n.user_id}
                            onClick={() => handleVerify(n.user_id, 'pending', n.ngo_name)}
                            title="Suspend – revoke access temporarily">
                            ⏳ Suspend
                          </button>
                        )}
                        {n.verification_status !== 'rejected' && (
                          <button className="adm-action-btn adm-action-btn--reject"
                            disabled={verifying === n.user_id}
                            onClick={() => handleVerify(n.user_id, 'rejected', n.ngo_name)}>
                            ❌ Reject
                          </button>
                        )}
                        {n.verification_status === 'rejected' && (
                          <button className="adm-action-btn adm-action-btn--pending"
                            disabled={verifying === n.user_id}
                            onClick={() => handleVerify(n.user_id, 'pending', n.ngo_name)}
                            title="Restore NGO to pending review">
                            🔄 Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={total} limit={PAGE_SIZE} onChange={(pg) => load(pg)} />
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DONATIONS PANEL
   ═══════════════════════════════════════════════════════════════════════ */
function DonationsPanel({ view, onSmartMatch }) {
  const [donations,  setDonations]  = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState('');
  const [statusFilt, setStatusFilt] = useState('');
  const [loading,    setLoading]    = useState(true);
  const [err,        setErr]        = useState('');
  const [detail,     setDetail]     = useState(null);
  const searchTimer = useRef(null);

  const getViewStatus = useCallback(() => {
    switch (view) {
      case 'active':     return ACTIVE_STATUSES.join(',');
      case 'completed':  return 'COMPLETED';
      case 'pickups':    return 'VOLUNTEER_ASSIGNED,PICKED_UP';
      case 'deliveries': return 'DELIVERED';
      default:           return '';
    }
  }, [view]);

  const load = useCallback(async (pg = 1, q = search, st = statusFilt) => {
    setLoading(true); setErr('');
    try {
      const params = new URLSearchParams({ page: pg, limit: PAGE_SIZE });
      const viewStatus = getViewStatus();
      const effectiveStatus = st || viewStatus;
      if (effectiveStatus && !effectiveStatus.includes(',')) {
        params.append('status', effectiveStatus);
      }
      if (q) params.append('search', q);
      const d = await api.get(`/admin/donations?${params}`);
      if (d.success) {
        let rows = d.donations;
        if (effectiveStatus?.includes(',')) {
          const allowed = effectiveStatus.split(',');
          rows = rows.filter((r) => allowed.includes(r.status));
        }
        setDonations(rows); setTotal(d.total); setPage(pg);
      } else setErr(d.error || 'Failed.');
    } catch { setErr('Could not connect.'); }
    finally { setLoading(false); }
  }, [search, statusFilt, getViewStatus]);

  useEffect(() => { setSearch(''); setStatusFilt(''); load(1, '', ''); }, [view]);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(1, val, statusFilt), 400);
  };

  const titles = {
    donations:  '📦 All Donations',
    active:     '⚡ Active Donations',
    completed:  '✅ Completed Donations',
    pickups:    '🚚 Pickup Requests',
    deliveries: '🏁 Delivery Records',
  };

  if (detail) return <DonationDetail donationId={detail} onBack={() => setDetail(null)} onSmartMatch={onSmartMatch} />;

  return (
    <div className="adm-card">
      <h3 className="adm-card__title">{titles[view] || '📦 Donations'}</h3>

      {view === 'donations' && (
        <div className="adm-chips">
          {[
            { label: 'All',          val: '',                                               cls: 'all'       },
            { label: '📋 Posted',    val: 'POSTED',                                         cls: 'posted'    },
            { label: '✅ Completed', val: 'COMPLETED',                                     cls: 'completed' },
            { label: '⚡ Active',    val: 'ACCEPTED,VOLUNTEER_ASSIGNED,PICKED_UP,DELIVERED', cls: 'active'   },
            { label: '🚫 Cancelled', val: 'CANCELLED',                                     cls: 'cancelled' },
          ].map(({ label, val, cls }) => (
            <button key={cls} className={`adm-chip${statusFilt === val ? ` active--${cls}` : ''}`}
              onClick={() => { setStatusFilt(val); load(1, search, val); }}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="adm-toolbar">
        <input id="donations-search" className="adm-search" placeholder="Search food name, city, donor…"
          value={search} onChange={(e) => handleSearch(e.target.value)} />
        <button className="adm-action-btn adm-action-btn--view" onClick={() => load(page)} disabled={loading}>🔄</button>
      </div>

      {err && <Err msg={err} />}

      {loading ? <Loading /> : donations.length === 0 ? (
        <Empty icon="📭" title="No donations found" desc={search ? 'No results for your search.' : 'No donations in this category.'} />
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>{['Food', 'Category', 'Type', 'Qty', 'People', 'City', 'Donor', 'Best Before', 'Status', 'NGO', 'Volunteer', 'Actions'].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {donations.map((d) => {
                  const bb     = d.best_before ? new Date(d.best_before) : null;
                  const msLeft = bb ? (bb - Date.now()) : Infinity;
                  const urgent   = msLeft > 0 && msLeft < 4 * 3600000;
                  const expiring = msLeft > 0 && msLeft < 8 * 3600000;
                  return (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600, color: 'var(--color-text-primary)', maxWidth: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {d.food_name}
                        {urgent    && <span style={{ color: '#B91C1C', marginLeft: 4, fontSize: '0.7rem' }}>🚨</span>}
                        {expiring && !urgent && <span style={{ color: '#D97706', marginLeft: 4, fontSize: '0.7rem' }}>⚠️</span>}
                      </td>
                      <td style={{ fontSize: '0.78rem' }}>{d.food_category}</td>
                      <td style={{ fontSize: '0.78rem' }}>{d.food_type === 'vegetarian' ? '🌿' : '🍗'}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{d.quantity} {d.unit}</td>
                      <td style={{ fontSize: '0.78rem' }}>{d.people_served || '—'}</td>
                      <td style={{ fontSize: '0.78rem' }}>{d.city}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{d.donor_name || '—'}</td>
                      <td style={{ fontSize: '0.72rem', color: urgent ? '#B91C1C' : expiring ? '#D97706' : 'var(--color-text-muted)', whiteSpace: 'nowrap', fontWeight: (urgent || expiring) ? 700 : 400 }}>
                        {fmt(d.best_before)}
                      </td>
                      <td><DonationStatusBadge status={d.status} /></td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{d.ngo_name || '—'}</td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{d.volunteer_name || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button className="adm-action-btn adm-action-btn--view" onClick={() => setDetail(d.id)}>View</button>
                          {d.status === 'POSTED' && (
                            <button className="adm-action-btn adm-action-btn--verify" title="Run Smart Match" onClick={() => onSmartMatch(d)}>🧠</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={total} limit={PAGE_SIZE} onChange={(pg) => load(pg)} />
        </>
      )}
    </div>
  );
}

function DonationDetail({ donationId, onBack, onSmartMatch }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');

  useEffect(() => {
    api.get(`/admin/donations/${donationId}`)
      .then((d) => { if (d.success) setData(d.donation); else setErr(d.error || 'Failed.'); })
      .catch(() => setErr('Could not connect.'))
      .finally(() => setLoading(false));
  }, [donationId]);

  if (loading) return <div className="adm-card"><Loading /></div>;
  if (err)     return <div className="adm-card"><Err msg={err} /></div>;
  const d = data;

  return (
    <div className="adm-card">
      <div className="adm-detail-back">
        <button className="adm-action-btn adm-action-btn--view" style={{ padding: '0.4rem 1rem' }} onClick={onBack}>← Back</button>
        <DonationStatusBadge status={d.status} />
        {d.status === 'POSTED' && (
          <button className="adm-action-btn adm-action-btn--verify" style={{ padding: '0.4rem 0.875rem' }} onClick={() => onSmartMatch(d)}>🧠 Smart Match</button>
        )}
      </div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.2rem' }}>{d.food_name}</h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>Donation #{d.id} · Posted {fmt(d.created_at)}</p>

      <h4 className="adm-section-heading">Food Details</h4>
      <div className="adm-detail-grid" style={{ marginBottom: '1.5rem' }}>
        <DF label="Category"      value={d.food_category} />
        <DF label="Type"          value={d.food_type === 'vegetarian' ? '🌿 Vegetarian' : '🍗 Non-Vegetarian'} />
        <DF label="Quantity"      value={`${d.quantity} ${d.unit}`} />
        <DF label="People Served" value={d.people_served} />
        <DF label="Prepared"      value={fmtD(d.preparation_date)} />
        <DF label="Best Before"   value={fmt(d.best_before)} />
        {d.description && <DF label="Description" value={d.description} wide />}
      </div>

      <h4 className="adm-section-heading">Pickup Location</h4>
      <div className="adm-detail-grid" style={{ marginBottom: '1.5rem' }}>
        <DF label="City"           value={d.city} />
        <DF label="Donor"          value={d.donor_name} />
        <DF label="Donor Phone"    value={d.donor_phone} />
        <DF label="Donor Email"    value={d.donor_email} />
        <DF label="Pickup Address" value={d.pickup_address} wide />
      </div>

      {d.ngo_name && <>
        <h4 className="adm-section-heading">NGO / Delivery</h4>
        <div className="adm-detail-grid" style={{ marginBottom: '1.5rem' }}>
          <DF label="NGO Name"    value={d.ngo_name} />
          <DF label="NGO Phone"   value={d.ngo_phone} />
          <DF label="NGO City"    value={d.ngo_city} />
          <DF label="NGO Address" value={d.ngo_address} wide />
        </div>
      </>}

      {d.volunteer_name && <>
        <h4 className="adm-section-heading">Volunteer</h4>
        <div className="adm-detail-grid" style={{ marginBottom: '1.5rem' }}>
          <DF label="Volunteer" value={d.volunteer_name} />
          <DF label="Phone"     value={d.volunteer_phone} />
          <DF label="Vehicle"   value={d.vehicle_type} />
        </div>
      </>}

      <h4 className="adm-section-heading">Timeline</h4>
      <div className="adm-detail-grid">
        <DF label="Posted"             value={fmt(d.created_at)} />
        <DF label="Accepted"           value={fmt(d.accepted_at)} />
        <DF label="Volunteer Assigned" value={fmt(d.volunteer_assigned_at)} />
        <DF label="Picked Up"          value={fmt(d.picked_up_at)} />
        <DF label="Delivered"          value={fmt(d.delivered_at)} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   VOLUNTEERS PANEL
   ═══════════════════════════════════════════════════════════════════════ */
function VolunteersPanel() {
  const [vols,    setVols]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');
  const searchTimer = useRef(null);

  const load = useCallback(async (pg = 1, q = search) => {
    setLoading(true); setErr('');
    try {
      const params = new URLSearchParams({ page: pg, limit: PAGE_SIZE });
      if (q) params.append('search', q);
      const d = await api.get(`/admin/volunteers?${params}`);
      if (d.success) { setVols(d.volunteers); setTotal(d.total); setPage(pg); }
      else setErr(d.error || 'Failed.');
    } catch { setErr('Could not connect.'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(1, ''); }, []);

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(1, val), 400);
  };

  return (
    <div className="adm-card">
      <h3 className="adm-card__title">🚗 Volunteers</h3>
      <div className="adm-toolbar">
        <input id="volunteers-search" className="adm-search" placeholder="Search name, email, service area…"
          value={search} onChange={(e) => handleSearch(e.target.value)} />
        <button className="adm-action-btn adm-action-btn--view" onClick={() => load(page)} disabled={loading}>🔄</button>
      </div>
      {err && <Err msg={err} />}
      {loading ? <Loading /> : vols.length === 0 ? (
        <Empty icon="🚗" title="No volunteers found" desc={search ? 'No results.' : 'No volunteers registered yet.'} />
      ) : (
        <>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>{['Name', 'Email', 'Phone', 'Vehicle', 'Service Area', 'Availability', 'Completed ✅', 'Active 🚚', 'Joined'].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {vols.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{v.name}</td>
                    <td style={{ fontSize: '0.78rem' }}>{v.email}</td>
                    <td style={{ fontSize: '0.78rem' }}>{v.phone || '—'}</td>
                    <td style={{ fontSize: '0.78rem' }}>{v.vehicle_type || '—'}</td>
                    <td style={{ fontSize: '0.78rem', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.service_area}>{v.service_area || '—'}</td>
                    <td style={{ fontSize: '0.78rem' }}>{v.availability || '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#16A34A' }}>{v.completed_pickups ?? 0}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#EA580C' }}>{v.active_pickups ?? 0}</td>
                    <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{fmtD(v.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={total} limit={PAGE_SIZE} onChange={(pg) => load(pg)} />
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT – ADMIN DASHBOARD
   ═══════════════════════════════════════════════════════════════════════ */
export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const [view,          setView]          = useState('overview');
  const [matchDonation, setMatchDonation] = useState(null);
  const [pendingNgos,   setPendingNgos]   = useState(0);
  const [sidebarOpen,   setSidebarOpen]   = useState(false);

  useEffect(() => {
    api.get('/admin/ngos?status=pending&limit=1')
      .then((d) => { if (d.success) setPendingNgos(d.total || 0); })
      .catch(() => {});
  }, [view]);

  const handleLogout = async () => { await logout(); navigate('/', { replace: true }); };
  const initials = user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  const sections = [
    { label: 'General',   items: NAV.filter((n) => n.section === 'GENERAL')   },
    { label: 'Users',     items: NAV.filter((n) => n.section === 'USERS')     },
    { label: 'Donations', items: NAV.filter((n) => n.section === 'DONATIONS') },
  ];

  const navigateTo = (id) => {
    setMatchDonation(null);
    setView(id);
    setSidebarOpen(false);
  };

  const renderPanel = () => {
    if (matchDonation) return (
      <SmartMatchPanel
        donation={matchDonation}
        userRole="admin"
        onClose={() => setMatchDonation(null)}
        onAccepted={() => setMatchDonation(null)}
      />
    );
    switch (view) {
      case 'overview':   return <OverviewPanel   onNavigate={navigateTo} />;
      case 'analytics':  return <AnalyticsPanel  />;
      case 'users':      return <UsersPanel roleFilter="" />;
      case 'donors':     return <UsersPanel roleFilter="donor" />;
      case 'volunteers': return <VolunteersPanel />;
      case 'ngos':       return <NgoPanel />;
      case 'donations':
      case 'active':
      case 'completed':
      case 'pickups':
      case 'deliveries':
        return <DonationsPanel view={view} onSmartMatch={(d) => setMatchDonation(d)} />;
      default: return <OverviewPanel onNavigate={navigateTo} />;
    }
  };

  const currentNav = NAV.find((n) => n.id === view);

  return (
    <div id="admin-dashboard" className="adm-layout">

      {/* Mobile overlay */}
      {sidebarOpen && <div className="adm-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar ──────────────────────────── */}
      <aside className={`adm-sidebar${sidebarOpen ? ' adm-sidebar--open' : ''}`}>
        <div className="adm-sidebar__brand">
          <div className="adm-sidebar__logo">Food<span>Bridge</span></div>
          <div className="adm-sidebar__subtitle">Admin Panel</div>
        </div>

        <div className="adm-sidebar__profile">
          <div className="adm-sidebar__avatar">{initials}</div>
          <div className="adm-sidebar__name">{user?.name}</div>
          <div className="adm-sidebar__email">{user?.email}</div>
          <span className="adm-sidebar__badge">⚙️ Admin</span>
        </div>

        <nav className="adm-nav" aria-label="Admin navigation">
          {sections.map(({ label, items }) => (
            <div key={label}>
              <div className="adm-nav__section-label">{label}</div>
              {items.map(({ id, icon, label: lbl }) => (
                <button key={id} id={`admin-nav-${id}`}
                  className={`adm-nav__item${view === id && !matchDonation ? ' active' : ''}`}
                  onClick={() => navigateTo(id)}>
                  <span className="adm-nav__icon">{icon}</span>
                  <span className="adm-nav__text">{lbl}</span>
                  {id === 'ngos' && pendingNgos > 0 && (
                    <span className="adm-nav__badge adm-nav__badge--warn">{pendingNgos}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
            <button className="adm-nav__item" id="admin-nav-logout" onClick={handleLogout}>
              <span className="adm-nav__icon">🚪</span>
              <span className="adm-nav__text">Log Out</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* ── Main Content ─────────────────────── */}
      <main className="adm-main">
        {/* Mobile header */}
        <div className="adm-mobile-header">
          <button className="adm-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <span /><span /><span />
          </button>
          <div className="adm-mobile-header__title">
            {currentNav?.icon} {currentNav?.label || 'Admin'}
          </div>
          <div className="adm-sidebar__avatar" style={{ width: 32, height: 32, fontSize: '0.75rem', flexShrink: 0 }}>{initials}</div>
        </div>

        {/* Page header (desktop) */}
        {!matchDonation && (
          <div className="adm-page-header">
            <div className="adm-page-header__title">{currentNav?.icon} {currentNav?.label || 'Overview'}</div>
            <div className="adm-page-header__sub">Admin Control Panel → {currentNav?.label || 'Overview'}</div>
          </div>
        )}

        {matchDonation && (
          <div className="adm-page-header">
            <div className="adm-page-header__title">🧠 Smart Match</div>
            <div className="adm-page-header__sub">
              Finding best NGOs for: <strong>{matchDonation.food_name}</strong>
              <button className="adm-action-btn adm-action-btn--view"
                style={{ marginLeft: '0.75rem', padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                onClick={() => setMatchDonation(null)}>
                ← Back
              </button>
            </div>
          </div>
        )}

        {renderPanel()}
      </main>
    </div>
  );
}
