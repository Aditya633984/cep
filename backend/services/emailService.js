'use strict';

/**
 * FoodBridge – Email Service
 * Sends transactional emails via Gmail SMTP using Nodemailer.
 * Enforces:
 * - Real Gmail SMTP delivery using Google App Passwords
 * - Clean, responsive HTML template matching Step 5 specification + plaintext fallback
 * - Secure error handling without leaking credentials or tokens
 * - Verification URL linking to FoodBridge frontend
 */

const path = require('path');
const dotenv = require('dotenv');

// Ensure environment variables are loaded regardless of execution context or CWD
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const nodemailer = require('nodemailer');

// In-memory record of the last sent email (for testing / verification inspection)
let lastSentEmail = null;
let customTransporter = null;

/**
 * Returns the effective base URL of the frontend application.
 */
function getAppBaseUrl() {
  const url = process.env.APP_BASE_URL || process.env.CLIENT_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173');
  return url.replace(/\/+$/, '');
}

/**
 * Analyzes current SMTP configuration and checks for missing or placeholder credentials.
 * Never exposes passwords or secret values.
 *
 * @returns {{
 *   host: string,
 *   port: number,
 *   secure: boolean,
 *   user: string,
 *   pass: string,
 *   isConfigured: boolean,
 *   missing: string[]
 * }}
 */
function isPlaceholderValue(val, type) {
  if (!val || typeof val !== 'string') return true;
  const s = val.trim().toLowerCase();
  if (type === 'user') {
    if (!s.includes('@')) return true;
    return (
      s.includes('your_project_email') ||
      s.includes('your_project_gmail') ||
      s.includes('your_email') ||
      s.includes('your_gmail') ||
      s.includes('example.com') ||
      s.startsWith('your_')
    );
  }
  if (type === 'pass') {
    const cleanPass = s.replace(/\s+/g, '');
    if (cleanPass.length < 8) return true;
    return (
      cleanPass.includes('your_16_character') ||
      cleanPass.includes('your_google_app_password') ||
      cleanPass.includes('your_app_password') ||
      cleanPass.includes('your_password') ||
      cleanPass.startsWith('your_')
    );
  }
  return false;
}

/**
 * Analyzes current SMTP configuration and checks for missing or placeholder credentials.
 * Never exposes passwords or secret values.
 *
 * @returns {{
 *   host: string,
 *   port: number,
 *   secure: boolean,
 *   user: string,
 *   pass: string,
 *   isConfigured: boolean,
 *   missing: string[]
 * }}
 */
function getSmtpStatus() {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const rawUser = process.env.SMTP_USER || '';
  const rawPass = process.env.SMTP_PASS || '';

  const user = rawUser.trim();
  const pass = rawPass.replace(/\s+/g, ''); // Google App Passwords frequently copy with spaces

  const missing = [];

  const isUserValid = Boolean(user && !isPlaceholderValue(user, 'user'));
  const isPassValid = Boolean(pass && !isPlaceholderValue(pass, 'pass'));

  if (!isUserValid) {
    missing.push('SMTP_USER');
  }
  if (!isPassValid) {
    missing.push('SMTP_PASS');
  }

  const isConfigured = isUserValid && isPassValid;

  return {
    host,
    port,
    secure,
    user,
    pass,
    isConfigured,
    missing,
  };
}

/**
 * Creates and configures the Nodemailer transporter for Gmail SMTP.
 */
function createTransporter() {
  if (customTransporter) {
    return customTransporter;
  }

  const status = getSmtpStatus();

  // In test mode without credentials configured, use a mock transporter that records dispatch
  if (process.env.NODE_ENV === 'test' && !status.isConfigured) {
    return {
      sendMail: async (mailOptions) => {
        lastSentEmail = { ...mailOptions, sentAt: new Date() };
        return {
          messageId: `<mock-${Date.now()}@foodbridge.org>`,
          response: '250 Mock email accepted',
          accepted: [mailOptions.to],
          rejected: [],
        };
      },
      verify: async () => true,
    };
  }

  const isSecure = status.secure || status.port === 465;

  const transportOptions = {
    host: status.host,
    port: status.port,
    secure: isSecure, // true for 465, false for 587
    auth: {
      user: status.user,
      pass: status.pass,
    },
    requireTLS: !isSecure, // Enforce STARTTLS on port 587
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      minVersion: 'TLSv1.2',
    },
  };

  return nodemailer.createTransport(transportOptions);
}

/**
 * Generates the responsive HTML verification email body strictly matching Step 5.
 * @param {string} username
 * @param {string} verificationUrl
 * @returns {string}
 */
function generateVerificationHtml(username, verificationUrl) {
  const greeting = username && username !== 'there' ? `Hello ${username},` : 'Hello,';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your FoodBridge Email Address</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #16a34a 0%, #2563eb 100%); padding: 28px 24px; text-align: center;">
              <span style="font-size: 32px; display: block; margin-bottom: 6px;">🌉</span>
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em;">FoodBridge</h1>
              <p style="color: #e2e8f0; margin: 4px 0 0; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; font-weight: 500;">
                Food Donation &amp; Redistribution Platform
              </p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px 28px 24px;">
              <p style="font-size: 16px; margin: 0 0 16px; font-weight: 600; color: #0f172a;">${greeting}</p>
              
              <p style="font-size: 15px; margin: 0 0 16px; color: #334155;">
                Welcome to FoodBridge!
              </p>
              
              <p style="font-size: 15px; margin: 0 0 24px; color: #334155; line-height: 1.6;">
                Please verify your email address by clicking the button below.
              </p>

              <!-- Verification Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 28px 0; width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${verificationUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 34px; font-size: 15px; color: #ffffff; background-color: #16a34a; text-decoration: none; font-weight: 600; border-radius: 8px; letter-spacing: 0.01em; box-shadow: 0 2px 4px rgba(22, 163, 74, 0.25);">
                      Verify My Email
                    </a>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #64748b; margin: 28px 0 8px;">
                If the button does not work, copy and paste this link into your browser:
              </p>
              <p style="font-size: 13px; margin: 0 0 20px; word-break: break-all;">
                <a href="${verificationUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">
                  ${verificationUrl}
                </a>
              </p>

              <div style="background-color: #f1f5f9; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 4px; margin: 22px 0;">
                <p style="font-size: 13px; color: #475569; margin: 0; font-weight: 500;">
                  ⏳ This verification link expires in 15 minutes.
                </p>
              </div>

              <p style="font-size: 13px; color: #94a3b8; margin: 24px 0 0;">
                If you did not register for FoodBridge, you can ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 28px 28px; border-top: 1px solid #f1f5f9; background-color: #fafafa;">
              <p style="font-size: 14px; margin: 0; color: #475569; line-height: 1.6;">
                Regards,<br>
                <strong style="color: #1e293b;">FoodBridge Team</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates the plaintext alternative email body strictly matching Step 5.
 * @param {string} username
 * @param {string} verificationUrl
 * @returns {string}
 */
function generateVerificationText(username, verificationUrl) {
  const greeting = username && username !== 'there' ? `Hello ${username},` : 'Hello,';

  return `${greeting}

Welcome to FoodBridge!

Please verify your email address by clicking the button below.

[Verify My Email]

If the button does not work, copy and paste this link into your browser:
${verificationUrl}

This verification link expires in 15 minutes.

If you did not register for FoodBridge, you can ignore this email.

Regards,
FoodBridge Team`;
}

/**
 * Sends a real verification email to the user's Gmail address.
 * Throws an error if sending fails so caller never falsely reports success.
 *
 * @param {object} params
 * @param {string} params.to - Recipient Gmail address
 * @param {string} params.username - Recipient's username/name
 * @param {string} params.token - Raw verification token
 * @returns {Promise<object>} Nodemailer send result
 */
async function sendVerificationEmail({ to, username, token }) {
  if (!to || typeof to !== 'string') {
    throw new Error('Recipient email is required.');
  }
  if (!token || typeof token !== 'string') {
    throw new Error('Verification token is required.');
  }

  const cleanRecipient = to.trim().toLowerCase();
  const cleanUsername = (username || '').trim();
  const appBaseUrl = getAppBaseUrl();
  const verificationUrl = `${appBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;

  const status = getSmtpStatus();

  // Fail fast if required SMTP credentials are missing/placeholder in non-test mode
  if (!status.isConfigured && process.env.NODE_ENV !== 'test' && !customTransporter) {
    const errorMsg = `SMTP credentials are not configured (missing: ${status.missing.join(', ')}). Please set SMTP_USER and SMTP_PASS (Google App Password) in your .env file.`;
    console.error(`[EmailService] Cannot send verification email to ${cleanRecipient}: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const transporter = createTransporter();
  const senderEmail = status.user || 'no-reply@foodbridge.org';
  const from = `"FoodBridge" <${senderEmail}>`;

  const mailOptions = {
    from,
    to: cleanRecipient,
    subject: 'Verify Your FoodBridge Email Address',
    text: generateVerificationText(cleanUsername, verificationUrl),
    html: generateVerificationHtml(cleanUsername, verificationUrl),
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    // Enforce delivery confirmation
    if (info && info.rejected && info.rejected.length > 0) {
      const rejectedList = info.rejected.join(', ');
      console.error(`[EmailService] Recipient rejected by SMTP server: ${rejectedList}`);
      throw new Error(`Email recipient rejected by SMTP server: ${rejectedList}`);
    }

    if (!info || (!info.messageId && (!info.accepted || info.accepted.length === 0))) {
      throw new Error('SMTP server did not confirm message acceptance.');
    }

    lastSentEmail = {
      to: cleanRecipient,
      from,
      subject: mailOptions.subject,
      verificationUrl,
      sentAt: new Date(),
      messageId: info.messageId,
    };
    return info;
  } catch (err) {
    // Log safe diagnostic error on the backend without leaking passwords or verification tokens
    console.error(`[EmailService] Failed to send email to ${cleanRecipient}:`, err.message);
    throw new Error(`Email delivery failed: ${err.message}`);
  }
}

/**
 * Verifies SMTP connection configuration without sending an email.
 * Runs transporter.verify() and reports actual error code and diagnostic details.
 * @returns {Promise<{
 *   success: boolean,
 *   configured: boolean,
 *   missing: string[],
 *   errorCode?: string,
 *   errorResponse?: string|null,
 *   message: string,
 *   advice?: string
 * }>}
 */
async function verifySmtpConnection() {
  const status = getSmtpStatus();

  // Test mode without credentials configured: return mock success
  if (process.env.NODE_ENV === 'test' && !status.isConfigured && !customTransporter) {
    return {
      success: true,
      configured: false,
      missing: status.missing,
      message: 'Test mode active with mock SMTP transporter.',
    };
  }

  try {
    const transporter = createTransporter();
    if (typeof transporter.verify === 'function') {
      await transporter.verify();
      return {
        success: true,
        configured: status.isConfigured,
        missing: [],
        message: 'Gmail SMTP connection verified successfully! Ready to deliver verification emails.',
      };
    }
    return { success: true, configured: true, missing: [], message: 'Custom/mock SMTP transporter active.' };
  } catch (err) {
    const errorCode = err.code || 'UNKNOWN';
    const errorResponse = err.response || null;
    let diagnosticAdvice = '';

    if (errorCode === 'EAUTH' || (err.message && err.message.includes('535'))) {
      diagnosticAdvice = 'Gmail rejected authentication (535 BadCredentials). Ensure 2-Step Verification is ON and generate a 16-character Google App Password (not your personal password).';
    } else if (errorCode === 'ETIMEDOUT' || errorCode === 'ECONNREFUSED') {
      diagnosticAdvice = `Connection to ${status.host}:${status.port} timed out or was refused. Check your internet connection or firewall. You can try SMTP_PORT=465 and SMTP_SECURE=true.`;
    }

    const result = {
      success: false,
      configured: status.isConfigured,
      missing: status.missing,
      errorCode,
      errorResponse,
      message: err.message,
      advice: diagnosticAdvice,
    };

    console.error(`[SMTP Diagnostic] transporter.verify() failed: [${errorCode}] ${err.message}`);
    return result;
  }
}

/**
 * Test inspection and mock helpers
 */
function getLastSentEmail() {
  return lastSentEmail;
}

function clearLastSentEmail() {
  lastSentEmail = null;
}

function setCustomTransporter(t) {
  customTransporter = t;
}

function resetTransporter() {
  customTransporter = null;
  lastSentEmail = null;
}

module.exports = {
  getAppBaseUrl,
  getSmtpStatus,
  createTransporter,
  sendVerificationEmail,
  verifySmtpConnection,
  generateVerificationHtml,
  generateVerificationText,
  getLastSentEmail,
  clearLastSentEmail,
  setCustomTransporter,
  resetTransporter,
};
