'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'foodbridge_super_secret_jwt_key_2024_change_in_production';

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

const resetDatabase = async () => {
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query('TRUNCATE TABLE donations');
  await pool.query('TRUNCATE TABLE ngo_profiles');
  await pool.query('TRUNCATE TABLE volunteer_profiles');
  await pool.query('TRUNCATE TABLE users');
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
};

const createTestUser = async ({
  name = 'Test User',
  email = 'test@example.com',
  password = 'password123',
  role = 'donor',
  phone = '1234567890',
  ngo_name = 'Test NGO',
  food_types = 'Cooked Food, Dry Ration, vegetarian',
  is_available = 1,
  verification_status = 'verified',
  vehicle_type = 'motorcycle',
} = {}) => {
  const hashedPassword = await bcrypt.hash(password, 8);
  const [result] = await pool.query(
    'INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
    [name, email.toLowerCase(), phone, hashedPassword, role]
  );
  const userId = result.insertId;

  if (role === 'ngo') {
    await pool.query(
      `INSERT INTO ngo_profiles (user_id, ngo_name, phone, email, food_types, is_available, verification_status, city, address)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Bangalore', '123 NGO Street')`,
      [userId, ngo_name, phone, email, food_types, is_available ? 1 : 0, verification_status]
    );
  }

  if (role === 'volunteer') {
    await pool.query(
      `INSERT INTO volunteer_profiles (user_id, phone, vehicle_type, service_area, availability)
       VALUES (?, ?, ?, 'Bangalore Central', 'Full-time')`,
      [userId, phone, vehicle_type]
    );
  }

  const user = { id: userId, name, email: email.toLowerCase(), role };
  const token = generateToken(user);

  return { id: userId, user, token, password };
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
  const [res] = await pool.query(
    `INSERT INTO donations (
       donor_id, ngo_id, volunteer_id, food_name, food_category, quantity, unit,
       people_served, food_type, preparation_date, best_before, pickup_address,
       city, description, status, accepted_at, received_at,
       volunteer_assigned_at, picked_up_at, delivered_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      donor_id, ngo_id, volunteer_id, food_name, food_category, quantity, unit,
      people_served, food_type, prep, bb, pickup_address,
      city, description, status,
      accepted_at ? formatDateTime(accepted_at) : (status !== 'POSTED' && status !== 'CANCELLED' ? formatDateTime(new Date()) : null),
      received_at ? formatDateTime(received_at) : (status === 'COMPLETED' ? formatDateTime(new Date()) : null),
      volunteer_assigned_at ? formatDateTime(volunteer_assigned_at) : (['VOLUNTEER_ASSIGNED','PICKED_UP','DELIVERED','COMPLETED'].includes(status) ? formatDateTime(new Date()) : null),
      picked_up_at ? formatDateTime(picked_up_at) : (['PICKED_UP','DELIVERED','COMPLETED'].includes(status) ? formatDateTime(new Date()) : null),
      delivered_at ? formatDateTime(delivered_at) : (['DELIVERED','COMPLETED'].includes(status) ? formatDateTime(new Date()) : null),
    ]
  );
  return res.insertId;
};

const closeDatabase = async () => {
  try {
    await pool.end();
  } catch {
    // Ignore if already closed
  }
};

module.exports = {
  resetDatabase,
  createTestUser,
  createTestDonation,
  generateToken,
  formatDate,
  formatDateTime,
  closeDatabase,
  pool,
};
