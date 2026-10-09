'use strict';

const request = require('supertest');
const app = require('../server');
const { resetDatabase, createTestUser, generateToken } = require('./testHelper');

describe('Authentication & Authorization Suite', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('Registration', () => {
    test('successfully registers a donor', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jane Donor',
          email: 'jane@example.com',
          password: 'securepassword123',
          role: 'donor',
          phone: '9876543210',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('jane@example.com');
      expect(res.body.user.role).toBe('donor');
    });

    test('successfully registers an NGO with profile', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Feeding Hope NGO',
          email: 'contact@feedinghope.org',
          password: 'securepassword123',
          role: 'ngo',
          ngo_name: 'Feeding Hope Foundation',
          founder: 'Alice Hope',
          address: '42 Kindness Lane',
          food_types: 'Cooked Food, Dry Ration',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('ngo');
    });

    test('successfully registers a volunteer', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Bob Volunteer',
          email: 'bob@example.com',
          password: 'securepassword123',
          role: 'volunteer',
          phone: '9876543210',
          vehicle_type: 'van',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('volunteer');
    });

    test('fails registration if role is admin (security protection against privilege escalation)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Hacker Admin',
          email: 'admin_hacker@example.com',
          password: 'securepassword123',
          role: 'admin',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Admin registration is not permitted/i);
    });

    test('fails registration on duplicate email (invalid case)', async () => {
      await createTestUser({ email: 'duplicate@example.com' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Duplicate User',
          email: 'duplicate@example.com',
          password: 'securepassword123',
          role: 'donor',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already exists/i);
    });

    test('fails registration on invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Bad Email User',
          email: 'not-an-email',
          password: 'securepassword123',
          role: 'donor',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid email/i);
    });

    test('fails registration on short password (< 8 chars)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Short Pass',
          email: 'short@example.com',
          password: '123',
          role: 'donor',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/at least 8 characters/i);
    });

    test('fails NGO registration if ngo_name is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'NGO User',
          email: 'nongoname@example.com',
          password: 'securepassword123',
          role: 'ngo',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/NGO Name is required/i);
    });
  });

  describe('Login', () => {
    test('successfully logs in with valid credentials', async () => {
      await createTestUser({ email: 'donor@example.com', password: 'password123', role: 'donor' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'donor@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('donor@example.com');
    });

    test('fails login with incorrect password (invalid login)', async () => {
      await createTestUser({ email: 'donor@example.com', password: 'password123' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'donor@example.com',
          password: 'wrongpassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid email or password/i);
    });

    test('fails login with non-existent email (invalid login)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unknown@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid email or password/i);
    });

    test('fails login with missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('JWT and Role-Based Authorization', () => {
    test('allows authenticated user to access /api/auth/me', async () => {
      const { user, token } = await createTestUser({ email: 'me@example.com', role: 'donor' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('me@example.com');
    });

    test('rejects request without token (401 Unauthorized API request)', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/No token provided/i);
    });

    test('rejects request with invalid token (401 Unauthorized API request)', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.signature');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid token/i);
    });

    test('enforces role-based authorization: donor cannot access admin endpoint', async () => {
      const { token } = await createTestUser({ email: 'donor@example.com', role: 'donor' });

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Access denied/i);
    });

    test('enforces role-based authorization: volunteer cannot access NGO dashboard', async () => {
      const { token } = await createTestUser({ email: 'vol@example.com', role: 'volunteer' });

      const res = await request(app)
        .get('/api/ngo/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Access denied/i);
    });
  });
});
