'use strict';

const request = require('supertest');
const app = require('../server');
const {
  resetDatabase,
  createTestUser,
  createTestDonation,
  pool,
} = require('./testHelper');

describe('Smart Matching Module Suite', () => {
  let donor1;
  let donor2;
  let volunteer;
  let bangaloreVegNgo;
  let bangaloreAnyNgo;
  let mumbaiNgo;
  let unverifiedNgo;
  let donationId;

  beforeEach(async () => {
    await resetDatabase();
    donor1 = await createTestUser({ email: 'donor1@example.com', role: 'donor' });
    donor2 = await createTestUser({ email: 'donor2@example.com', role: 'donor' });
    volunteer = await createTestUser({ email: 'vol@example.com', role: 'volunteer' });

    // Bangalore Vegetarian NGO (verified)
    bangaloreVegNgo = await createTestUser({
      name: 'Bangalore Veg Care',
      email: 'blr_veg@example.com',
      role: 'ngo',
      ngo_name: 'Bangalore Vegetarian Relief',
      food_types: 'Cooked Food, Dry Ration, vegetarian',
      is_available: 1,
      verification_status: 'verified',
    });
    // Set city in ngo_profiles
    await pool.query('UPDATE ngo_profiles SET city = ? WHERE user_id = ?', ['Bangalore', bangaloreVegNgo.id]);

    // Bangalore Any Food NGO (verified)
    bangaloreAnyNgo = await createTestUser({
      name: 'Bangalore General Relief',
      email: 'blr_any@example.com',
      role: 'ngo',
      ngo_name: 'Bangalore General Relief',
      food_types: 'Cooked Food, Packaged Food, non-vegetarian, meat, all',
      is_available: 1,
      verification_status: 'verified',
    });
    await pool.query('UPDATE ngo_profiles SET city = ? WHERE user_id = ?', ['Bangalore', bangaloreAnyNgo.id]);

    // Mumbai NGO (different city)
    mumbaiNgo = await createTestUser({
      name: 'Mumbai Food Bank',
      email: 'mum@example.com',
      role: 'ngo',
      ngo_name: 'Mumbai Seva',
      food_types: 'Cooked Food, vegetarian',
      is_available: 1,
      verification_status: 'verified',
    });
    await pool.query('UPDATE ngo_profiles SET city = ? WHERE user_id = ?', ['Mumbai', mumbaiNgo.id]);

    // Unverified NGO
    unverifiedNgo = await createTestUser({
      name: 'Pending Verification NGO',
      email: 'pending@example.com',
      role: 'ngo',
      ngo_name: 'Pending Foundation',
      food_types: 'Cooked Food, all',
      is_available: 1,
      verification_status: 'pending',
    });
    await pool.query('UPDATE ngo_profiles SET city = ? WHERE user_id = ?', ['Bangalore', unverifiedNgo.id]);

    // Create a vegetarian donation in Bangalore
    donationId = await createTestDonation({
      donor_id: donor1.id,
      food_name: 'Fresh Veg Meals',
      food_category: 'Cooked Food',
      food_type: 'vegetarian',
      quantity: 25,
      city: 'Bangalore',
      status: 'POSTED',
    });
  });

  describe('Algorithm Scoring & Ranking', () => {
    test('ranks local compatible NGOs highest', async () => {
      const res = await request(app)
        .get(`/api/matching/donations/${donationId}/ngos`)
        .set('Authorization', `Bearer ${donor1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.matches).toBeDefined();
      expect(res.body.matches.length).toBeGreaterThan(0);

      // Bangalore NGOs should have higher scores than Mumbai NGO (proximity factor)
      const blrMatch = res.body.matches.find((m) => m.ngo_id === bangaloreVegNgo.id);
      const mumMatch = res.body.matches.find((m) => m.ngo_id === mumbaiNgo.id);

      expect(blrMatch).toBeDefined();
      expect(mumMatch).toBeDefined();
      expect(blrMatch.score).toBeGreaterThan(mumMatch.score);
    });

    test('correctly lowers dietary score for vegetarian NGO on non-veg donation', async () => {
      const nonVegDonationId = await createTestDonation({
        donor_id: donor1.id,
        food_name: 'Chicken Rice',
        food_category: 'Cooked Food',
        food_type: 'non-vegetarian',
        quantity: 20,
        city: 'Bangalore',
        status: 'POSTED',
      });

      const res = await request(app)
        .get(`/api/matching/donations/${nonVegDonationId}/ngos`)
        .set('Authorization', `Bearer ${donor1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const anyMatch = res.body.matches.find((m) => m.ngo_id === bangaloreAnyNgo.id);
      const vegMatch = res.body.matches.find((m) => m.ngo_id === bangaloreVegNgo.id);

      const anyDiet = anyMatch.factors.find((f) => f.key === 'vegetarian').score;
      const vegDiet = vegMatch.factors.find((f) => f.key === 'vegetarian').score;

      expect(anyDiet).toBeGreaterThan(vegDiet);
      expect(anyMatch.score).toBeGreaterThan(vegMatch.score);
    });

    test('respects only_verified filter', async () => {
      const res = await request(app)
        .get(`/api/matching/donations/${donationId}/ngos?only_verified=true`)
        .set('Authorization', `Bearer ${donor1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Pending NGO should NOT be in the results
      const hasUnverified = res.body.matches.some((m) => m.ngo_id === unverifiedNgo.id);
      expect(hasUnverified).toBe(false);
    });

    test('respects limit query parameter', async () => {
      const res = await request(app)
        .get(`/api/matching/donations/${donationId}/ngos?limit=2`)
        .set('Authorization', `Bearer ${donor1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.matches.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Authorization & Access Control', () => {
    test('donor can view matching for their own donation', async () => {
      const res = await request(app)
        .get(`/api/matching/donations/${donationId}/ngos`)
        .set('Authorization', `Bearer ${donor1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('fails if another donor tries to access matching for donation (invalid case: unauthorized request)', async () => {
      const res = await request(app)
        .get(`/api/matching/donations/${donationId}/ngos`)
        .set('Authorization', `Bearer ${donor2.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Access denied/i);
    });

    test('fails if volunteer tries to access matching endpoint', async () => {
      const res = await request(app)
        .get(`/api/matching/donations/${donationId}/ngos`)
        .set('Authorization', `Bearer ${volunteer.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Access denied/i);
    });

    test('allows NGO to view matching for available POSTED donation', async () => {
      const res = await request(app)
        .get(`/api/matching/donations/${donationId}/ngos`)
        .set('Authorization', `Bearer ${bangaloreVegNgo.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('returns 404 for non-existent donation', async () => {
      const res = await request(app)
        .get('/api/matching/donations/99999/ngos')
        .set('Authorization', `Bearer ${donor1.token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
