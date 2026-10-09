'use strict';

const request = require('supertest');
const app = require('../server');
const {
  resetDatabase,
  createTestUser,
  createTestDonation,
  formatDate,
  formatDateTime,
  pool,
} = require('./testHelper');

describe('NGO Module & Donation Acceptance Suite', () => {
  let donor;
  let vegNgo;
  let anyNgo;
  let volunteer;

  beforeEach(async () => {
    await resetDatabase();
    donor = await createTestUser({ email: 'donor@example.com', role: 'donor' });
    vegNgo = await createTestUser({
      email: 'veg_ngo@example.com',
      role: 'ngo',
      ngo_name: 'Pure Vegetarian Seva',
      food_types: 'Cooked Food, Dry Ration, vegetarian',
      is_available: 1,
      verification_status: 'verified',
    });
    anyNgo = await createTestUser({
      email: 'any_ngo@example.com',
      role: 'ngo',
      ngo_name: 'All Food Welcome NGO',
      food_types: 'Cooked Food, non-vegetarian, meat, all',
      is_available: 1,
      verification_status: 'verified',
    });
    volunteer = await createTestUser({ email: 'vol@example.com', role: 'volunteer' });
  });

  describe('NGO Profile & Availability', () => {
    test('successfully fetches NGO profile', async () => {
      const res = await request(app)
        .get('/api/ngo/profile')
        .set('Authorization', `Bearer ${vegNgo.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.profile.ngo_name).toBe('Pure Vegetarian Seva');
      expect(res.body.profile.verification_status).toBe('verified');
    });

    test('successfully updates NGO profile', async () => {
      const res = await request(app)
        .put('/api/ngo/profile')
        .set('Authorization', `Bearer ${vegNgo.token}`)
        .send({
          ngo_name: 'Updated Vegetarian Seva',
          operating_area: 'Indiranagar, Koramangala',
          max_food_capacity: 100,
          city: 'Bangalore',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.profile.ngo_name).toBe('Updated Vegetarian Seva');
      expect(Number(res.body.profile.max_food_capacity)).toBe(100);
    });

    test('successfully toggles availability to unavailable and back', async () => {
      // Toggle off
      const res1 = await request(app)
        .patch('/api/ngo/availability')
        .set('Authorization', `Bearer ${vegNgo.token}`)
        .send({ is_available: false });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.is_available).toBe(false);

      // Verify DB
      const [rows1] = await pool.query('SELECT is_available FROM ngo_profiles WHERE user_id = ?', [vegNgo.id]);
      expect(rows1[0].is_available).toBe(0);

      // Toggle on
      const res2 = await request(app)
        .patch('/api/ngo/availability')
        .set('Authorization', `Bearer ${vegNgo.token}`)
        .send({ is_available: true });

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.is_available).toBe(true);
    });
  });

  describe('Donation Acceptance & Compatibility Checks', () => {
    test('successfully accepts a compatible vegetarian donation', async () => {
      const donationId = await createTestDonation({
        donor_id: donor.id,
        food_name: 'Paneer Butter Masala',
        food_category: 'Cooked Food',
        food_type: 'vegetarian',
        quantity: 20,
        status: 'POSTED',
      });

      const res = await request(app)
        .post(`/api/ngo/donations/${donationId}/accept`)
        .set('Authorization', `Bearer ${vegNgo.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/accepted/i);

      // Verify in DB
      const [rows] = await pool.query('SELECT status, ngo_id, accepted_at FROM donations WHERE id = ?', [donationId]);
      expect(rows[0].status).toBe('ACCEPTED');
      expect(rows[0].ngo_id).toBe(vegNgo.id);
      expect(rows[0].accepted_at).not.toBeNull();
    });

    test('fails when vegetarian NGO tries to accept non-vegetarian food (invalid case: incompatible food)', async () => {
      const nonVegDonationId = await createTestDonation({
        donor_id: donor.id,
        food_name: 'Chicken Biryani',
        food_category: 'Cooked Food',
        food_type: 'non-vegetarian',
        quantity: 15,
        status: 'POSTED',
      });

      const res = await request(app)
        .post(`/api/ngo/donations/${nonVegDonationId}/accept`)
        .set('Authorization', `Bearer ${vegNgo.token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Incompatible food type/i);
    });

    test('successfully accepts non-vegetarian food if NGO accepts non-veg', async () => {
      const nonVegDonationId = await createTestDonation({
        donor_id: donor.id,
        food_name: 'Chicken Curry',
        food_category: 'Cooked Food',
        food_type: 'non-vegetarian',
        quantity: 15,
        status: 'POSTED',
      });

      const res = await request(app)
        .post(`/api/ngo/donations/${nonVegDonationId}/accept`)
        .set('Authorization', `Bearer ${anyNgo.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/accepted/i);
    });

    test('fails acceptance if NGO is marked as unavailable', async () => {
      // Mark vegNgo as unavailable
      await pool.query('UPDATE ngo_profiles SET is_available = 0 WHERE user_id = ?', [vegNgo.id]);

      const donationId = await createTestDonation({
        donor_id: donor.id,
        food_name: 'Veg Pulao',
        food_category: 'Cooked Food',
        food_type: 'vegetarian',
        quantity: 10,
        status: 'POSTED',
      });

      const res = await request(app)
        .post(`/api/ngo/donations/${donationId}/accept`)
        .set('Authorization', `Bearer ${vegNgo.token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/currently marked as unavailable/i);
    });

    test('fails acceptance if NGO verification is rejected', async () => {
      // Mark vegNgo as rejected
      await pool.query("UPDATE ngo_profiles SET verification_status = 'rejected' WHERE user_id = ?", [vegNgo.id]);

      const donationId = await createTestDonation({
        donor_id: donor.id,
        food_name: 'Veg Pulao',
        food_category: 'Cooked Food',
        food_type: 'vegetarian',
        quantity: 10,
        status: 'POSTED',
      });

      const res = await request(app)
        .post(`/api/ngo/donations/${donationId}/accept`)
        .set('Authorization', `Bearer ${vegNgo.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/verification was rejected/i);
    });

    test('fails acceptance if donation has already been accepted', async () => {
      const donationId = await createTestDonation({
        donor_id: donor.id,
        food_name: 'Dal Rice',
        food_category: 'Cooked Food',
        quantity: 10,
        status: 'ACCEPTED',
        ngo_id: anyNgo.id,
      });

      const res = await request(app)
        .post(`/api/ngo/donations/${donationId}/accept`)
        .set('Authorization', `Bearer ${vegNgo.token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not available for acceptance/i);
    });

    test('fails acceptance if donation best_before has expired', async () => {
      const pastTime = new Date(Date.now() - 3600 * 1000);
      const donationId = await createTestDonation({
        donor_id: donor.id,
        food_name: 'Past Food',
        food_category: 'Cooked Food',
        quantity: 10,
        best_before: pastTime,
        status: 'POSTED',
      });

      const res = await request(app)
        .post(`/api/ngo/donations/${donationId}/accept`)
        .set('Authorization', `Bearer ${vegNgo.token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/expired donation/i);
    });
  });

  describe('Donation Rejection & Receipt Workflow', () => {
    test('successfully rejects an accepted donation and returns status to POSTED', async () => {
      const donationId = await createTestDonation({
        donor_id: donor.id,
        food_name: 'Apples',
        food_category: 'Fruits',
        quantity: 25,
        status: 'ACCEPTED',
        ngo_id: vegNgo.id,
      });

      const res = await request(app)
        .post(`/api/ngo/donations/${donationId}/reject`)
        .set('Authorization', `Bearer ${vegNgo.token}`)
        .send({ reason: 'Capacity temporarily exceeded' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/made available again/i);

      // Verify DB state
      const [rows] = await pool.query('SELECT status, ngo_id, reject_reason FROM donations WHERE id = ?', [donationId]);
      expect(rows[0].status).toBe('POSTED');
      expect(rows[0].ngo_id).toBeNull();
      expect(rows[0].reject_reason).toBe('Capacity temporarily exceeded');
    });

    test('successfully confirms food received (marks DELIVERED as COMPLETED)', async () => {
      const donationId = await createTestDonation({
        donor_id: donor.id,
        food_name: 'Vegetable Khichdi',
        food_category: 'Cooked Food',
        quantity: 30,
        people_served: 75,
        status: 'DELIVERED',
        ngo_id: vegNgo.id,
      });

      const res = await request(app)
        .post(`/api/ngo/donations/${donationId}/received`)
        .set('Authorization', `Bearer ${vegNgo.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/received/i);

      const [rows] = await pool.query('SELECT status, received_at FROM donations WHERE id = ?', [donationId]);
      expect(rows[0].status).toBe('COMPLETED');
      expect(rows[0].received_at).not.toBeNull();
    });

    test('fails markReceived if called by NGO other than the assigned NGO', async () => {
      const donationId = await createTestDonation({
        donor_id: donor.id,
        food_name: 'Roti and Sabzi',
        food_category: 'Cooked Food',
        quantity: 20,
        status: 'DELIVERED',
        ngo_id: vegNgo.id,
      });

      const res = await request(app)
        .post(`/api/ngo/donations/${donationId}/received`)
        .set('Authorization', `Bearer ${anyNgo.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Access denied/i);
    });
  });

  describe('NGO Dashboard Calculations & Role Security', () => {
    test('accurately calculates NGO dashboard statistics', async () => {
      // 1 Completed
      await createTestDonation({
        donor_id: donor.id,
        ngo_id: vegNgo.id,
        food_name: 'Completed Meal',
        food_category: 'Cooked Food',
        quantity: 40,
        people_served: 100,
        status: 'COMPLETED',
      });

      // 1 Delivered (also counts as received/total food)
      await createTestDonation({
        donor_id: donor.id,
        ngo_id: vegNgo.id,
        food_name: 'Delivered Meal',
        food_category: 'Cooked Food',
        quantity: 25,
        people_served: 50,
        status: 'DELIVERED',
      });

      // 1 Accepted (in progress)
      await createTestDonation({
        donor_id: donor.id,
        ngo_id: vegNgo.id,
        food_name: 'Accepted Meal',
        food_category: 'Cooked Food',
        quantity: 15,
        people_served: 30,
        status: 'ACCEPTED',
      });

      // 1 Posted (available for browsing)
      await createTestDonation({
        donor_id: donor.id,
        food_name: 'Available Meal',
        food_category: 'Cooked Food',
        quantity: 10,
        people_served: 20,
        status: 'POSTED',
      });

      const res = await request(app)
        .get('/api/ngo/dashboard')
        .set('Authorization', `Bearer ${vegNgo.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats.available).toBe(1);
      expect(res.body.stats.accepted).toBe(3); // Completed + Delivered + Accepted
      expect(res.body.stats.received).toBe(2); // Completed + Delivered
      expect(res.body.stats.totalFood).toBe(65); // 40 + 25
      expect(res.body.stats.totalPeople).toBe(150); // 100 + 50
    });

    test('fails when donor or volunteer tries to access NGO dashboard (invalid case: unauthorized role)', async () => {
      const resDonor = await request(app)
        .get('/api/ngo/dashboard')
        .set('Authorization', `Bearer ${donor.token}`);
      expect(resDonor.status).toBe(403);

      const resVol = await request(app)
        .get('/api/ngo/dashboard')
        .set('Authorization', `Bearer ${volunteer.token}`);
      expect(resVol.status).toBe(403);
    });
  });
});
