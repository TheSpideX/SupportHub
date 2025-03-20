/**
 * Auth Middleware Index
 * Exports all authentication and security middleware
 * 
 * This file organizes middleware by functionality:
 * - Token authentication
 * - Session validation
 * - CSRF protection
 * - Rate limiting
 */

// Authentication middleware
const { 
  authenticateToken, 
  optionalAuth, 
  refreshToken,
  validateAccessToken
} = require('./authenticate');

// Session middleware
const {
  validateSession,
  enforceSessionLimits,
  updateSessionActivity
} = require('./session');

// Rate limiting middleware
const { 
  loginRateLimit,
  apiRateLimit,
  refreshTokenRateLimit,
  registrationRateLimit
} = require('./rate-limit');

// CSRF protection middleware
const { 
  generateToken, 
  validateToken,
  clearToken 
} = require('./csrf');

// Import validation schemas directly
const validationSchemas = require('../validations/schemas');

// Export all middleware
module.exports = {
  // Token authentication
  authenticateToken,
  optionalAuth,
  refreshToken,
  validateAccessToken,
  
  // Session management
  validateSession,
  enforceSessionLimits,
  updateSessionActivity,
  
  // Rate limiting
  loginRateLimit,
  apiRateLimit,
  refreshTokenRateLimit,
  registrationRateLimit,
  
  // CSRF protection
  csrfProtection: validateToken,
  generateCsrfToken: generateToken,
  clearCsrfToken: clearToken,
  
  // Validation schemas
  validationSchemas
};
