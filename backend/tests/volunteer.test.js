'use strict';

const request = require('supertest');
const app = require('../server');
const {
  resetDatabase,
  createTestUser,
  createTestDonation,
  pool,
} = require('./testHelper');

describe('Volunteer Module & Pickup/Delivery Workflow Suite', () => {
  let donor;
  let ngo;
  let volunteer1;
  let volunteer2;

  beforeEach(async () => {
    await resetDatabase();
    donor = await createTestUser({ email: 'donor@example.com', role: 'donor' });
    ngo = await createTestUser({ email: 'ngo@example.com', role: 'ngo' });
    volunteer1 = await createTestUser({ email: 'vol1@example.com', role: 'volunteer', vehicle_type: 'motorcycle' });
    volunteer2 = await createTestUser({ email: 'vol2@example.com', role: 'volunteer', vehicle_type: 'van' });
  });

  describe('Volunteer Profile & Available Pickups', () => {
    test('successfully retrieves volunteer profile', async () => {
      const res = await request(app)
        .get('/api/volunteer/profile')
        .set('Authorization', `Bearer ${volunteer1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.profile.vehicle_type).toBe('motorcycle');
    });

    test('successfully updates volunteer profile', async () => {
      const res = await request(app)
        .put('/api/volunteer/profile')
        .set('Authorization', `Bearer ${volunteer1.token}`)
        .send({
          phone: '9988776655',
          vehicle_type: 'car',
          service_area: 'South Bangalore',
          availability: 'Weekends only',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.profile.vehicle_type).toBe('car');
      expect(res.body.profile.service_area).toBe('South Bangalore');
    });

    test('lists available pickups that have status ACCEPTED', async () => {
      await createTestDonation({
        donor_id: donor.id,
        ngo_id: ngo.id,
        food_name: 'Available Khichdi',
        status: 'ACCEPTED',
      });

      const res = await request(app)
        .get('/api/volunteer/pickups/available')
        .set('Authorization', `Bearer ${volunteer1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pickups.length).toBe(1);
      expect(res.body.pickups[0].food_name).toBe('Available Khichdi');
    });
  });

  describe('Pickup Workflow & Concurrency Rules', () => {
    test('volunteer successfully accepts an available pickup', async () => {
      const donationId = await createTestDonation({
        donor_id: donor.id,
        ngo_id: ngo.id,
        food_name: 'Hot Soup',
        status: 'ACCEPTED',
      });

      const res = await request(app)
        .post(`/api/volunteer/pickups/${donationId}/accept`)
        .set('Authorization', `Bearer ${volunteer1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/accepted/i);

      // Verify DB state
      const [rows] = await pool.query('SELECT status, volunteer_id, volunteer_assigned_at FROM donations WHERE id = ?', [donationId]);
      expect(rows[0].status).toBe('VOLUNTEER_ASSIGNED');
      expect(rows[0].volunteer_id).toBe(volunteer1.id);
      expect(rows[0].volunteer_assigned_at).not.toBeNull();
    });

    test('fails if second volunteer tries to accept an already assigned pickup', async () => {
      const donationId = await createTestDonation({
        donor_id: donor.id,
        ngo_id: ngo.id,
        food_name: 'Hot Soup',
        volunteer_id: volunteer1.id,
        status: 'VOLUNTEER_ASSIGNED',
      });

      const res = await request(app)
        .post(`/api/volunteer/pickups/${donationId}/accept`)
        .set('Authorization', `Bearer ${volunteer2.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Another volunteer is already assigned/i);
    });

    test('fails if volunteer tries to accept another pickup while having an active pickup', async () => {
      // Volunteer 1 already has an active pickup in progress
      await createTestDonation({
        donor_id: donor.id,
        ngo_id: ngo.id,
        volunteer_id: volunteer1.id,
        food_name: 'First Active Delivery',
        status: 'VOLUNTEER_ASSIGNED',
      });

      const secondDonationId = await createTestDonation({
        donor_id: donor.id,
        ngo_id: ngo.id,
        food_name: 'Second Available Meal',
        status: 'ACCEPTED',
      });

      const res = await request(app)
        .post(`/api/volunteer/pickups/${secondDonationId}/accept`)
        .set('Authorization', `Bearer ${volunteer1.token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already have an active pickup/i);
    });
  });

  describe('Pickup & Delivery Status Transitions & Cross-Volunteer Security', () => {
    let assignedDonationId;

    beforeEach(async () => {
      assignedDonationId = await createTestDonation({
        donor_id: donor.id,
        ngo_id: ngo.id,
        volunteer_id: volunteer1.id,
        food_name: 'Biryani Packets',
        status: 'VOLUNTEER_ASSIGNED',
      });
    });

    test('assigned volunteer successfully marks food as picked up', async () => {
      const res = await request(app)
        .post(`/api/volunteer/pickups/${assignedDonationId}/pickup`)
        .set('Authorization', `Bearer ${volunteer1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/picked up/i);

      const [rows] = await pool.query('SELECT status, picked_up_at FROM donations WHERE id = ?', [assignedDonationId]);
      expect(rows[0].status).toBe('PICKED_UP');
      expect(rows[0].picked_up_at).not.toBeNull();
    });

    test('fails when another volunteer tries to mark picked up (invalid case: volunteer accessing another volunteer pickup)', async () => {
      const res = await request(app)
        .post(`/api/volunteer/pickups/${assignedDonationId}/pickup`)
        .set('Authorization', `Bearer ${volunteer2.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Access denied: You are not assigned to this pickup/i);
    });

    test('assigned volunteer marks picked up food as delivered', async () => {
      // First update to PICKED_UP
      await pool.query("UPDATE donations SET status = 'PICKED_UP', picked_up_at = NOW() WHERE id = ?", [assignedDonationId]);

      const res = await request(app)
        .post(`/api/volunteer/pickups/${assignedDonationId}/deliver`)
        .set('Authorization', `Bearer ${volunteer1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/Delivery marked/i);

      const [rows] = await pool.query('SELECT status, delivered_at FROM donations WHERE id = ?', [assignedDonationId]);
      expect(rows[0].status).toBe('DELIVERED');
      expect(rows[0].delivered_at).not.toBeNull();
    });

    test('fails when another volunteer tries to mark delivered (invalid case: volunteer accessing another volunteer pickup)', async () => {
      await pool.query("UPDATE donations SET status = 'PICKED_UP', picked_up_at = NOW() WHERE id = ?", [assignedDonationId]);

      const res = await request(app)
        .post(`/api/volunteer/pickups/${assignedDonationId}/deliver`)
        .set('Authorization', `Bearer ${volunteer2.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Access denied: You are not assigned to this pickup/i);
    });

    test('fails marking delivered before picking up (invalid workflow state)', async () => {
      // Still in VOLUNTEER_ASSIGNED, not yet PICKED_UP
      const res = await request(app)
        .post(`/api/volunteer/pickups/${assignedDonationId}/deliver`)
        .set('Authorization', `Bearer ${volunteer1.token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/not in PICKED_UP status/i);
    });
  });

  describe('Volunteer Dashboard Calculations & Authorization', () => {
    test('accurately calculates volunteer dashboard statistics', async () => {
      // 1 Completed delivery
      await createTestDonation({
        donor_id: donor.id,
        ngo_id: ngo.id,
        volunteer_id: volunteer1.id,
        quantity: 50,
        people_served: 120,
        status: 'COMPLETED',
      });

      // 1 Active delivery (PICKED_UP)
      await createTestDonation({
        donor_id: donor.id,
        ngo_id: ngo.id,
        volunteer_id: volunteer1.id,
        quantity: 20,
        people_served: 40,
        status: 'PICKED_UP',
      });

      // 1 Available pickup for any volunteer to claim
      await createTestDonation({
        donor_id: donor.id,
        ngo_id: ngo.id,
        quantity: 15,
        status: 'ACCEPTED',
      });

      const res = await request(app)
        .get('/api/volunteer/dashboard')
        .set('Authorization', `Bearer ${volunteer1.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats.available).toBe(1);
      expect(res.body.stats.active).toBe(1);
      expect(res.body.stats.completed).toBe(1);
      expect(res.body.stats.totalFood).toBe(50);
      expect(res.body.stats.totalPeople).toBe(120);
    });

    test('fails when donor or NGO attempts to access volunteer dashboard (invalid case: unauthorized role)', async () => {
      const resDonor = await request(app)
        .get('/api/volunteer/dashboard')
        .set('Authorization', `Bearer ${donor.token}`);
      expect(resDonor.status).toBe(403);

      const resNgo = await request(app)
        .get('/api/volunteer/dashboard')
        .set('Authorization', `Bearer ${ngo.token}`);
      expect(resNgo.status).toBe(403);
    });
  });
});
