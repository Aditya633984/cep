/**
 * AnalyticsCharts – reusable chart components for FoodBridge dashboards.
 * Uses Chart.js via react-chartjs-2.
 */

import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  ArcElement, PointElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  ArcElement, PointElement, Title, Tooltip, Legend, Filler
);

const FONT_FAMILY = "'Inter', 'Outfit', sans-serif";

const THEME = {
  dark: {
    surface: 'rgba(30,41,59,0.85)', border: 'rgba(255,255,255,0.07)',
    text: '#F1F5F9', muted: '#94A3B8', grid: 'rgba(148,163,184,0.07)',
    tick: '#64748B', tooltipBg: 'rgba(15,23,42,0.96)',
    tooltipTitle: '#F1F5F9', tooltipBody: '#94A3B8',
  },
  light: {
    surface: '#FFFFFF', border: '#E2E8F0',
    text: '#0F172A', muted: '#64748B', grid: 'rgba(148,163,184,0.1)',
    tick: '#94A3B8', tooltipBg: 'rgba(255,255,255,0.98)',
    tooltipTitle: '#0F172A', tooltipBody: '#475569',
  },
};

function getTheme(theme) { return THEME[theme] || THEME.dark; }

function baseOptions(theme) {
  const t = getTheme(theme);
  return {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false, labels: { font: { family: FONT_FAMILY, size: 12 }, color: t.muted } },
      tooltip: {
        backgroundColor: t.tooltipBg, titleColor: t.tooltipTitle, bodyColor: t.tooltipBody,
        borderColor: 'rgba(99,102,241,0.2)', borderWidth: 1, cornerRadius: 8, padding: 10,
        titleFont: { family: FONT_FAMILY, size: 12, weight: '600' },
        bodyFont: { family: FONT_FAMILY, size: 12 },
        displayColors: true, boxWidth: 10, boxHeight: 10, boxPadding: 4,
      },
    },
    scales: {
      x: { grid: { color: t.grid, drawBorder: false }, ticks: { color: t.tick, font: { family: FONT_FAMILY, size: 11 } }, border: { display: false } },
      y: { grid: { color: t.grid, drawBorder: false }, ticks: { color: t.tick, font: { family: FONT_FAMILY, size: 11 }, precision: 0 }, border: { display: false }, beginAtZero: true },
    },
  };
}

const ACCENT = {
  blue:   { bg: 'rgba(99,102,241,0.85)',  border: '#6366F1' },
  green:  { bg: 'rgba(34,197,94,0.85)',   border: '#22C55E' },
  amber:  { bg: 'rgba(251,191,36,0.85)',  border: '#FBBF24' },
  purple: { bg: 'rgba(168,85,247,0.85)',  border: '#A855F7' },
  sky:    { bg: 'rgba(14,165,233,0.85)',  border: '#0EA5E9' },
  rose:   { bg: 'rgba(244,63,94,0.85)',   border: '#F43F5E' },
  teal:   { bg: 'rgba(20,184,166,0.85)',  border: '#14B8A6' },
  orange: { bg: 'rgba(249,115,22,0.85)',  border: '#F97316' },
};

const CAT_PALETTE = [ACCENT.blue.bg, ACCENT.green.bg, ACCENT.amber.bg, ACCENT.purple.bg, ACCENT.sky.bg, ACCENT.rose.bg, ACCENT.teal.bg, ACCENT.orange.bg];
const CAT_BORDERS = [ACCENT.blue.border, ACCENT.green.border, ACCENT.amber.border, ACCENT.purple.border, ACCENT.sky.border, ACCENT.rose.border, ACCENT.teal.border, ACCENT.orange.border];

function fmtMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} '${y.slice(2)}`;
}

export function ChartCard({ title, subtitle, children, height = 240, theme = 'dark' }) {
  const t = getTheme(theme);
  return (
    <div className="analytics-card" style={{ background: t.surface, border: `1px solid ${t.border}` }}>
      <div className="analytics-card__header">
        <span className="analytics-card__title" style={{ color: t.text }}>{title}</span>
        {subtitle && <span className="analytics-card__subtitle" style={{ color: t.muted }}>{subtitle}</span>}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

function EmptyChart({ message = 'No data yet', theme = 'dark', title = '', height = 240, subtitle }) {
  const t = getTheme(theme);
  return (
    <ChartCard title={title} subtitle={subtitle} theme={theme} height={height}>
      <div className="analytics-empty">
        <span>{'📊'}</span>
        <p>{message}</p>
        <small style={{ color: t.muted, fontSize: '0.7rem' }}>Data will appear once donations are made</small>
      </div>
    </ChartCard>
  );
}

export function DonationsByMonthChart({ data = [], label = 'Donations', theme = 'dark' }) {
  if (!data.length) return <EmptyChart title="Donations by Month" subtitle="Last 12 months" message="No donation data yet" theme={theme} />;
  const labels = data.map((d) => fmtMonth(d.month));
  const counts = data.map((d) => Number(d.count));
  const chartData = {
    labels,
    datasets: [{ label, data: counts, backgroundColor: counts.map((_, i) => i === counts.length - 1 ? ACCENT.blue.border : ACCENT.blue.bg), borderColor: ACCENT.blue.border, borderWidth: 2, borderRadius: 8, borderSkipped: false }],
  };
  const opts = { ...baseOptions(theme), plugins: { ...baseOptions(theme).plugins, legend: { display: false }, tooltip: { ...baseOptions(theme).plugins.tooltip, callbacks: { label: (ctx) => ` ${ctx.raw} donations` } } } };
  return <ChartCard title="Donations by Month" subtitle="Last 12 months" theme={theme}><Bar data={chartData} options={opts} /></ChartCard>;
}

export function CategoryDistributionChart({ data = [], theme = 'dark' }) {
  const t = getTheme(theme);
  if (!data.length) return <EmptyChart title="Food Category Distribution" message="No category data yet" theme={theme} height={310} />;
  const labels = data.map((d) => d.food_category);
  const counts = data.map((d) => Number(d.count));
  const total = counts.reduce((a, b) => a + b, 0);
  const chartData = { labels, datasets: [{ data: counts, backgroundColor: CAT_PALETTE.slice(0, labels.length), borderColor: CAT_BORDERS.slice(0, labels.length), borderWidth: 2, hoverOffset: 10 }] };
  const opts = {
    responsive: true, maintainAspectRatio: false, cutout: '65%',
    animation: { duration: 700, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { font: { family: FONT_FAMILY, size: 11 }, color: t.muted, padding: 14, usePointStyle: true, pointStyleWidth: 8 } },
      tooltip: { ...baseOptions(theme).plugins.tooltip, callbacks: { label: (ctx) => { const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0; return ` ${ctx.raw} (${pct}%)`; } } },
    },
  };
  return <ChartCard title="Food Category Distribution" height={310} theme={theme}><Doughnut data={chartData} options={opts} /></ChartCard>;
}

export function CompletedVsActiveChart({ completed = 0, active = 0, posted = 0, cancelled = 0, theme = 'dark' }) {
  const total = completed + active + posted + cancelled;
  const t = getTheme(theme);
  if (total === 0) return <EmptyChart title="Donation Status Overview" message="No donations yet" theme={theme} height={310} />;
  const segs = [
    { label: 'Completed', value: completed, bg: ACCENT.green.bg },
    { label: 'Active',    value: active,    bg: ACCENT.blue.bg  },
    { label: 'Posted',    value: posted,    bg: ACCENT.amber.bg },
    { label: 'Cancelled', value: cancelled, bg: ACCENT.rose.bg  },
  ].filter(s => s.value > 0);
  const chartData = { labels: segs.map(s => s.label), datasets: [{ data: segs.map(s => s.value), backgroundColor: segs.map(s => s.bg), borderColor: t.surface, borderWidth: 3, hoverOffset: 10 }] };
  const opts = {
    responsive: true, maintainAspectRatio: false, cutout: '65%',
    animation: { duration: 700, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: true, position: 'bottom', labels: { font: { family: FONT_FAMILY, size: 11 }, color: t.muted, padding: 14, usePointStyle: true, pointStyleWidth: 8 } },
      tooltip: { ...baseOptions(theme).plugins.tooltip, callbacks: { label: (ctx) => { const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0; return ` ${ctx.raw} (${pct}%)`; } } },
    },
  };
  return <ChartCard title="Donation Status Overview" height={310} theme={theme}><Doughnut data={chartData} options={opts} /></ChartCard>;
}

export function FoodOverTimeChart({ data = [], label = 'Food Donated (kg)', theme = 'dark' }) {
  const t = getTheme(theme);
  if (!data.length) return <EmptyChart title="Food Donated Over Time" subtitle="Completed deliveries (kg)" message="No food data yet" theme={theme} />;
  const labels = data.map((d) => fmtMonth(d.month));
  const values = data.map((d) => Number(d.total_qty));
  const chartData = {
    labels,
    datasets: [{ label, data: values, fill: true, backgroundColor: 'rgba(34,197,94,0.12)', borderColor: ACCENT.green.border, pointBackgroundColor: ACCENT.green.border, pointBorderColor: t.surface, pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2.5, tension: 0.4 }],
  };
  const opts = { ...baseOptions(theme), plugins: { ...baseOptions(theme).plugins, legend: { display: false }, tooltip: { ...baseOptions(theme).plugins.tooltip, callbacks: { label: (ctx) => ` ${Number(ctx.raw).toFixed(1)} kg` } } }, scales: { ...baseOptions(theme).scales, y: { ...baseOptions(theme).scales.y, ticks: { ...baseOptions(theme).scales.y.ticks, callback: (v) => `${v} kg` } } } };
  return <ChartCard title="Food Donated Over Time" subtitle="Completed deliveries (kg)" theme={theme}><Line data={chartData} options={opts} /></ChartCard>;
}

export function PeopleOverTimeChart({ data = [], theme = 'dark' }) {
  const t = getTheme(theme);
  if (!data.length) return <EmptyChart title="People Served Over Time" subtitle="From completed donations" message="No people data yet" theme={theme} />;
  const labels = data.map((d) => fmtMonth(d.month));
  const values = data.map((d) => Number(d.total_people));
  const chartData = {
    labels,
    datasets: [{ label: 'People Served', data: values, fill: true, backgroundColor: 'rgba(168,85,247,0.12)', borderColor: ACCENT.purple.border, pointBackgroundColor: ACCENT.purple.border, pointBorderColor: t.surface, pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2.5, tension: 0.4 }],
  };
  const opts = { ...baseOptions(theme), plugins: { ...baseOptions(theme).plugins, legend: { display: false }, tooltip: { ...baseOptions(theme).plugins.tooltip, callbacks: { label: (ctx) => ` ${Number(ctx.raw).toLocaleString('en-IN')} people` } } }, scales: { ...baseOptions(theme).scales, y: { ...baseOptions(theme).scales.y, ticks: { ...baseOptions(theme).scales.y.ticks, callback: (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v } } } };
  return <ChartCard title="People Served Over Time" subtitle="From completed donations" theme={theme}><Line data={chartData} options={opts} /></ChartCard>;
}

export function PickupsByMonthChart({ data = [], theme = 'dark' }) {
  if (!data.length) return <EmptyChart title="Pickups by Month" subtitle="Last 12 months" message="No pickup data yet" theme={theme} />;
  const labels = data.map((d) => fmtMonth(d.month));
  const counts = data.map((d) => Number(d.count));
  const chartData = { labels, datasets: [{ label: 'Pickups', data: counts, backgroundColor: counts.map((_, i) => i === counts.length - 1 ? ACCENT.teal.border : ACCENT.teal.bg), borderColor: ACCENT.teal.border, borderWidth: 2, borderRadius: 8, borderSkipped: false }] };
  const opts = { ...baseOptions(theme), plugins: { ...baseOptions(theme).plugins, legend: { display: false }, tooltip: { ...baseOptions(theme).plugins.tooltip, callbacks: { label: (ctx) => ` ${ctx.raw} pickups` } } } };
  return <ChartCard title="Pickups by Month" subtitle="Last 12 months" theme={theme}><Bar data={chartData} options={opts} /></ChartCard>;
}

const STATUS_MAP = {
  POSTED:             { color: ACCENT.amber,  label: 'Posted'             },
  ACCEPTED:           { color: ACCENT.blue,   label: 'Accepted'           },
  VOLUNTEER_ASSIGNED: { color: ACCENT.sky,    label: 'Volunteer Assigned' },
  PICKED_UP:          { color: ACCENT.orange, label: 'Picked Up'          },
  DELIVERED:          { color: ACCENT.teal,   label: 'Delivered'          },
  COMPLETED:          { color: ACCENT.green,  label: 'Completed'          },
  CANCELLED:          { color: ACCENT.rose,   label: 'Cancelled'          },
};

export function StatusBreakdownChart({ data = [], theme = 'dark' }) {
  if (!data.length) return <EmptyChart title="Donations by Status" subtitle="All time" message="No donation data yet" theme={theme} height={280} />;
  const t = getTheme(theme);
  const labels = data.map((d) => STATUS_MAP[d.status]?.label || d.status);
  const counts = data.map((d) => Number(d.count));
  const bgColors = data.map((d) => STATUS_MAP[d.status]?.color.bg || ACCENT.blue.bg);
  const bdColors = data.map((d) => STATUS_MAP[d.status]?.color.border || ACCENT.blue.border);
  const chartData = { labels, datasets: [{ label: 'Donations', data: counts, backgroundColor: bgColors, borderColor: bdColors, borderWidth: 2, borderRadius: 6, borderSkipped: false }] };
  const opts = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeOutQuart' },
    plugins: { legend: { display: false }, tooltip: { ...baseOptions(theme).plugins.tooltip, callbacks: { label: (ctx) => ` ${ctx.raw} donations` } } },
    scales: {
      x: { grid: { color: t.grid, drawBorder: false }, ticks: { color: t.tick, font: { family: FONT_FAMILY, size: 11 }, precision: 0 }, border: { display: false }, beginAtZero: true },
      y: { grid: { color: 'transparent', drawBorder: false }, ticks: { color: t.tick, font: { family: FONT_FAMILY, size: 11 } }, border: { display: false } },
    },
  };
  return <ChartCard title="Donations by Status" subtitle="All time" height={280} theme={theme}><Bar data={chartData} options={opts} /></ChartCard>;
}

export function MonthlyRegistrationsChart({ data = [], theme = 'dark' }) {
  if (!data.length) return <EmptyChart title="New User Registrations" subtitle="Last 6 months" message="No registration data yet" theme={theme} />;
  const labels = data.map((d) => fmtMonth(d.month));
  const counts = data.map((d) => Number(d.count));
  const chartData = { labels, datasets: [{ label: 'New Users', data: counts, backgroundColor: counts.map((_, i) => i === counts.length - 1 ? ACCENT.purple.border : ACCENT.purple.bg), borderColor: ACCENT.purple.border, borderWidth: 2, borderRadius: 8, borderSkipped: false }] };
  const opts = { ...baseOptions(theme), plugins: { ...baseOptions(theme).plugins, legend: { display: false }, tooltip: { ...baseOptions(theme).plugins.tooltip, callbacks: { label: (ctx) => ` ${ctx.raw} new users` } } } };
  return <ChartCard title="New User Registrations" subtitle="Last 6 months" theme={theme}><Bar data={chartData} options={opts} /></ChartCard>;
}

export function FoodDeliveredOverTimeChart({ data = [], theme = 'dark' }) {
  const t = getTheme(theme);
  if (!data.length) return <EmptyChart title="Food Delivered Over Time" subtitle="Kg delivered per month" message="No delivery data yet" theme={theme} />;
  const labels = data.map((d) => fmtMonth(d.month));
  const values = data.map((d) => Number(d.total_qty));
  const chartData = { labels, datasets: [{ label: 'Food Delivered (kg)', data: values, fill: true, backgroundColor: 'rgba(20,184,166,0.12)', borderColor: ACCENT.teal.border, pointBackgroundColor: ACCENT.teal.border, pointBorderColor: t.surface, pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 7, borderWidth: 2.5, tension: 0.4 }] };
  const opts = { ...baseOptions(theme), plugins: { ...baseOptions(theme).plugins, legend: { display: false }, tooltip: { ...baseOptions(theme).plugins.tooltip, callbacks: { label: (ctx) => ` ${Number(ctx.raw).toFixed(1)} kg` } } }, scales: { ...baseOptions(theme).scales, y: { ...baseOptions(theme).scales.y, ticks: { ...baseOptions(theme).scales.y.ticks, callback: (v) => `${v} kg` } } } };
  return <ChartCard title="Food Delivered Over Time" subtitle="Kg delivered per month" theme={theme}><Line data={chartData} options={opts} /></ChartCard>;
}
