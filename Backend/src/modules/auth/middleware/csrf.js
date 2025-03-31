const { AppError } = require('../../../utils/errors');
const securityConfig = require('../config/security.config');
const cookieConfig = require('../config/cookie.config');
const tokenService = require('../services/token.service');
const logger = require('../../../utils/logger');

/**
 * Generate CSRF token and set in cookie
 */
exports.generateToken = (req, res, next) => {
  try {
    // Use token service to generate CSRF token
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
 * Extract CSRF tokens from request or socket
 * @param {Object} req - HTTP request or socket object
 * @param {boolean} isSocket - Whether the request is a socket
 * @returns {Object} Extracted tokens
 */
const extractCsrfTokens = (req, isSocket = false) => {
  let headerToken, cookieToken;
  
  if (isSocket) {
    // For WebSocket requests
    headerToken = req.handshake.headers[securityConfig.csrf.headerName.toLowerCase()] || 
                 (req.handshake.auth && req.handshake.auth.csrfToken);
    
    const cookies = parseCookies(req.request.headers.cookie || '');
    cookieToken = cookies[cookieConfig.names.CSRF_TOKEN];
  } else {
    // For HTTP requests
    headerToken = req.headers[securityConfig.csrf.headerName.toLowerCase()];
    cookieToken = req.cookies[cookieConfig.names.CSRF_TOKEN];
  }
  
  return { headerToken, cookieToken };
};

/**
 * Validate CSRF token for HTTP requests
 */
exports.validateToken = (req, res, next) => {
  try {
    // Skip validation for non-state-changing methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }
    
    const { headerToken, cookieToken } = extractCsrfTokens(req);
    
    // Use token service to validate CSRF token
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

/**
 * WebSocket CSRF validation middleware
 * @param {Object} socket - Socket.io socket
 * @param {Function} next - Next middleware function
 */
exports.validateSocketCsrf = (socket, next) => {
  try {
    // Skip for connection handshake (already validated)
    if (socket.handshake.auth && socket.handshake.auth._csrfValidated) {
      return next();
    }
    
    const { headerToken, cookieToken } = extractCsrfTokens(socket, true);
    
    // Validate token
    const isValid = tokenService.validateCsrfToken(headerToken, cookieToken);
    
    if (!isValid) {
      return next(new AppError('WebSocket CSRF validation failed', 403, 'SOCKET_CSRF_VALIDATION_FAILED'));
    }
    
    // Mark as validated to avoid redundant checks
    if (socket.handshake.auth) {
      socket.handshake.auth._csrfValidated = true;
    }
    
    next();
  } catch (error) {
    logger.error('WebSocket CSRF validation error:', error);
    next(new AppError('WebSocket CSRF validation error', 403, 'SOCKET_CSRF_ERROR'));
  }
};

/**
 * Parse cookies from cookie string
 * @param {String} cookieString - Cookie header string
 * @returns {Object} Parsed cookies
 */
function parseCookies(cookieString) {
  const cookies = {};
  if (!cookieString) return cookies;
  
  cookieString.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    if (name) cookies[name] = value;
  });
  
  return cookies;
}

/**
 * Middleware to refresh CSRF token via WebSocket
 * @param {Object} io - Socket.io instance
 */
exports.setupCsrfSocketHandlers = (io) => {
  const authNamespace = io.of('/auth');
  
  // Handle CSRF token refresh requests
  authNamespace.on('connection', (socket) => {
    socket.on('csrf:refresh', async (callback) => {
      try {
        // Verify user is authenticated
        if (!socket.data || !socket.data.userId) {
          return callback({ success: false, error: 'Authentication required' });
        }
        
        // Generate new CSRF token
        const csrfToken = tokenService.generateCsrfToken();
        
        // Broadcast to all user's connected sockets to update their CSRF token
        socket.to(`user:${socket.data.userId}`).emit('csrf:updated', { token: csrfToken });
        
        // Return new token to requesting client
        callback({ success: true, token: csrfToken });
        
        logger.debug(`CSRF token refreshed for user ${socket.data.userId}`);
      } catch (error) {
        logger.error('CSRF socket refresh error:', error);
        callback({ success: false, error: 'Failed to refresh CSRF token' });
      }
    });
  });
  
  logger.info('CSRF WebSocket handlers initialized');
};
