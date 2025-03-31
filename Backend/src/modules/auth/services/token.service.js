const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../../../utils/errors');
const tokenConfig = require('../config/token.config');
const { cookie: cookieConfig } = require('../config');
const { redisClient } = require('../../../config/redis');
const logger = require('../../../utils/logger');
const sessionService = require('./session.service');
const Token = require('../models/token.model');
const User = require('../models/user.model');
const socketService = require('./socket.service');
const config = require('../config');
const { roomRegistry } = config;
const authErrorHandler = require('../utils/errorHandler');

// Store cleanup intervals for proper shutdown
const cleanupIntervals = [];

// Add initialization flag
let isInitialized = false;

/**
 * Generate token
 * @param {Object} payload
 * @param {string} type - 'access' or 'refresh'
 * @returns {string}
 */
const generateToken = (payload, type = 'access') => {
  if (!tokenConfig || !tokenConfig[type]) {
    logger.error(`Token configuration for ${type} is missing`);
    throw new Error(`Token configuration for ${type} is missing`);
  }

  const { secret, expiresIn, algorithm } = tokenConfig[type];
  
  if (!secret) {
    logger.error(`Secret for ${type} token is missing`);
    throw new Error(`Secret for ${type} token is missing`);
  }

  return jwt.sign(
    payload,
    secret,
    {
      expiresIn,
      algorithm: algorithm || 'HS256'
    }
  );
};

/**
 * Verify token
 * @param {string} token
 * @param {string} type - 'access' or 'refresh'
 * @returns {Object} decoded token
 */
const verifyToken = (token, type = 'access') => {
  try {
    // Fix: Use the correct property path based on token config structure
    const secret = type === 'access' 
      ? tokenConfig.access.secret 
      : tokenConfig.refresh.secret;
    
    if (!secret) {
      logger.error(`Secret for ${type} token is missing`);
      throw new AppError(`Secret for ${type} token is missing`, 500, 'TOKEN_CONFIG_ERROR');
    }
    
    return jwt.verify(token, secret);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Token expired', 401, 'TOKEN_EXPIRED');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }
    throw error;
  }
};

/**
 * Check if token is blacklisted
 * @param {string} token
 * @returns {boolean}
 */
const isTokenBlacklisted = async (token) => {
  const blacklisted = await redisClient.get(`blacklist:${token}`);
  return !!blacklisted;
};

/**
 * Generate tokens for a user
 * @param {Object} user
 * @param {Object} sessionData - Optional session data
 * @returns {Object} access and refresh tokens
 */
exports.generateAuthTokens = async (user, sessionData = {}) => {
  // Create or get session
  const session = sessionData.sessionId 
    ? await sessionService.getSessionById(sessionData.sessionId)
    : await sessionService.createSession({
        userId: user._id,
        userAgent: sessionData.userAgent,
        ipAddress: sessionData.ipAddress,
        deviceInfo: sessionData.deviceInfo
      });

  // Base payload for both tokens
  const basePayload = {
    sub: user._id.toString(),
    userId: user._id.toString(), // For backward compatibility
    email: user.email,
    role: user.role,
    sessionId: session.id,
    jti: uuidv4() // Unique token ID
  };

  // Generate tokens
  const accessToken = generateToken(basePayload, 'access');
  const refreshToken = generateToken(basePayload, 'refresh');
  
  // Generate CSRF token for protection against CSRF attacks
  const csrfToken = crypto.randomBytes(32).toString('hex');
  
  // Store CSRF token in Redis with user ID association
  await redisClient.set(
    `csrf:${csrfToken}`, 
    user._id.toString(),
    'EX',
    tokenConfig.access.expiresIn
  );

  return {
    accessToken,
    refreshToken,
    csrfToken,
    session
  };
};

/**
 * Refresh tokens
 * @param {string} refreshToken
 * @returns {Object} new access and refresh tokens
 */
exports.refreshTokens = async (refreshToken) => {
  logger.debug('Starting token refresh process');
  
  // Verify refresh token
  const decoded = await exports.verifyRefreshToken(refreshToken);
  logger.debug('Refresh token verified', { 
    userId: decoded.sub || decoded.userId,
    sessionId: decoded.sessionId || 'none'
  });
  
  // Get user directly from token payload
  const userId = decoded.sub || decoded.userId;
  if (!userId) {
    throw new Error('User ID not found in token');
  }
  
  // Get user from database
  const user = await User.findById(userId);
  if (!user) {
    logger.error(`User not found for ID: ${userId}`);
    throw new Error('User not found');
  }
  
  if (!user.status || !user.status.isActive) {
    logger.warn(`Inactive user attempted token refresh: ${userId}`);
    throw new Error('User account is inactive');
  }
  
  // Check token version if implemented
  if (user.security && user.security.tokenVersion !== undefined && 
      decoded.version !== undefined && 
      decoded.version !== user.security.tokenVersion) {
    logger.warn(`Token version mismatch for user ${userId}: token=${decoded.version}, user=${user.security.tokenVersion}`);
    throw new Error('Token has been revoked');
  }
  
  // Get session if available
  let session;
  if (decoded.sessionId) {
    try {
      session = await sessionService.getSessionById(decoded.sessionId);
      if (!session) {
        logger.warn(`Session not found: ${decoded.sessionId}`);
        // Create a new session instead of failing
        session = await sessionService.createSession({
          userId: user._id,
          userAgent: decoded.userAgent || 'Unknown'
        });
      }
    } catch (err) {
      logger.error('Error retrieving session:', err);
      // Create a new session
      session = await sessionService.createSession({
        userId: user._id,
        userAgent: decoded.userAgent || 'Unknown'
      });
    }
  } else {
    // Create a new session if none exists
    session = await sessionService.createSession({
      userId: user._id,
      userAgent: decoded.userAgent || 'Unknown'
    });
  }
  
  // Generate new tokens
  const tokenData = await exports.generateAuthTokens(user, {
    sessionId: session.id,
    userAgent: decoded.userAgent
  });
  
  return {
    accessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken,
    session: tokenData.session
  };
};

/**
 * Verify an access token
 * @param {string} token - The access token to verify
 * @returns {Promise<Object>} - The decoded token payload
 */
exports.verifyAccessToken = async (token) => {
  try {
    // Use the correct secret key from config
    // Fix: Use the correct property path based on your token config structure
    const secret = tokenConfig.access.secret;
    
    // Add logging for debugging
    console.log('Verifying access token with secret:', secret ? (secret.substring(0, 3) + '...') : 'undefined');
    
    // Verify the token
    const decoded = jwt.verify(token, secret);
    return decoded;
  } catch (error) {
    console.error('Access token verification failed:', error.message);
    throw error;
  }
};

/**
 * Verify refresh token
 * @param {string} token
 * @returns {Object} decoded token
 */
exports.verifyRefreshToken = async (token) => {
  // Check if token is blacklisted
  const blacklisted = await isTokenBlacklisted(token);
  if (blacklisted) {
    throw new AppError('Refresh token has been revoked', 401, 'TOKEN_REVOKED');
  }
  
  return verifyToken(token, 'refresh');
};

/**
 * Blacklist a token with proper TTL management
 * @param {string} token
 * @param {string} type - 'access' or 'refresh'
 */
exports.blacklistToken = async (token, type = 'access') => {
  try {
    // Decode token without verification to get expiration
    const decoded = jwt.decode(token);
    
    if (!decoded || !decoded.exp) {
      throw new Error('Invalid token format');
    }
    
    // Calculate TTL (time-to-live) in seconds
    const expiryTime = decoded.exp;
    const currentTime = Math.floor(Date.now() / 1000);
    const ttl = Math.max(expiryTime - currentTime, 0);
    
    // Skip blacklisting if token is already expired or about to expire
    if (ttl < 10) {
      logger.debug('Token already expired or about to expire, skipping blacklist');
      return true;
    }
    
    // Use token ID or hash instead of full token to save space
    const tokenId = decoded.jti || crypto.createHash('sha256').update(token).digest('hex');
    
    // Add token to blacklist with expiry
    const ttlSeconds = Math.max(1, ttl + 60); // Add 60s buffer, ensure minimum 1 second
    await redisClient.set(`blacklist:${tokenId}`, '1', 'EX', ttlSeconds);
    
    // Track blacklist size periodically
    if (Math.random() < 0.01) { // 1% chance to check size
      const blacklistSize = await getBlacklistSize();
      logger.debug(`Current token blacklist size: ${blacklistSize} entries`);
      
      // Alert if blacklist grows too large
      if (blacklistSize > 10000) {
        logger.warn(`Token blacklist size (${blacklistSize}) is large, consider cleanup`);
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to blacklist token', { error: error.message, type });
    return false;
  }
};

/**
 * Revoke token
 * @param {string} token
 * @param {string} type - 'access' or 'refresh'
 */
exports.revokeToken = async (token, type = 'access') => {
  try {
    // Decode token to get session ID
    const decoded = jwt.decode(token);
    
    // Blacklist the token
    await exports.blacklistToken(token, type);
    
    // If it's a refresh token and has a session ID, mark the session for cleanup
    if (type === 'refresh' && decoded && decoded.sessionId) {
      try {
        await sessionService.markSessionForCleanup(decoded.sessionId);
      } catch (error) {
        logger.warn('Failed to mark session for cleanup during token revocation', {
          sessionId: decoded.sessionId,
          error: error.message
        });
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to revoke token', { error: error.message, type });
    return false;
  }
};

/**
 * Generate CSRF token
 * @param {string} userId
 * @returns {string} CSRF token
 */
exports.generateCsrfToken = async (userId) => {
  const csrfToken = crypto.randomBytes(32).toString('hex');
  
  // Store CSRF token in Redis with user ID association
  if (userId) {
    await redisClient.set(
      `csrf:${csrfToken}`, 
      userId.toString(),
      'EX',
      tokenConfig.csrfToken.expiresIn
    );
  }
  
  return csrfToken;
};

/**
 * Verify CSRF token
 * @param {string} token
 * @param {string} userId
 * @returns {boolean}
 */
exports.verifyCsrfToken = async (token, userId) => {
  if (!token) return false;
  
  const storedUserId = await redisClient.get(`csrf:${token}`);
  
  // If no user ID is stored or provided, just check if token exists
  if (!userId) return !!storedUserId;
  
  // If user ID is provided, check if it matches
  return storedUserId === userId.toString();
};

/**
 * Set token cookies
 * @param {Object} res - Express response object
 * @param {Object} tokens - Access and refresh tokens
 */
exports.setTokenCookies = (res, tokens) => {
  // Get cookie config
  const cookieNames = cookieConfig.names;
  const baseOptions = {
    httpOnly: true, // Ensure HTTP-only for security
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  };
  
  // Set access token cookie
  if (tokens.accessToken) {
    res.cookie(
      cookieNames.ACCESS_TOKEN, 
      tokens.accessToken, 
      {
        ...baseOptions,
        maxAge: tokenConfig.access.expiresIn * 1000
      }
    );
  }
  
  // Set refresh token cookie
  if (tokens.refreshToken) {
    res.cookie(
      cookieNames.REFRESH_TOKEN, 
      tokens.refreshToken, 
      {
        ...baseOptions,
        maxAge: tokenConfig.refresh.expiresIn * 1000
      }
    );
  }
  
  // Set CSRF token if provided
  if (tokens.csrfToken) {
    res.cookie(
      cookieNames.CSRF_TOKEN,
      tokens.csrfToken,
      {
        ...baseOptions,
        httpOnly: false // CSRF token must be accessible to JavaScript
      }
    );
  }
};

/**
 * Clear token cookies
 * @param {Object} res - Express response object
 */
exports.clearTokenCookies = (res) => {
  const cookieNames = cookieConfig.names;
  const baseOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  };
  
  // Clear all auth cookies
  res.clearCookie(cookieNames.ACCESS_TOKEN, baseOptions);
  res.clearCookie(cookieNames.REFRESH_TOKEN, baseOptions);
  res.clearCookie(cookieNames.CSRF_TOKEN, {...baseOptions, httpOnly: false});
};

/**
 * Initialize token service
 * Sets up token cleanup and other initialization tasks
 */
exports.initialize = function() {
  // Prevent duplicate initialization
  if (exports.isInitialized) {
    logger.debug('Token service already initialized, skipping');
    return;
  }
  
  // Set up scheduled cleanup of expired tokens
  exports.setupTokenCleanup();
  
  // Initialize token blacklist if using Redis
  if (process.env.TOKEN_BLACKLIST_ENABLED === 'true') {
    initializeTokenBlacklist();
  }
  
  exports.isInitialized = true;
  logger.info('Token service initialized');
};

// Export initialization status
exports.isInitialized = isInitialized;

/**
 * Set up scheduled cleanup of expired tokens
 */
exports.setupTokenCleanup = function() {
  logger.info('Setting up token cleanup schedule');
  
  // Set up interval to clean up expired tokens
  const cleanupInterval = setInterval(async () => {
    try {
      const result = await Token.cleanupExpiredTokens();
      logger.debug(`Cleaned up ${result.deletedCount || 0} expired tokens`);
    } catch (error) {
      logger.error('Error during token cleanup:', error);
    }
  }, 3600000); // Run every hour
  
  // Store interval reference for cleanup
  cleanupIntervals.push(cleanupInterval);
  
  logger.info('Token cleanup schedule established');
};

/**
 * Get current size of token blacklist
 * @returns {Promise<number>} Number of blacklisted tokens
 */
async function getBlacklistSize() {
  try {
    const keys = await redisClient.keys('blacklist:*');
    return keys.length;
  } catch (error) {
    logger.error('Failed to get blacklist size', error);
    return 0;
  }
}

/**
 * Clean up expired tokens from blacklist
 * This is automatically handled by Redis TTL, but this function
 * can be used for manual cleanup if needed
 */
async function cleanupExpiredTokens() {
  try {
    // Redis automatically removes expired keys
    // This function is mainly for monitoring
    const before = await getBlacklistSize();
    
    // Force cleanup of any tokens without proper TTL
    const keys = await redisClient.keys('blacklist:*');
    let cleaned = 0;
    
    for (const key of keys) {
      const ttl = await redisClient.ttl(key);
      if (ttl < 0) {
        await redisClient.del(key);
        cleaned++;
      }
    }
    
    const after = await getBlacklistSize();
    logger.info(`Blacklist cleanup: ${before} → ${after} entries (${cleaned} manually removed)`);
  } catch (error) {
    logger.error('Failed to clean up expired tokens:', error);
  }
}

/**
 * Initialize token blacklist
 */
function initializeTokenBlacklist() {
  // Implementation depends on your storage mechanism
  logger.info('Token blacklist initialized');
}

/**
 * Validate CSRF token
 * @param {string} headerToken - Token from request header
 * @param {string} cookieToken - Token from cookie
 * @returns {boolean} Whether the token is valid
 */
exports.validateCsrfToken = function(headerToken, cookieToken) {
  if (!headerToken || !cookieToken) {
    return false;
  }
  
  try {
    // Simple comparison for double-submit cookie pattern
    return headerToken === cookieToken;
  } catch (error) {
    logger.error('Error validating CSRF token:', error);
    return false;
  }
};

/**
 * Clean up resources used by the token service
 * Called during application shutdown
 */
exports.cleanup = function() {
  logger.info('Cleaning up token service resources');
  
  try {
    // Clear all intervals
    cleanupIntervals.forEach(interval => {
      clearInterval(interval);
    });
    cleanupIntervals.length = 0;
    
    logger.info('Token service cleanup completed');
    return true;
  } catch (error) {
    logger.error('Error during token service cleanup:', error);
    return false;
  }
};

/**
 * Get token expiration time
 * @param {string} token - JWT token
 * @returns {number} Expiration time in seconds
 */
exports.getTokenExpiration = (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return 0;
    }
    return decoded.exp;
  } catch (error) {
    logger.error('Failed to get token expiration', error);
    return 0;
  }
};

/**
 * Check if token is about to expire
 * @param {string} token - JWT token
 * @param {number} thresholdSeconds - Seconds threshold before expiration
 * @returns {boolean} True if token is about to expire
 */
exports.isTokenExpiringSoon = (token, thresholdSeconds = 300) => {
  try {
    const expTime = exports.getTokenExpiration(token);
    if (!expTime) return true;
    
    const currentTime = Math.floor(Date.now() / 1000);
    return expTime - currentTime < thresholdSeconds;
  } catch (error) {
    logger.error('Failed to check token expiration', error);
    return true; // Assume token is expiring if we can't check
  }
};

/**
 * Send token expiration warning via WebSocket
 * @param {Object} socket - WebSocket connection
 * @param {string} userId - User ID
 * @param {number} expiresIn - Seconds until expiration
 */
exports.sendTokenExpirationWarning = (socket, userId, expiresIn) => {
  if (!socket) return;
  
  try {
    socket.to(`user:${userId}`).emit('token:expiring', {
      expiresIn,
      timestamp: Date.now()
    });
    
    logger.debug(`Sent token expiration warning to user ${userId}, expires in ${expiresIn}s`);
  } catch (error) {
    logger.error('Failed to send token expiration warning', error);
  }
};

/**
 * Notify connected clients about token refresh
 * @param {Object} io - Socket.io instance
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID that performed the refresh
 */
exports.notifyTokenRefresh = (io, userId, sessionId) => {
  if (!io) return;
  
  try {
    io.to(`user:${userId}`).emit('token:refreshed', {
      sessionId,
      timestamp: Date.now()
    });
    
    logger.debug(`Notified token refresh to user ${userId} sessions`);
  } catch (error) {
    logger.error('Failed to notify token refresh', error);
  }
};

/**
 * Schedule token expiration check and warning
 * @param {Object} io - Socket.io instance
 * @param {string} userId - User ID
 * @param {string} token - JWT token
 * @param {number} warningThreshold - Seconds before expiration to send warning
 */
exports.scheduleTokenExpirationCheck = (io, userId, token, warningThreshold = 300) => {
  try {
    const expTime = exports.getTokenExpiration(token);
    if (!expTime) return;
    
    const currentTime = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = expTime - currentTime;
    const timeUntilWarning = timeUntilExpiry - warningThreshold;
    
    if (timeUntilWarning <= 0) {
      // Already within warning period, send immediately
      exports.sendTokenExpirationWarning(io, userId, timeUntilExpiry);
      return;
    }
    
    // Schedule warning
    setTimeout(() => {
      exports.sendTokenExpirationWarning(io, userId, warningThreshold);
    }, timeUntilWarning * 1000);
    
    logger.debug(`Scheduled token expiration warning for user ${userId} in ${timeUntilWarning}s`);
  } catch (error) {
    logger.error('Failed to schedule token expiration check', error);
  }
};

/**
 * Get time remaining until token expires
 * @param {string} token - JWT token
 * @returns {number} Seconds until expiration, 0 if expired or invalid
 */
exports.getTokenTimeRemaining = (token) => {
  try {
    const expTime = exports.getTokenExpiration(token);
    if (!expTime) return 0;
    
    const currentTime = Math.floor(Date.now() / 1000);
    return Math.max(0, expTime - currentTime);
  } catch (error) {
    logger.error('Failed to get token time remaining', error);
    return 0;
  }
};

/**
 * Notify security event to connected clients
 * @param {Object} io - Socket.io instance
 * @param {string} userId - User ID
 * @param {string} eventType - Type of security event
 * @param {Object} data - Additional event data
 */
exports.notifySecurityEvent = (io, userId, eventType, data = {}) => {
  if (!io) return;
  
  try {
    io.to(`user:${userId}`).emit(`token:${eventType}`, {
      ...data,
      timestamp: Date.now()
    });
    
    logger.debug(`Sent security event ${eventType} to user ${userId}`);
  } catch (error) {
    logger.error(`Failed to send security event ${eventType}`, error);
  }
};

/**
 * Register socket connection with user session
 * @param {Object} socket - Socket.io socket
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 */
exports.registerSocketConnection = async (socket, userId, sessionId) => {
  try {
    // No need to join rooms here as it's handled by socketService.joinHierarchicalRooms
    
    // Update session with socket ID
    if (sessionId) {
      const sessionService = require('./session.service');
      await sessionService.updateSession(sessionId, {
        lastSocketId: socket.id,
        lastSocketConnected: new Date()
      });
    }
    
    logger.debug(`Socket ${socket.id} registered for user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Error registering socket connection:', error);
    return false;
  }
}

/**
 * Validate socket connection using HTTP-only cookie
 * @param {Object} socket - Socket.io socket
 * @returns {Object} Validation result with user data
 */
exports.validateSocketConnection = async (socket) => {
  try {
    const cookies = socket.request.headers.cookie;
    if (!cookies) {
      return { valid: false };
    }
    
    const cookie = require('cookie');
    const parsedCookies = cookie.parse(cookies);
    const token = parsedCookies[config.token.cookieName];
    
    if (!token) {
      return { valid: false };
    }
    
    // Verify token
    const decoded = await this.verifyToken(token);
    
    return {
      valid: true,
      userData: {
        userId: decoded.sub,
        sessionId: decoded.sessionId,
        deviceId: decoded.deviceId,
        tabId: decoded.tabId || null
      }
    };
  } catch (error) {
    logger.error('Error validating socket connection:', error);
    return { valid: false, error: error.message };
  }
}

/**
 * Get all active sessions for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} List of active sessions
 */
exports.getActiveUserSessions = async (userId) => {
  try {
    return await sessionService.getActiveSessions(userId);
  } catch (error) {
    logger.error('Failed to get active user sessions', error);
    return [];
  }
};

/**
 * Validate if socket session is still valid
 * @param {Object} socket - Socket.io socket
 * @returns {Promise<boolean>} True if session is valid
 */
exports.validateSocketSession = async (socket) => {
  try {
    const user = socket.user;
    const sessionId = socket.sessionId;
    
    if (!user || !sessionId) {
      return false;
    }
    
    // Check if session exists and is active
    const session = await sessionService.getSessionById(sessionId);
    if (!session || !session.isActive) {
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to validate socket session', error);
    return false;
  }
};

/**
 * Validate session timeouts
 * @param {Object} session - Session object
 * @returns {Object} Validation result
 */
exports.validateSessionTimeouts = (session) => {
  const now = new Date();
  
  // Check absolute timeout
  if (session.expiresAt && now > session.expiresAt) {
    return {
      valid: false,
      error: {
        message: 'Session expired',
        code: 'SESSION_EXPIRED'
      }
    };
  }
  
  // Check idle timeout
  const lastActivity = session.lastActiveAt || session.createdAt;
  const idleTimeout = session.idleTimeout || sessionConfig.timeouts.idle;
  const idleExpiresAt = new Date(lastActivity.getTime() + idleTimeout * 1000);
  
  if (now > idleExpiresAt) {
    return {
      valid: false,
      error: {
        message: 'Session idle timeout',
        code: 'SESSION_IDLE_TIMEOUT'
      }
    };
  }
  
  return { valid: true };
};
