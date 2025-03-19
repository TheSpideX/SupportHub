/**
 * Storage Utility Functions
 * 
 * Handles secure storage operations for authentication data,
 * including HTTP-only cookies, token storage, and session management.
 */

const crypto = require('crypto');
const config = require('../config/auth.config');
const logger = require('../../../utils/logger');

/**
 * Default cookie options
 */
const defaultCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: 30 * 60 * 1000 // 30 minutes default
};

/**
 * Set an HTTP-only cookie
 * @param {Object} res - Express response object
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {Object} options - Cookie options
 */
const setCookie = (res, name, value, options = {}) => {
  const cookieOptions = {
    ...defaultCookieOptions,
    ...options
  };
  
  res.cookie(name, value, cookieOptions);
  
  // Set a flag cookie to indicate token presence (not HTTP-only)
  // This allows the frontend to check if auth tokens exist
  if (name === 'access_token' || name === 'refresh_token') {
    res.cookie(`${name}_exists`, 'true', {
      ...cookieOptions,
      httpOnly: false
    });
  }
  
  logger.debug(`Cookie set: ${name}`, { 
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    maxAge: cookieOptions.maxAge
  });
};

/**
 * Clear a cookie
 * @param {Object} res - Express response object
 * @param {string} name - Cookie name
 * @param {Object} options - Cookie options
 */
const clearCookie = (res, name, options = {}) => {
  const cookieOptions = {
    ...defaultCookieOptions,
    ...options
  };
  
  res.clearCookie(name, cookieOptions);
  
  // Clear the flag cookie as well
  if (name === 'access_token' || name === 'refresh_token') {
    res.clearCookie(`${name}_exists`, {
      ...cookieOptions,
      httpOnly: false
    });
  }
  
  logger.debug(`Cookie cleared: ${name}`);
};

/**
 * Set authentication tokens as HTTP-only cookies
 * @param {Object} res - Express response object
 * @param {Object} tokens - Token data
 * @param {Object} options - Cookie options
 */
const setAuthCookies = (res, tokens, options = {}) => {
  if (!tokens) return;
  
  // Set access token cookie
  if (tokens.accessToken) {
    setCookie(res, config.cookie.names.ACCESS_TOKEN, tokens.accessToken, {
      ...options,
      maxAge: config.token.accessExpiresIn * 1000
    });
  }
  
  // Set refresh token cookie
  if (tokens.refreshToken) {
    setCookie(res, config.cookie.names.REFRESH_TOKEN, tokens.refreshToken, {
      ...options,
      maxAge: config.token.refreshExpiresIn * 1000,
      path: '/api/auth' // Restrict refresh token to auth routes
    });
  }
  
  // Set CSRF token cookie (not HTTP-only)
  if (tokens.csrfToken) {
    setCookie(res, config.cookie.names.CSRF_TOKEN, tokens.csrfToken, {
      ...options,
      httpOnly: false,
      maxAge: config.token.accessExpiresIn * 1000
    });
  }
  
  logger.debug('Auth cookies set successfully');
};

/**
 * Clear authentication cookies
 * @param {Object} res - Express response object
 */
const clearAuthCookies = (res) => {
  clearCookie(res, 'access_token');
  clearCookie(res, 'refresh_token', { path: '/api/auth' });
  clearCookie(res, 'csrf_token', { httpOnly: false });
  
  logger.debug('Auth cookies cleared successfully');
};

/**
 * Store session metadata
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} metadata - Session metadata
 */
const storeSessionMetadata = (req, res, metadata) => {
  if (!metadata) return;
  
  // Store minimal session metadata in a cookie
  setCookie(res, 'session_meta', JSON.stringify({
    lastActivity: metadata.lastActivity || Date.now(),
    deviceId: metadata.deviceId || crypto.randomBytes(8).toString('hex')
  }), {
    httpOnly: false, // Allow frontend access
    maxAge: config.session.maxAge || 30 * 24 * 60 * 60 * 1000 // 30 days
  });
  
  logger.debug('Session metadata stored');
};

/**
 * Get session metadata from request
 * @param {Object} req - Express request object
 * @returns {Object|null} Session metadata
 */
const getSessionMetadata = (req) => {
  try {
    const metaCookie = req.cookies.session_meta;
    
    if (!metaCookie) return null;
    
    return JSON.parse(metaCookie);
  } catch (error) {
    logger.error('Error parsing session metadata', { error: error.message });
    return null;
  }
};

/**
 * Create a security context for the session
 * @param {Object} req - Express request object
 * @param {string} userId - User ID
 * @returns {Object} Security context
 */
const createSecurityContext = (req, userId = 'anonymous') => {
  const contextId = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  
  return {
    id: contextId,
    userId,
    createdAt: now,
    lastVerified: now,
    ipHash: crypto.createHash('sha256').update(req.ip || 'unknown').digest('hex'),
    userAgent: req.headers['user-agent'] || 'unknown',
    deviceFingerprint: req.headers['x-device-fingerprint'] || contextId
  };
};

module.exports = {
  setCookie,
  clearCookie,
  setAuthCookies,
  clearAuthCookies,
  storeSessionMetadata,
  getSessionMetadata,
  createSecurityContext
};
