const crypto = require('crypto');
const { AppError } = require('../../../utils/errors');
const securityConfig = require('../config/security.config');
const cookieConfig = require('../config/cookie.config');

/**
 * Generate CSRF token and set in cookie
 */
exports.generateToken = (req, res, next) => {
  try {
    // Only generate token if not already present
    if (!req.cookies[cookieConfig.names.CSRF_TOKEN]) {
      // Generate random token
      const token = crypto.randomBytes(32).toString('hex');
      
      // Set cookie with appropriate settings
      // Note: This cookie must be readable by JavaScript
      res.cookie(cookieConfig.names.CSRF_TOKEN, token, {
        httpOnly: false, // Must be accessible to frontend
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: cookieConfig.maxAge.CSRF_TOKEN
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validate CSRF token
 */
exports.validateToken = (req, res, next) => {
  try {
    // Skip validation for non-state-changing methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }
    
    // Get token from request header
    const headerToken = req.headers[securityConfig.csrf.headerName.toLowerCase()];
    
    // Get token from cookie
    const cookieToken = req.cookies[cookieConfig.names.CSRF_TOKEN];
    
    // Validate tokens exist and match
    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      return next(new AppError('CSRF token validation failed', 403, 'CSRF_VALIDATION_FAILED'));
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Clear CSRF token
 */
exports.clearToken = (req, res, next) => {
  res.clearCookie(cookieConfig.names.CSRF_TOKEN);
  next();
};
