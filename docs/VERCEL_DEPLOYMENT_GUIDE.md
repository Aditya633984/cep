# 🚀 FoodBridge — Vercel Deployment Guide

This guide walks you through deploying the **FoodBridge** frontend (React + Vite) to **Vercel** with full client-side routing support (zero 404s on page refresh).

---

## 📋 Pre-configured Files in the Repository

The following configurations have already been set up for you:
1. **[frontend/vercel.json](file:///Users/aditya/Desktop/CEP_Project/frontend/vercel.json)**: Configured SPA rewrite rules so React Router paths (`/login`, `/donor`, `/ngo`, `/analytics`, etc.) don't trigger 404 errors on page reload.
2. **[vercel.json](file:///Users/aditya/Desktop/CEP_Project/vercel.json)** (Root): Configured root build and output settings in case you deploy the repository from the root directory.
3. **[package.json](file:///Users/aditya/Desktop/CEP_Project/package.json)** (Root): Added root-level build commands.
4. **[.gitignore](file:///Users/aditya/Desktop/CEP_Project/.gitignore)**: Updated to ignore `.vercel` deployment cache.

---

## 🌐 Method 1: Deploy via GitHub (Recommended)

This is the standard, automated method that provides continuous deployment whenever you push code.

### Step 1: Initialize Git and Push to GitHub (if not already done)
In your terminal:
```bash
cd /Users/aditya/Desktop/CEP_Project
git init
git add .
git commit -m "feat: configure vercel deployment for FoodBridge"
git branch -M main
# Create a new repository on https://github.com/new, then run:
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

### Step 2: Import into Vercel
1. Go to [vercel.com](https://vercel.com) and log in.
2. Click **Add New…** > **Project**.
3. Under **Import Git Repository**, select your FoodBridge repository.

### Step 3: Configure Project Settings
- **Framework Preset**: `Vite` (automatically detected)
- **Root Directory**: Click **Edit** and select `frontend` *(recommended)*, or leave as `./` (both will work due to root `vercel.json`).
- **Build Command**: `npm run build` (or `vite build`)
- **Output Directory**: `dist`
- **Environment Variables**:
  - Add `VITE_API_URL`: Value should be your deployed backend URL (e.g. `https://foodbridge-api.onrender.com/api` or your production backend domain).

### Step 4: Click Deploy!
- Vercel will build the project in ~15-30 seconds.
- You will receive a live URL: `https://<your-project>.vercel.app`.

---

## 💻 Method 2: Deploy directly via Vercel CLI (Quickest)

You can also deploy straight from your computer using the Vercel CLI.

### Step 1: Log in to Vercel in your terminal
Run:
```bash
npx vercel login
```
Follow the prompt in your browser to authorize your account.

### Step 2: Deploy the Frontend
Run:
```bash
cd frontend
npx vercel
```
Answer the prompts:
- **Set up and deploy?**: `y`
- **Which scope?**: Choose your personal account or team
- **Link to existing project?**: `n`
- **What’s your project’s name?**: `foodbridge-frontend` (or any name)
- **In which directory is your code located?**: `./`
- **Want to modify build settings?**: `n` (default Vite settings are detected)

### Step 3: Deploy to Production
Once preview deployment succeeds, deploy to production:
```bash
npx vercel --prod
```

---

## ⚙️ Connecting Backend and Database

The FoodBridge frontend connects to the backend through `VITE_API_URL`:
- During local development: defaults to `http://localhost:5000/api`.
- When deployed on Vercel: requests must reach an HTTPS API endpoint.

### Instant Testing with HTTPS Tunnel (Currently Active):
Your backend is connected to Vercel via a secure HTTPS tunnel:
- **Tunnel URL**: `https://7d7abb257ce00b.lhr.life/api`
- **Frontend URL**: `https://frontend-pi-eight-59.vercel.app`

To keep the tunnel running or restart it in the future:
1. Start your backend: `cd backend && node server.js`
2. Start the tunnel in a separate terminal: `npm run tunnel`
3. If the tunnel URL changes, update `VITE_API_URL` in `frontend/.env` and re-deploy (`cd frontend && npx vercel --prod`).

### Permanent Cloud Backend (Render / Railway + Cloud MySQL):
For 24/7 cloud availability without running your laptop:
1. **Database**: Use a free cloud MySQL instance:
   - [Aiven for MySQL](https://aiven.io) (Free tier)
   - [TiDB Cloud](https://tidbcloud.com) (Free tier)
   - [Railway MySQL](https://railway.app)
2. **Backend**: Deploy `backend/` to [Render](https://render.com) or [Railway](https://railway.app):
   - Set environment variables (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `CLIENT_URL=https://frontend-pi-eight-59.vercel.app`).
   - Run `node config/seed.js` or let `initSchema()` initialize the tables automatically.
3. Update `VITE_API_URL` on Vercel to point to your cloud backend URL.
