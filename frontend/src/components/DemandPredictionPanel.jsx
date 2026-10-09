import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';
import '../styles/DemandPrediction.css';

const CATEGORIES = [
  'Cooked Food', 'Packaged Food', 'Dry Ration',
  'Fruits', 'Vegetables', 'Bakery Items', 'Dairy', 'Other',
];

const CONFIDENCE_META = {
  high:   { cls: 'conf-high',   icon: '🟢', label: 'High Confidence'   },
  medium: { cls: 'conf-medium', icon: '🟡', label: 'Medium Confidence' },
  low:    { cls: 'conf-low',    icon: '🔴', label: 'Low Confidence'    },
};

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Single prediction card ────────────────────────────────────────────────── */
function PredictionCard({ p }) {
  const [expanded, setExpanded] = useState(false);

  if (p.status === 'insufficient_data') {
    return (
      <div className="pred-card pred-card--empty">
        <div className="pred-card__cat">{p.category}</div>
        <div className="pred-card__insufficient">
          <span>📉</span>
          <p>Insufficient data</p>
          <small>{p.message}</small>
        </div>
      </div>
    );
  }

  const conf = CONFIDENCE_META[p.confidence] || CONFIDENCE_META.low;

  return (
    <div className={`pred-card ${expanded ? 'pred-card--expanded' : ''}`}>
      <div className="pred-card__header" onClick={() => setExpanded(e => !e)}>
        <div className="pred-card__left">
          <div className="pred-card__cat">{p.category}</div>
          <div className="pred-card__qty">
            <span className="pred-card__qty-main">{p.predicted_qty}</span>
            <span className="pred-card__qty-unit">units</span>
          </div>
          <div className="pred-card__range">
            Range: {p.predicted_qty_low}–{p.predicted_qty_high}
          </div>
          {p.predicted_people !== null && (
            <div className="pred-card__people">
              ≈ {p.predicted_people} people
            </div>
          )}
        </div>
        <div className="pred-card__right">
          <span className={`pred-card__conf ${conf.cls}`}>
            {conf.icon} {conf.label}
          </span>
          <span className="pred-card__dp">{p.data_points} data pts</span>
          <button className="pred-card__expand-btn" aria-label="Toggle details">
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="pred-card__details">
          <div className="pred-detail-grid">
            <div className="pred-detail-item">
              <span className="pred-detail-label">Algorithm</span>
              <span className="pred-detail-value" style={{ fontSize: '0.72rem' }}>{p.algorithm}</span>
            </div>
            <div className="pred-detail-item">
              <span className="pred-detail-label">Target Date</span>
              <span className="pred-detail-value">{fmtDate(p.target_date)}</span>
            </div>
            <div className="pred-detail-item">
              <span className="pred-detail-label">Day Factor</span>
              <span className="pred-detail-value">{p.factors?.day_of_week} × {p.factors?.day_factor}</span>
            </div>
            <div className="pred-detail-item">
              <span className="pred-detail-label">Month Factor</span>
              <span className="pred-detail-value">{p.factors?.month} × {p.factors?.month_factor}</span>
            </div>
            <div className="pred-detail-item">
              <span className="pred-detail-label">WMA Estimate</span>
              <span className="pred-detail-value">{p.factors?.wma_estimate}</span>
            </div>
            <div className="pred-detail-item">
              <span className="pred-detail-label">Trend Slope</span>
              <span className="pred-detail-value">{p.factors?.trend_slope}</span>
            </div>
            <div className="pred-detail-item">
              <span className="pred-detail-label">Historical Mean</span>
              <span className="pred-detail-value">{p.factors?.historical_mean}</span>
            </div>
            <div className="pred-detail-item">
              <span className="pred-detail-label">Std Deviation</span>
              <span className="pred-detail-value">{p.factors?.std_deviation}</span>
            </div>
            <div className="pred-detail-item">
              <span className="pred-detail-label">R² Score</span>
              <span className="pred-detail-value">{p.r_squared}</span>
            </div>
            <div className="pred-detail-item">
              <span className="pred-detail-label">People / Unit</span>
              <span className="pred-detail-value">{p.factors?.people_per_unit ?? '—'}</span>
            </div>
          </div>
          <div className="pred-card__msg">{p.message}</div>
        </div>
      )}
    </div>
  );
}

/* ── Main Panel ───────────────────────────────────────────────────────────── */
export default function DemandPredictionPanel() {
  const [loading,     setLoading]     = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [error,       setError]       = useState('');
  const [meta,        setMeta]        = useState(null);   // categories metadata
  const [result,      setResult]      = useState(null);   // prediction result
  const [category,    setCategory]    = useState('');     // '' = all
  const [dateStr,     setDateStr]     = useState('');     // '' = tomorrow

  /* Minimum date for the picker = today */
  const todayISO = new Date().toISOString().split('T')[0];

  /* Load categories metadata once */
  useEffect(() => {
    api.get('/ngo/predict/categories')
      .then(d => { if (d.success) setMeta(d.categories); })
      .catch(() => {})
      .finally(() => setMetaLoading(false));
  }, []);

  const runPrediction = useCallback(async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      let path = '/ngo/predict';
      const params = [];
      if (category) params.push(`category=${encodeURIComponent(category)}`);
      if (dateStr)  params.push(`date=${dateStr}`);
      if (params.length) path += '?' + params.join('&');

      const d = await api.get(path);
      if (!d.success) throw new Error(d.error || 'Prediction failed.');
      setResult(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [category, dateStr]);

  /* Derive badge for a category selector option */
  function catBadge(cat) {
    if (!meta) return '';
    const m = meta.find(x => x.category === cat);
    if (!m) return ' (0 pts)';
    return m.has_enough_data ? ` (${m.data_points} pts ✓)` : ` (${m.data_points} pts — need 3)`;
  }

  const predictions       = result?.predictions || [];
  const okPredictions     = predictions.filter(p => p.status === 'ok');
  const emptyPredictions  = predictions.filter(p => p.status !== 'ok');

  return (
    <div className="pred-panel">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="pred-panel__header">
        <div className="pred-panel__title-row">
          <span className="pred-panel__icon">🤖</span>
          <div>
            <h3 className="pred-panel__title">AI Demand Forecast</h3>
            <p className="pred-panel__sub">
              Predict your NGO's food requirements using historical data.
              Model: <strong>Weighted Moving Average + OLS Trend + Seasonality</strong>
            </p>
          </div>
        </div>
      </div>

      {/* ── Controls ───────────────────────────────────────────── */}
      <div className="pred-controls">
        <div className="pred-controls__field">
          <label className="pred-controls__label">Food Category</label>
          <select
            className="pred-controls__select"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}{catBadge(c)}</option>
            ))}
          </select>
        </div>

        <div className="pred-controls__field">
          <label className="pred-controls__label">Predict For Date</label>
          <input
            type="date"
            className="pred-controls__input"
            min={todayISO}
            value={dateStr}
            onChange={e => setDateStr(e.target.value)}
          />
          <small className="pred-controls__hint">Leave blank for tomorrow</small>
        </div>

        <button
          className="pred-controls__btn"
          onClick={runPrediction}
          disabled={loading}
        >
          {loading ? '⏳ Predicting…' : '🔮 Run Forecast'}
        </button>
      </div>

      {/* ── Category metadata table ─────────────────────────────── */}
      {!metaLoading && meta && meta.length > 0 && !result && (
        <div className="pred-meta-table">
          <div className="pred-meta-table__title">📋 Your Data Availability</div>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Data Points</th>
                <th>Status</th>
                <th>Last Donation</th>
              </tr>
            </thead>
            <tbody>
              {meta.map(m => (
                <tr key={m.category}>
                  <td>{m.category}</td>
                  <td>{m.data_points}</td>
                  <td>
                    {m.has_enough_data
                      ? <span className="pred-status-ok">✅ Ready</span>
                      : <span className="pred-status-warn">⚠️ Need {3 - m.data_points} more</span>}
                  </td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    {m.last_donation ? fmtDate(m.last_donation) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!metaLoading && meta && meta.length === 0 && !result && (
        <div className="pred-no-data">
          <span>📦</span>
          <p>No historical donation data yet.</p>
          <small>
            Accept at least 3 donations in a category to enable predictions for that category.
          </small>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────── */}
      {error && (
        <div className="pred-error">❌ {error}</div>
      )}

      {/* ── Results ────────────────────────────────────────────── */}
      {result && (
        <div className="pred-results">
          <div className="pred-results__meta">
            <span>🏢 <strong>{result.ngo_name}</strong> · {result.city}</span>
            <span>📅 {predictions.length > 0 && predictions[0].target_date ? fmtDate(predictions[0].target_date) : 'Tomorrow'}</span>
            <span>📁 {result.total_records} historical records · {result.look_back_months}-month window</span>
            <button className="pred-results__clear" onClick={() => setResult(null)}>✕ Clear</button>
          </div>

          {predictions.length === 0 && (
            <div className="pred-no-data">
              <span>📦</span>
              <p>No predictions available.</p>
              <small>Accept and complete at least 3 donations in a food category to generate forecasts.</small>
            </div>
          )}

          {okPredictions.length > 0 && (
            <>
              <div className="pred-results__section-title">✅ Predictions</div>
              <div className="pred-cards-grid">
                {okPredictions.map((p, i) => <PredictionCard key={i} p={p} />)}
              </div>
            </>
          )}

          {emptyPredictions.length > 0 && (
            <>
              <div className="pred-results__section-title">📉 Insufficient Data</div>
              <div className="pred-cards-grid">
                {emptyPredictions.map((p, i) => <PredictionCard key={i} p={p} />)}
              </div>
            </>
          )}

          {/* Disclaimer */}
          <div className="pred-disclaimer">
            ⚠️ These forecasts are statistical estimates based on historical donation patterns.
            They are <strong>not guaranteed predictions</strong>. Always cross-check with
            current operational needs. Confidence improves with more data points.
          </div>
        </div>
      )}

      {/* ── Model Info Accordion ────────────────────────────────── */}
      <ModelInfoAccordion />
    </div>
  );
}

/* ── Model info accordion ─────────────────────────────────────────────────── */
function ModelInfoAccordion() {
  const [open, setOpen] = useState(false);
  return (
    <div className="pred-model-info">
      <button className="pred-model-info__toggle" onClick={() => setOpen(o => !o)}>
        🔬 About the Prediction Model {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="pred-model-info__body">
          <h4>Input Features</h4>
          <ul>
            <li><strong>NGO ID</strong> – Filters history to this specific NGO only</li>
            <li><strong>Food Category</strong> – Per-category prediction (Cooked Food, Dry Ration, etc.)</li>
            <li><strong>Historical Quantities</strong> – Accepted donation quantities (COMPLETED / DELIVERED status)</li>
            <li><strong>Historical Beneficiaries</strong> – <code>people_served</code> field per donation</li>
            <li><strong>Day of Week</strong> – Derived from the target date; demand varies Mon–Sun</li>
            <li><strong>Month</strong> – Seasonal adjustment for Indian festive/cold months</li>
            <li><strong>Location (City)</strong> – Contextual metadata (not a numeric feature in this model)</li>
            <li><strong>Recency Weight</strong> – More recent donations carry higher weight via WMA</li>
          </ul>

          <h4>Algorithm</h4>
          <p>
            <strong>Weighted Moving Average (WMA) — 70% weight</strong><br />
            Assigns linearly increasing weights to historical observations so that recent
            donations have more influence. Formula: Σ(w·qty) / Σ(w) where w = observation index.
          </p>
          <p>
            <strong>OLS Linear Regression (trend) — 30% weight</strong><br />
            Fits a least-squares line to (index, quantity) pairs to detect whether demand
            is growing, stable, or declining over time. R² score is reported per prediction.
          </p>
          <p>
            <strong>Seasonality Adjustments</strong><br />
            Both estimates are multiplied by a day-of-week factor (DOW_FACTOR) and a monthly
            factor (MONTH_FACTOR) calibrated for Indian demand patterns
            (e.g., weekdays higher, December peak, summer dip).
          </p>
          <p>
            <strong>Final Estimate:</strong> 0.70 × WMA_adjusted + 0.30 × max(0, Trend_adjusted)
          </p>

          <h4>Output</h4>
          <ul>
            <li><strong>predicted_qty</strong> – Point estimate (rounded integer)</li>
            <li><strong>predicted_qty_low / high</strong> – ±1 standard deviation range</li>
            <li><strong>predicted_people</strong> – Derived from historical people-per-unit ratio</li>
            <li><strong>confidence</strong> – high / medium / low (based on n ≥ 10, R² ≥ 0.6, CV &lt; 0.3)</li>
          </ul>

          <h4>Training Data</h4>
          <p>
            No pre-trained model is used. The algorithm runs on live database records each
            time a prediction is requested. It uses up to <strong>12 months</strong> of
            COMPLETED/DELIVERED/PICKED_UP donations for this NGO. A minimum of{' '}
            <strong>3 data points per category</strong> is required.
          </p>

          <h4>Limitations</h4>
          <ul>
            <li>Predictions degrade with sparse data (&lt; 5 records)</li>
            <li>External factors (festivals, disasters, donor availability) are not modeled</li>
            <li>Day-of-week and month factors are fixed heuristics, not learned from data</li>
            <li>Location is not used as a numeric predictor in this version</li>
            <li>Model assumes quantity is a continuous variable — may be less accurate for discrete meal counts</li>
            <li>No cross-NGO learning — predictions are strictly per-NGO</li>
          </ul>
        </div>
      )}
    </div>
  );
}
