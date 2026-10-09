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

describe('Donations & Donor Module Suite', () => {
  let donor;
  let otherDonor;

  beforeEach(async () => {
    await resetDatabase();
    donor = await createTestUser({ email: 'donor1@example.com', role: 'donor' });
    otherDonor = await createTestUser({ email: 'donor2@example.com', role: 'donor' });
  });

  describe('Donation Creation & Input Validation', () => {
    test('successfully creates a valid donation', async () => {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const today = new Date().toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/donor/donations')
        .set('Authorization', `Bearer ${donor.token}`)
        .send({
          food_name: 'Fresh Vegetable Biryani',
          food_category: 'Cooked Food',
          quantity: 15,
          unit: 'kg',
          people_served: 40,
          food_type: 'vegetarian',
          preparation_date: today,
          best_before: tomorrow,
          pickup_address: '100 MG Road',
          city: 'Bangalore',
          description: 'Leftover from corporate lunch, kept refrigerated.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.donation.food_name).toBe('Fresh Vegetable Biryani');
      expect(Number(res.body.donation.quantity)).toBe(15);
      expect(res.body.donation.status).toBe('POSTED');
    });

    test('fails creation with negative quantity (invalid case: negative quantity)', async () => {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const today = new Date().toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/donor/donations')
        .set('Authorization', `Bearer ${donor.token}`)
        .send({
          food_name: 'Invalid Food',
          food_category: 'Cooked Food',
          quantity: -5,
          unit: 'kg',
          people_served: 10,
          food_type: 'vegetarian',
          preparation_date: today,
          best_before: tomorrow,
          pickup_address: '100 MG Road',
          city: 'Bangalore',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Quantity must be a positive number/i);
    });

    test('fails creation with zero quantity', async () => {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const today = new Date().toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/donor/donations')
        .set('Authorization', `Bearer ${donor.token}`)
        .send({
          food_name: 'Zero Qty Food',
          food_category: 'Cooked Food',
          quantity: 0,
          unit: 'kg',
          food_type: 'vegetarian',
          preparation_date: today,
          best_before: tomorrow,
          pickup_address: '100 MG Road',
          city: 'Bangalore',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('fails creation with expired food (invalid case: expired food)', async () => {
      const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const twoDaysAgo = new Date(Date.now() - 48 * 3600 * 1000).toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/donor/donations')
        .set('Authorization', `Bearer ${donor.token}`)
        .send({
          food_name: 'Expired Dal Makhani',
          food_category: 'Cooked Food',
          quantity: 10,
          unit: 'kg',
          people_served: 25,
          food_type: 'vegetarian',
          preparation_date: twoDaysAgo,
          best_before: yesterday,
          pickup_address: '100 MG Road',
          city: 'Bangalore',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Cannot donate expired food/i);
    });

    test('fails creation with negative people_served', async () => {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const today = new Date().toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/donor/donations')
        .set('Authorization', `Bearer ${donor.token}`)
        .send({
          food_name: 'Bad People Food',
          food_category: 'Cooked Food',
          quantity: 10,
          unit: 'kg',
          people_served: -12,
          food_type: 'vegetarian',
          preparation_date: today,
          best_before: tomorrow,
          pickup_address: '100 MG Road',
          city: 'Bangalore',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/People served must be a positive integer/i);
    });

    test('fails creation with invalid food category (invalid case: input validation)', async () => {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const today = new Date().toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/donor/donations')
        .set('Authorization', `Bearer ${donor.token}`)
        .send({
          food_name: 'Pizza Hut Special',
          food_category: 'Fast Food Junk',
          quantity: 10,
          unit: 'kg',
          people_served: 20,
          food_type: 'vegetarian',
          preparation_date: today,
          best_before: tomorrow,
          pickup_address: '100 MG Road',
          city: 'Bangalore',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid food category/i);
    });

    test('fails creation with invalid unit (invalid case: input validation)', async () => {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const today = new Date().toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/donor/donations')
        .set('Authorization', `Bearer ${donor.token}`)
        .send({
          food_name: 'Food with Bad Unit',
          food_category: 'Cooked Food',
          quantity: 10,
          unit: 'barrels',
          people_served: 20,
          food_type: 'vegetarian',
          preparation_date: today,
          best_before: tomorrow,
          pickup_address: '100 MG Road',
          city: 'Bangalore',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid unit/i);
    });
  });

  describe('Donation Modification & Authorization', () => {
    let postedDonationId;

    beforeEach(async () => {
      postedDonationId = await createTestDonation({
        donor_id: donor.id,
        food_name: 'Apples',
        food_category: 'Fruits',
        quantity: 20,
        unit: 'kg',
        people_served: 50,
        food_type: 'vegetarian',
        pickup_address: '12 Market St',
        city: 'Bangalore',
        status: 'POSTED',
      });
    });

    test('successfully updates a POSTED donation', async () => {
      const res = await request(app)
        .put(`/api/donor/donations/${postedDonationId}`)
        .set('Authorization', `Bearer ${donor.token}`)
        .send({
          food_name: 'Fresh Red Apples',
          quantity: 25,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.donation.food_name).toBe('Fresh Red Apples');
      expect(Number(res.body.donation.quantity)).toBe(25);
    });

    test('fails update if other donor tries to modify it (invalid case: unauthorized modification)', async () => {
      const res = await request(app)
        .put(`/api/donor/donations/${postedDonationId}`)
        .set('Authorization', `Bearer ${otherDonor.token}`)
        .send({ food_name: 'Hacked Apples' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Access denied/i);
    });

    test('fails modifying completed donation (invalid case: donor modifying completed donation)', async () => {
      // Mark donation as COMPLETED
      await pool.query(
        `UPDATE donations SET status = 'COMPLETED', received_at = NOW() WHERE id = ?`,
        [postedDonationId]
      );

      const res = await request(app)
        .put(`/api/donor/donations/${postedDonationId}`)
        .set('Authorization', `Bearer ${donor.token}`)
        .send({
          food_name: 'Trying to modify completed food',
          quantity: 50,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Cannot edit a donation with status "COMPLETED"/i);
    });

    test('fails cancelling completed donation (invalid case: donor cancelling completed donation)', async () => {
      // Mark donation as COMPLETED
      await pool.query(
        `UPDATE donations SET status = 'COMPLETED', received_at = NOW() WHERE id = ?`,
        [postedDonationId]
      );

      const res = await request(app)
        .delete(`/api/donor/donations/${postedDonationId}`)
        .set('Authorization', `Bearer ${donor.token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Cannot cancel a donation with status "COMPLETED"/i);
    });

    test('successfully cancels a POSTED donation', async () => {
      const res = await request(app)
        .delete(`/api/donor/donations/${postedDonationId}`)
        .set('Authorization', `Bearer ${donor.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/cancelled/i);

      // Verify DB status
      const [rows] = await pool.query('SELECT status FROM donations WHERE id = ?', [postedDonationId]);
      expect(rows[0].status).toBe('CANCELLED');
    });
  });

  describe('Donor Dashboard Calculations', () => {
    test('accurately calculates dashboard statistics for donor', async () => {
      // Insert 1 COMPLETED (qty 30, people 60)
      await createTestDonation({
        donor_id: donor.id,
        food_name: 'Meal 1',
        food_category: 'Cooked Food',
        quantity: 30,
        unit: 'kg',
        people_served: 60,
        food_type: 'vegetarian',
        status: 'COMPLETED',
      });

      // Insert 1 DELIVERED (qty 20, people 40)
      await createTestDonation({
        donor_id: donor.id,
        food_name: 'Meal 2',
        food_category: 'Cooked Food',
        quantity: 20,
        unit: 'kg',
        people_served: 40,
        food_type: 'vegetarian',
        status: 'DELIVERED',
      });

      // Insert 1 POSTED (active)
      await createTestDonation({
        donor_id: donor.id,
        food_name: 'Meal 3',
        food_category: 'Cooked Food',
        quantity: 15,
        unit: 'kg',
        people_served: 30,
        food_type: 'vegetarian',
        status: 'POSTED',
      });

      // Insert 1 CANCELLED
      await createTestDonation({
        donor_id: donor.id,
        food_name: 'Meal 4',
        food_category: 'Cooked Food',
        quantity: 10,
        unit: 'kg',
        people_served: 20,
        food_type: 'vegetarian',
        status: 'CANCELLED',
      });

      const res = await request(app)
        .get('/api/donor/dashboard')
        .set('Authorization', `Bearer ${donor.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats.total).toBe(4);
      expect(res.body.stats.active).toBe(2); // POSTED + DELIVERED
      expect(res.body.stats.completed).toBe(1);
      expect(res.body.stats.cancelled).toBe(1);
      expect(res.body.stats.totalFood).toBe(50); // 30 + 20
      expect(res.body.stats.totalPeople).toBe(100); // 60 + 40
    });
  });
});
