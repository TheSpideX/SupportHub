/**
 * Auth Middleware Index
 * Exports all authentication and security middleware
 */

// Authentication middleware
const { 
  authenticateToken, 
  optionalAuth, 
  refreshToken 
} = require('./authenticate');

// Rate limiting middleware
const { 
  loginRateLimit,
  apiRateLimit,
  refreshTokenRateLimit
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
  // Authentication
  authenticateToken,
  optionalAuth,
  refreshToken,
  
  // Rate limiting
  loginRateLimit,
  apiRateLimit,
  refreshTokenRateLimit,
  
  // CSRF protection
  csrfProtection: validateToken,
  generateCsrfToken: generateToken,
  clearCsrfToken: clearToken,
  
  // Validation schemas
  validationSchemas
};
