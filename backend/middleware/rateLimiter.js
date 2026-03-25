// backend/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// General API limiter - 100 requests per 15 min
exports.apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false  // ✅ Disable validation to avoid X-Forwarded-For warning
});

// Stricter login limiter - 5 attempts per 15 min
exports.loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // Don't count successful logins
  message: { error: 'Too many login attempts, please try after 15 minutes' },
  validate: false  // ✅ Disable validation
});

// Slow down after 50 requests
exports.speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: 500, // Add 500ms delay after 50 requests
  validate: false  // ✅ Disable validation for slowDown as well
});

// Heavy operations limiter (sales, reports)
exports.heavyOpsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 heavy ops per minute
  message: { error: 'Too many operations, please slow down' },
  validate: false  // ✅ Disable validation
});