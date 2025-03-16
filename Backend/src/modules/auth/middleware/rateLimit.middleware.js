const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const Redis = require("ioredis");
const config = require("../config");
const logger = require("../../../utils/logger");
const { AuthError } = require("../errors");

const COMPONENT = 'RateLimitMiddleware';

// Create a dedicated Redis client for rate limiting
const redisClient = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0,
});

/**
 * Creates a configurable rate limiter
 * @param {Object} options - Rate limiter configuration
 * @returns {Function} Express middleware
 */
const createRateLimiter = (options) => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const windowMs = options.windowMs || config.rateLimiting.windowMs || 15 * 60 * 1000;
  const maxAttempts = options.max || config.rateLimiting.max || 1000;
  
  // In development mode, we can skip rate limiting
  if (isDevelopment) {
    return (req, res, next) => {
      next();
    };
  }
  
  return rateLimit({
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: options.prefix || "rate_limit:",
    }),
    windowMs,
    max: typeof maxAttempts === 'function' ? maxAttempts : (req) => {
      // Dynamic rate limiting based on risk score if function not provided
      if (typeof maxAttempts === 'number') {
        const riskScore = calculateRiskScore(req);
        return Math.max(1, maxAttempts - Math.floor(riskScore / 10));
      }
      return maxAttempts;
    },
    message: {
      code: options.errorCode || "RATE_LIMIT_EXCEEDED",
      message: options.message || "Too many attempts. Please try again later.",
      details: {
        remainingTime: windowMs / 1000,
        nextAttemptAt: Date.now() + windowMs
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || ((req) => {
      // Default key generator combines IP, email and device fingerprint
      const email = req.body.email || req.query.email || 'anonymous';
      const fingerprint = req.body.deviceInfo?.fingerprint || req.headers['x-device-fingerprint'] || 'unknown';
      return `${req.ip}:${email}:${fingerprint}`;
    }),
    skip: options.skip || ((req) => {
      // Skip rate limiting in development mode
      return process.env.NODE_ENV === 'development';
    }),
    handler: (req, res, next, options) => {
      const retryAfter = Math.ceil(options.windowMs / 1000);
      
      // Log rate limit exceeded
      logger.warn('Rate limit exceeded', {
        component: COMPONENT,
        ip: req.ip,
        endpoint: req.originalUrl,
        method: req.method,
        retryAfter
      });
      
      // Apply progressive delay if enabled
      if (options.progressiveDelay) {
        const key = options.keyGenerator(req);
        applyProgressiveDelay(key);
      }
      
      // Return standardized error response
      res.status(429).json({
        error: {
          code: options.message.code,
          message: options.message.message,
          details: {
            ...options.message.details,
            retryAfter
          }
        }
      });
    }
  });
};

/**
 * Login-specific rate limiter with enhanced security
 * @returns {Function} Express middleware
 */
const loginRateLimit = () => {
  return createRateLimiter({
    windowMs: config.rateLimiting.login?.windowMs || 15 * 60 * 1000,
    max: config.rateLimiting.login?.max || 5, // Use configured value or default to 5
    prefix: "rate_limit:login:",
    errorCode: "LOGIN_RATE_LIMIT_EXCEEDED",
    message: "Too many login attempts. Please try again later.",
    progressiveDelay: true,
    keyGenerator: (req) => {
      // For login, track by IP, email, and device fingerprint
      const email = req.body.email || 'anonymous';
      const fingerprint = req.body.deviceInfo?.fingerprint || req.headers['x-device-fingerprint'] || 'unknown';
      return `login:${req.ip}:${email}:${fingerprint}`;
    },
    handler: (req, res, next, options) => {
      // Log rate limit hit
      logger.warn('Rate limit exceeded', {
        component: 'RateLimitMiddleware',
        ip: req.ip,
        email: req.body.email,
        endpoint: req.originalUrl,
        method: req.method
      });
      
      // Return standardized error response
      return res.status(429).json({
        error: {
          code: options.errorCode,
          message: options.message,
          retryAfter: Math.ceil(options.windowMs / 1000)
        }
      });
    }
  });
};

/**
 * General API rate limiter
 * @returns {Function} Express middleware
 */
const apiRateLimit = () => {
  return createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    prefix: "rate_limit:api:",
    errorCode: "API_RATE_LIMIT_EXCEEDED",
    message: "Too many API requests. Please slow down.",
    keyGenerator: (req) => {
      // For API, primarily track by IP and user ID if available
      const userId = req.user?.id || 'anonymous';
      return `api:${req.ip}:${userId}`;
    },
    skip: (req) => {
      // Skip rate limiting for certain endpoints or IPs
      const skipIPs = process.env.RATE_LIMIT_SKIP_IPS?.split(',') || [];
      if (skipIPs.includes(req.ip)) return true;
      
      // Skip for health checks and non-sensitive endpoints
      if (req.path.includes('/health') || req.path.includes('/public')) return true;
      
      return false;
    }
  });
};

/**
 * Implements progressive delay for repeated attempts
 * @param {String} key - Rate limit key
 * @returns {Promise<number>} Delay in milliseconds
 */
const applyProgressiveDelay = async (key) => {
  try {
    // Get current attempt count
    const attemptsKey = `progressive_delay:${key}`;
    const attempts = await redisClient.incr(attemptsKey);
    
    // Set expiration on first attempt
    if (attempts === 1) {
      await redisClient.expire(attemptsKey, 24 * 60 * 60); // 24 hours
    }
    
    // Calculate delay based on attempts
    const delay = progressiveDelay(attempts);
    
    // Store the delay
    await redisClient.set(`delay:${key}`, delay, 'EX', 24 * 60 * 60);
    
    return delay;
  } catch (error) {
    logger.error('Error applying progressive delay', {
      component: COMPONENT,
      error: error.message,
      key
    });
    return 0;
  }
};

/**
 * Calculate progressive delay based on attempt count
 * @param {Number} attempts - Number of attempts
 * @returns {Number} Delay in milliseconds
 */
const progressiveDelay = (attempts) => {
  // Exponential backoff: 100ms * 2^(attempts-1), capped at 30 seconds
  return Math.min(100 * Math.pow(2, attempts - 1), 30000);
};

/**
 * Calculate risk score based on request data
 * @param {Object} req - Express request object
 * @returns {Number} Risk score (0-100)
 */
const calculateRiskScore = (req) => {
  let score = 0;
  
  // Missing device info is suspicious
  if (!req.body.deviceInfo) score += 20;
  
  // Missing email is suspicious
  if (!req.body.email) score += 20;
  
  // Check if IP is from known data center or proxy
  const ip = req.ip;
  if (isDataCenterIP(ip)) score += 15;
  
  // Check for suspicious headers
  if (!req.headers['user-agent']) score += 10;
  
  // Check for rapid requests
  const requestTime = req.headers['x-request-time'];
  if (requestTime && Date.now() - parseInt(requestTime) < 500) score += 10;
  
  // Cap at 100
  return Math.min(100, score);
};

/**
 * Check if IP is from a data center
 * @param {String} ip - IP address
 * @returns {Boolean} True if IP is from a data center
 */
const isDataCenterIP = (ip) => {
  // Simplified check - in production, use a proper IP database
  const dataCenterRanges = [
    '34.', '35.', '199.', // Google Cloud
    '52.', '54.', '13.', // AWS
    '40.', '104.', '13.' // Azure
  ];
  
  return dataCenterRanges.some(range => ip.startsWith(range));
};

/**
 * Middleware to check if request should be delayed
 * @returns {Function} Express middleware
 */
const checkProgressiveDelay = () => {
  return async (req, res, next) => {
    try {
      // Generate key based on IP and identifier
      const email = req.body.email || req.query.email || 'anonymous';
      const fingerprint = req.body.deviceInfo?.fingerprint || req.headers['x-device-fingerprint'] || 'unknown';
      const key = `login:${req.ip}:${email}:${fingerprint}`;
      
      // Check if there's a delay for this key
      const delay = await redisClient.get(`delay:${key}`);
      
      if (delay && parseInt(delay) > 0) {
        // Add delay header for frontend
        res.set('X-Rate-Limit-Delay', delay);
        
        // For significant delays, return error instead of waiting
        if (parseInt(delay) > 5000) {
          return res.status(429).json({
            error: {
              code: 'PROGRESSIVE_DELAY',
              message: 'Please wait before trying again',
              details: {
                delayMs: parseInt(delay),
                retryAfter: Math.ceil(parseInt(delay) / 1000)
              }
            }
          });
        }
        
        // For smaller delays, actually delay the response
        await new Promise(resolve => setTimeout(resolve, parseInt(delay)));
      }
      
      next();
    } catch (error) {
      // If there's an error, continue without delay
      logger.error('Error checking progressive delay', {
        component: COMPONENT,
        error: error.message
      });
      next();
    }
  };
};

// Enhanced rate limiter with dynamic limits
const createEnhancedRateLimiter = (options) => {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const maxAttempts = options.max || 5;
  
  return rateLimit({
    store: new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: options.prefix || "rate_limit:",
    }),
    windowMs,
    max: (req) => {
      // Dynamic rate limiting based on risk score
      const riskScore = calculateRiskScore(req);
      const adjustedLimit = Math.max(1, maxAttempts - Math.floor(riskScore / 10));
      return adjustedLimit;
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use combination of IP, user identifier, and device fingerprint
      const identifier = req.body.email || req.user?.id || 'anonymous';
      const fingerprint = req.body.deviceInfo?.fingerprint || 
                          req.headers['x-device-fingerprint'] || 
                          'unknown';
      return `${options.prefix || ''}:${req.ip}:${identifier}:${fingerprint}`;
    }
  });
};

// For backward compatibility with security.middleware.js
const rateLimiters = {
  login: loginRateLimit(),
  passwordReset: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    prefix: "rate_limit:password_reset:",
    errorCode: "PASSWORD_RESET_RATE_LIMIT_EXCEEDED",
    message: "Too many password reset attempts. Please try again later."
  }),
  emailVerification: createRateLimiter({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 5,
    prefix: "rate_limit:email_verification:",
    errorCode: "EMAIL_VERIFICATION_RATE_LIMIT_EXCEEDED",
    message: "Too many email verification attempts. Please try again later."
  }),
  api: apiRateLimit()
};

module.exports = {
  createRateLimiter,
  loginRateLimit,
  apiRateLimit,
  progressiveDelay,
  checkProgressiveDelay,
  createEnhancedRateLimiter,
  rateLimiters
};