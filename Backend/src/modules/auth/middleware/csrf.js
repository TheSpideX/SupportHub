const { AppError } = require('../../../utils/errors');
const securityConfig = require('../config/security.config');
const cookieConfig = require('../config/cookie.config');

/**
 * Generate CSRF token and set in cookie
 */
exports.generateToken = (req, res, next) => {
  try {
    // Use token service to generate CSRF token
    const tokenService = require('../services/token.service');
    const csrfToken = tokenService.generateCsrfToken();
    
    // Set cookie with appropriate settings
    // Note: This cookie must be readable by JavaScript
    res.cookie(cookieConfig.names.CSRF_TOKEN, csrfToken, {
      httpOnly: false, // Must be accessible to frontend
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: cookieConfig.maxAge.CSRF_TOKEN
    });
    
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
    
    // Use token service to validate CSRF token
    const tokenService = require('../services/token.service');
    const isValid = tokenService.validateCsrfToken(headerToken, cookieToken);
    
    if (!isValid) {
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
