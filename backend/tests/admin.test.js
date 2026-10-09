'use strict';

const request = require('supertest');
const app = require('../server');
const {
  resetDatabase,
  createTestUser,
  createTestDonation,
  pool,
} = require('./testHelper');

describe('Admin Module & Verification Workflow Suite', () => {
  let admin;
  let donor;
  let ngo;
  let volunteer;

  beforeEach(async () => {
    await resetDatabase();
    admin = await createTestUser({ email: 'admin@foodbridge.org', role: 'admin' });
    donor = await createTestUser({ email: 'donor@example.com', role: 'donor' });
    ngo = await createTestUser({
      email: 'ngo@example.com',
      role: 'ngo',
      ngo_name: 'Hope NGO',
      verification_status: 'pending',
    });
    volunteer = await createTestUser({ email: 'vol@example.com', role: 'volunteer' });
  });

  describe('Admin Authorization & Role Protection', () => {
    test('allows admin access to admin endpoints', async () => {
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('blocks non-admin users from admin endpoints (invalid case: role authorization)', async () => {
      const resDonor = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${donor.token}`);
      expect(resDonor.status).toBe(403);
      expect(resDonor.body.error).toMatch(/Access denied/i);

      const resNgo = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${ngo.token}`);
      expect(resNgo.status).toBe(403);

      const resVol = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${volunteer.token}`);
      expect(resVol.status).toBe(403);
    });

    test('blocks unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/admin/stats');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Admin Platform Statistics', () => {
    test('accurately calculates platform metrics', async () => {
      // 1 Completed donation (qty 50, people 100)
      await createTestDonation({
        donor_id: donor.id,
        ngo_id: ngo.id,
        quantity: 50,
        people_served: 100,
        status: 'COMPLETED',
      });

      // 1 Posted donation
      await createTestDonation({
        donor_id: donor.id,
        quantity: 20,
        people_served: 40,
        status: 'POSTED',
      });

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { stats } = res.body;
      expect(stats.total_users).toBe(4); // admin, donor, ngo, volunteer
      expect(stats.total_donors).toBe(1);
      expect(stats.total_ngos).toBe(1);
      expect(stats.total_volunteers).toBe(1);
      expect(stats.total_donations).toBe(2);
      expect(stats.completed_donations).toBe(1);
      expect(stats.posted_donations).toBe(1);
      expect(parseFloat(stats.total_kg_donated)).toBe(50);
      expect(parseInt(stats.total_people_served)).toBe(100);
      expect(stats.ngo_pending).toBe(1);
    });
  });

  describe('NGO Verification Workflow', () => {
    test('admin lists NGOs filtered by verification status', async () => {
      const res = await request(app)
        .get('/api/admin/ngos?status=pending')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.ngos.length).toBe(1);
      expect(res.body.ngos[0].verification_status).toBe('pending');
    });

    test('admin verifies a pending NGO (changes status to verified)', async () => {
      const res = await request(app)
        .patch(`/api/admin/ngos/${ngo.id}/verify`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'verified' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify in DB
      const [rows] = await pool.query('SELECT verification_status FROM ngo_profiles WHERE user_id = ?', [ngo.id]);
      expect(rows[0].verification_status).toBe('verified');
    });

    test('admin rejects an NGO (changes status to rejected)', async () => {
      const res = await request(app)
        .patch(`/api/admin/ngos/${ngo.id}/verify`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'rejected' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const [rows] = await pool.query('SELECT verification_status FROM ngo_profiles WHERE user_id = ?', [ngo.id]);
      expect(rows[0].verification_status).toBe('rejected');
    });

    test('fails verification with invalid status value (invalid case: input validation)', async () => {
      const res = await request(app)
        .patch(`/api/admin/ngos/${ngo.id}/verify`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'approved_super' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid status/i);
    });

    test('returns 404 when verifying non-existent NGO', async () => {
      const res = await request(app)
        .patch('/api/admin/ngos/99999/verify')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'verified' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Admin User & Donation Listings', () => {
    test('admin searches and filters users by role', async () => {
      const res = await request(app)
        .get('/api/admin/users?role=donor')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.users.length).toBe(1);
      expect(res.body.users[0].email).toBe('donor@example.com');
    });

    test('admin retrieves single user detail without leaking password hash', async () => {
      const res = await request(app)
        .get(`/api/admin/users/${donor.id}`)
        .set('Authorization', `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('donor@example.com');
      expect(res.body.user.password).toBeUndefined(); // Security check: no password leak
    });

    test('admin lists donations with status filter', async () => {
      await createTestDonation({
        donor_id: donor.id,
        food_name: 'Donation for Admin View',
        status: 'POSTED',
      });

      const res = await request(app)
        .get('/api/admin/donations?status=POSTED')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.donations.length).toBe(1);
      expect(res.body.donations[0].food_name).toBe('Donation for Admin View');
    });
  });
});
