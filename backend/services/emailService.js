'use strict';

/**
 * FoodBridge – Email Service
 * Sends transactional emails via Gmail SMTP using Nodemailer.
 * Enforces:
 * - Real Gmail SMTP delivery using Google App Passwords
 * - Clean, responsive HTML template + plaintext fallback
 * - Secure error handling without leaking credentials or tokens
 * - Verification URL linking to FoodBridge frontend
 */

const nodemailer = require('nodemailer');

// In-memory record of the last sent email (for testing / verification inspection)
let lastSentEmail = null;
let customTransporter = null;

/**
 * Returns the effective base URL of the frontend application.
 */
function getAppBaseUrl() {
  const url = process.env.APP_BASE_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  return url.replace(/\/+$/, '');
}

/**
 * Creates and configures the Nodemailer transporter for Gmail SMTP.
 */
function createTransporter() {
  if (customTransporter) {
    return customTransporter;
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : '';

  // In test mode without credentials configured, use a mock transporter that records dispatch
  if (process.env.NODE_ENV === 'test' && (!user || user.includes('your_project_email'))) {
    return {
      sendMail: async (mailOptions) => {
        lastSentEmail = { ...mailOptions, sentAt: new Date() };
        return { messageId: `<mock-${Date.now()}@foodbridge.org>`, response: '250 Mock email accepted' };
      },
      verify: async () => true,
    };
  }

  const options = {
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  };

  if (host === 'smtp.gmail.com') {
    options.service = 'gmail';
  }

  return nodemailer.createTransport(options);
}

/**
 * Generates the responsive HTML verification email body.
 * @param {string} username
 * @param {string} verificationUrl
 * @returns {string}
 */
function generateVerificationHtml(username, verificationUrl) {
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
            <td style="background: linear-gradient(135deg, #16a34a 0%, #2563eb 100%); padding: 32px 28px; text-align: center;">
              <span style="font-size: 36px; display: block; margin-bottom: 8px;">🌉</span>
              <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.02em;">FoodBridge</h1>
              <p style="color: #e2e8f0; margin: 6px 0 0; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; font-weight: 500;">
                Food Donation &amp; Redistribution Platform
              </p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px 32px 24px;">
              <p style="font-size: 16px; margin: 0 0 16px; font-weight: 600; color: #0f172a;">Hello ${username},</p>
              
              <p style="font-size: 15px; margin: 0 0 16px; color: #334155;">
                Welcome to FoodBridge!
              </p>
              
              <p style="font-size: 15px; margin: 0 0 24px; color: #334155; line-height: 1.6;">
                Thank you for joining our food donation and redistribution platform. To complete your registration, please verify your email address by clicking the button below.
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
                  ⏳ This link will expire in 15 minutes.
                </p>
              </div>

              <p style="font-size: 13px; color: #94a3b8; margin: 24px 0 0;">
                If you did not create a FoodBridge account, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px 32px; border-top: 1px solid #f1f5f9; background-color: #fafafa;">
              <p style="font-size: 14px; margin: 0; color: #475569; line-height: 1.6;">
                Regards,<br>
                <strong style="color: #1e293b;">FoodBridge Team</strong><br>
                <span style="font-size: 12px; color: #64748b;">Connecting Surplus Food with Those Who Need It.</span>
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
 * Generates the plaintext alternative email body.
 * @param {string} username
 * @param {string} verificationUrl
 * @returns {string}
 */
function generateVerificationText(username, verificationUrl) {
  return `Hello ${username},

Welcome to FoodBridge!

Thank you for joining our food donation and redistribution platform. To complete your registration, please verify your email address by clicking the button below.

[Verify My Email]

If the button does not work, copy and paste this link into your browser:

${verificationUrl}

This link will expire in 15 minutes.

If you did not create a FoodBridge account, you can safely ignore this email.

Regards,
FoodBridge Team
Connecting Surplus Food with Those Who Need It.`;
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
  const cleanUsername = (username || 'there').trim();
  const appBaseUrl = getAppBaseUrl();
  const verificationUrl = `${appBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;

  const transporter = createTransporter();
  const senderEmail = process.env.SMTP_USER || 'no-reply@foodbridge.org';
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
    // Never leak passwords or sensitive tokens in error logs
    console.error(`[EmailService] Failed to send email to ${cleanRecipient}:`, err.message);
    throw new Error(`Email delivery failed: ${err.message}`);
  }
}

/**
 * Verifies SMTP connection configuration without sending an email.
 * @returns {Promise<{ success: boolean, message: string }>}
 */
async function verifySmtpConnection() {
  try {
    const transporter = createTransporter();
    if (typeof transporter.verify === 'function') {
      await transporter.verify();
      return { success: true, message: 'SMTP server connection verified successfully.' };
    }
    return { success: true, message: 'Mock SMTP transporter active.' };
  } catch (err) {
    return { success: false, message: `SMTP connection error: ${err.message}` };
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
