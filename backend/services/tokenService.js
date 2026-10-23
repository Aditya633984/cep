'use strict';

/**
 * FoodBridge – Token Service
 * Cryptographically secure token generation and hashing for email verification.
 * Follows OWASP verification token best practices:
 * - 256 bits of cryptographically secure randomness via crypto.randomBytes
 * - Only SHA-256 token hashes are stored in the database
 * - Plaintext tokens are sent only to the recipient's verified Gmail inbox
 * - 15-minute expiration window
 */

const crypto = require('crypto');

const TOKEN_EXPIRY_MINUTES = 15;

/**
 * Generate a new random verification token, its SHA-256 hash, and expiration timestamp.
 * @returns {{ token: string, tokenHash: string, expiresAt: Date }}
 */
function generateVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

  return {
    token,
    tokenHash,
    expiresAt,
  };
}

/**
 * Computes the SHA-256 hash of a plaintext token.
 * @param {string} token
 * @returns {string}
 */
function hashToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string');
  }
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Validates whether a token has expired.
 * @param {string|Date} expiresAt
 * @returns {boolean}
 */
function isTokenExpired(expiresAt) {
  if (!expiresAt) return true;
  const expiryTime = new Date(expiresAt).getTime();
  return Number.isNaN(expiryTime) || expiryTime < Date.now();
}

module.exports = {
  TOKEN_EXPIRY_MINUTES,
  generateVerificationToken,
  hashToken,
  isTokenExpired,
};
