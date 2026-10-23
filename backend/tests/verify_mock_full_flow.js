'use strict';

const request      = require('supertest');
const app          = require('../server');
const emailService = require('../services/emailService');

async function runTests() {
  console.log('🧪 Starting FoodBridge Mock Backend End-to-End Verification...\n');
  let passCount = 0;
  let failCount = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passCount++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name} ->`, err.message);
      failCount++;
    }
  };

  // 1. Health check
  await test('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    if (res.status !== 200 || !res.body.success) throw new Error(`Unexpected status ${res.status}`);
  });

  // 2. Demo donor login
  let donorToken = '';
  await test('POST /api/auth/login works for donor@foodbridge.org', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'donor@foodbridge.org', password: 'Password@123' });
    if (res.status !== 200 || !res.body.token) throw new Error(res.body.error || 'Login failed');
    donorToken = res.body.token;
  });

  // 3. Demo admin login
  let adminToken = '';
  await test('POST /api/auth/login works for admin@foodbridge.org', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@foodbridge.org', password: 'Admin@12345' });
    if (res.status !== 200 || !res.body.token) throw new Error(res.body.error || 'Login failed');
    adminToken = res.body.token;
  });

  // 4. Demo NGO login
  let ngoToken = '';
  await test('POST /api/auth/login works for ngo@hope.org', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ngo@hope.org', password: 'Password@123' });
    if (res.status !== 200 || !res.body.token) throw new Error(res.body.error || 'Login failed');
    ngoToken = res.body.token;
  });

  // 5. Demo Volunteer login
  let volToken = '';
  await test('POST /api/auth/login works for volunteer@foodbridge.org', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'volunteer@foodbridge.org', password: 'Password@123' });
    if (res.status !== 200 || !res.body.token) throw new Error(res.body.error || 'Login failed');
    volToken = res.body.token;
  });

  // 6. Invalid credentials rejection
  await test('POST /api/auth/login rejects wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'donor@foodbridge.org', password: 'WrongPassword!' });
    if (res.status !== 401) throw new Error(`Expected 401 but got ${res.status}`);
  });

  // 7. Register new user (Email Verification Flow)
  const randomEmail = `newuser${Date.now()}@gmail.com`;
  const randomPhone = '9' + String(Date.now()).slice(-9);
  let verificationToken = '';
  let newUserToken = '';

  await test('POST /api/auth/register creates unverified account and sends verification email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'NewTestDonor',
        email: randomEmail,
        phone: randomPhone,
        password: 'Password@123',
        role: 'donor',
      });
    if (res.status !== 201 || !res.body.requiresVerification) {
      throw new Error(res.body.error || 'Registration failed');
    }
    const lastEmail = emailService.getLastSentEmail();
    if (!lastEmail) throw new Error('Verification email was not dispatched');
    verificationToken = new URL(lastEmail.verificationUrl).searchParams.get('token');
  });

  // 7b. Attempt login before verification
  await test('POST /api/auth/login rejects unverified user with 403', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: randomEmail, password: 'Password@123' });
    if (res.status !== 403 || !res.body.requiresVerification) {
      throw new Error(`Expected 403 with requiresVerification but got ${res.status}`);
    }
  });

  // 7c. Verify email with token
  await test('GET /api/auth/verify-email validates token and marks user verified', async () => {
    const res = await request(app).get(`/api/auth/verify-email?token=${verificationToken}`);
    if (res.status !== 200 || !res.body.success) {
      throw new Error(res.body.error || 'Email verification failed');
    }
  });

  // 7d. Log in after email verification
  await test('POST /api/auth/login logs in newly verified user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: randomEmail, password: 'Password@123' });
    if (res.status !== 200 || !res.body.token) {
      throw new Error(res.body.error || 'Login failed after verification');
    }
    newUserToken = res.body.token;
  });

  // 8. Reject duplicate email
  const anotherPhone = '8' + String(Date.now()).slice(-9);
  await test('POST /api/auth/register rejects duplicate email with 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'DuplicateDonor',
        email: randomEmail,
        phone: anotherPhone,
        password: 'Password@123',
        role: 'donor',
      });
    if (res.status !== 409) throw new Error(`Expected 409 but got ${res.status}`);
  });

  // 9. Protected route rejection
  await test('GET /api/donor/dashboard rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/donor/dashboard');
    if (res.status !== 401) throw new Error(`Expected 401 but got ${res.status}`);
  });

  // 10. Donor dashboard
  await test('GET /api/donor/dashboard loads stats and charts', async () => {
    const res = await request(app)
      .get('/api/donor/dashboard')
      .set('Authorization', `Bearer ${donorToken}`);
    if (res.status !== 200 || !res.body.stats || !res.body.chart_data) {
      throw new Error('Failed to load donor dashboard');
    }
  });

  // 11. Create a donation
  let createdDonationId = null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const futureStr = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  await test('POST /api/donor/donations creates a new donation', async () => {
    const res = await request(app)
      .post('/api/donor/donations')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        food_name: 'Hot Meals - Rajma & Rice',
        food_category: 'Cooked Food',
        quantity: 15,
        unit: 'kg',
        people_served: 35,
        food_type: 'vegetarian',
        preparation_date: todayStr,
        best_before: futureStr,
        pickup_address: 'Grand Plaza Hotel Kitchen Dock',
        city: 'Bangalore',
        description: 'Fresh lunch packs.',
      });
    if (res.status !== 201 || !res.body.donation) throw new Error(res.body.error || 'Create donation failed');
    createdDonationId = res.body.donation.id;
  });

  // 12. NGO available donations
  await test('GET /api/ngo/donations/available lists posted donations', async () => {
    const res = await request(app)
      .get('/api/ngo/donations/available')
      .set('Authorization', `Bearer ${ngoToken}`);
    if (res.status !== 200 || !Array.isArray(res.body.donations)) {
      throw new Error('Failed to list available donations for NGO');
    }
    const found = res.body.donations.find((d) => d.id === createdDonationId);
    if (!found) throw new Error('Newly created donation not in available list');
  });

  // 13. Smart Matching
  await test('GET /api/matching/donations/:id/ngos returns ranked NGO candidates', async () => {
    const res = await request(app)
      .get(`/api/matching/donations/${createdDonationId}/ngos`)
      .set('Authorization', `Bearer ${donorToken}`);
    if (res.status !== 200 || !Array.isArray(res.body.ranked_ngos)) {
      throw new Error('Matching engine failed');
    }
    if (res.body.ranked_ngos.length === 0) throw new Error('No candidate NGOs returned');
  });

  // 14. NGO accepts donation
  await test('POST /api/ngo/donations/:id/accept updates status to ACCEPTED', async () => {
    const res = await request(app)
      .post(`/api/ngo/donations/${createdDonationId}/accept`)
      .set('Authorization', `Bearer ${ngoToken}`);
    if (res.status !== 200 || res.body.donation.status !== 'ACCEPTED') {
      throw new Error('Accept donation failed');
    }
  });

  // 15. Volunteer views available pickups
  await test('GET /api/volunteer/pickups/available shows newly accepted donation', async () => {
    const res = await request(app)
      .get('/api/volunteer/pickups/available')
      .set('Authorization', `Bearer ${volToken}`);
    if (res.status !== 200 || !Array.isArray(res.body.pickups)) {
      throw new Error('Failed to list volunteer pickups');
    }
    const found = res.body.pickups.find((p) => p.id === createdDonationId);
    if (!found) throw new Error('Accepted donation not visible to volunteers');
  });

  // 16. Volunteer accepts pickup
  await test('POST /api/volunteer/pickups/:id/accept assigns volunteer', async () => {
    const res = await request(app)
      .post(`/api/volunteer/pickups/${createdDonationId}/accept`)
      .set('Authorization', `Bearer ${volToken}`);
    if (res.status !== 200 || res.body.pickup.status !== 'VOLUNTEER_ASSIGNED') {
      throw new Error('Volunteer accept failed');
    }
  });

  // 17. Volunteer marks picked up
  await test('POST /api/volunteer/pickups/:id/pickup marks status PICKED_UP', async () => {
    const res = await request(app)
      .post(`/api/volunteer/pickups/${createdDonationId}/pickup`)
      .set('Authorization', `Bearer ${volToken}`);
    if (res.status !== 200 || res.body.pickup.status !== 'PICKED_UP') {
      throw new Error('Mark picked up failed');
    }
  });

  // 18. Volunteer marks delivered
  await test('POST /api/volunteer/pickups/:id/deliver marks status DELIVERED', async () => {
    const res = await request(app)
      .post(`/api/volunteer/pickups/${createdDonationId}/deliver`)
      .set('Authorization', `Bearer ${volToken}`);
    if (res.status !== 200 || res.body.pickup.status !== 'DELIVERED') {
      throw new Error('Mark delivered failed');
    }
  });

  // 19. NGO marks received / completed
  await test('POST /api/ngo/donations/:id/received marks status COMPLETED', async () => {
    const res = await request(app)
      .post(`/api/ngo/donations/${createdDonationId}/received`)
      .set('Authorization', `Bearer ${ngoToken}`);
    if (res.status !== 200 || res.body.donation.status !== 'COMPLETED') {
      throw new Error('Mark received failed');
    }
  });

  // 20. NGO Demand Prediction (AI/ML)
  await test('GET /api/ngo/predict computes demand forecast', async () => {
    const res = await request(app)
      .get('/api/ngo/predict')
      .set('Authorization', `Bearer ${ngoToken}`);
    if (res.status !== 200 || !res.body.success) {
      throw new Error('Demand prediction failed');
    }
  });

  // 21. Admin dashboard & stats
  await test('GET /api/admin/stats returns full system metrics', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    if (res.status !== 200 || !res.body.totals) {
      throw new Error('Admin stats failed');
    }
  });

  console.log(`\n========================================`);
  console.log(`Test Results: ${passCount} Passed, ${failCount} Failed.`);
  console.log(`========================================\n`);

  if (failCount > 0) process.exit(1);
}

runTests();
