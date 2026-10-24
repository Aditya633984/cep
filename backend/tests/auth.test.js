'use strict';

const request = require('supertest');
const app = require('../server');
const { resetDatabase, createTestUser, generateToken } = require('./testHelper');

describe('Authentication & Authorization Suite', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe('Registration & Input Validation Requirements (14 Test Cases)', () => {
    // ── Case 1: Alphabet-only username is accepted ───────────────────────────
    test('1. Alphabet-only username is accepted', async () => {
      const validUsernames = ['Aditya', 'Rahul', 'FoodBridge'];
      let phoneNum = 9876543210;

      for (const username of validUsernames) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username,
            email: `${username.toLowerCase()}@gmail.com`,
            phone: String(phoneNum++),
            password: 'securepassword123',
            confirmPassword: 'securepassword123',
            role: 'donor',
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.name).toBe(username);
      }
    });

    // ── Case 2: Username containing numbers is rejected ─────────────────────
    test('2. Username containing numbers is rejected', async () => {
      const invalidWithNumbers = ['Aditya123', 'Rahul99', '12345'];

      for (const username of invalidWithNumbers) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username,
            email: 'validuser@gmail.com',
            phone: '9876543210',
            password: 'securepassword123',
            role: 'donor',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe(
          'Username must contain only alphabet letters. Numbers, spaces and special characters are not allowed.'
        );
      }
    });

    // ── Case 3: Username containing spaces is rejected ──────────────────────
    test('3. Username containing spaces is rejected', async () => {
      const invalidWithSpaces = ['Rahul Sharma', ' Aditya', 'Food Bridge ', 'Jane Donor'];

      for (const username of invalidWithSpaces) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username,
            email: 'validuser@gmail.com',
            phone: '9876543210',
            password: 'securepassword123',
            role: 'donor',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe(
          'Username must contain only alphabet letters. Numbers, spaces and special characters are not allowed.'
        );
      }
    });

    // ── Case 4: Valid 10-digit Indian mobile number is accepted ─────────────
    test('4. Valid 10-digit Indian mobile number is accepted', async () => {
      // Starting with 6, 7, 8, 9
      const validPhones = ['9876543210', '8765432109', '7654321098', '6543210987'];

      for (let i = 0; i < validPhones.length; i++) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: `ValidUser${String.fromCharCode(65 + i)}`,
            email: `user${i}@gmail.com`,
            phone: validPhones[i],
            password: 'securepassword123',
            role: 'donor',
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.user.phone).toBe(validPhones[i]);
      }
    });

    // ── Case 5: Phone number containing letters or symbols is rejected ──────
    test('5. Phone number containing letters or symbols is rejected', async () => {
      const invalidPhonesWithSymbols = [
        '98765abc10',
        '+919876543210',
        '98765-43210',
        '98765 43210',
        '98765@3210',
      ];

      for (const phone of invalidPhonesWithSymbols) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'Aditya',
            email: 'aditya@gmail.com',
            phone,
            password: 'securepassword123',
            role: 'donor',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe(
          'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.'
        );
      }
    });

    // ── Case 6: Phone number with fewer or more than 10 digits is rejected ──
    test('6. Phone number with fewer or more than 10 digits is rejected', async () => {
      const wrongLengthPhones = [
        '12345',          // 5 digits
        '98765',          // 5 digits
        '987654321',      // 9 digits
        '98765432101',    // 11 digits
        '5876543210',     // 10 digits but starts with 5 (not 6, 7, 8, or 9)
      ];

      for (const phone of wrongLengthPhones) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'Aditya',
            email: 'aditya@gmail.com',
            phone,
            password: 'securepassword123',
            role: 'donor',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe(
          'Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.'
        );
      }
    });

    // ── Case 7: Valid @gmail.com address is accepted ─────────────────────────
    test('7. Valid @gmail.com address is accepted', async () => {
      const validEmails = [
        'aditya@gmail.com',
        'rahul123@gmail.com',
        'food.bridge@gmail.com',
        '  trimmed@gmail.com  ', // normalized by trimming
      ];
      const validNames = ['AdityaUser', 'RahulUser', 'BridgeUser', 'TrimmedUser'];
      let phoneNum = 9811223300;

      for (let i = 0; i < validEmails.length; i++) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: validNames[i],
            email: validEmails[i],
            phone: String(phoneNum++),
            password: 'securepassword123',
            role: 'donor',
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.user.email).toBe(validEmails[i].trim().toLowerCase());
      }
    });

    // ── Case 8: Non-Gmail address is rejected ────────────────────────────────
    test('8. Non-Gmail address is rejected', async () => {
      const nonGmailAddresses = [
        'aditya@yahoo.com',
        'rahul@gmail',
        'user@outlook.com',
        'custom@foodbridge.org',
        'aditya@gmail.com.in',
      ];

      for (const email of nonGmailAddresses) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'Aditya',
            email,
            phone: '9876543210',
            password: 'securepassword123',
            role: 'donor',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('Enter a valid Gmail address ending with @gmail.com.');
      }
    });

    // ── Case 9: Missing Gmail username is rejected ───────────────────────────
    test('9. Missing Gmail username is rejected', async () => {
      const missingUsernames = ['@gmail.com', '  @gmail.com'];

      for (const email of missingUsernames) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'Aditya',
            email,
            phone: '9876543210',
            password: 'securepassword123',
            role: 'donor',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe('Enter a valid Gmail address ending with @gmail.com.');
      }
    });

    // ── Case 10: Password shorter than 8 characters is rejected ──────────────
    test('10. Password shorter than 8 characters is rejected', async () => {
      const shortPasswords = ['123', 'pass', '1234567'];

      for (const password of shortPasswords) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'Aditya',
            email: 'aditya@gmail.com',
            phone: '9876543210',
            password,
            role: 'donor',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/Password must be at least 8 characters/i);
      }
    });

    // ── Case 11: Mismatched confirmation password is rejected ────────────────
    test('11. Mismatched confirmation password is rejected', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'Aditya',
          email: 'aditya@gmail.com',
          phone: '9876543210',
          password: 'securepassword123',
          confirmPassword: 'differentpassword456',
          role: 'donor',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Passwords do not match.');
    });

    // ── Case 12: Duplicate email and phone numbers are rejected ──────────────
    test('12. Duplicate email and phone numbers are rejected', async () => {
      // Register initial user
      const initial = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'FirstUser',
          email: 'firstuser@gmail.com',
          phone: '9876543210',
          password: 'securepassword123',
          role: 'donor',
        });
      expect(initial.status).toBe(201);

      // Attempt registration with duplicate email (different phone)
      const dupEmailRes = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'SecondUser',
          email: 'firstuser@gmail.com',
          phone: '9876543211',
          password: 'securepassword123',
          role: 'donor',
        });
      expect(dupEmailRes.status).toBe(409);
      expect(dupEmailRes.body.success).toBe(false);
      expect(dupEmailRes.body.error).toMatch(/email already exists/i);

      // Attempt registration with duplicate phone (different email)
      const dupPhoneRes = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'ThirdUser',
          email: 'thirduser@gmail.com',
          phone: '9876543210',
          password: 'securepassword123',
          role: 'donor',
        });
      expect(dupPhoneRes.status).toBe(409);
      expect(dupPhoneRes.body.success).toBe(false);
      expect(dupPhoneRes.body.error).toMatch(/phone number already exists/i);
    });

    // ── Case 13: Invalid data submitted directly to the backend is rejected ──
    test('13. Invalid data submitted directly to the backend is rejected', async () => {
      // 13a. Missing username
      const resNoUsername = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'aditya@gmail.com',
          phone: '9876543210',
          password: 'securepassword123',
          role: 'donor',
        });
      expect(resNoUsername.status).toBe(400);
      expect(resNoUsername.body.error).toMatch(/Username must contain only alphabet letters/i);

      // 13b. Username with special characters
      const resSpecialChar = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'Aditya@',
          email: 'aditya@gmail.com',
          phone: '9876543210',
          password: 'securepassword123',
          role: 'donor',
        });
      expect(resSpecialChar.status).toBe(400);
      expect(resSpecialChar.body.error).toMatch(/Username must contain only alphabet letters/i);

      // 13c. Missing phone
      const resNoPhone = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'Aditya',
          email: 'aditya@gmail.com',
          password: 'securepassword123',
          role: 'donor',
        });
      expect(resNoPhone.status).toBe(400);
      expect(resNoPhone.body.error).toMatch(/Enter a valid 10-digit Indian mobile number/i);

      // 13d. Admin role attempt directly via API
      const resAdminEscalation = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'AdminHacker',
          email: 'adminhacker@gmail.com',
          phone: '9876543210',
          password: 'securepassword123',
          role: 'admin',
        });
      expect(resAdminEscalation.status).toBe(403);
      expect(resAdminEscalation.body.error).toMatch(/Admin registration is not permitted/i);

      // 13e. Invalid role
      const resInvalidRole = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'Aditya',
          email: 'aditya@gmail.com',
          phone: '9876543210',
          password: 'securepassword123',
          role: 'superman',
        });
      expect(resInvalidRole.status).toBe(400);
      expect(resInvalidRole.body.error).toMatch(/Invalid role/i);
    });

    // ── Case 14: Valid registration and login work correctly ─────────────────
    test('14. Valid registration and login work correctly', async () => {
      // Register
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'Aditya',
          email: 'aditya@gmail.com',
          phone: '9876543210',
          password: 'ValidPassword123',
          confirmPassword: 'ValidPassword123',
          role: 'donor',
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.success).toBe(true);
      expect(regRes.body.token).toBeDefined();
      expect(regRes.body.user.name).toBe('Aditya');
      expect(regRes.body.user.email).toBe('aditya@gmail.com');
      expect(regRes.body.user.password).toBeUndefined(); // no password exposed

      // Immediately log in with registered credentials (no email verification required)
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'aditya@gmail.com',
          password: 'ValidPassword123',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.token).toBeDefined();
      expect(loginRes.body.user.email).toBe('aditya@gmail.com');
      expect(loginRes.body.user.password).toBeUndefined();
      expect(loginRes.body.user.email).toBe('aditya@gmail.com');
      expect(loginRes.body.user.password).toBeUndefined();

      // Login fails with wrong password
      const badPassRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'aditya@gmail.com',
          password: 'WrongPassword999',
        });

      expect(badPassRes.status).toBe(401);
      expect(badPassRes.body.success).toBe(false);
      expect(badPassRes.body.error).toBe('Invalid email or password.');

      // Authenticated access with token
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.user.email).toBe('aditya@gmail.com');
      expect(meRes.body.user.password).toBeUndefined();
    });
  });

  describe('Role-Specific Registrations', () => {
    test('successfully registers an NGO with profile', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'FeedingHope',
          email: 'feedinghope@gmail.com',
          phone: '9844556677',
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

    test('fails NGO registration if ngo_name is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'NgoUser',
          email: 'nongoname@gmail.com',
          phone: '9844556688',
          password: 'securepassword123',
          role: 'ngo',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/NGO Name is required/i);
    });

    test('successfully registers a volunteer', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'BobVolunteer',
          email: 'bobvolunteer@gmail.com',
          phone: '9877889900',
          password: 'securepassword123',
          role: 'volunteer',
          vehicle_type: 'van',
          service_area: 'Indiranagar',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.role).toBe('volunteer');
    });
  });

  describe('Login Validation & Error Handling', () => {
    test('fails login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@gmail.com',
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid email or password.');
    });

    test('fails login with missing fields', async () => {
      const res1 = await request(app).post('/api/auth/login').send({});
      expect(res1.status).toBe(400);
      expect(res1.body.error).toMatch(/Email and password are required/i);

      const res2 = await request(app).post('/api/auth/login').send({ email: 'test@gmail.com' });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toMatch(/Email and password are required/i);
    });
  });

  describe('JWT and Role-Based Authorization', () => {
    test('allows authenticated user to access /api/auth/me', async () => {
      const { user, token } = await createTestUser({ email: 'donor@gmail.com', role: 'donor' });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('donor@gmail.com');
    });

    test('rejects request without token (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/No token provided/i);
    });

    test('rejects request with invalid token (401 Unauthorized)', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.signature');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid token/i);
    });

    test('enforces role-based authorization: donor cannot access admin endpoint', async () => {
      const { token } = await createTestUser({ email: 'donor@gmail.com', role: 'donor' });

      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Access denied/i);
    });

    test('enforces role-based authorization: volunteer cannot access NGO dashboard', async () => {
      const { token } = await createTestUser({ email: 'vol@gmail.com', role: 'volunteer' });

      const res = await request(app)
        .get('/api/ngo/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Access denied/i);
    });
  });
});
