'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mockStore = require('../services/mockStore');
const {
  initialUsers,
  initialNgoProfiles,
  initialVolunteerProfiles,
  initialDonations,
} = require('../data/mockFixtures');

const JWT_SECRET = process.env.JWT_SECRET || 'foodbridge_demo_jwt_secret_key_2026';

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
};

const formatDate = (d) => {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10);
};

const formatDateTime = (d) => {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

let testPhoneCounter = 9870000000;

const resetDatabase = async () => {
  mockStore.users = [];
  mockStore.ngoProfiles = [];
  mockStore.volunteerProfiles = [];
  mockStore.donations = [];
  mockStore.verificationTokens = [];
  mockStore.nextUserId = 1;
  mockStore.nextDonationId = 1;
  mockStore.nextVerificationTokenId = 1;
  testPhoneCounter = 9870000000;
};

const createTestUser = async ({
  name = 'Test User',
  email = 'test@example.com',
  password = 'password123',
  role = 'donor',
  phone,
  email_verified = true,
  ngo_name = 'Test NGO',
  food_types = 'Cooked Food, Dry Ration, vegetarian',
  is_available = 1,
  verification_status = 'verified',
  vehicle_type = 'motorcycle',
} = {}) => {
  const hashedPassword = await bcrypt.hash(password, 8);
  const userPhone = phone !== undefined ? phone : String(testPhoneCounter++);
  const user = mockStore.createUser({
    name,
    email: email.toLowerCase(),
    phone: userPhone,
    password: hashedPassword,
    role,
    email_verified,
    email_verified_at: email_verified ? new Date().toISOString() : null,
  });

  if (role === 'ngo') {
    mockStore.upsertNgoProfile(user.id, {
      ngo_name,
      phone,
      email,
      food_types,
      is_available: is_available ? 1 : 0,
      verification_status,
      city: 'Bangalore',
      address: '123 NGO Street',
      lat: 12.9784,
      lng: 77.6408,
    });
  }

  if (role === 'volunteer') {
    mockStore.upsertVolunteerProfile(user.id, {
      phone,
      vehicle_type,
      service_area: 'Bangalore Central',
      availability: 'Full-time',
      lat: 12.9719,
      lng: 77.6412,
    });
  }

  const token = generateToken(user);
  return { id: user.id, user, token, password };
};

const createTestDonation = async ({
  donor_id,
  ngo_id = null,
  volunteer_id = null,
  food_name = 'Test Meal',
  food_category = 'Cooked Food',
  quantity = 10,
  unit = 'kg',
  people_served = 25,
  food_type = 'vegetarian',
  preparation_date = null,
  best_before = null,
  pickup_address = '123 Main St',
  city = 'Bangalore',
  status = 'POSTED',
  description = 'Test description',
  accepted_at = null,
  received_at = null,
  volunteer_assigned_at = null,
  picked_up_at = null,
  delivered_at = null,
} = {}) => {
  const prep = preparation_date ? formatDate(preparation_date) : formatDate(new Date());
  const bb = best_before ? formatDateTime(best_before) : formatDateTime(new Date(Date.now() + 24 * 3600 * 1000));

  const donation = mockStore.createDonation({
    donor_id,
    food_name,
    food_category,
    quantity,
    unit,
    people_served,
    food_type,
    preparation_date: prep,
    best_before: bb,
    pickup_address,
    city,
    description,
    lat: 12.9750,
    lng: 77.6095,
  });

  // Update status and timestamps if not POSTED
  if (status !== 'POSTED') {
    mockStore.updateDonation(donation.id, {
      status,
      ngo_id,
      volunteer_id,
      accepted_at: accepted_at ? formatDateTime(accepted_at) : (status !== 'POSTED' && status !== 'CANCELLED' ? formatDateTime(new Date()) : null),
      received_at: received_at ? formatDateTime(received_at) : (status === 'COMPLETED' ? formatDateTime(new Date()) : null),
      volunteer_assigned_at: volunteer_assigned_at ? formatDateTime(volunteer_assigned_at) : (['VOLUNTEER_ASSIGNED','PICKED_UP','DELIVERED','COMPLETED'].includes(status) ? formatDateTime(new Date()) : null),
      picked_up_at: picked_up_at ? formatDateTime(picked_up_at) : (['PICKED_UP','DELIVERED','COMPLETED'].includes(status) ? formatDateTime(new Date()) : null),
      delivered_at: delivered_at ? formatDateTime(delivered_at) : (['DELIVERED','COMPLETED'].includes(status) ? formatDateTime(new Date()) : null),
    });
  }

  return donation.id;
};

const mockQuery = async (sql, params = []) => {
  const s = String(sql).trim();
  const lower = s.toLowerCase();

  // SELECT from donations WHERE id = ?
  if (lower.startsWith('select') && lower.includes('from donations') && lower.includes('where id = ?')) {
    const id = Number(params[0]);
    const d = mockStore.donations.find((item) => Number(item.id) === id);
    return d ? [[{ ...d }], []] : [[], []];
  }

  // SELECT from ngo_profiles WHERE user_id = ?
  if (lower.startsWith('select') && lower.includes('from ngo_profiles') && lower.includes('where user_id = ?')) {
    const userId = Number(params[0]);
    const p = mockStore.ngoProfiles.find((item) => Number(item.user_id) === userId);
    return p ? [[{ ...p }], []] : [[], []];
  }

  // SELECT password FROM users WHERE id = ?
  if (lower.startsWith('select') && lower.includes('from users') && lower.includes('where id = ?')) {
    const id = Number(params[0]);
    const u = mockStore.users.find((item) => Number(item.id) === id);
    return u ? [[{ ...u }], []] : [[], []];
  }

  // UPDATE donations SET ... WHERE id = ?
  if (lower.startsWith('update donations set')) {
    const id = Number(params[params.length - 1]);
    const d = mockStore.donations.find((item) => Number(item.id) === id);
    if (d) {
      if (lower.includes("status = 'picked_up'")) {
        d.status = 'PICKED_UP';
        d.picked_up_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
      }
      if (lower.includes("status = 'completed'")) {
        d.status = 'COMPLETED';
        d.received_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
      }
      if (lower.includes("status = 'cancelled'")) {
        d.status = 'CANCELLED';
      }
    }
    return [{ affectedRows: 1 }, []];
  }

  // UPDATE ngo_profiles SET ... WHERE user_id = ?
  if (lower.startsWith('update ngo_profiles set')) {
    const userId = Number(params[params.length - 1]);
    const p = mockStore.ngoProfiles.find((item) => Number(item.user_id) === userId);
    if (p) {
      if (lower.includes('city = ?')) {
        const city = params[0];
        p.city = city;
        if (String(city).toLowerCase() === 'mumbai') {
          p.lat = 19.0760;
          p.lng = 72.8777;
        } else if (String(city).toLowerCase() === 'bangalore') {
          p.lat = 12.9784;
          p.lng = 77.6408;
        }
      }
      if (lower.includes('is_available = 0') || lower.includes('is_available = ?')) {
        p.is_available = lower.includes('is_available = 0') ? 0 : Number(params[0]);
      }
      if (lower.includes("verification_status = 'rejected'")) {
        p.verification_status = 'rejected';
      } else if (lower.includes("verification_status = 'verified'")) {
        p.verification_status = 'verified';
      } else if (lower.includes("verification_status = ?")) {
        p.verification_status = params[0];
      }
    }
    return [{ affectedRows: 1 }, []];
  }

  return [[], []];
};

const closeDatabase = async () => {};

module.exports = {
  resetDatabase,
  createTestUser,
  createTestDonation,
  generateToken,
  formatDate,
  formatDateTime,
  closeDatabase,
  pool: { query: mockQuery },
};
