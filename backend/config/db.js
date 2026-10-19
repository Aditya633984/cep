'use strict';

/**
 * FoodBridge – Mock Database Adapter
 * Replaces MySQL / mysql2 runtime dependency with an in-memory Mock Data Store.
 * Guarantees zero "connect ECONNREFUSED 127.0.0.1:3306" errors on Vercel and local dev.
 */

const mockStore = require('../services/mockStore');

console.log('📦  FoodBridge running with Mock Data Store (MySQL-free, zero database dependency)');

/**
 * Backwards-compatible query helper in case any legacy code calls pool.query
 */
const mockQuery = async (sql, params = []) => {
  const sqlTrimmed = String(sql).trim();
  const lower = sqlTrimmed.toLowerCase();

  // 1. users
  if (lower.includes('from users')) {
    if (lower.includes('where email = ?') || lower.includes('where email =')) {
      const email = params[0];
      const user = mockStore.findUserByEmail(email);
      return [user ? [user] : []];
    }
    if (lower.includes('where id = ?') || lower.includes('where id =')) {
      const id = params[0];
      const user = mockStore.findUserById(id);
      return [user ? [user] : []];
    }
    if (lower.includes('count(*)')) {
      const allUsers = mockStore.getUsers();
      if (lower.includes("where role='donor'") || lower.includes("where role = 'donor'")) {
        return [[{ total: allUsers.filter(u => u.role === 'donor').length }]];
      }
      return [[{ total: allUsers.length }]];
    }
    return [mockStore.getUsers()];
  }

  // 2. ngo_profiles
  if (lower.includes('from ngo_profiles')) {
    if (lower.includes('where p.user_id = ?') || lower.includes('where user_id = ?')) {
      const userId = params[0];
      const profile = mockStore.findNgoByUserId(userId);
      if (profile) {
        const u = mockStore.findUserById(userId);
        return [[{ ...profile, name: u ? u.name : '', user_email: u ? u.email : '', user_phone: u ? u.phone : '' }]];
      }
      return [[]];
    }
    return [mockStore.getNgoProfiles()];
  }

  // 3. volunteer_profiles
  if (lower.includes('from volunteer_profiles')) {
    if (lower.includes('where user_id = ?') || lower.includes('where vp.user_id = ?')) {
      const userId = params[0];
      const profile = mockStore.findVolunteerByUserId(userId);
      return [profile ? [profile] : []];
    }
    return [mockStore.getVolunteerProfiles()];
  }

  // 4. donations
  if (lower.includes('from donations')) {
    if (lower.includes('where id = ?')) {
      const id = params[0];
      const d = mockStore.findDonationById(id);
      return [d ? [d] : []];
    }
    if (lower.includes('where donor_id = ?')) {
      const donorId = Number(params[0]);
      return [mockStore.getDonations(d => d.donor_id === donorId)];
    }
    return [mockStore.getDonations()];
  }

  // Default empty result set matching mysql2 [rows, fields] signature
  return [[], []];
};

const mockPool = {
  query: mockQuery,
  getConnection: async () => ({
    query: mockQuery,
    release: () => {},
  }),
};

const testConnection = async () => {
  return { success: true, mode: 'mock', message: 'Mock data store is active' };
};

const ensureSchema = async () => {
  return true;
};

module.exports = {
  pool: mockPool,
  testConnection,
  ensureSchema,
  mockStore,
};
