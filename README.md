# FoodBridge 🌉

**Food Donation & Redistribution Platform**

FoodBridge connects surplus food sources (restaurants, hotels, caterers, grocery stores) with verified charities (NGOs, shelters, community kitchens) and volunteer couriers to eliminate food waste and fight hunger.

Featuring a **Multi-Factor Smart Matching Engine** and **AI/ML Demand Prediction**, FoodBridge delivers an end-to-end, zero-waste redistribution pipeline.

---

## 🚀 Key Features

- **🍱 Donor Hub**: Post surplus meals and packaged rations with shelf-life timers, dietary badges, and image uploads.
- **🧠 Smart Matching Engine**: Automatic 7-factor ranking (Proximity, Category, Freshness, Capacity, Dietary, Availability, Operating Area) to match donations to the best NGOs.
- **📈 AI/ML Demand Prediction**: Hybrid Weighted Moving Average (WMA) + Linear Regression model with weekly and monthly seasonality adjustments.
- **🏢 NGO Management**: Evaluate matches, claim donations, manage capacities, and track completed distributions.
- **🚗 Volunteer Logistics**: Single-active pickup enforcement, live route mapping, and milestone updates (`PICKED_UP`, `DELIVERED`).
- **🛡️ Admin Console**: User auditing, NGO verification workflows (`pending` / `verified` / `rejected`), and aggregate social impact dashboards.
- **📊 Real-Time Analytics**: Visual trends for donations, beneficiary counts, and monthly redistribution volumes powered by Chart.js.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8, React Router v7, Chart.js 4, Leaflet Maps, Vanilla CSS Design System |
| **Backend** | Node.js 18+, Express.js 4.18+, Morgan, Multer |
| **Database** | MySQL 8 / 5.7+ (`mysql2/promise` connection pool) |
| **Authentication** | JSON Web Tokens (JWT, HMAC-SHA256) & Bcrypt Password Hashing |
| **Testing** | Jest 30, Supertest 7 (103 automated tests across 8 suites) |

---

## 📂 Project Structure

```
CEP_Project/
├── backend/
│   ├── config/             # Database connection, migrations & seeder (seed.js)
│   ├── controllers/        # Business logic (auth, donation, ngo, volunteer, admin, matching, predict)
│   ├── matching/           # 7-factor smart food matching engine
│   ├── middleware/         # Auth, RBAC, error handling, file upload
│   ├── ml/                 # AI Demand prediction engine (WMA + OLS Regression)
│   ├── routes/             # REST API routing
│   ├── tests/              # Jest + Supertest test suites & workflow verifier
│   └── server.js           # Express application entrypoint
├── frontend/
│   ├── public/             # Static assets & favicon
│   ├── src/
│   │   ├── components/     # Reusable UI cards, maps, charts, badges, modals
│   │   ├── context/        # AuthContext & session state
│   │   ├── pages/          # Home, About, Contact, Login, Register, 4 Dashboards
│   │   ├── styles/         # CSS design tokens & component stylesheets
│   │   └── utils/          # API client with JWT interception
│   └── vite.config.js      # Vite build configuration
└── docs/
    ├── FINAL_DOCUMENTATION.md   # Comprehensive 15-section technical documentation
    └── AI_DEMAND_PREDICTION.md  # Detailed ML specification & math formulation
```

---

## ⚡ Quick Start Guide

### Prerequisites
- **Node.js** 18+
- **MySQL** 5.7+ or 8+
- **npm** 9+

---

### 1. Database Setup

Ensure MySQL is running, then create the database:

```sql
CREATE DATABASE IF NOT EXISTS foodbridge;
```

---

### 2. Backend Setup

```bash
cd backend

# 1. Configure environment variables
cp .env.example .env
# Edit .env to set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and DB_SOCKET (if using MAMP/XAMPP)

# 2. Install dependencies
npm install

# 3. Seed demo accounts & donations
npm run seed

# 4. Run automated test suite
npm test

# 5. Start development API server
npm run dev
# → API running on http://localhost:5000
```

---

### 3. Frontend Setup

In a new terminal window:

```bash
cd frontend

# 1. Configure environment variables
cp .env.example .env
# Default points to VITE_API_URL=http://localhost:5000/api

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
# → Web app running on http://localhost:5173
```

---

## 👥 Default Demo Credentials

The database seeder (`npm run seed`) automatically creates demo accounts for each role:

| Role | Email | Password | Dashboard Features |
|---|---|---|---|
| **Admin** | `admin@foodbridge.org` | `Admin@12345` | System overview, NGO approvals, user audit, global analytics |
| **Donor** | `donor@foodbridge.org` | `Password@123` | Post surplus food, smart matching trigger, donation history |
| **NGO** | `ngo@hope.org` | `Password@123` | Browse available food, accept donations, AI demand prediction |
| **Volunteer** | `volunteer@foodbridge.org` | `Password@123` | Accept pickups, mark food collected & delivered |

---

## 🧪 Testing & Verification

### Run Jest Test Suite
```bash
cd backend
npm test
# Result: 8 passed suites, 103 passed tests
```

### Run End-to-End Workflow Verification
Executes a complete lifecycle (Donor Post → Smart Match → NGO Accept → Volunteer Pickup → Delivery → NGO Receipt → Admin Analytics):
```bash
cd backend
node tests/verify_workflows.js
```

---

## 🌐 Production Deployment

### 1. Build Frontend Static Assets
```bash
cd frontend
npm run build
# Generates minified production bundle in frontend/dist/
```

### 2. Configure Production Backend
In `backend/.env`:
```ini
PORT=5000
NODE_ENV=production
CLIENT_URL=https://your-production-domain.com
JWT_SECRET=your_cryptographically_secure_random_key_64_chars
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=foodbridge
```

Start the production server:
```bash
cd backend
npm start
```

Static frontend files can be served via Nginx, Caddy, Vercel, or Netlify, pointing API traffic to `https://api.your-domain.com`.

---

## 📚 Detailed Documentation

For full architecture diagrams, database schemas, complete API specifications, mathematical formulas for the Smart Matching algorithm, and ML model details, refer to:
- 📄 [Comprehensive Documentation](file:///Users/aditya/Desktop/CEP_Project/docs/FINAL_DOCUMENTATION.md)
- 📄 [AI Demand Prediction Architecture](file:///Users/aditya/Desktop/CEP_Project/docs/AI_DEMAND_PREDICTION.md)

---

## 📄 License
ISC License. Built for Social Good and Zero Food Waste.
