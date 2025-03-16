const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const { AuthError } = require('../errors/auth.error');
const logger = require('../../../utils/logger');

const COMPONENT = 'tokens.utils';

/**
 * Create an access token for a user
 * @param {Object} user - User object
 * @param {Object} options - Additional options
 * @returns {String} JWT access token
 */
const createAccessToken = (user, options = {}) => {
  const { deviceFingerprint, sessionId } = options;
  
  const payload = {
    userId: user._id,
    email: user.email,
    role: user.role,
    type: 'access'
  };
  
  // Add optional fields if provided
  if (deviceFingerprint) payload.deviceFingerprint = deviceFingerprint;
  if (sessionId) payload.sessionId = sessionId;
  
  return jwt.sign(
    payload,
    config.jwt.accessSecret,
    { 
      expiresIn: config.jwt.accessExpiry,
      issuer: config.jwt.issuer || 'tech-support-crm'
    }
  );
};

/**
 * Create a refresh token for a user
 * @param {Object} user - User object
 * @param {Object} options - Additional options
 * @returns {String} JWT refresh token
 */
const createRefreshToken = (user, options = {}) => {
  const { deviceFingerprint, rememberMe, sessionId } = options;
  
  const payload = {
    userId: user._id,
    version: user.tokenVersion || user.security?.tokenVersion || 0,
    type: 'refresh',
    jti: crypto.randomBytes(16).toString('hex')
  };
  
  // Add optional fields if provided
  if (deviceFingerprint) payload.deviceFingerprint = deviceFingerprint;
  if (sessionId) payload.sessionId = sessionId;
  
  // Determine expiry based on rememberMe flag
  const expiresIn = rememberMe ? 
    (config.jwt.extendedRefreshExpiry || '30d') : 
    config.jwt.refreshExpiry;
  
  return jwt.sign(
    payload,
    config.jwt.refreshSecret,
    { 
      expiresIn,
      issuer: config.jwt.issuer || 'tech-support-crm'
    }
  );
};

/**
 * Verify a token's validity
 * @param {String} token - JWT token to verify
 * @param {String} type - Token type ('access' or 'refresh')
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token, type = 'access') => {
  const secret = type === 'access' 
    ? config.jwt.accessSecret 
    : config.jwt.refreshSecret;
    
  try {
    const decoded = jwt.verify(token, secret);
    
    // Verify token type matches expected type
    if (decoded.type && decoded.type !== type) {
      logger.warn('Token type mismatch', { 
        component: COMPONENT, 
        expected: type, 
        received: decoded.type 
      });
      throw new AuthError('INVALID_TOKEN_TYPE');
    }
    
    return decoded;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    if (error.name === 'TokenExpiredError') {
      logger.warn('Expired token used', { 
        component: COMPONENT, 
        error: error.message 
      });
      throw new AuthError('TOKEN_EXPIRED');
    }

    logger.warn('Invalid token', { 
      component: COMPONENT, 
      error: error.message 
    });
    throw new AuthError('INVALID_TOKEN');
  }
};

/**
 * Decode a token without verification
 * @param {String} token - JWT token to decode
 * @returns {Object|null} Decoded token payload or null if invalid
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    logger.warn('Failed to decode token', { 
      component: COMPONENT, 
      error: error.message 
    });
    return null;
  }
};

/**
 * Hash a token for storage
 * @param {String} token - Token to hash
 * @returns {String} Hashed token
 */
const hashToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

/**
 * Calculate token expiration time in seconds
 * @param {String} token - JWT token
 * @returns {Number} Seconds until expiration
 */
const getTokenExpiry = (token) => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return 0;
  
  return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
};

/**
 * Create a temporary token (for password reset, email verification, etc.)
 * @param {String} type - Token type
 * @param {Object} payload - Token payload
 * @param {String} expiresIn - Expiration time
 * @returns {String} JWT token
 */
const createTemporaryToken = (type, payload, expiresIn = '1h') => {
  return jwt.sign(
    { ...payload, type },
    config.jwt.accessSecret,
    { 
      expiresIn,
      issuer: config.jwt.issuer || 'tech-support-crm',
      jwtid: crypto.randomBytes(16).toString('hex')
    }
  );
};

module.exports = {
  createAccessToken,
  createRefreshToken,
  verifyToken,
  decodeToken,
  hashToken,
  getTokenExpiry,
  createTemporaryToken
};