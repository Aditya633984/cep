'use strict';

const request = require('supertest');
const app = require('../server');
const {
  resetDatabase,
  createTestUser,
  createTestDonation,
  formatDate,
  pool,
} = require('./testHelper');

describe('AI Demand Prediction Module Suite', () => {
  let donor;
  let ngo;
  let otherNgo;
  let volunteer;

  beforeEach(async () => {
    await resetDatabase();
    donor = await createTestUser({ email: 'donor@example.com', role: 'donor' });
    ngo = await createTestUser({
      email: 'ngo@example.com',
      role: 'ngo',
      ngo_name: 'Relief India NGO',
    });
    otherNgo = await createTestUser({
      email: 'other_ngo@example.com',
      role: 'ngo',
      ngo_name: 'No Data NGO',
    });
    volunteer = await createTestUser({ email: 'vol@example.com', role: 'volunteer' });
  });

  describe('Prediction Calculations & History Thresholds', () => {
    test('returns empty predictions when NGO has 0 historical donations without crashing', async () => {
      const res = await request(app)
        .get('/api/ngo/predict')
        .set('Authorization', `Bearer ${otherNgo.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.total_records).toBe(0);
      expect(res.body.predictions).toEqual([]);
    });

    test('returns insufficient_data when category has fewer than 3 observations', async () => {
      // Create 2 completed donations (minimum threshold is 3)
      await createTestDonation({
        donor_id: donor.id,
        ngo_id: ngo.id,
        food_category: 'Dry Ration',
        quantity: 20,
        status: 'COMPLETED',
        accepted_at: new Date(Date.now() - 5 * 86400000),
      });
      await createTestDonation({
        donor_id: donor.id,
        ngo_id: ngo.id,
        food_category: 'Dry Ration',
        quantity: 25,
        status: 'COMPLETED',
        accepted_at: new Date(Date.now() - 3 * 86400000),
      });

      const res = await request(app)
        .get('/api/ngo/predict?category=Dry Ration')
        .set('Authorization', `Bearer ${ngo.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.predictions.length).toBe(1);
      expect(res.body.predictions[0].status).toBe('insufficient_data');
      expect(res.body.predictions[0].data_points).toBe(2);
      expect(res.body.predictions[0].required_points).toBe(3);
    });

    test('accurately calculates prediction when 3+ completed donations exist', async () => {
      // Create 3 completed donations for Cooked Food
      await createTestDonation({
        donor_id: donor.id,
        ngo_id: ngo.id,
        food_category: 'Cooked Food',
        quantity: 30,
        people_served: 60,
        status: 'COMPLETED',
        accepted_at: new Date(Date.now() - 10 * 86400000),
      });
      await createTestDonation({
        donor_id: donor.id,
        ngo_id: ngo.id,
        food_category: 'Cooked Food',
        quantity: 40,
        people_served: 80,
        status: 'COMPLETED',
        accepted_at: new Date(Date.now() - 5 * 86400000),
      });
      await createTestDonation({
        donor_id: donor.id,
        ngo_id: ngo.id,
        food_category: 'Cooked Food',
        quantity: 50,
        people_served: 100,
        status: 'COMPLETED',
        accepted_at: new Date(Date.now() - 1 * 86400000),
      });

      const res = await request(app)
        .get('/api/ngo/predict?category=Cooked Food')
        .set('Authorization', `Bearer ${ngo.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.predictions.length).toBe(1);

      const p = res.body.predictions[0];
      expect(p.status).toBe('ok');
      expect(p.data_points).toBe(3);
      expect(p.predicted_qty).toBeGreaterThan(0);
      expect(p.confidence).toBeDefined();
      expect(p.factors).toBeDefined();
      expect(p.factors.wma_estimate).toBeGreaterThan(0);
    });
  });

  describe('Target Date Input Validation', () => {
    test('successfully predicts for a future date (date=YYYY-MM-DD)', async () => {
      // 3 donations
      for (let i = 1; i <= 3; i++) {
        await createTestDonation({
          donor_id: donor.id,
          ngo_id: ngo.id,
          food_category: 'Cooked Food',
          quantity: 20 * i,
          people_served: 40 * i,
          status: 'COMPLETED',
          accepted_at: new Date(Date.now() - i * 86400000),
        });
      }

      const futureDate = formatDate(new Date(Date.now() + 7 * 86400000));
      const res = await request(app)
        .get(`/api/ngo/predict?category=Cooked Food&date=${futureDate}`)
        .set('Authorization', `Bearer ${ngo.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.predictions[0].target_date).toBe(futureDate);
    });

    test('fails when target date is in the past (invalid case: input validation)', async () => {
      const pastDate = '2020-01-01';
      const res = await request(app)
        .get(`/api/ngo/predict?date=${pastDate}`)
        .set('Authorization', `Bearer ${ngo.token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/must be today or in the future/i);
    });

    test('fails when date format is invalid (invalid case: input validation)', async () => {
      const res = await request(app)
        .get('/api/ngo/predict?date=not-a-date')
        .set('Authorization', `Bearer ${ngo.token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid date format/i);
    });
  });

  describe('Prediction Categories Metadata & Role Protection', () => {
    test('fetches prediction metadata categories', async () => {
      await createTestDonation({
        donor_id: donor.id,
        ngo_id: ngo.id,
        food_category: 'Vegetables',
        quantity: 15,
        status: 'COMPLETED',
        accepted_at: new Date(),
      });

      const res = await request(app)
        .get('/api/ngo/predict/categories')
        .set('Authorization', `Bearer ${ngo.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.categories).toBeDefined();
    });

    test('fails when donor or volunteer tries to access prediction endpoint (invalid case: unauthorized role)', async () => {
      const resDonor = await request(app)
        .get('/api/ngo/predict')
        .set('Authorization', `Bearer ${donor.token}`);
      expect(resDonor.status).toBe(403);

      const resVol = await request(app)
        .get('/api/ngo/predict')
        .set('Authorization', `Bearer ${volunteer.token}`);
      expect(resVol.status).toBe(403);
    });
  });
});
