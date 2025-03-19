const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('../../../config/redis');

// Base rate limiter configuration
const createRateLimiter = (options) => {
  const baseConfig = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
      status: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.'
    }
  };

  // Use Redis store if available
  if (redis.client) {
    baseConfig.store = new RedisStore({
      sendCommand: (...args) => redis.client.sendCommand(args),
      prefix: 'ratelimit:'
    });
  }

  return rateLimit({
    ...baseConfig,
    ...options
  });
};

// Specific rate limiters
exports.loginRateLimit = () => createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: (req) => {
    return req.body.email ? `login:${req.body.email}` : req.ip;
  },
  message: {
    status: 'error',
    code: 'LOGIN_ATTEMPTS_EXCEEDED',
    message: 'Too many login attempts, please try again later.'
  }
});

exports.apiRateLimit = () => createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user ? `user:${req.user._id}` : req.ip;
  }
});

exports.refreshTokenRateLimit = () => createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 refresh attempts per hour
  message: {
    status: 'error',
    code: 'REFRESH_ATTEMPTS_EXCEEDED',
    message: 'Too many token refresh attempts, please login again.'
  }
});

// Add registration rate limiter
exports.registrationRateLimit = () => createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 registration attempts per hour
  message: {
    status: 'error',
    code: 'REGISTRATION_ATTEMPTS_EXCEEDED',
    message: 'Too many registration attempts, please try again later.'
  }
});
