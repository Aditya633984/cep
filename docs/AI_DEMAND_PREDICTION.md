# FoodBridge — AI Demand Prediction Feature
## Technical Documentation

> **Version:** 1.0  
> **Last Updated:** October 2026  
> **Author:** FoodBridge Development Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [Input Features](#2-input-features)
3. [Algorithm & Model](#3-algorithm--model)
4. [Training Data](#4-training-data)
5. [Prediction Process (Step-by-Step)](#5-prediction-process-step-by-step)
6. [API Endpoints](#6-api-endpoints)
7. [Frontend Integration](#7-frontend-integration)
8. [Output Schema](#8-output-schema)
9. [Confidence Levels](#9-confidence-levels)
10. [Limitations](#10-limitations)
11. [Future Improvements](#11-future-improvements)
12. [File Map](#12-file-map)

---

## 1. Overview

The **AI Demand Prediction** feature allows NGOs on FoodBridge to forecast the quantity of food they will require for a specific future date. It uses **statistical ML techniques** (Weighted Moving Average + OLS Linear Regression) applied to each NGO's own historical donation-receipt data.

### Goals
- Predict approximate food quantity required per food category
- Help NGOs proactively plan food procurement and volunteer allocation
- Show honest, data-backed confidence levels
- Refuse to generate fake predictions when insufficient data exists

### Design Principles
- **No fake predictions:** If fewer than 3 data points exist for a category, the system returns "Insufficient data for reliable prediction".
- **Modular ML:** The prediction engine (`backend/ml/demandPredictor.js`) is completely decoupled from Express and the database.
- **Per-NGO isolation:** Predictions are computed only using that NGO's own history — no cross-NGO data leakage.
- **Live computation:** No pre-trained model is stored. Predictions are computed on-the-fly on each API call.

---

## 2. Input Features

| Feature | Source | Role in Model |
|---|---|---|
| **NGO ID** | JWT token (authenticated user) | Filters historical data to this NGO only |
| **Food Category** | User-selected or all categories | Per-category predictions |
| **Historical Quantity** | `donations.quantity` (COMPLETED/DELIVERED) | Primary numeric signal for WMA and regression |
| **Historical Beneficiaries** | `donations.people_served` | Used to derive `people_per_unit` ratio |
| **Recency Weight** | Derived (observation index) | Recent donations have higher weight in WMA |
| **Day of Week** | Derived from `targetDate` | Demand seasonality factor (0=Sun...6=Sat) |
| **Month** | Derived from `targetDate` | Monthly seasonality adjustment |
| **Location (City)** | `ngo_profiles.city` | Contextual metadata; not a numeric predictor in v1 |
| **Previous Food Demand** | All rows (up to 12 months) | Forms the training window |

### Seasonality Factors

**Day-of-Week Factor (DOW_FACTOR):**
```
Sun=0.88, Mon=1.05, Tue=1.08, Wed=1.07, Thu=1.05, Fri=0.97, Sat=0.90
```

**Monthly Factor (MONTH_FACTOR):**
```
Jan=1.05, Feb=1.02, Mar=1.00, Apr=0.97, May=0.95, Jun=0.96,
Jul=0.98, Aug=1.00, Sep=1.02, Oct=1.04, Nov=1.06, Dec=1.08
```

---

## 3. Algorithm & Model

**Algorithm:** Blended Estimator — Weighted Moving Average (WMA) + OLS Linear Regression with Seasonality Adjustments

All mathematics are implemented in pure JavaScript inside `backend/ml/demandPredictor.js`. No external ML library is used.

### Algorithm Steps

**Step 1 — Weighted Moving Average (WMA):**
```
WMA = Σ(weight_i × qty_i) / Σ(weight_i)
      where weight_i = i + 1  (1-indexed position, most recent = highest weight)
```

**Step 2 — OLS Linear Regression (Trend):**
```
slope     = Σ((x_i - x̄)(y_i - ȳ)) / Σ((x_i - x̄)²)
intercept = ȳ - slope × x̄
trend     = intercept + slope × n   (project to next step)
```

**Step 3 — Seasonality Adjustments:**
```
WMA_adj   = WMA   × DOW_FACTOR[dow] × MONTH_FACTOR[month]
Trend_adj = trend × DOW_FACTOR[dow] × MONTH_FACTOR[month]
```

**Step 4 — Blended Final Estimate:**
```
predicted_qty = round(0.70 × WMA_adj + 0.30 × max(0, Trend_adj))
```

**Step 5 — Uncertainty Range (±1 Standard Deviation):**
```
low  = max(0, predicted_qty - σ)
high = predicted_qty + σ
```

**Step 6 — Beneficiary Count:**
```
people_per_unit  = mean(people_served) / mean(quantity)
predicted_people = round(predicted_qty × people_per_unit)
```

---

## 4. Training Data

| Property | Value |
|---|---|
| **Data source** | MySQL `donations` table |
| **Filter** | `ngo_id = <current NGO>` AND `status IN ('COMPLETED','DELIVERED','PICKED_UP')` |
| **Time window** | Last **12 months** from prediction time |
| **Minimum threshold** | **3 data points per category** |
| **Pre-trained model** | None — algorithm runs live on each API call |
| **Training frequency** | On-demand (per API request) |

> **Why no pre-trained model?** NGO-specific history is small in scale (typically < 100 records per NGO). Running live ensures predictions always reflect the latest data without a retraining pipeline.

---

## 5. Prediction Process (Step-by-Step)

```
[NGO Dashboard] → clicks "Run Forecast"
        │
        ▼
GET /api/ngo/predict?category=X&date=YYYY-MM-DD
        │
        ▼
predictController.js
  ├── Validates JWT (authenticate middleware)
  ├── Validates role = 'ngo' (authorize middleware)
  ├── Resolves targetDate (defaults to tomorrow)
  ├── Fetches NGO profile (name, city)
  ├── Queries donations table (last 12 months, completed statuses)
  │
  ▼
ml/demandPredictor.js :: predictDemand(rows, params)
  ├── Filters rows by food_category
  ├── Checks MIN_OBSERVATIONS = 3
  │   ├── If < 3 → returns { status: 'insufficient_data', message: '...' }
  │   └── If ≥ 3 → continues
  ├── Sorts by accepted_at (ascending)
  ├── Runs WMA on quantity array
  ├── Runs OLS regression on (index, quantity) pairs
  ├── Applies DOW + monthly seasonality factors
  ├── Blends: 0.70 × WMA_adj + 0.30 × Trend_adj
  ├── Computes σ for range; R² for confidence
  ├── Computes predicted_people from ratio
  └── Returns prediction object
        │
        ▼
predictController.js → JSON response
        │
        ▼
[DemandPredictionPanel.jsx]
  ├── Renders PredictionCard per category
  ├── Shows confidence badge (high/medium/low)
  ├── Shows range and people estimate
  ├── Expandable detail (factors, R², etc.)
  └── ModelInfoAccordion (inline docs)
```

---

## 6. API Endpoints

### GET /api/ngo/predict

Predict food demand for the authenticated NGO.

**Auth:** Bearer JWT required, role = `ngo`

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `category` | string | No | Food category. If omitted, predicts all categories. |
| `date` | YYYY-MM-DD | No | Target date (must be today or future). Defaults to tomorrow. |

**Example:**
```http
GET /api/ngo/predict?category=Cooked%20Food&date=2026-10-15
Authorization: Bearer <token>
```

**Success Response:**
```json
{
  "success": true,
  "ngo_name": "XYZ Foundation",
  "city": "Mumbai",
  "total_records": 24,
  "categories_with_data": ["Cooked Food", "Dry Ration"],
  "look_back_months": 12,
  "generated_at": "2026-10-07T00:00:00.000Z",
  "predictions": [
    {
      "status": "ok",
      "predicted_qty": 85,
      "predicted_qty_low": 70,
      "predicted_qty_high": 100,
      "predicted_people": 340,
      "confidence": "medium",
      "data_points": 8,
      "r_squared": 0.612,
      "algorithm": "Weighted Moving Average (70%) + OLS Linear Regression (30%), with day-of-week & month seasonality",
      "category": "Cooked Food",
      "ngo": "XYZ Foundation",
      "city": "Mumbai",
      "target_date": "2026-10-15",
      "factors": {
        "wma_estimate": 82.5,
        "trend_slope": 1.23,
        "trend_estimate": 91.4,
        "day_of_week": "Thursday",
        "day_factor": 1.05,
        "month": "October",
        "month_factor": 1.04,
        "std_deviation": 14.3,
        "historical_mean": 78.2,
        "historical_min": 55,
        "historical_max": 105,
        "people_per_unit": 4.0
      },
      "message": "Predicted demand for Cooked Food on Thursday, October: ~85 units (70–100 range). Confidence: medium. Based on 8 data points."
    }
  ]
}
```

**Insufficient Data Response (inside predictions array):**
```json
{
  "status": "insufficient_data",
  "predicted_qty": null,
  "data_points": 2,
  "required_points": 3,
  "category": "Dairy",
  "message": "Only 2 data point(s) for \"Dairy\". Need at least 3."
}
```

---

### GET /api/ngo/predict/categories

Get metadata about category-level data availability.

**Auth:** Bearer JWT required, role = `ngo`

**Example Response:**
```json
{
  "success": true,
  "look_back_months": 12,
  "categories": [
    {
      "category": "Cooked Food",
      "data_points": 12,
      "total_qty": 960,
      "total_people": 3840,
      "has_enough_data": true,
      "first_donation": "2026-01-15T00:00:00.000Z",
      "last_donation": "2026-09-28T00:00:00.000Z"
    }
  ]
}
```

---

## 7. Frontend Integration

The prediction feature lives in the **NGO Dashboard** under the "🤖 AI Demand Forecast" sidebar tab.

| File | Purpose |
|---|---|
| `backend/ml/demandPredictor.js` | Core ML engine |
| `backend/controllers/predictController.js` | API handlers |
| `backend/routes/ngo.js` | Route definitions |
| `frontend/src/components/DemandPredictionPanel.jsx` | Main UI panel |
| `frontend/src/styles/DemandPrediction.css` | Styles |
| `frontend/src/pages/NgoDashboard.jsx` | Integration point (sidebar + overview widget) |

---

## 8. Output Schema

```typescript
interface Prediction {
  status: 'ok' | 'insufficient_data';
  predicted_qty?: number;          // Point estimate (rounded integer)
  predicted_qty_low?: number;      // Lower bound (predicted_qty - σ)
  predicted_qty_high?: number;     // Upper bound (predicted_qty + σ)
  predicted_people?: number | null; // Estimated beneficiary count
  confidence?: 'high' | 'medium' | 'low';
  data_points?: number;
  r_squared?: number;              // OLS fit quality (0–1)
  algorithm?: string;
  category: string;
  ngo: string;
  city: string;
  target_date?: string;            // ISO date YYYY-MM-DD
  factors?: {
    wma_estimate: number;
    trend_slope: number;
    trend_estimate: number;
    day_of_week: string;
    day_factor: number;
    month: string;
    month_factor: number;
    std_deviation: number;
    historical_mean: number;
    historical_min: number;
    historical_max: number;
    people_per_unit: number | null;
  };
  message: string;
  // Insufficient data only:
  required_points?: number;        // Always 3
}
```

---

## 9. Confidence Levels

| Level | Criteria | Meaning |
|---|---|---|
| 🟢 **High** | n ≥ 10 AND R² ≥ 0.6 AND CV < 0.3 | Strong signal; prediction is reliable |
| 🟡 **Medium** | n ≥ 5 AND R² ≥ 0.3 | Moderate data; reasonable estimate |
| 🔴 **Low** | All other cases (but n ≥ 3) | Sparse data; treat as rough guide only |

- **CV** (Coefficient of Variation) = σ / mean

---

## 10. Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| Minimum 3 data points per category required | New NGOs get no prediction for sparse categories | Shows honest "Insufficient data" message (never guesses) |
| Predictions degrade with sparse data (< 5 records) | Wide uncertainty ranges | Confidence badge + explicit range shown |
| External factors not modeled | Festivals, disasters, donor availability not captured | Disclaimer shown on all predictions |
| DOW and month factors are fixed heuristics | Not learned from this NGO's specific patterns | Future: per-NGO calibration |
| Location not a numeric predictor | Urban vs. rural differences not captured | Future: city-level clustering |
| No cross-NGO learning | Cannot help new NGOs using similar NGOs' data | Future: collaborative filtering |
| 12-month look-back is fixed | May miss multi-year seasonal patterns | Future: configurable window |
| No donor supply forecasting | Predicts demand only, not actual availability | Out of scope for v1 |

---

## 11. Future Improvements

- Per-NGO DOW/month factor calibration using each NGO's own history
- Poisson or Negative Binomial regression for count-valued food quantities
- Integration of external signals: weather, festivals, local events
- Cross-NGO transfer learning for cold-start NGOs
- City-level demand clustering
- Prediction accuracy tracking (MAPE, RMSE vs. actual)
- Anomaly detection for unusual demand spikes

---

## 12. File Map

```
backend/
├── ml/
│   └── demandPredictor.js          ← Core ML engine (pure JS, no Express/DB)
├── controllers/
│   └── predictController.js        ← API handlers (DB queries + ML calls)
└── routes/
    └── ngo.js                      ← Route definitions

frontend/src/
├── components/
│   └── DemandPredictionPanel.jsx   ← Full UI panel component
├── styles/
│   └── DemandPrediction.css        ← Panel styles
└── pages/
    └── NgoDashboard.jsx            ← Integration (sidebar tab + overview widget)

docs/
└── AI_DEMAND_PREDICTION.md         ← This document
```

---

*FoodBridge AI Demand Prediction — Built with statistical ML, designed for real-world food redistribution.*
