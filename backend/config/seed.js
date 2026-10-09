'use strict';
/**
 * FoodBridge – Database Seeder
 * Populates realistic seed data for development, testing, and demonstration.
 * Run with: npm run seed
 */

const bcrypt = require('bcryptjs');
const { pool, testConnection } = require('./db');

async function seed() {
  console.log('🌱 Starting FoodBridge database seeding...');
  await testConnection();

  const conn = await pool.getConnection();

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE donations');
    await conn.query('TRUNCATE TABLE ngo_profiles');
    await conn.query('TRUNCATE TABLE volunteer_profiles');
    await conn.query('TRUNCATE TABLE users');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('🧹 Cleaned existing tables.');

    // ── 1. Create Users ────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash('Password@123', 10);
    const adminPasswordHash = await bcrypt.hash('Admin@12345', 10);

    // Admin
    const [adminRes] = await conn.query(
      `INSERT INTO users (name, email, phone, password, role)
       VALUES (?, ?, ?, ?, ?)`,
      ['Platform Admin', 'admin@foodbridge.org', '9900112233', adminPasswordHash, 'admin']
    );
    const adminId = adminRes.insertId;

    // Donors
    const [donor1Res] = await conn.query(
      `INSERT INTO users (name, email, phone, password, role)
       VALUES (?, ?, ?, ?, ?)`,
      ['Grand Plaza Hotel', 'donor@foodbridge.org', '9811223344', passwordHash, 'donor']
    );
    const donor1Id = donor1Res.insertId;

    const [donor2Res] = await conn.query(
      `INSERT INTO users (name, email, phone, password, role)
       VALUES (?, ?, ?, ?, ?)`,
      ['Green Leaf Bakery', 'bakery@foodbridge.org', '9822334455', passwordHash, 'donor']
    );
    const donor2Id = donor2Res.insertId;

    // NGOs
    const [ngo1Res] = await conn.query(
      `INSERT INTO users (name, email, phone, password, role)
       VALUES (?, ?, ?, ?, ?)`,
      ['Feeding Hope Foundation', 'ngo@hope.org', '9844556677', passwordHash, 'ngo']
    );
    const ngo1Id = ngo1Res.insertId;

    const [ngo2Res] = await conn.query(
      `INSERT INTO users (name, email, phone, password, role)
       VALUES (?, ?, ?, ?, ?)`,
      ['City Care Shelter', 'ngo@citycare.org', '9855667788', passwordHash, 'ngo']
    );
    const ngo2Id = ngo2Res.insertId;

    const [ngo3Res] = await conn.query(
      `INSERT INTO users (name, email, phone, password, role)
       VALUES (?, ?, ?, ?, ?)`,
      ['New Light Trust', 'ngo@newlight.org', '9866778899', passwordHash, 'ngo']
    );
    const ngo3Id = ngo3Res.insertId;

    // Volunteers
    const [vol1Res] = await conn.query(
      `INSERT INTO users (name, email, phone, password, role)
       VALUES (?, ?, ?, ?, ?)`,
      ['Alex Courier', 'volunteer@foodbridge.org', '9877889900', passwordHash, 'volunteer']
    );
    const vol1Id = vol1Res.insertId;

    const [vol2Res] = await conn.query(
      `INSERT INTO users (name, email, phone, password, role)
       VALUES (?, ?, ?, ?, ?)`,
      ['Sam Driver', 'sam@foodbridge.org', '9888990011', passwordHash, 'volunteer']
    );
    const vol2Id = vol2Res.insertId;

    console.log('👤 Users seeded successfully.');

    // ── 2. Create NGO Profiles ────────────────────────────────────────────────
    await conn.query(
      `INSERT INTO ngo_profiles (user_id, ngo_name, founder, address, city, phone, email, food_types, operating_area, max_food_capacity, is_available, verification_status, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ngo1Id,
        'Feeding Hope Foundation',
        'Dr. Priya Sharma',
        '42 Kindness Lane, Indiranagar',
        'Bangalore',
        '9844556677',
        'ngo@hope.org',
        'Cooked Food, Packaged Food, Fruits, Vegetables, Dairy',
        'Indiranagar, Koramangala, CBD',
        250.00,
        1,
        'verified',
        12.9784,
        77.6408,
      ]
    );

    await conn.query(
      `INSERT INTO ngo_profiles (user_id, ngo_name, founder, address, city, phone, email, food_types, operating_area, max_food_capacity, is_available, verification_status, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ngo2Id,
        'City Care Shelter',
        'Rahul Deshmukh',
        '108 Hope Road, Koramangala',
        'Bangalore',
        '9855667788',
        'ngo@citycare.org',
        'Cooked Food, Dry Ration, Bakery Items',
        'Koramangala, BTM Layout, HSR Layout',
        150.00,
        1,
        'verified',
        12.9352,
        77.6245,
      ]
    );

    await conn.query(
      `INSERT INTO ngo_profiles (user_id, ngo_name, founder, address, city, phone, email, food_types, operating_area, max_food_capacity, is_available, verification_status, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ngo3Id,
        'New Light Trust',
        'Ananya Sen',
        '7 Sunrise Boulevard, Whitefield',
        'Bangalore',
        '9866778899',
        'ngo@newlight.org',
        'Dry Ration, Packaged Food, Fruits',
        'Whitefield, Marathahalli',
        100.00,
        1,
        'pending',
        12.9698,
        77.7500,
      ]
    );

    console.log('🏢 NGO profiles seeded.');

    // ── 3. Create Volunteer Profiles ──────────────────────────────────────────
    await conn.query(
      `INSERT INTO volunteer_profiles (user_id, phone, address, vehicle_type, service_area, availability, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vol1Id,
        '9877889900',
        '15 Metro View, Indiranagar',
        'motorcycle',
        'Indiranagar, Koramangala, Central Bangalore',
        'Weekdays 10 AM - 8 PM',
        12.9719,
        77.6412,
      ]
    );

    await conn.query(
      `INSERT INTO volunteer_profiles (user_id, phone, address, vehicle_type, service_area, availability, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vol2Id,
        '9888990011',
        '88 Ring Road, HSR Layout',
        'van',
        'Koramangala, HSR Layout, Bellandur',
        'All days, morning & evening',
        12.9121,
        77.6446,
      ]
    );

    console.log('🚗 Volunteer profiles seeded.');

    // ── 4. Create Seed Donations across Lifecycle ─────────────────────────────
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const plus1Day = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const plus2Days = new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const plus6Hours = new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const pastTime = new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const pastYesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const past3Days = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const past6Days = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    const sampleDonations = [
      {
        donor_id: donor1Id,
        ngo_id: null,
        volunteer_id: null,
        food_name: 'Buffet Surplus - Veg Biryani & Curries',
        food_category: 'Cooked Food',
        quantity: 25.0,
        unit: 'kg',
        people_served: 60,
        food_type: 'vegetarian',
        preparation_date: today,
        best_before: plus6Hours,
        pickup_address: 'Grand Plaza Hotel, MG Road',
        city: 'Bangalore',
        description: 'Freshly prepared executive lunch buffet surplus. Packed in food-grade thermal containers.',
        status: 'POSTED',
        lat: 12.9750,
        lng: 77.6095,
      },
      {
        donor_id: donor2Id,
        ngo_id: null,
        volunteer_id: null,
        food_name: 'Assorted Fresh Breads & Baguettes',
        food_category: 'Bakery Items',
        quantity: 15.0,
        unit: 'kg',
        people_served: 40,
        food_type: 'vegetarian',
        preparation_date: today,
        best_before: plus2Days,
        pickup_address: 'Green Leaf Bakery, 100ft Road, Indiranagar',
        city: 'Bangalore',
        description: 'Artisan whole wheat loaves and baguettes baked today morning.',
        status: 'POSTED',
        lat: 12.9780,
        lng: 77.6410,
      },
      {
        donor_id: donor1Id,
        ngo_id: ngo1Id,
        volunteer_id: null,
        food_name: 'Steamed Rice, Dal Makhani & Roti',
        food_category: 'Cooked Food',
        quantity: 30.0,
        unit: 'kg',
        people_served: 75,
        food_type: 'vegetarian',
        preparation_date: today,
        best_before: plus1Day,
        pickup_address: 'Grand Plaza Hotel, MG Road',
        city: 'Bangalore',
        description: 'Banquet dinner surplus prepared under hygienic conditions.',
        status: 'ACCEPTED',
        accepted_at: pastTime,
        lat: 12.9750,
        lng: 77.6095,
      },
      {
        donor_id: donor1Id,
        ngo_id: ngo1Id,
        volunteer_id: vol1Id,
        food_name: 'Mixed Seasonal Fruits Box',
        food_category: 'Fruits',
        quantity: 20.0,
        unit: 'kg',
        people_served: 50,
        food_type: 'vegetarian',
        preparation_date: today,
        best_before: plus2Days,
        pickup_address: 'Grand Plaza Hotel, MG Road',
        city: 'Bangalore',
        description: 'Apples, oranges, and bananas from morning breakfast service.',
        status: 'VOLUNTEER_ASSIGNED',
        accepted_at: pastTime,
        volunteer_assigned_at: pastTime,
        lat: 12.9750,
        lng: 77.6095,
      },
      {
        donor_id: donor2Id,
        ngo_id: ngo2Id,
        volunteer_id: vol2Id,
        food_name: 'Fresh Muffins & Buns',
        food_category: 'Bakery Items',
        quantity: 12.0,
        unit: 'kg',
        people_served: 35,
        food_type: 'vegetarian',
        preparation_date: today,
        best_before: plus1Day,
        pickup_address: 'Green Leaf Bakery, Indiranagar',
        city: 'Bangalore',
        description: 'Packaged boxes of assorted sweet and savoury bakery items.',
        status: 'PICKED_UP',
        accepted_at: pastTime,
        volunteer_assigned_at: pastTime,
        picked_up_at: pastTime,
        lat: 12.9780,
        lng: 77.6410,
      },
      {
        donor_id: donor1Id,
        ngo_id: ngo2Id,
        volunteer_id: vol1Id,
        food_name: 'Paneer Butter Masala & Pulao',
        food_category: 'Cooked Food',
        quantity: 18.0,
        unit: 'kg',
        people_served: 45,
        food_type: 'vegetarian',
        preparation_date: today,
        best_before: plus6Hours,
        pickup_address: 'Grand Plaza Hotel, MG Road',
        city: 'Bangalore',
        description: 'High quality catered food delivered to City Care Shelter entrance.',
        status: 'DELIVERED',
        accepted_at: pastTime,
        volunteer_assigned_at: pastTime,
        picked_up_at: pastTime,
        delivered_at: pastTime,
        lat: 12.9750,
        lng: 77.6095,
      },
      {
        donor_id: donor1Id,
        ngo_id: ngo1Id,
        volunteer_id: vol1Id,
        food_name: 'Dinner Buffet Meal Packs',
        food_category: 'Cooked Food',
        quantity: 40.0,
        unit: 'kg',
        people_served: 100,
        food_type: 'vegetarian',
        preparation_date: today,
        best_before: plus1Day,
        pickup_address: 'Grand Plaza Hotel, MG Road',
        city: 'Bangalore',
        description: 'Complete wholesome meal packs distributed to shelter residents.',
        status: 'COMPLETED',
        accepted_at: pastYesterday,
        volunteer_assigned_at: pastYesterday,
        picked_up_at: pastYesterday,
        delivered_at: pastYesterday,
        received_at: pastYesterday,
        lat: 12.9750,
        lng: 77.6095,
      },
      {
        donor_id: donor1Id,
        ngo_id: ngo1Id,
        volunteer_id: vol1Id,
        food_name: 'Steamed Rice & Lentil Curry',
        food_category: 'Cooked Food',
        quantity: 35.0,
        unit: 'kg',
        people_served: 90,
        food_type: 'vegetarian',
        preparation_date: past3Days.slice(0, 10),
        best_before: past3Days,
        pickup_address: 'Grand Plaza Hotel, MG Road',
        city: 'Bangalore',
        description: 'Hygienic fresh cooked meal trays distributed.',
        status: 'COMPLETED',
        accepted_at: past3Days,
        volunteer_assigned_at: past3Days,
        picked_up_at: past3Days,
        delivered_at: past3Days,
        received_at: past3Days,
        lat: 12.9750,
        lng: 77.6095,
      },
      {
        donor_id: donor1Id,
        ngo_id: ngo1Id,
        volunteer_id: vol1Id,
        food_name: 'Community Lunch - Chana & Poori',
        food_category: 'Cooked Food',
        quantity: 30.0,
        unit: 'kg',
        people_served: 80,
        food_type: 'vegetarian',
        preparation_date: past6Days.slice(0, 10),
        best_before: past6Days,
        pickup_address: 'Grand Plaza Hotel, MG Road',
        city: 'Bangalore',
        description: 'Nutritious cooked lunch meal trays delivered.',
        status: 'COMPLETED',
        accepted_at: past6Days,
        volunteer_assigned_at: past6Days,
        picked_up_at: past6Days,
        delivered_at: past6Days,
        received_at: past6Days,
        lat: 12.9750,
        lng: 77.6095,
      },
    ];

    for (const d of sampleDonations) {
      await conn.query(
        `INSERT INTO donations (
          donor_id, ngo_id, volunteer_id, food_name, food_category,
          quantity, unit, people_served, food_type, preparation_date,
          best_before, pickup_address, city, description, status,
          accepted_at, volunteer_assigned_at, picked_up_at, delivered_at, received_at,
          lat, lng
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          d.donor_id, d.ngo_id, d.volunteer_id, d.food_name, d.food_category,
          d.quantity, d.unit, d.people_served, d.food_type, d.preparation_date,
          d.best_before, d.pickup_address, d.city, d.description, d.status,
          d.accepted_at || null, d.volunteer_assigned_at || null,
          d.picked_up_at || null, d.delivered_at || null, d.received_at || null,
          d.lat || null, d.lng || null,
        ]
      );
    }

    console.log(`📦 Seeded ${sampleDonations.length} donations across all statuses.`);
    console.log('\n========================================');
    console.log('🎉 Seeding completed successfully!');
    console.log('Default credentials for testing:');
    console.log('  Admin:     admin@foodbridge.org     / Admin@12345');
    console.log('  Donor:     donor@foodbridge.org     / Password@123');
    console.log('  NGO:       ngo@hope.org             / Password@123');
    console.log('  Volunteer: volunteer@foodbridge.org / Password@123');
    console.log('========================================\n');
  } catch (err) {
    console.error('❌ Seeding failed:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();
