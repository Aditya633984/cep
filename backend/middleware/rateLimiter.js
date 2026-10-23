'use strict';

/**
 * FoodBridge – Rate Limiter Middleware
 * Protects registration, login, email verification, and resend endpoints from abuse.
 * Uses an in-memory sliding window bucket with IP and email tracking.
 */

const ipRequests = new Map();
const emailCooldowns = new Map();

/**
 * Clean up expired records every 10 minutes to prevent memory leaks
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of ipRequests.entries()) {
    if (now > record.resetTime) {
      ipRequests.delete(key);
    }
  }
  for (const [key, resetTime] of emailCooldowns.entries()) {
    if (now > resetTime) {
      emailCooldowns.delete(key);
    }
  }
}, 10 * 60 * 1000).unref();

/**
 * Generic rate limiter factory
 */
function createRateLimiter({ windowMs, maxRequests, message, keyPrefix = 'rl' }) {
  return (req, res, next) => {
    // Skip rate limiting during non-rate-limit unit tests unless testing the limiter itself
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    const record = ipRequests.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      ipRequests.set(key, record);
      return next();
    }

    record.count++;
    ipRequests.set(key, record);

    if (record.count > maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        success: false,
        error: message || 'Too many requests. Please try again later.',
        retryAfter: retryAfterSeconds,
      });
    }

    next();
  };
}

/**
 * Dedicated limiter for resending verification emails.
 * Enforces:
 * 1. IP rate limiting (max 5 requests per 15 minutes)
 * 2. Per-email cooldown (minimum 45 seconds between resends for the same email address)
 */
function resendVerificationLimiter(req, res, next) {
  if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
    return next();
  }

  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const ipKey = `resend:${ip}`;
  const now = Date.now();

  // 1. Check IP limit (5 per 15 mins)
  const windowMs = 15 * 60 * 1000;
  const ipRecord = ipRequests.get(ipKey) || { count: 0, resetTime: now + windowMs };

  if (now > ipRecord.resetTime) {
    ipRecord.count = 1;
    ipRecord.resetTime = now + windowMs;
  } else {
    ipRecord.count++;
  }
  ipRequests.set(ipKey, ipRecord);

  if (ipRecord.count > 5) {
    const retryAfter = Math.ceil((ipRecord.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      success: false,
      error: 'Too many verification email requests from this IP. Please wait a few minutes before trying again.',
      retryAfter,
    });
  }

  // 2. Check email cooldown if email is provided (45s cooldown)
  const email = req.body && req.body.email ? String(req.body.email).trim().toLowerCase() : null;
  if (email) {
    const nextAllowed = emailCooldowns.get(email);
    if (nextAllowed && now < nextAllowed) {
      const waitSeconds = Math.ceil((nextAllowed - now) / 1000);
      return res.status(429).json({
        success: false,
        error: `Please wait ${waitSeconds} seconds before requesting another verification email.`,
        retryAfter: waitSeconds,
      });
    }
    // Set 45s cooldown
    emailCooldowns.set(email, now + 45 * 1000);
  }

  next();
}

const registerLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
  message: 'Too many registration attempts. Please wait a few minutes before trying again.',
  keyPrefix: 'reg',
});

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 25,
  message: 'Too many login attempts. Please wait a few minutes before trying again.',
  keyPrefix: 'login',
});

const verifyEmailLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  message: 'Too many verification attempts. Please wait a few minutes before trying again.',
  keyPrefix: 'verify',
});

function resetRateLimits() {
  ipRequests.clear();
  emailCooldowns.clear();
}

module.exports = {
  createRateLimiter,
  resendVerificationLimiter,
  registerLimiter,
  loginLimiter,
  verifyEmailLimiter,
  resetRateLimits,
};
