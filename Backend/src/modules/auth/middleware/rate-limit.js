const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('../../../config/redis');
const securityConfig = require('../config/security.config');
const logger = require('../../../utils/logger');

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

// WebSocket rate limiting service
// This is a shared service that can be used by both HTTP and WebSocket
exports.rateLimitService = {
  /**
   * Check if a request/connection should be rate limited
   * @param {string} key - The rate limit key
   * @param {string} type - The type of rate limit
   * @param {Object} options - Rate limit options
   * @returns {Promise<Object>} Rate limit result
   */
  async checkRateLimit(key, type, options = {}) {
    if (!redis.client) {
      logger.warn('Redis not available for rate limiting');
      return { limited: false };
    }

    const config = securityConfig.rateLimiting[type] || securityConfig.socket.rateLimiting;
    const windowMs = options.windowMs || config.windowMs || 60000;
    const max = options.max || config.max || 100;
    const prefix = `ratelimit:${type}:`;
    const redisKey = `${prefix}${key}`;
    
    try {
      // Get current count
      const current = await redis.client.get(redisKey);
      const count = current ? parseInt(current, 10) : 0;
      
      // Check if limit exceeded
      if (count >= max) {
        return { 
          limited: true, 
          remaining: 0,
          resetTime: await redis.client.pttl(redisKey)
        };
      }
      
      // Increment counter
      await redis.client.incr(redisKey);
      
      // Set expiry if it's a new key
      if (count === 0) {
        await redis.client.pexpire(redisKey, windowMs);
      }
      
      return {
        limited: false,
        remaining: max - (count + 1),
        resetTime: await redis.client.pttl(redisKey)
      };
    } catch (error) {
      logger.error('Rate limit check error:', error);
      return { limited: false }; // Fail open if Redis error
    }
  },
  
  /**
   * Reset rate limit for a key
   * @param {string} key - The rate limit key
   * @param {string} type - The type of rate limit
   * @returns {Promise<boolean>} Success status
   */
  async resetRateLimit(key, type) {
    if (!redis.client) return false;
    
    const prefix = `ratelimit:${type}:`;
    const redisKey = `${prefix}${key}`;
    
    try {
      await redis.client.del(redisKey);
      return true;
    } catch (error) {
      logger.error('Rate limit reset error:', error);
      return false;
    }
  }
};

/**
 * WebSocket rate limiting middleware
 * @param {Object} options - Rate limit options
 * @returns {Function} Socket.io middleware
 */
exports.socketRateLimit = (options = {}) => {
  return async (socket, next) => {
    try {
      const type = options.type || 'socket';
      const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
      
      // Generate key based on user ID if authenticated, otherwise IP
      let key;
      if (socket.data && socket.data.userId) {
        key = `user:${socket.data.userId}`;
      } else {
        key = `ip:${clientIp}`;
      }
      
      // Check rate limit
      const result = await exports.rateLimitService.checkRateLimit(key, type, options);
      
      if (result.limited) {
        logger.warn(`WebSocket rate limited: ${key} (${type})`);
        return next(new Error('Rate limit exceeded, please try again later'));
      }
      
      // Add rate limit info to socket
      socket.rateLimit = {
        remaining: result.remaining,
        resetTime: result.resetTime
      };
      
      next();
    } catch (error) {
      logger.error('WebSocket rate limit error:', error);
      next(new Error('Internal server error'));
    }
  };
};

/**
 * WebSocket message rate limiting middleware
 * @param {Object} io - Socket.io instance
 * @param {Object} options - Rate limit options
 * @returns {Function} Socket middleware for messages
 */
exports.socketMessageRateLimit = (io, options = {}) => {
  const messageCounters = new Map();
  
  // Clean up counters periodically
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    const windowMs = options.windowMs || securityConfig.socket.rateLimiting.messagesPerMinute || 60000;
    
    for (const [key, data] of messageCounters.entries()) {
      if (now - data.timestamp > windowMs) {
        messageCounters.delete(key);
      }
    }
  }, 60000); // Clean up every minute
  
  // Ensure cleanup interval is terminated when server shuts down
  if (io) {
    io.on('close', () => {
      clearInterval(cleanupInterval);
    });
  }
  
  return (socket) => {
    // Add middleware to all incoming events
    socket.use(async (packet, next) => {
      try {
        const [eventName] = packet;
        
        // Skip internal events
        if (eventName.startsWith('socket.') || eventName === 'disconnect') {
          return next();
        }
        
        const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
        const key = socket.data && socket.data.userId ? `user:${socket.data.userId}` : `ip:${clientIp}`;
        
        // Use Redis for distributed rate limiting if available
        if (redis.client) {
          const result = await exports.rateLimitService.checkRateLimit(
            key, 
            'socketMessage', 
            {
              windowMs: options.windowMs || 60000,
              max: options.max || securityConfig.socket.rateLimiting.messagesPerMinute || 100
            }
          );
          
          if (result.limited) {
            logger.warn(`WebSocket message rate limited: ${key}`);
            return next(new Error('Message rate limit exceeded'));
          }
        } else {
          // Fallback to in-memory rate limiting
          const now = Date.now();
          const windowMs = options.windowMs || 60000;
          const max = options.max || securityConfig.socket.rateLimiting.messagesPerMinute || 100;
          
          let data = messageCounters.get(key);
          
          if (!data) {
            data = { count: 0, timestamp: now };
            messageCounters.set(key, data);
          } else if (now - data.timestamp > windowMs) {
            // Reset if window has passed
            data.count = 0;
            data.timestamp = now;
          }
          
          data.count++;
          
          if (data.count > max) {
            logger.warn(`WebSocket message rate limited (in-memory): ${key}`);
            return next(new Error('Message rate limit exceeded'));
          }
        }
        
        next();
      } catch (error) {
        logger.error('WebSocket message rate limit error:', error);
        next(new Error('Internal server error'));
      }
    });
  };
};

/**
 * Connection throttling middleware for WebSockets
 * Limits the number of connections per IP address
 * @param {Object} options - Rate limit options
 * @returns {Function} Socket.io middleware
 */
exports.socketConnectionThrottle = (options = {}) => {
  return async (socket, next) => {
    try {
      const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
      const type = 'socketConnection';
      const key = `ip:${clientIp}`;
      
      // Use the shared rate limit service
      const result = await exports.rateLimitService.checkRateLimit(
        key, 
        type, 
        {
          windowMs: options.windowMs || securityConfig.socket.rateLimiting.connectionWindowMs || 60000,
          max: options.max || securityConfig.socket.rateLimiting.connectionsPerIP || 10
        }
      );
      
      if (result.limited) {
        logger.warn(`WebSocket connection throttled: ${key}`);
        return next(new Error('Too many connections, please try again later'));
      }
      
      // Add throttle info to socket
      socket.connectionThrottle = {
        remaining: result.remaining,
        resetTime: result.resetTime
      };
      
      next();
    } catch (error) {
      logger.error('WebSocket connection throttle error:', error);
      next(new Error('Internal server error'));
    }
  };
};

/**
 * WebSocket authentication rate limiting middleware
 * Limits the number of authentication attempts per IP address
 * @param {Object} options - Rate limit options
 * @returns {Function} Socket.io middleware
 */
exports.socketAuthRateLimit = (options = {}) => {
  return async (socket, next) => {
    try {
      const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
      const type = 'socketAuth';
      const key = `ip:${clientIp}`;
      
      // Use the shared rate limit service
      const result = await exports.rateLimitService.checkRateLimit(
        key, 
        type, 
        {
          windowMs: options.windowMs || securityConfig.socket.rateLimiting.authWindowMs || 900000, // 15 minutes
          max: options.max || securityConfig.socket.rateLimiting.authAttemptsPerIP || 5
        }
      );
      
      if (result.limited) {
        logger.warn(`WebSocket auth rate limited: ${key}`);
        return next(new Error('Too many authentication attempts, please try again later'));
      }
      
      // Add rate limit info to socket
      socket.authRateLimit = {
        remaining: result.remaining,
        resetTime: result.resetTime
      };
      
      // Store the rate limit key for later use (e.g., to reset on successful auth)
      socket.authRateLimitKey = key;
      
      next();
    } catch (error) {
      logger.error('WebSocket auth rate limit error:', error);
      next(new Error('Internal server error'));
    }
  };
};

/**
 * Reset rate limit for a specific key and type
 * @param {string} key - The rate limit key
 * @param {string} type - The type of rate limit
 * @returns {Promise<boolean>} Success status
 */
exports.rateLimitService.resetRateLimit = async (key, type) => {
  if (!redis.client) {
    logger.warn('Redis not available for rate limit reset');
    return false;
  }
  
  const prefix = `ratelimit:${type}:`;
  const redisKey = `${prefix}${key}`;
  
  try {
    await redis.client.del(redisKey);
    return true;
  } catch (error) {
    logger.error('Rate limit reset error:', error);
    return false;
  }
};
