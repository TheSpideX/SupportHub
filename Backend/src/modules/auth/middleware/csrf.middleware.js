const Tokens = require('csrf');
const crypto = require('crypto');
const { AuthError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');
const config = require('../config');

const COMPONENT = 'CSRFMiddleware';
const tokens = new Tokens();

/**
 * Generate CSRF token and set it in the response
 */
exports.generateToken = async (req, res, next) => {
  try {
    // Generate a new token
    const secret = tokens.secretSync();
    const token = tokens.create(secret);
    
    // Store the secret in the session
    req.session.csrfSecret = secret;
    
    // Set cookie with the token
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false, // Must be accessible from JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Store token in res.locals for other middleware to access
    res.locals.csrfToken = token;
    
    // Log token generation for debugging
    logger.debug('Generated CSRF token', {
      component: COMPONENT,
      sessionId: req.session.id,
      hasToken: !!token,
      hasSecret: !!req.session.csrfSecret
    });
    
    // If this is a dedicated CSRF token endpoint, send response
    if (req.path === '/csrf-token' || req.path === '/csrf') {
      return res.status(200).json({
        success: true,
        csrfToken: token
      });
    }
    
    // Otherwise continue to next middleware
    next();
  } catch (error) {
    logger.error('Failed to generate CSRF token', {
      component: COMPONENT,
      error: error.message
    });
    
    // For CSRF token endpoints, return error response
    if (req.path === '/csrf-token' || req.path === '/csrf') {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate CSRF token'
      });
    }
    
    next(new AuthError('CSRF_ERROR', 'Failed to generate CSRF token'));
  }
};

/**
 * Get CSRF token from cookie
 */
exports.getCsrfTokenFromCookie = (req) => {
  try {
    return req.cookies['XSRF-TOKEN'];
  } catch (error) {
    logger.error('Failed to get CSRF token from cookie', {
      component: COMPONENT,
      error: error.message
    });
    return null;
  }
};

/**
 * Validate CSRF token from request
 */
exports.validateToken = (req, res, next) => {
  try {
    // Skip validation for development if configured
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_CSRF_VALIDATION === 'true') {
      logger.warn('CSRF validation skipped in development', {
        component: COMPONENT,
        path: req.path
      });
      return next();
    }
    
    // Get the token from headers or request body
    const token = req.headers['x-csrf-token'] || 
                  req.headers['x-xsrf-token'] || 
                  req.body._csrf;
    
    // Get the secret from the session
    const secret = req.session.csrfSecret;
    
    // Log validation attempt for debugging
    logger.debug('Validating CSRF token', {
      component: COMPONENT,
      hasToken: !!token,
      hasSecret: !!secret,
      sessionId: req.session.id,
      headers: Object.keys(req.headers)
    });
    
    if (!token || !secret) {
      logger.warn('Missing CSRF token or secret', {
        component: COMPONENT,
        ip: req.ip,
        method: req.method,
        path: req.path,
        hasToken: !!token,
        hasSecret: !!secret
      });
      
      // If we're in development or testing, generate a new token and continue
      if (process.env.NODE_ENV !== 'production') {
        logger.warn('Generating new CSRF token in non-production environment', {
          component: COMPONENT,
          path: req.path
        });
        return exports.generateToken(req, res, next);
      }
      
      return next(new AuthError('CSRF_INVALID', 'Invalid CSRF token'));
    }
    
    // Validate the token
    if (!tokens.verify(secret, token)) {
      logger.warn('Invalid CSRF token', {
        component: COMPONENT,
        ip: req.ip,
        method: req.method,
        path: req.path
      });
      return next(new AuthError('CSRF_INVALID', 'Invalid CSRF token'));
    }
    
    logger.debug('CSRF token validated successfully', {
      component: COMPONENT,
      path: req.path
    });
    
    next();
  } catch (error) {
    logger.error('CSRF validation error', {
      component: COMPONENT,
      error: error.message
    });
    next(new AuthError('CSRF_ERROR', 'CSRF validation failed'));
  }
};

/**
 * Extract CSRF token from cookies
 * @param {Object} req - Express request object
 * @returns {String|null} CSRF token or null
 */
const extractTokenFromCookie = (req) => {
  if (req.cookies && req.cookies['XSRF-TOKEN']) {
    return req.cookies['XSRF-TOKEN'];
  }
  return null;
};

/**
 * CSRF protection middleware that both generates and validates tokens
 * @returns {Function[]} Array of middleware functions
 */
exports.csrfProtection = () => {
  return [exports.generateToken, exports.validateToken];
};

/**
 * Middleware to handle CSRF errors with appropriate responses
 * @param {Object} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleCsrfErrors = (err, req, res, next) => {
  if (err.code && err.code.startsWith('CSRF_')) {
    // Log the error
    logger.warn('CSRF error handler', {
      component: COMPONENT,
      code: err.code,
      message: err.message,
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    
    // Return standardized error response
    return res.status(403).json({
      error: {
        code: err.code,
        message: err.message,
        details: {
          // Include instructions for frontend
          action: 'Please refresh the page or request a new CSRF token',
          tokenEndpoint: '/api/auth/csrf'
        }
      }
    });
  }
  
  // Pass other errors to next error handler
  next(err);
};

module.exports = {
  generateToken: exports.generateToken,
  validateToken: exports.validateToken,
  csrfProtection: exports.csrfProtection,
  handleCsrfErrors
};
