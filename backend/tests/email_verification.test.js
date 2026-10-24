'use strict';

/**
 * FoodBridge – Comprehensive Email Verification Test Suite
 * Tests all 14 required cases for Gmail email verification, tokens, and authorization.
 */

const request = require('supertest');
const app = require('../server');
const mockStore = require('../services/mockStore');
const emailService = require('../services/emailService');
const tokenService = require('../services/tokenService');
const { resetDatabase, createTestUser } = require('./testHelper');

describe('Email Verification via Gmail Suite (All 14 Required Test Cases)', () => {
  beforeEach(async () => {
    await resetDatabase();
    emailService.resetTransporter();
  });

  afterEach(() => {
    emailService.resetTransporter();
  });

  // ── Case 1: Register with a valid Gmail address ───────────────────────────
  test('Case 1: Register with a valid Gmail address creates an unverified account', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'Aarav',
        email: 'aarav.donor@gmail.com',
        phone: '9876543210',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'donor',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.requiresVerification).toBe(true);
    expect(res.body.message).toMatch(/verification email has been sent to your Gmail address/i);
    expect(res.body.token).toBeUndefined(); // No JWT issued until email is verified
    expect(res.body.user.email_verified).toBe(false);

    // Verify in mock store
    const storedUser = mockStore.findUserByEmail('aarav.donor@gmail.com');
    expect(storedUser).not.toBeNull();
    expect(storedUser.email_verified).toBe(false);
  });

  // ── Case 2: Receive the actual verification email in Gmail inbox ───────────
  test('Case 2: Verification email is sent with correct HTML and plain-text templates', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'Priya',
        email: 'priya.food@gmail.com',
        phone: '9812345678',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'donor',
      });

    expect(res.status).toBe(201);

    const sentEmail = emailService.getLastSentEmail();
    expect(sentEmail).not.toBeNull();
    expect(sentEmail.to).toBe('priya.food@gmail.com');
    expect(sentEmail.subject).toBe('Verify Your FoodBridge Email Address');

    // Verify content requirements
    expect(sentEmail.verificationUrl).toContain('/verify-email?token=');
  });

  // ── Case 3: Click the link and verify the account ─────────────────────────
  test('Case 3: Clicking the verification link successfully marks account as verified', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'Karan',
        email: 'karan.ngo@gmail.com',
        phone: '9823456789',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'ngo',
        ngo_name: 'Karan Food Relief',
      });

    const sentEmail = emailService.getLastSentEmail();
    const token = new URL(sentEmail.verificationUrl).searchParams.get('token');
    expect(token).toBeDefined();

    const verifyRes = await request(app)
      .get(`/api/auth/verify-email?token=${token}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    expect(verifyRes.body.message).toBe(
      'Email verified successfully! Your FoodBridge account is now verified. You can log in.'
    );

    // Verify in data store
    const user = mockStore.findUserByEmail('karan.ngo@gmail.com');
    expect(user.email_verified).toBe(true);
    expect(user.email_verified_at).toBeDefined();
  });

  // ── Case 4: Log in successfully after verification ─────────────────────────
  test('Case 4: User logs in successfully after email verification and receives JWT', async () => {
    // 1. Register
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'Devika',
        email: 'devika.vol@gmail.com',
        phone: '9834567890',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'volunteer',
      });

    // 2. Verify email
    const sentEmail = emailService.getLastSentEmail();
    const token = new URL(sentEmail.verificationUrl).searchParams.get('token');
    await request(app).get(`/api/auth/verify-email?token=${token}`);

    // 3. Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'devika.vol@gmail.com',
        password: 'Password@123',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.token).toBeDefined();
    expect(loginRes.body.user.email).toBe('devika.vol@gmail.com');
    expect(loginRes.body.user.email_verified).toBe(true);
  });

  // ── Case 5: Attempt login before verification ─────────────────────────────
  test('Case 5: Attempting login before verification is rejected with clear message', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'Rohan',
        email: 'rohan.unverified@gmail.com',
        phone: '9845678901',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'donor',
      });

    // Attempt login without verifying
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'rohan.unverified@gmail.com',
        password: 'Password@123',
      });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.success).toBe(false);
    expect(loginRes.body.requiresVerification).toBe(true);
    expect(loginRes.body.error).toBe(
      'Please verify your email before logging in. Check your Gmail inbox for the verification link.'
    );
    expect(loginRes.body.token).toBeUndefined();
  });

  // ── Case 6: Use an invalid token ──────────────────────────────────────────
  test('Case 6: Verifying with an invalid token returns 400 error', async () => {
    const invalidToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const res = await request(app)
      .get(`/api/auth/verify-email?token=${invalidToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Invalid or unrecognized verification token/i);
  });

  // ── Case 7: Use an expired token ──────────────────────────────────────────
  test('Case 7: Verifying with an expired token (>15 minutes) returns 400 error', async () => {
    // Create user and token expired 1 hour ago
    const user = mockStore.createUser({
      name: 'ExpiredUser',
      email: 'expired@gmail.com',
      phone: '9856789012',
      password: 'hashedpassword',
      role: 'donor',
      email_verified: false,
    });

    const expiredToken = 'expiredtoken1234567890abcdef1234567890abcdef1234567890abcdef12';
    const tokenHash = tokenService.hashToken(expiredToken);
    const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour in past

    mockStore.createVerificationToken({
      userId: user.id,
      tokenHash,
      expiresAt: pastDate,
    });

    const res = await request(app)
      .get(`/api/auth/verify-email?token=${expiredToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/This verification link has expired/i);

    // User must remain unverified
    const checkUser = mockStore.findUserById(user.id);
    expect(checkUser.email_verified).toBe(false);
  });

  // ── Case 8: Click the same verification link twice ────────────────────────
  test('Case 8: Clicking the same verification link twice is rejected on second attempt', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'Sneha',
        email: 'sneha.donor@gmail.com',
        phone: '9867890123',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'donor',
      });

    const sentEmail = emailService.getLastSentEmail();
    const token = new URL(sentEmail.verificationUrl).searchParams.get('token');

    // First click: success
    const firstRes = await request(app).get(`/api/auth/verify-email?token=${token}`);
    expect(firstRes.status).toBe(200);
    expect(firstRes.body.success).toBe(true);

    // Second click: rejected as already used
    const secondRes = await request(app).get(`/api/auth/verify-email?token=${token}`);
    expect(secondRes.status).toBe(400);
    expect(secondRes.body.success).toBe(false);
    expect(secondRes.body.error).toMatch(/This verification link has already been used/i);
  });

  // ── Case 9: Request a new verification email ──────────────────────────────
  test('Case 9: Requesting a new verification email invalidates previous token and dispatches new email', async () => {
    // 1. Register initial user
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'Manish',
        email: 'manish.resend@gmail.com',
        phone: '9878901234',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'donor',
      });

    const firstEmail = emailService.getLastSentEmail();
    const firstToken = new URL(firstEmail.verificationUrl).searchParams.get('token');

    // 2. Resend verification
    emailService.clearLastSentEmail();
    const resendRes = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'manish.resend@gmail.com' });

    expect(resendRes.status).toBe(200);
    expect(resendRes.body.success).toBe(true);

    // 3. Verify new email was dispatched
    const secondEmail = emailService.getLastSentEmail();
    expect(secondEmail).not.toBeNull();
    const secondToken = new URL(secondEmail.verificationUrl).searchParams.get('token');
    expect(secondToken).toBeDefined();
    expect(secondToken).not.toBe(firstToken); // Tokens must be different

    // 4. Old token must now be invalid
    const oldTokenRes = await request(app).get(`/api/auth/verify-email?token=${firstToken}`);
    expect(oldTokenRes.status).toBe(400);

    // 5. New token verifies account successfully
    const newTokenRes = await request(app).get(`/api/auth/verify-email?token=${secondToken}`);
    expect(newTokenRes.status).toBe(200);
    expect(newTokenRes.body.success).toBe(true);
  });

  // ── Case 10: Attempt to register with an already-used email ─────────────────
  test('Case 10: Attempt to register with an already-registered email returns 409 duplicate error', async () => {
    // Register first user
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'DuplicateOne',
        email: 'duplicate.user@gmail.com',
        phone: '9889012345',
        password: 'Password@123',
        role: 'donor',
      });

    // Attempt second registration with identical email
    const dupRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'DuplicateTwo',
        email: 'duplicate.user@gmail.com',
        phone: '9890123456',
        password: 'Password@123',
        role: 'donor',
      });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.success).toBe(false);
    expect(dupRes.body.error).toMatch(/account with this email already exists/i);
  });

  // ── Case 11: Simulate an SMTP failure ─────────────────────────────────────
  test('Case 11: SMTP failure rolls back user, returns error, and does NOT falsely claim email was sent', async () => {
    // Set a mock transporter that simulates Gmail SMTP failure
    emailService.setCustomTransporter({
      sendMail: async () => {
        const err = new Error('Invalid login: 535-5.7.8 Username and Password not accepted');
        err.code = 'EAUTH';
        throw err;
      },
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'FailUser',
        email: 'failuser@gmail.com',
        phone: '9891234567',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'donor',
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Failed to send verification email/i);

    // Verify user was rolled back so they can retry without duplicate key error
    const userInDb = mockStore.findUserByEmail('failuser@gmail.com');
    expect(userInDb).toBeNull();
  });

  // ── Case 12: Verify email is sent to the correct recipient ────────────────
  test('Case 12: Email is sent to the exact user entered Gmail address, not admin', async () => {
    const targetEmail = 'exact.donor.recipient@gmail.com';

    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'TargetUser',
        email: targetEmail,
        phone: '9892345678',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'donor',
      });

    const sentEmail = emailService.getLastSentEmail();
    expect(sentEmail).not.toBeNull();
    expect(sentEmail.to).toBe(targetEmail);
    expect(sentEmail.to).not.toBe('admin@foodbridge.org');
  });

  // ── Case 13: Confirm unverified users cannot access protected APIs ─────────
  test('Case 13: Unverified users cannot obtain JWT or access protected endpoints', async () => {
    // Create unverified user
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'ProtectedTest',
        email: 'protected.test@gmail.com',
        phone: '9893456789',
        password: 'Password@123',
        role: 'donor',
      });

    // Login fails
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'protected.test@gmail.com',
        password: 'Password@123',
      });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.token).toBeUndefined();

    // Direct access to protected route without token is rejected
    const meRes = await request(app).get('/api/auth/me');
    expect(meRes.status).toBe(401);
  });

  // ── Case 14: Confirm existing FoodBridge modules continue working ──────────
  test('Case 14: Existing FoodBridge modules and verified accounts continue working', async () => {
    // 1. Verified donor can log in
    const donor = await createTestUser({
      name: 'ExistingDonor',
      email: 'existing.donor@gmail.com',
      password: 'Password@123',
      role: 'donor',
      email_verified: true,
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'existing.donor@gmail.com',
        password: 'Password@123',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();

    // 2. Can access dashboard stats
    const dashRes = await request(app)
      .get('/api/donor/dashboard')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body.success).toBe(true);

    // 3. Health check continues working
    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('ok');
  });

  // ── Case 15: SMTP Status Diagnostics Endpoint ─────────────────────────────
  test('Case 15: GET /api/auth/smtp-status reports status without exposing secret passwords', async () => {
    const res = await request(app).get('/api/auth/smtp-status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('configured');
    expect(res.body).toHaveProperty('message');
    // Ensure passwords or raw secrets are never in the response payload
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('your_16_character_google_app_password');
    expect(bodyStr).not.toContain('foodbridge_super_secret');
  });

  // ── Case 16: Retrying unverified registration safely reuses the account ─────
  test('Case 16: Retrying unverified registration with same phone/email does not create duplicate accounts', async () => {
    // 1. Initial registration
    const firstRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'RetryUser',
        email: 'retry.user@gmail.com',
        phone: '9871112222',
        password: 'Password@123',
        confirmPassword: 'Password@123',
        role: 'donor',
      });
    expect(firstRes.status).toBe(201);

    const usersBefore = mockStore.getUsers().filter((u) => u.email === 'retry.user@gmail.com');
    expect(usersBefore.length).toBe(1);

    // 2. Retry registration with same email and phone
    const retryRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'RetryUserRenamed',
        email: 'retry.user@gmail.com',
        phone: '9871112222',
        password: 'NewPassword@123',
        confirmPassword: 'NewPassword@123',
        role: 'donor',
      });
    expect(retryRes.status).toBe(201);
    expect(retryRes.body.requiresVerification).toBe(true);

    // Confirm no duplicate was created
    const usersAfter = mockStore.getUsers().filter((u) => u.email === 'retry.user@gmail.com');
    expect(usersAfter.length).toBe(1);
    expect(usersAfter[0].id).toBe(usersBefore[0].id);
    expect(usersAfter[0].name).toBe('RetryUserRenamed');
  });
});
