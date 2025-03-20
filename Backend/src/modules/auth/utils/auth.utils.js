/**
 * Authentication Utilities
 * Common utility functions for authentication
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../../../utils/logger');

// Import models directly
const User = require('../models/user.model');
const Token = require('../models/token.model');
const Session = require('../models/session.model');
const SecurityEvent = require('../models/security-event.model');

// Implement device utils directly
const deviceUtils = {
  normalizeDeviceInfo: (req) => {
    return {
      userAgent: req.headers['user-agent'] || 'unknown',
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      // Add other device info as needed
    };
  },
  generateDeviceId: (deviceInfo) => {
    const data = `${deviceInfo.userAgent}|${deviceInfo.ip}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
};

// Implement security utils directly
const securityUtils = {
  hashToken: (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
  },
  generateRandomToken: (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
  }
};

/**
 * Extract user data for client consumption
 * @param {Object} user - User document from database
 * @returns {Object} Sanitized user data
 */
const extractUserData = (user) => {
  if (!user) return null;
  
  return {
    id: user._id || user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isVerified: user.isVerified,
    has2FA: !!user.twoFactorAuth?.enabled,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    preferences: user.preferences || {},
    profileImage: user.profileImage
  };
};

/**
 * Calculate session expiry time
 * @param {number} durationInSeconds - Session duration in seconds
 * @returns {number} Expiry timestamp in milliseconds
 */
const calculateSessionExpiry = (durationInSeconds = 1800) => {
  return Date.now() + (durationInSeconds * 1000);
};

/**
 * Check if a session is expired
 * @param {Object} session - Session data
 * @returns {boolean} True if session is expired
 */
const isSessionExpired = (session) => {
  if (!session || !session.expiresAt) {
    return true;
  }
  
  return Date.now() > session.expiresAt;
};

/**
 * Format authentication error for consistent client responses
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 * @returns {Object} Formatted error object
 */
const formatAuthError = (code, message, details = {}) => {
  const error = {
    error: {
      code,
      message,
      timestamp: Date.now()
    }
  };
  
  if (Object.keys(details).length > 0) {
    error.error.details = details;
  }
  
  logger.debug('Auth error formatted', { code, message });
  
  return error;
};

/**
 * Sanitize credentials for logging and storage
 * @param {Object} credentials - User credentials
 * @returns {Object} Sanitized credentials
 */
const sanitizeCredentials = (credentials) => {
  if (!credentials) return {};
  
  const sanitized = { ...credentials };
  
  // Remove sensitive fields
  if (sanitized.password) sanitized.password = '[REDACTED]';
  if (sanitized.token) sanitized.token = '[REDACTED]';
  if (sanitized.refreshToken) sanitized.refreshToken = '[REDACTED]';
  if (sanitized.accessToken) sanitized.accessToken = '[REDACTED]';
  if (sanitized.twoFactorToken) sanitized.twoFactorToken = '[REDACTED]';
  
  return sanitized;
};

/**
 * Extract session data from token and request
 * @param {Object} tokenData - Decoded token data
 * @param {Object} req - Express request object
 * @returns {Object} Session data
 */
const extractSessionData = (tokenData, req) => {
  if (!tokenData) return null;
  
  const deviceInfo = deviceUtils.normalizeDeviceInfo({
    userAgent: req.headers['user-agent']
  }, req);
  
  return {
    userId: tokenData.userId || tokenData.sub,
    expiresAt: tokenData.exp ? tokenData.exp * 1000 : calculateSessionExpiry(config.jwt.accessExpiresIn),
    createdAt: tokenData.iat ? tokenData.iat * 1000 : Date.now(),
    lastActivity: Date.now(),
    deviceInfo
  };
};

/**
 * Validate authentication state
 * @param {Object} tokenData - Decoded token data
 * @param {Object} user - User document
 * @returns {Object} Validation result with status and message
 */
const validateAuthState = async (tokenData, user) => {
  if (!tokenData || !user) {
    return { valid: false, reason: 'INVALID_TOKEN_OR_USER' };
  }
  
  // Check if user is active
  if (!user.isActive) {
    return { valid: false, reason: 'USER_INACTIVE' };
  }
  
  // Check if user is locked
  if (user.isLocked) {
    return { valid: false, reason: 'USER_LOCKED' };
  }
  
  // Check if token was issued before password change
  if (user.passwordChangedAt && tokenData.iat * 1000 < user.passwordChangedAt.getTime()) {
    return { valid: false, reason: 'PASSWORD_CHANGED' };
  }
  
  // Check if token is in blacklist
  try {
    const isBlacklisted = await Token.exists({
      token: securityUtils.hashToken(tokenData.jti),
      type: 'blacklist'
    });
    
    if (isBlacklisted) {
      return { valid: false, reason: 'TOKEN_BLACKLISTED' };
    }
  } catch (error) {
    logger.error('Error checking token blacklist', { error: error.message });
    return { valid: false, reason: 'TOKEN_VALIDATION_ERROR' };
  }
  
  return { valid: true };
};

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise} Promise with the function result
 */
const withRetry = async (fn, options = {}) => {
  const maxRetries = options.maxRetries || 3;
  const baseDelay = options.baseDelay || 1000;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

/**
 * Create a standardized auth error object
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Error} originalError - Original error object
 * @returns {Object} Standardized auth error
 */
const createAuthError = (code, message, originalError = null) => {
  const error = {
    code,
    message,
    timestamp: Date.now()
  };
  
  if (originalError) {
    error.originalError = originalError.message;
  }
  
  logger.error(`Auth error: ${message}`, { code, error: originalError });
  
  return error;
};

/**
 * Update the last activity timestamp in session data
 * @param {Object} sessionData - Session data
 * @param {number} timestamp - Timestamp to set
 * @returns {Object} Updated session data
 */
const updateLastActivity = (sessionData, timestamp = Date.now()) => {
  if (!sessionData) return null;
  
  return {
    ...sessionData,
    lastActivity: timestamp
  };
};

/**
 * Get client information from request
 * @param {Object} req - Express request object
 * @returns {Object} Client information
 */
const getClientInfo = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  
  // Extract basic device info from user agent
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);
  const isTablet = /tablet|ipad/i.test(userAgent);
  const isDesktop = !isMobile && !isTablet;
  
  // Extract browser info
  const browserInfo = {};
  if (userAgent.includes('Chrome')) browserInfo.browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browserInfo.browser = 'Firefox';
  else if (userAgent.includes('Safari')) browserInfo.browser = 'Safari';
  else if (userAgent.includes('Edge')) browserInfo.browser = 'Edge';
  else if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) browserInfo.browser = 'Internet Explorer';
  else browserInfo.browser = 'Unknown';
  
  // Extract OS info
  const osInfo = {};
  if (userAgent.includes('Windows')) osInfo.os = 'Windows';
  else if (userAgent.includes('Mac OS')) osInfo.os = 'MacOS';
  else if (userAgent.includes('Linux')) osInfo.os = 'Linux';
  else if (userAgent.includes('Android')) osInfo.os = 'Android';
  else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) osInfo.os = 'iOS';
  else osInfo.os = 'Unknown';
  
  // Get IP address
  const ip = req.headers['x-forwarded-for'] || 
             req.headers['x-real-ip'] || 
             req.connection.remoteAddress || 
             req.ip || 
             '0.0.0.0';
  
  // Create fingerprint from available data
  const fingerprint = `${userAgent}|${ip}|${req.headers['accept-language'] || ''}`;
  
  return {
    userAgent,
    ip,
    deviceType: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
    ...browserInfo,
    ...osInfo,
    fingerprint,
    timestamp: Date.now()
  };
};

module.exports = {
  extractUserData,
  calculateSessionExpiry,
  isSessionExpired,
  formatAuthError,
  sanitizeCredentials,
  withRetry,
  extractSessionData,
  validateAuthState,
  createAuthError,
  updateLastActivity,
  getClientInfo
};
