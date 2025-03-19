const { AuthError } = require('../errors');
const csrfUtils = require('../utils/csrf.utils');
const logger = require('../../../utils/logger');

const COMPONENT = 'CSRFMiddleware';

/**
 * Generate CSRF token and set as cookie
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.generateToken = (req, res, next) => {
  try {
    const csrfToken = csrfUtils.generateToken();
    
    // Set CSRF token cookie (not HTTP-only so JS can access it)
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    // Also attach to response for initial page load
    res.locals.csrfToken = csrfToken;
    
    next();
  } catch (error) {
    logger.error('CSRF token generation error', { 
      component: COMPONENT, 
      error: error.message 
    });
    next(error);
  }
};

/**
 * Validate CSRF token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
exports.validateToken = (req, res, next) => {
  try {
    // Skip for non-mutating methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    
    // Skip for login route - initial login won't have CSRF token
    if (req.path === '/api/auth/login' || req.path === '/login') {
      logger.info('Skipping CSRF validation for login route', {
        component: COMPONENT
      });
      return next();
    }
    
    const tokenFromHeader = req.headers['x-csrf-token'];
    const tokenFromBody = req.body?.csrf_token;
    const tokenFromCookie = req.cookies?.csrf_token;
    
    // Use token from header or body
    const token = tokenFromHeader || tokenFromBody;
    
    // If no CSRF token in cookie, generate a new one
    if (!tokenFromCookie) {
      if (process.env.NODE_ENV === 'development') {
        // In development, allow requests without CSRF
        logger.warn('No CSRF token in cookie, but allowing in development', {
          component: COMPONENT
        });
        return next();
      }
      
      logger.warn('CSRF validation failed: No token in cookie', {
        component: COMPONENT
      });
      return next(new AuthError('CSRF token missing', 'CSRF_MISSING'));
    }
    
    // If no token in request, reject
    if (!token) {
      logger.warn('CSRF validation failed: No token in request', {
        component: COMPONENT
      });
      return next(new AuthError('CSRF token required', 'CSRF_REQUIRED'));
    }
    
    // Validate token
    if (!csrfUtils.validateToken(token, tokenFromCookie)) {
      logger.warn('CSRF validation failed: Invalid token', {
        component: COMPONENT
      });
      return next(new AuthError('Invalid CSRF token', 'CSRF_INVALID'));
    }
    
    next();
  } catch (error) {
    logger.error('CSRF validation error', { 
      component: COMPONENT, 
      error: error.message 
    });
    next(error);
  }
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
