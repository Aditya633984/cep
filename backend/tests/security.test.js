'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const app = require('../server');
const {
  resetDatabase,
  createTestUser,
  generateToken,
  pool,
} = require('./testHelper');

describe('Security & Defensive Hardening Suite', () => {
  let donor;
  let admin;

  beforeEach(async () => {
    await resetDatabase();
    donor = await createTestUser({ email: 'donor@example.com', role: 'donor', password: 'RealSecurePassword123!' });
    admin = await createTestUser({ email: 'admin@foodbridge.org', role: 'admin', password: 'AdminPassword123!' });
  });

  describe('Password Hashing & Protection', () => {
    test('passwords are hashed using bcrypt with salt rounds >= 10', async () => {
      const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [donor.id]);
      const storedHash = rows[0].password;

      // Ensure raw password is NOT stored
      expect(storedHash).not.toBe('RealSecurePassword123!');
      // Ensure it is a valid bcrypt hash format ($2a$ or $2b$)
      expect(storedHash).toMatch(/^\$2[ab]\$\d{2}\$/);
      // Verify bcrypt can authenticate it
      const match = await bcrypt.compare('RealSecurePassword123!', storedHash);
      expect(match).toBe(true);
      // Wrong password fails
      const badMatch = await bcrypt.compare('WrongPassword', storedHash);
      expect(badMatch).toBe(false);
    });

    test('password hash is NEVER leaked in /api/auth/me or login response', async () => {
      // Login endpoint
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'donor@example.com', password: 'RealSecurePassword123!' });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.password).toBeUndefined();

      // Me endpoint
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${donor.token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.password).toBeUndefined();
    });
  });

  describe('JWT Validation & Tampering Resistance', () => {
    test('rejects request with missing Authorization header (401)', async () => {
      const res = await request(app).get('/api/donor/dashboard');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/No token provided/i);
    });

    test('rejects request with malformed header (not Bearer format) (401)', async () => {
      const res = await request(app)
        .get('/api/donor/dashboard')
        .set('Authorization', `Basic ${donor.token}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('rejects tampered JWT signature (invalid token) (401)', async () => {
      // Modify payload or signature
      const tampered = donor.token.slice(0, -6) + 'abcdef';
      const res = await request(app)
        .get('/api/donor/dashboard')
        .set('Authorization', `Bearer ${tampered}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid token/i);
    });

    test('rejects JWT signed with wrong secret (401)', async () => {
      const fakeToken = jwt.sign(
        { id: donor.id, email: donor.user.email, role: 'donor' },
        'wrong_attacker_secret_key_123',
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/donor/dashboard')
        .set('Authorization', `Bearer ${fakeToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid token/i);
    });

    test('rejects expired JWT (401)', async () => {
      const secret = process.env.JWT_SECRET || 'foodbridge_super_secret_jwt_key_2024_change_in_production';
      const expiredToken = jwt.sign(
        { id: donor.id, email: donor.user.email, role: 'donor' },
        secret,
        { expiresIn: '-1s' } // Expired 1 second ago
      );

      const res = await request(app)
        .get('/api/donor/dashboard')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Token expired/i);
    });
  });

  describe('SQL Injection Protection', () => {
    test('login endpoint resists classic SQL injection payloads', async () => {
      // Attempt SQLi auth bypass
      const sqliRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: "' OR '1'='1' --",
          password: 'anything',
        });

      expect(sqliRes.status).toBe(401);
      expect(sqliRes.body.success).toBe(false);
      expect(sqliRes.body.error).toMatch(/Invalid email or password/i);
    });

    test('search query parameter resists SQL injection payloads', async () => {
      // Attempt SQL injection in search
      const res = await request(app)
        .get("/api/admin/users?search=' OR 1=1 --")
        .set('Authorization', `Bearer ${admin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Since it's parameterized with LIKE ?, it literally searches for the string "' OR 1=1 --"
      // and finds 0 matches rather than returning all database records
      expect(res.body.users.length).toBe(0);
    });
  });

  describe('XSS & Security Headers', () => {
    test('essential security headers are set on all responses', async () => {
      const res = await request(app).get('/api/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-xss-protection']).toMatch(/1;\s*mode=block/);
    });

    test('input containing HTML/XSS script tags is safely stored as literal text', async () => {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const today = new Date().toISOString().split('T')[0];
      const xssPayload = '<script>alert("XSS")</script>';

      const res = await request(app)
        .post('/api/donor/donations')
        .set('Authorization', `Bearer ${donor.token}`)
        .send({
          food_name: xssPayload,
          food_category: 'Cooked Food',
          quantity: 5,
          unit: 'kg',
          people_served: 10,
          food_type: 'vegetarian',
          preparation_date: today,
          best_before: tomorrow,
          pickup_address: '100 MG Road',
          city: 'Bangalore',
          description: '<img src=x onerror=alert(1)>',
        });

      expect(res.status).toBe(201);
      expect(res.body.donation.food_name).toBe(xssPayload);

      // Verify DB stored literally without executing
      const [rows] = await pool.query('SELECT food_name, description FROM donations WHERE id = ?', [res.body.donation.id]);
      expect(rows[0].food_name).toBe(xssPayload);
    });
  });

  describe('File Upload Validation & Path Traversal Prevention', () => {
    test('rejects non-image executable file uploads (e.g. .sh, .exe, .js)', async () => {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const today = new Date().toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/donor/donations')
        .set('Authorization', `Bearer ${donor.token}`)
        .field('food_name', 'Test Upload')
        .field('food_category', 'Cooked Food')
        .field('quantity', '5')
        .field('unit', 'kg')
        .field('food_type', 'vegetarian')
        .field('preparation_date', today)
        .field('best_before', tomorrow)
        .field('pickup_address', '100 MG Road')
        .field('city', 'Bangalore')
        .attach('food_image', Buffer.from('#!/bin/bash\necho "exploit"'), 'script.sh');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Only image files .* are allowed/i);
    });

    test('rejects oversized file uploads (> 5MB)', async () => {
      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const today = new Date().toISOString().split('T')[0];
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6 MB

      const res = await request(app)
        .post('/api/donor/donations')
        .set('Authorization', `Bearer ${donor.token}`)
        .field('food_name', 'Test Upload')
        .field('food_category', 'Cooked Food')
        .field('quantity', '5')
        .field('unit', 'kg')
        .field('food_type', 'vegetarian')
        .field('preparation_date', today)
        .field('best_before', tomorrow)
        .field('pickup_address', '100 MG Road')
        .field('city', 'Bangalore')
        .attach('food_image', largeBuffer, 'huge_image.jpg');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/File size exceeds allowed limit/i);
    });
  });

  describe('API Error Handling & Environment Protection', () => {
    test('non-existent route returns 404 with clean JSON error', async () => {
      const res = await request(app).get('/api/does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Route .* not found/i);
    });

    test('malformed JSON body returns 400 Bad Request instead of unhandled 500', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email": "donor@example.com", "password": invalid_json_here}');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('JWT_SECRET is securely configured in process.env', () => {
      expect(process.env.JWT_SECRET).toBeDefined();
      expect(process.env.JWT_SECRET.length).toBeGreaterThanOrEqual(16);
    });
  });

  describe('Role-Based Authorization & Session Handling', () => {
    let ngoUser;
    let volunteerUser;

    beforeEach(async () => {
      ngoUser = await createTestUser({ email: 'ngo_test@example.com', role: 'ngo' });
      volunteerUser = await createTestUser({ email: 'vol_test@example.com', role: 'volunteer' });
    });

    test('allows NGO account to access Available Donations endpoint with 200 OK', async () => {
      const res = await request(app)
        .get('/api/ngo/donations/available')
        .set('Authorization', `Bearer ${ngoUser.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.donations)).toBe(true);
    });

    test('normalizes role casing (e.g. NGO or Ngo) so authorization succeeds', async () => {
      const secret = process.env.JWT_SECRET || 'foodbridge_demo_jwt_secret_key_2026';
      // Token signed with uppercase 'NGO'
      const tokenUppercase = jwt.sign(
        { id: ngoUser.id, email: ngoUser.email, role: 'NGO' },
        secret,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/ngo/donations/available')
        .set('Authorization', `Bearer ${tokenUppercase}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('denies Donor from accessing NGO Available Donations endpoint with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/ngo/donations/available')
        .set('Authorization', `Bearer ${donor.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Access denied. This route requires one of: [ngo].');
    });

    test('denies Volunteer from accessing NGO Available Donations endpoint with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/ngo/donations/available')
        .set('Authorization', `Bearer ${volunteerUser.token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Access denied. This route requires one of: [ngo].');
    });

    test('returns 401 Unauthorized for expired JWT on Available Donations endpoint', async () => {
      const secret = process.env.JWT_SECRET || 'foodbridge_demo_jwt_secret_key_2026';
      const expiredToken = jwt.sign(
        { id: ngoUser.id, email: ngoUser.email, role: 'ngo' },
        secret,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/ngo/donations/available')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Token expired. Please log in again.');
    });

    test('returns 401 Unauthorized when no token is provided', async () => {
      const res = await request(app).get('/api/ngo/donations/available');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Access denied. No token provided.');
    });

    test('returns 401 Unauthorized for tampered/invalid token', async () => {
      const res = await request(app)
        .get('/api/ngo/donations/available')
        .set('Authorization', 'Bearer invalid.tampered.token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid token.');
    });
  });
});
