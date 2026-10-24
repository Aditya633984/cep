'use strict';

/**
 * FoodBridge – Mock Data Store Service
 * In-memory state management with realistic fixtures and optional file caching.
 */

const fs   = require('fs');
const path = require('path');
const {
  initialUsers,
  initialNgoProfiles,
  initialVolunteerProfiles,
  initialDonations,
} = require('../data/mockFixtures');

// Determine cache file location (/tmp for serverless, local data folder for dev)
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const cacheFile = isServerless
  ? path.join('/tmp', 'foodbridge_mock_state.json')
  : path.join(__dirname, '..', 'data', 'mockState.json');

// Deep copy helper
const clone = (data) => JSON.parse(JSON.stringify(data));

class MockDataStore {
  constructor() {
    this.users                  = clone(initialUsers);
    this.ngoProfiles            = clone(initialNgoProfiles);
    this.volunteerProfiles      = clone(initialVolunteerProfiles);
    this.donations              = clone(initialDonations);
    this.verificationTokens     = [];
    this.nextUserId             = 100;
    this.nextNgoId              = 100;
    this.nextVolId              = 100;
    this.nextDonationId         = 100;
    this.nextVerificationTokenId = 1;

    this.loadFromCache();
  }

  loadFromCache() {
    if (process.env.NODE_ENV === 'test') return;
    try {
      if (fs.existsSync(cacheFile)) {
        const raw = fs.readFileSync(cacheFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.users && parsed.donations) {
          this.users                  = parsed.users;
          this.ngoProfiles            = parsed.ngoProfiles || this.ngoProfiles;
          this.volunteerProfiles      = parsed.volunteerProfiles || this.volunteerProfiles;
          this.donations              = parsed.donations;
          this.verificationTokens     = parsed.verificationTokens || [];
          this.nextUserId             = parsed.nextUserId || 100;
          this.nextDonationId         = parsed.nextDonationId || 100;
          this.nextVerificationTokenId = parsed.nextVerificationTokenId || 1;
        }
      }
    } catch (e) {
      // Fallback silently to fresh fixtures
    }
  }

  saveToCache() {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const payload = {
        users:                  this.users,
        ngoProfiles:            this.ngoProfiles,
        volunteerProfiles:      this.volunteerProfiles,
        donations:              this.donations,
        verificationTokens:     this.verificationTokens,
        nextUserId:             this.nextUserId,
        nextDonationId:         this.nextDonationId,
        nextVerificationTokenId: this.nextVerificationTokenId,
      };
      fs.writeFileSync(cacheFile, JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {
      // Ignore write errors in restricted environments
    }
  }

  resetToFixtures() {
    this.users                  = clone(initialUsers);
    this.ngoProfiles            = clone(initialNgoProfiles);
    this.volunteerProfiles      = clone(initialVolunteerProfiles);
    this.donations              = clone(initialDonations);
    this.verificationTokens     = [];
    this.nextUserId             = 100;
    this.nextNgoId              = 100;
    this.nextVolId              = 100;
    this.nextDonationId         = 100;
    this.nextVerificationTokenId = 1;
    if (fs.existsSync(cacheFile) && process.env.NODE_ENV !== 'test') {
      try { fs.unlinkSync(cacheFile); } catch (e) {}
    }
  }

  // ─── Users ──────────────────────────────────────────────────────────────────
  getUsers() {
    return clone(this.users);
  }

  findUserById(id) {
    const numId = Number(id);
    return clone(this.users.find((u) => u.id === numId) || null);
  }

  findUserByEmail(email) {
    if (!email) return null;
    const clean = String(email).trim().toLowerCase();
    return clone(this.users.find((u) => u.email.toLowerCase() === clean) || null);
  }

  findUserByPhone(phone) {
    if (!phone) return null;
    const clean = String(phone).trim();
    return clone(this.users.find((u) => u.phone && String(u.phone).trim() === clean) || null);
  }

  findUserByUsername(username) {
    if (!username) return null;
    const clean = String(username).trim().toLowerCase();
    return clone(
      this.users.find(
        (u) =>
          u.email_verified &&
          ((u.username && String(u.username).trim().toLowerCase() === clean) ||
            (u.name && String(u.name).trim().toLowerCase() === clean))
      ) || null
    );
  }

  createUser(userData) {
    const cleanEmail = userData.email.trim().toLowerCase();
    const cleanPhone = userData.phone ? String(userData.phone).trim() : null;

    if (this.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      const err = new Error(`Duplicate entry '${cleanEmail}' for key 'users.email'`);
      err.code = 'ER_DUP_ENTRY';
      throw err;
    }

    if (cleanPhone && this.users.some((u) => u.phone && String(u.phone).trim() === cleanPhone)) {
      const err = new Error(`Duplicate entry '${cleanPhone}' for key 'users.phone'`);
      err.code = 'ER_DUP_ENTRY';
      throw err;
    }

    const newUser = {
      id: this.nextUserId++,
      name: userData.name.trim(),
      username: userData.username ? userData.username.trim() : userData.name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      password: userData.password, // already hashed
      role: userData.role,
      email_verified: Boolean(userData.email_verified),
      email_verified_at: userData.email_verified_at || null,
      created_at: new Date().toISOString(),
    };
    this.users.push(newUser);
    this.saveToCache();
    return clone(newUser);
  }

  deleteUser(id) {
    const numId = Number(id);
    const idx = this.users.findIndex((u) => u.id === numId);
    if (idx !== -1) {
      this.users.splice(idx, 1);
      this.ngoProfiles = this.ngoProfiles.filter((p) => p.user_id !== numId);
      this.volunteerProfiles = this.volunteerProfiles.filter((v) => v.user_id !== numId);
      this.verificationTokens = this.verificationTokens.filter((t) => t.user_id !== numId);
      this.saveToCache();
      return true;
    }
    return false;
  }

  updateUser(id, updates = {}) {
    const numId = Number(id);
    const u = this.users.find((user) => user.id === numId);
    if (!u) return null;
    if (updates.name !== undefined) u.name = String(updates.name).trim();
    if (updates.username !== undefined) u.username = String(updates.username).trim();
    if (updates.phone !== undefined) u.phone = updates.phone ? String(updates.phone).trim() : null;
    if (updates.password !== undefined) u.password = updates.password;
    if (updates.role !== undefined) u.role = updates.role;
    if (updates.email_verified !== undefined) u.email_verified = Boolean(updates.email_verified);
    if (updates.email_verified_at !== undefined) u.email_verified_at = updates.email_verified_at;
    this.saveToCache();
    return clone(u);
  }

  markUserEmailVerified(userId) {
    const numId = Number(userId);
    const u = this.users.find((user) => user.id === numId);
    if (!u) return null;
    u.email_verified = true;
    u.email_verified_at = new Date().toISOString();
    this.saveToCache();
    return clone(u);
  }

  // ─── Verification Tokens ────────────────────────────────────────────────────
  createVerificationToken({ userId, tokenHash, expiresAt }) {
    const tokenRecord = {
      id: this.nextVerificationTokenId++,
      user_id: Number(userId),
      token_hash: tokenHash,
      expires_at: expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt,
      used_at: null,
      created_at: new Date().toISOString(),
    };
    this.verificationTokens.push(tokenRecord);
    this.saveToCache();
    return clone(tokenRecord);
  }

  findTokenByHash(tokenHash) {
    if (!tokenHash) return null;
    const t = this.verificationTokens.find((item) => item.token_hash === tokenHash);
    return clone(t || null);
  }

  markTokenUsed(id) {
    const numId = Number(id);
    const t = this.verificationTokens.find((item) => item.id === numId);
    if (t) {
      t.used_at = new Date().toISOString();
      this.saveToCache();
      return clone(t);
    }
    return null;
  }

  invalidateUserTokens(userId) {
    const numId = Number(userId);
    this.verificationTokens.forEach((t) => {
      if (t.user_id === numId && !t.used_at) {
        t.used_at = new Date().toISOString();
      }
    });
    this.saveToCache();
  }

  // ─── NGO Profiles ───────────────────────────────────────────────────────────
  getNgoProfiles() {
    return clone(this.ngoProfiles);
  }

  findNgoByUserId(userId) {
    const numId = Number(userId);
    return clone(this.ngoProfiles.find((p) => p.user_id === numId) || null);
  }

  findNgoById(id) {
    const numId = Number(id);
    return clone(this.ngoProfiles.find((p) => p.id === numId) || null);
  }

  upsertNgoProfile(userId, data) {
    const numId = Number(userId);
    let p = this.ngoProfiles.find((item) => item.user_id === numId);
    if (p) {
      Object.assign(p, data);
    } else {
      p = {
        id: this.nextNgoId++,
        user_id: numId,
        ngo_name: data.ngo_name || 'NGO Organization',
        founder: data.founder || null,
        address: data.address || null,
        city: data.city || 'Bangalore',
        phone: data.phone || null,
        email: data.email || null,
        food_types: data.food_types || 'Cooked Food',
        operating_area: data.operating_area || null,
        max_food_capacity: parseFloat(data.max_food_capacity) || 100.0,
        is_available: data.is_available !== undefined ? (data.is_available ? 1 : 0) : 1,
        verification_status: data.verification_status || 'verified',
        lat: data.lat || null,
        lng: data.lng || null,
      };
      this.ngoProfiles.push(p);
    }
    this.saveToCache();
    return clone(p);
  }

  toggleNgoAvailability(userId) {
    const numId = Number(userId);
    const p = this.ngoProfiles.find((item) => item.user_id === numId);
    if (!p) return null;
    p.is_available = p.is_available ? 0 : 1;
    this.saveToCache();
    return p.is_available;
  }

  updateNgoVerification(id, status) {
    const numId = Number(id);
    const p = this.ngoProfiles.find((item) => item.id === numId || item.user_id === numId);
    if (!p) return null;
    p.verification_status = status;
    this.saveToCache();
    return clone(p);
  }

  // ─── Volunteer Profiles ─────────────────────────────────────────────────────
  getVolunteerProfiles() {
    return clone(this.volunteerProfiles);
  }

  findVolunteerByUserId(userId) {
    const numId = Number(userId);
    return clone(this.volunteerProfiles.find((v) => v.user_id === numId) || null);
  }

  upsertVolunteerProfile(userId, data) {
    const numId = Number(userId);
    let v = this.volunteerProfiles.find((item) => item.user_id === numId);
    if (v) {
      Object.assign(v, data);
      v.updated_at = new Date().toISOString();
    } else {
      v = {
        id: this.nextVolId++,
        user_id: numId,
        phone: data.phone || null,
        address: data.address || null,
        vehicle_type: data.vehicle_type || 'motorcycle',
        service_area: data.service_area || null,
        availability: data.availability || null,
        lat: data.lat || null,
        lng: data.lng || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.volunteerProfiles.push(v);
    }
    this.saveToCache();
    return clone(v);
  }

  // ─── Donations ──────────────────────────────────────────────────────────────
  getDonations(filterFn) {
    const list = filterFn ? this.donations.filter(filterFn) : this.donations;
    return clone(list);
  }

  findDonationById(id) {
    const numId = Number(id);
    return clone(this.donations.find((d) => d.id === numId) || null);
  }

  createDonation(data) {
    const newDonation = {
      id: this.nextDonationId++,
      donor_id: Number(data.donor_id),
      ngo_id: null,
      volunteer_id: null,
      food_name: data.food_name,
      food_category: data.food_category,
      quantity: parseFloat(data.quantity),
      unit: data.unit || 'kg',
      people_served: parseInt(data.people_served, 10) || null,
      food_type: data.food_type || 'vegetarian',
      preparation_date: data.preparation_date,
      best_before: data.best_before,
      pickup_address: data.pickup_address,
      city: data.city || 'Bangalore',
      description: data.description || null,
      food_image: data.food_image || null,
      pickup_availability: data.pickup_availability || null,
      status: 'POSTED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      lat: data.lat ? parseFloat(data.lat) : null,
      lng: data.lng ? parseFloat(data.lng) : null,
    };
    this.donations.unshift(newDonation);
    this.saveToCache();
    return clone(newDonation);
  }

  updateDonation(id, updates) {
    const numId = Number(id);
    const d = this.donations.find((item) => item.id === numId);
    if (!d) return null;
    Object.assign(d, updates, { updated_at: new Date().toISOString() });
    this.saveToCache();
    return clone(d);
  }

  // ─── Hydrated Donation Helpers ──────────────────────────────────────────────
  hydrateDonation(d) {
    if (!d) return null;
    const donor = this.findUserById(d.donor_id);
    const ngoUser = d.ngo_id ? this.findUserById(d.ngo_id) : null;
    const ngoProf = d.ngo_id ? this.findNgoByUserId(d.ngo_id) : null;
    const volunteerUser = d.volunteer_id ? this.findUserById(d.volunteer_id) : null;

    return {
      ...d,
      donor_name: donor ? donor.name : 'Unknown Donor',
      donor_phone: donor ? donor.phone : '',
      donor_email: donor ? donor.email : '',
      ngo_contact_name: ngoUser ? ngoUser.name : null,
      ngo_phone: ngoProf ? ngoProf.phone : (ngoUser ? ngoUser.phone : null),
      ngo_name: ngoProf ? ngoProf.ngo_name : (ngoUser ? ngoUser.name : null),
      ngo_address: ngoProf ? ngoProf.address : null,
      ngo_city: ngoProf ? ngoProf.city : null,
      volunteer_name: volunteerUser ? volunteerUser.name : null,
      volunteer_phone: volunteerUser ? volunteerUser.phone : null,
    };
  }

  // ─── Dashboard Stats ────────────────────────────────────────────────────────
  getDonorDashboardStats(donorId) {
    const numDonorId = Number(donorId);
    const donor = this.findUserById(numDonorId);
    const donorDonations = this.donations.filter((d) => d.donor_id === numDonorId);

    const counts = { total: donorDonations.length, active: 0, completed: 0, cancelled: 0 };
    const ACTIVE_STATUSES = ['POSTED', 'ACCEPTED', 'VOLUNTEER_ASSIGNED', 'PICKED_UP', 'DELIVERED'];

    let totalFood = 0;
    let totalPeople = 0;

    const monthlyMap = {};
    const catMap = {};
    const foodTimeMap = {};
    const peopleTimeMap = {};

    donorDonations.forEach((d) => {
      if (ACTIVE_STATUSES.includes(d.status)) counts.active++;
      if (d.status === 'COMPLETED') counts.completed++;
      if (d.status === 'CANCELLED') counts.cancelled++;

      if (['COMPLETED', 'DELIVERED'].includes(d.status)) {
        totalFood += parseFloat(d.quantity || 0);
        totalPeople += parseInt(d.people_served || 0, 10);
      }

      const m = (d.created_at || '').slice(0, 7) || '2026-10';
      monthlyMap[m] = (monthlyMap[m] || 0) + 1;

      const cat = d.food_category || 'Other';
      if (!catMap[cat]) catMap[cat] = { count: 0, total_qty: 0 };
      catMap[cat].count++;
      catMap[cat].total_qty += parseFloat(d.quantity || 0);

      if (['COMPLETED', 'DELIVERED'].includes(d.status)) {
        foodTimeMap[m] = (foodTimeMap[m] || 0) + parseFloat(d.quantity || 0);
        peopleTimeMap[m] = (peopleTimeMap[m] || 0) + parseInt(d.people_served || 0, 10);
      }
    });

    const recent = donorDonations
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    const donationsByMonth = Object.keys(monthlyMap).sort().map((month) => ({
      month,
      count: monthlyMap[month],
    }));

    const categoryDist = Object.keys(catMap).map((cat) => ({
      food_category: cat,
      count: catMap[cat].count,
      total_qty: catMap[cat].total_qty,
    }));

    const foodOverTime = Object.keys(foodTimeMap).sort().map((month) => ({
      month,
      total_qty: foodTimeMap[month],
    }));

    const peopleOverTime = Object.keys(peopleTimeMap).sort().map((month) => ({
      month,
      total_people: peopleTimeMap[month],
    }));

    return {
      user: donor,
      stats: {
        total: counts.total,
        active: counts.active,
        completed: counts.completed,
        cancelled: counts.cancelled,
        totalFood: Math.round(totalFood * 100) / 100,
        totalPeople,
      },
      recentDonations: recent,
      chart_data: {
        donations_by_month: donationsByMonth,
        category_distribution: categoryDist,
        food_over_time: foodOverTime,
        people_over_time: peopleOverTime,
      },
    };
  }

  getNgoDashboardStats(ngoId) {
    const numNgoId = Number(ngoId);
    const user = this.findUserById(numNgoId);
    const profile = this.findNgoByUserId(numNgoId);

    const availableCount = this.donations.filter((d) => d.status === 'POSTED').length;
    const acceptedCount = this.donations.filter((d) => d.ngo_id === numNgoId && d.status !== 'CANCELLED').length;
    const receivedDonations = this.donations.filter(
      (d) => d.ngo_id === numNgoId && ['DELIVERED', 'COMPLETED'].includes(d.status)
    );

    const totalFood = receivedDonations.reduce((sum, d) => sum + parseFloat(d.quantity || 0), 0);
    const totalPeople = receivedDonations.reduce((sum, d) => sum + parseInt(d.people_served || 0, 10), 0);

    const recentAccepted = this.donations
      .filter((d) => d.ngo_id === numNgoId)
      .slice()
      .sort((a, b) => new Date(b.accepted_at || b.created_at) - new Date(a.accepted_at || a.created_at))
      .slice(0, 5)
      .map((d) => this.hydrateDonation(d));

    // Charts
    const monthlyMap = {};
    const catMap = {};
    const foodTimeMap = {};
    const peopleTimeMap = {};

    this.donations
      .filter((d) => d.ngo_id === numNgoId)
      .forEach((d) => {
        const m = (d.accepted_at || d.created_at || '').slice(0, 7) || '2026-10';
        monthlyMap[m] = (monthlyMap[m] || 0) + 1;

        const cat = d.food_category || 'Other';
        if (!catMap[cat]) catMap[cat] = { count: 0, total_qty: 0 };
        catMap[cat].count++;
        catMap[cat].total_qty += parseFloat(d.quantity || 0);

        if (['DELIVERED', 'COMPLETED'].includes(d.status)) {
          foodTimeMap[m] = (foodTimeMap[m] || 0) + parseFloat(d.quantity || 0);
          peopleTimeMap[m] = (peopleTimeMap[m] || 0) + parseInt(d.people_served || 0, 10);
        }
      });

    const donationsByMonth = Object.keys(monthlyMap).sort().map((month) => ({
      month,
      count: monthlyMap[month],
    }));

    const categoryDist = Object.keys(catMap).map((cat) => ({
      food_category: cat,
      count: catMap[cat].count,
      total_qty: catMap[cat].total_qty,
    }));

    const foodOverTime = Object.keys(foodTimeMap).sort().map((month) => ({
      month,
      total_qty: foodTimeMap[month],
    }));

    const peopleOverTime = Object.keys(peopleTimeMap).sort().map((month) => ({
      month,
      total_people: peopleTimeMap[month],
    }));

    return {
      user,
      profile,
      stats: {
        available: availableCount,
        accepted: acceptedCount,
        received: receivedDonations.length,
        totalFood: Math.round(totalFood * 100) / 100,
        totalPeople,
      },
      recentAccepted,
      chart_data: {
        donations_by_month: donationsByMonth,
        category_distribution: categoryDist,
        food_over_time: foodOverTime,
        people_over_time: peopleOverTime,
      },
    };
  }

  getVolunteerDashboardStats(volId) {
    const numVolId = Number(volId);
    const user = this.findUserById(numVolId);
    const profile = this.findVolunteerByUserId(numVolId);

    const activeList = this.donations.filter(
      (d) => d.volunteer_id === numVolId && ['VOLUNTEER_ASSIGNED', 'PICKED_UP', 'DELIVERED'].includes(d.status)
    );
    const completedList = this.donations.filter((d) => d.volunteer_id === numVolId && d.status === 'COMPLETED');
    const availablePickups = this.donations.filter((d) => d.status === 'ACCEPTED' && !d.volunteer_id);

    const totalFood = completedList.reduce((sum, d) => sum + parseFloat(d.quantity || 0), 0);
    const totalPeople = completedList.reduce((sum, d) => sum + parseInt(d.people_served || 0, 10), 0);

    return {
      user,
      profile,
      stats: {
        active: activeList.length,
        completed: completedList.length,
        available: availablePickups.length,
        totalFood: Math.round(totalFood * 100) / 100,
        totalPeople,
      },
      available: availablePickups.map((d) => this.hydrateDonation(d)),
      activePickups: activeList.map((d) => this.hydrateDonation(d)),
      completed: completedList.map((d) => this.hydrateDonation(d)),
    };
  }

  getAdminStats() {
    const totalUsers = this.users.length;
    const totalDonors = this.users.filter((u) => u.role === 'donor').length;
    const totalNgos = this.users.filter((u) => u.role === 'ngo').length;
    const totalVolunteers = this.users.filter((u) => u.role === 'volunteer').length;

    const totalDonations = this.donations.length;
    const completedDonations = this.donations.filter((d) => d.status === 'COMPLETED').length;
    const postedDonations = this.donations.filter((d) => d.status === 'POSTED').length;
    const acceptedDonations = this.donations.filter((d) => d.status === 'ACCEPTED').length;
    const assignedDonations = this.donations.filter((d) => d.status === 'VOLUNTEER_ASSIGNED').length;
    const pickedUpDonations = this.donations.filter((d) => d.status === 'PICKED_UP').length;
    const deliveredDonations = this.donations.filter((d) => d.status === 'DELIVERED').length;
    const cancelledDonations = this.donations.filter((d) => d.status === 'CANCELLED').length;

    const activeDonations = postedDonations + acceptedDonations + assignedDonations + pickedUpDonations + deliveredDonations;

    const completedItems = this.donations.filter((d) => d.status === 'COMPLETED');
    const totalKgDonated = completedItems.reduce((sum, d) => sum + parseFloat(d.quantity || 0), 0);
    const totalPeopleServed = completedItems.reduce((sum, d) => sum + parseInt(d.people_served || 0, 10), 0);

    const ngoPending = this.ngoProfiles.filter((p) => p.verification_status === 'pending').length;
    const ngoVerified = this.ngoProfiles.filter((p) => p.verification_status === 'verified').length;
    const ngoRejected = this.ngoProfiles.filter((p) => p.verification_status === 'rejected').length;

    // By status
    const statusMap = {};
    this.donations.forEach((d) => {
      statusMap[d.status] = (statusMap[d.status] || 0) + 1;
    });
    const donByStatus = Object.keys(statusMap).map((st) => ({ status: st, count: statusMap[st] }));

    // Monthly donations
    const monthlyMap = {};
    const catMap = {};
    const foodTimeMap = {};
    this.donations.forEach((d) => {
      const m = (d.created_at || '').slice(0, 7) || '2026-10';
      monthlyMap[m] = (monthlyMap[m] || 0) + 1;

      const cat = d.food_category || 'Other';
      if (!catMap[cat]) catMap[cat] = { count: 0, total_qty: 0 };
      catMap[cat].count++;
      catMap[cat].total_qty += parseFloat(d.quantity || 0);

      if (['COMPLETED', 'DELIVERED'].includes(d.status)) {
        foodTimeMap[m] = (foodTimeMap[m] || 0) + parseFloat(d.quantity || 0);
      }
    });

    const donationsByMonth = Object.keys(monthlyMap).sort().map((month) => ({
      month,
      count: monthlyMap[month],
    }));

    const categoryDist = Object.keys(catMap).map((cat) => ({
      food_category: cat,
      count: catMap[cat].count,
      total_qty: catMap[cat].total_qty,
    }));

    const foodOverTime = Object.keys(foodTimeMap).sort().map((month) => ({
      month,
      total_qty: foodTimeMap[month],
    }));

    const totals = {
      total_users: totalUsers,
      total_donors: totalDonors,
      total_ngos: totalNgos,
      total_volunteers: totalVolunteers,
      total_donations: totalDonations,
      completed_donations: completedDonations,
      posted_donations: postedDonations,
      accepted_donations: acceptedDonations,
      assigned_donations: assignedDonations,
      picked_up_donations: pickedUpDonations,
      delivered_donations: deliveredDonations,
      cancelled_donations: cancelledDonations,
      active_donations: activeDonations,
      total_kg_donated: Math.round(totalKgDonated * 100) / 100,
      total_people_served: totalPeopleServed,
      ngo_pending: ngoPending,
      ngo_verified: ngoVerified,
      ngo_rejected: ngoRejected,
    };

    return {
      ...totals,
      totals,
      donByStatus,
      donationsByMonth,
      categoryDist,
      foodOverTime,
    };
  }

  getPredictionHistory(ngoId, category) {
    const numNgoId = Number(ngoId);
    let rows = this.donations.filter(
      (d) => d.ngo_id === numNgoId && ['COMPLETED', 'DELIVERED'].includes(d.status)
    );
    if (category) {
      rows = rows.filter((d) => d.food_category === category);
    }
    return rows.map((d) => ({
      food_category: d.food_category,
      quantity: d.quantity,
      unit: d.unit,
      people_served: d.people_served || 0,
      received_at: d.received_at || d.accepted_at || d.created_at,
    }));
  }
}

// Singleton instance
const store = new MockDataStore();

module.exports = store;
