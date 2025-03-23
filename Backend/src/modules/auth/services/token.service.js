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

// Store cleanup intervals for proper shutdown
const cleanupIntervals = [];

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

  return {
    accessToken,
    refreshToken,
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
    await redisClient.set(`blacklist:${tokenId}`, '1', 'EX', ttl + 60); // Add 60s buffer
    
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
  // Ensure cookie config exists with defaults if not defined
  const cookieSecure = cookieConfig?.accessTokenOptions?.secure ?? true;
  const cookieSameSite = cookieConfig?.accessTokenOptions?.sameSite ?? 'strict';
  const cookieMaxAge = cookieConfig?.accessTokenOptions?.maxAge ?? 900000; // 15 minutes default
  
  // Set token existence flag for frontend detection
  // This is not HTTP-only so frontend can detect authentication state
  res.cookie(
    'auth_token_exists', 
    'true', 
    {
      httpOnly: false,
      secure: cookieSecure,
      sameSite: cookieSameSite,
      path: '/',
      maxAge: cookieMaxAge
    }
  );
  
  if (tokens.accessToken) {
    res.cookie(
      cookieConfig?.names?.ACCESS_TOKEN || 'access_token', 
      tokens.accessToken, 
      cookieConfig?.accessTokenOptions || {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: cookieSameSite,
        path: '/',
        maxAge: cookieMaxAge
      }
    );
  }
  
  if (tokens.refreshToken) {
    res.cookie(
      cookieConfig?.names?.REFRESH_TOKEN || 'refresh_token', 
      tokens.refreshToken, 
      cookieConfig?.refreshTokenOptions || {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: cookieSameSite,
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days default
      }
    );
  }
};

/**
 * Clear token cookies
 * @param {Object} res - Express response object
 */
exports.clearTokenCookies = (res) => {
  // Ensure cookie config exists with defaults if not defined
  const cookieSecure = cookieConfig?.accessTokenOptions?.secure ?? true;
  const cookieSameSite = cookieConfig?.accessTokenOptions?.sameSite ?? 'strict';
  
  // Default cookie names if config is missing
  const accessTokenName = cookieConfig?.names?.ACCESS_TOKEN || 'access_token';
  const refreshTokenName = cookieConfig?.names?.REFRESH_TOKEN || 'refresh_token';
  const csrfTokenName = cookieConfig?.names?.CSRF_TOKEN || 'csrf_token';
  
  // Clear cookies with fallback options
  res.clearCookie(accessTokenName, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: '/'
  });
  
  res.clearCookie(refreshTokenName, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: '/'
  });
  
  res.clearCookie(csrfTokenName, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: '/'
  });
  
  // Clear the token existence flag
  res.clearCookie('auth_token_exists', {
    httpOnly: false,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: '/'
  });
};

/**
 * Initialize token service
 * Sets up token cleanup and other initialization tasks
 */
exports.initialize = function() {
  // Set up scheduled cleanup of expired tokens
  exports.setupTokenCleanup();
  
  // Initialize token blacklist if using Redis
  if (process.env.TOKEN_BLACKLIST_ENABLED === 'true') {
    initializeTokenBlacklist();
  }
  
  logger.info('Token service initialized');
};

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
