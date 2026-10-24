'use strict';

/**
 * FoodBridge – Gmail SMTP Diagnostic Tool
 * Validates environment variables, tests SMTP connection, and diagnoses common delivery issues.
 *
 * Usage:
 *   node backend/utils/diagnose_smtp.js
 *   node backend/utils/diagnose_smtp.js recipient@gmail.com
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const { getSmtpStatus, verifySmtpConnection, sendVerificationEmail } = require('../services/emailService');

function maskEmail(email) {
  if (!email || !email.includes('@')) return '(empty)';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

async function runDiagnostic() {
  console.log('====================================================');
  console.log('🔍 FoodBridge Gmail SMTP Diagnostic & Health Check');
  console.log('====================================================\n');

  const status = getSmtpStatus();

  console.log('1️⃣  Environment Configuration Status:');
  console.log(`   - SMTP_HOST:    ${status.host}`);
  console.log(`   - SMTP_PORT:    ${status.port} (secure: ${status.secure})`);
  console.log(`   - SMTP_USER:    ${status.missing.includes('SMTP_USER') ? '❌ PLACEHOLDER / NOT SET' : maskEmail(status.user)}`);
  console.log(`   - SMTP_PASS:    ${status.missing.includes('SMTP_PASS') ? '❌ PLACEHOLDER / NOT SET' : `✅ Configured (${status.pass.length} chars, App Password)`}`);
  console.log(`   - APP_BASE_URL: ${process.env.APP_BASE_URL || 'http://localhost:5173'}\n`);

  console.log('2️⃣  Testing Live Gmail SMTP Connection with transporter.verify()...');
  const connResult = await verifySmtpConnection();

  if (!connResult.success) {
    console.error(`\n❌ SMTP Verification Status: Failed (Error Code: ${connResult.errorCode || 'UNCONFIGURED'})`);
    console.error(`   Message: ${connResult.message}`);
    if (connResult.advice) {
      console.log(`   💡 Advice: ${connResult.advice}`);
    }

    if (!status.isConfigured) {
      console.log('\n📋 Required Configuration Steps:');
      console.log('   1. Open `backend/.env` (and root `.env`).');
      console.log('   2. Set SMTP_USER to your project Gmail address (e.g., your_email@gmail.com).');
      console.log('   3. Set SMTP_PASS to a 16-character Google App Password (not your personal Gmail password).');
      console.log('      Generate one at: https://myaccount.google.com/apppasswords');
      console.log('   4. Save the file and re-run: node backend/utils/diagnose_smtp.js\n');
      return;
    }

    console.error('\n💡 Troubleshooting Tips:');
    console.error('   - 535-5.7.8 Username and Password not accepted:');
    console.error('     1. Ensure 2-Step Verification is enabled on your Google Account.');
    console.error('     2. Ensure SMTP_PASS is a 16-character Google App Password, NOT your regular password.');
    console.error('   - Connection timeout (ETIMEDOUT / ECONNREFUSED):');
    console.error('     Check if your network or ISP blocks port 587. You can try SMTP_PORT=465 and SMTP_SECURE=true.\n');
    return;
  }

  console.log(`   ✅ ${connResult.message}\n`);

  // Optional: Send test verification email if recipient argument is provided
  const targetRecipient = process.argv[2];
  if (targetRecipient && targetRecipient.includes('@gmail.com')) {
    console.log(`3️⃣  Sending Test Verification Email to: ${targetRecipient}...`);
    try {
      const result = await sendVerificationEmail({
        to: targetRecipient,
        username: 'DiagnosticTester',
        token: 'test_token_' + Date.now(),
      });
      console.log(`   ✅ Test verification email dispatched successfully! Message ID: ${result.messageId}`);
    } catch (err) {
      console.error(`   ❌ Failed to deliver test email: ${err.message}`);
    }
  } else {
    console.log('ℹ️  Tip: To send a real test email, run:');
    console.log('   node backend/utils/diagnose_smtp.js your_test_email@gmail.com\n');
  }

  console.log('====================================================');
  console.log('✨ Diagnostic check complete.');
  console.log('====================================================');
}

if (require.main === module) {
  runDiagnostic();
}

module.exports = { runDiagnostic };
