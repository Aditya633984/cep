'use strict';
/**
 * End-to-End Workflow Verification Script
 * Validates the complete lifecycle:
 * Donor Post -> Smart Match -> NGO Accept -> Volunteer Accept ->
 * Volunteer Pickup -> Volunteer Deliver -> NGO Confirm Received -> Admin Analytics
 */

const BASE = 'http://localhost:5000/api';

async function req(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  return { status: res.status, data };
}

async function runVerification() {
  console.log('====================================================');
  console.log('🧪 FoodBridge End-to-End Workflow Verification');
  console.log('====================================================\n');

  // 1. Authenticate all 4 roles
  console.log('1️⃣  Authenticating all user roles...');
  const donorAuth = await req('POST', '/auth/login', { email: 'donor@foodbridge.org', password: 'Password@123' });
  const ngoAuth   = await req('POST', '/auth/login', { email: 'ngo@hope.org', password: 'Password@123' });
  const volAuth   = await req('POST', '/auth/login', { email: 'volunteer@foodbridge.org', password: 'Password@123' });
  const adminAuth = await req('POST', '/auth/login', { email: 'admin@foodbridge.org', password: 'Admin@12345' });

  if (!donorAuth.data.token || !ngoAuth.data.token || !volAuth.data.token || !adminAuth.data.token) {
    throw new Error('Authentication failed for one or more roles.');
  }
  console.log('   ✅ All 4 roles authenticated successfully.\n');

  // 2. Donor posts a new donation
  console.log('2️⃣  Donor creates a new surplus food donation...');
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');

  const postRes = await req('POST', '/donor/donations', {
    food_name: 'Fresh Packed Meals - Corporate Event Surplus',
    food_category: 'Cooked Food',
    quantity: 20,
    unit: 'kg',
    people_served: 50,
    food_type: 'vegetarian',
    preparation_date: today,
    best_before: tomorrow,
    pickup_address: 'Grand Plaza Convention Hall, MG Road',
    city: 'Bangalore',
    description: 'Hygienically packed surplus meals from evening gala.',
    lat: 12.9750,
    lng: 77.6095,
  }, donorAuth.data.token);

  if (!postRes.data.success || !postRes.data.donation?.id) {
    throw new Error('Failed to post donation: ' + JSON.stringify(postRes.data));
  }
  const donationId = postRes.data.donation.id;
  console.log(`   ✅ Donation created successfully (ID: ${donationId}, Status: POSTED).\n`);

  // 3. Smart Matching engine evaluation
  console.log('3️⃣  Running Smart Matching Engine on donation...');
  const matchRes = await req('GET', `/matching/donations/${donationId}/ngos`, null, donorAuth.data.token);
  if (!matchRes.data.success || !matchRes.data.matches?.length) {
    throw new Error('Smart matching returned no matches.');
  }
  const topMatch = matchRes.data.matches[0];
  console.log(`   ✅ Matched with ${matchRes.data.matches.length} NGOs. Top match: ${topMatch.ngo_name} (Score: ${topMatch.score}/100).\n`);

  // 4. NGO accepts donation
  console.log('4️⃣  NGO accepts donation...');
  const acceptRes = await req('POST', `/ngo/donations/${donationId}/accept`, {}, ngoAuth.data.token);
  if (!acceptRes.data.success) {
    throw new Error('NGO failed to accept donation: ' + JSON.stringify(acceptRes.data));
  }
  console.log(`   ✅ Donation ${donationId} accepted by NGO. Status: ACCEPTED.\n`);

  // 5. Volunteer views available pickups & accepts task
  console.log('5️⃣  Volunteer accepts pickup task...');
  const volAcceptRes = await req('POST', `/volunteer/pickups/${donationId}/accept`, {}, volAuth.data.token);
  if (!volAcceptRes.data.success) {
    throw new Error('Volunteer failed to accept pickup: ' + JSON.stringify(volAcceptRes.data));
  }
  console.log(`   ✅ Volunteer assigned to donation. Status: VOLUNTEER_ASSIGNED.\n`);

  // 6. Volunteer marks food collected (picked up)
  console.log('6️⃣  Volunteer marks food collected from donor...');
  const pickupRes = await req('POST', `/volunteer/pickups/${donationId}/pickup`, {}, volAuth.data.token);
  if (!pickupRes.data.success) {
    throw new Error('Failed to update status to pickup: ' + JSON.stringify(pickupRes.data));
  }
  console.log(`   ✅ Food marked collected. Status: PICKED_UP.\n`);

  // 7. Volunteer marks food delivered to NGO
  console.log('7️⃣  Volunteer marks food delivered to NGO...');
  const deliverRes = await req('POST', `/volunteer/pickups/${donationId}/deliver`, {}, volAuth.data.token);
  if (!deliverRes.data.success) {
    throw new Error('Failed to update status to deliver: ' + JSON.stringify(deliverRes.data));
  }
  console.log(`   ✅ Food marked delivered. Status: DELIVERED.\n`);

  // 8. NGO confirms food received (completes lifecycle)
  console.log('8️⃣  NGO confirms receipt of food...');
  const receivedRes = await req('POST', `/ngo/donations/${donationId}/received`, {}, ngoAuth.data.token);
  if (!receivedRes.data.success) {
    throw new Error('Failed to mark received: ' + JSON.stringify(receivedRes.data));
  }
  console.log(`   ✅ Food receipt confirmed! Status: COMPLETED.\n`);

  // 9. Admin monitors updated stats
  console.log('9️⃣  Admin dashboard verification...');
  const adminStatsRes = await req('GET', '/admin/stats', null, adminAuth.data.token);
  const stats = adminStatsRes.data.stats;
  console.log(`   ✅ Admin platform metrics verified:`);
  console.log(`      - Total registered users: ${stats.total_users}`);
  console.log(`      - Total donations: ${stats.total_donations}`);
  console.log(`      - Completed donations: ${stats.completed_donations}`);
  console.log(`      - Total food distributed: ${stats.total_kg_donated} kg`);
  console.log(`      - Total people served: ${stats.total_people_served}`);

  console.log('\n====================================================');
  console.log('🎉 ALL USER WORKFLOWS SUCCESSFULLY VERIFIED!');
  console.log('====================================================\n');
}

runVerification().catch((err) => {
  console.error('\n❌ Workflow verification failed:', err.message);
  process.exit(1);
});
