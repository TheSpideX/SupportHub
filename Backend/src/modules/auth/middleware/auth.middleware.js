const TokenService = require('../services/token.service');
const SessionService = require('../services/session.service');
const { AuthError } = require('../errors');
const logger = require('../../../utils/logger');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/user.model');

// Initialize services
const tokenService = new TokenService();
const sessionService = new SessionService();

const COMPONENT = 'AuthMiddleware';

/**
 * Extract token from request (cookie-based authentication)
 * @param {Object} req - Express request object
 * @returns {string|null} - Extracted token or null
 */
const extractToken = (req) => {
  // Primary method: Check cookies for accessToken
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  
  // Fallback: Check Authorization header (for API clients)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.substring(7);
  }
  
  // No token found
  return null;
};

/**
 * Verify JWT token and return decoded payload
 * @param {string} token - JWT token to verify
 * @returns {Promise<Object>} Decoded token payload
 */
const verifyToken = async (token) => {
  try {
    // Get JWT secret from environment variables or fallback to a default
    const secret = process.env.JWT_SECRET || process.env.TOKEN_SECRET || 'default-jwt-secret-for-development';
    
    if (!secret) {
      throw new Error('JWT secret not configured');
    }
    
    // Verify token
    const decoded = jwt.verify(token, secret);
    
    // Check if token is expired
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      throw new AuthError('TOKEN_EXPIRED', 'Token has expired');
    }
    
    return decoded;
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new AuthError('TOKEN_INVALID', 'Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      throw new AuthError('TOKEN_EXPIRED', 'Token has expired');
    }
    throw error;
  }
};

/**
 * Middleware to authenticate user based on JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header or cookies
    let token = null;
    
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      console.log('Token extracted from Authorization header');
    }
    
    // Check cookies if no token in header
    if (!token && req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
      console.log('Token extracted from cookies');
    }
    
    // Log token presence
    console.log('Token present:', !!token);
    if (token) {
      console.log('Token first 15 chars:', token.substring(0, 15) + '...');
    }
    
    if (!token) {
      logger.warn('No authentication token provided', {
        path: req.path,
        method: req.method,
        headers: JSON.stringify(req.headers),
        cookies: JSON.stringify(req.cookies || {})
      });
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Verify token
    console.log('Verifying token...');
    const decoded = await tokenService.verifyToken(token, 'access');
    console.log('Token verified, decoded payload:', JSON.stringify(decoded, null, 2));
    
    // Get user from database using Mongoose model directly
    console.log('Looking up user with ID:', decoded.userId || decoded.sub);
    const user = await User.findById(decoded.userId || decoded.sub);
    console.log('User found:', !!user);
    
    if (!user) {
      // Try to find if user exists with different ID format
      console.log('User not found, checking database...');
      const userCount = await User.countDocuments({});
      console.log('Total users in database:', userCount);
      
      if (userCount > 0) {
        const sampleUsers = await User.find({}).limit(3);
        console.log('Sample user IDs:', sampleUsers.map(u => u._id.toString()));
      }
      
      logger.warn('User not found for token', {
        userId: decoded.userId || decoded.sub,
        path: req.path,
        tokenIssueTime: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : 'unknown'
      });
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Attach user to request (sanitize sensitive data)
    req.user = {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      // Add other non-sensitive fields as needed
    };
    req.userId = user._id;
    req.sessionId = decoded.sessionId;
    
    console.log('Authentication successful for user:', user.email);
    
    // Continue to next middleware
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    logger.error('Authentication error', {
      error: error.message,
      stack: error.stack,
      path: req.path
    });
    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

/**
 * Optional authentication middleware - doesn't require authentication
 * but will set req.user if a valid token is present
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = (req, res, next) => {
  try {
    // Get token from header or cookie
    const token = req.cookies.token || 
                 (req.headers.authorization && req.headers.authorization.startsWith('Bearer') 
                  ? req.headers.authorization.split(' ')[1] 
                  : null);
    
    if (token) {
      try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
      } catch (error) {
        // Just log the error but continue
        logger.debug('Token verification failed but continuing', {
          component: COMPONENT,
          error: error.message
        });
      }
    }
    
    // Always continue to next middleware
    next();
  } catch (error) {
    logger.error('Error in optional authentication', {
      component: COMPONENT,
      error: error.message,
      stack: error.stack
    });
    next(error);
  }
};

/**
 * Role-based access control middleware
 * @param {Array} allowedRoles - Array of roles that have access
 */
const requireRoles = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthError('AUTHENTICATION_REQUIRED');
      }
      
      if (!allowedRoles.includes(req.user.role)) {
        logger.warn('Insufficient permissions', {
          component: COMPONENT,
          userId: req.user.id,
          userRole: req.user.role,
          requiredRoles: allowedRoles
        });
        
        throw new AuthError('INSUFFICIENT_PERMISSIONS');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Extract user information from token without verification
 * Useful for debugging or non-critical operations
 * @param {String} token - JWT token
 */
const extractUserFromToken = (token) => {
  try {
    return tokenService.decodeToken(token);
  } catch (error) {
    logger.error('Failed to extract user from token', {
      component: COMPONENT,
      error: error.message
    });
    return null;
  }
};

/**
 * Middleware to check if session is valid
 * Used for session validation endpoint
 */
const validateSession = async (req, res, next) => {
  try {
    if (!req.user || !req.user.sessionId) {
      throw new AuthError('SESSION_NOT_FOUND');
    }
    
    const deviceInfo = req.body.deviceInfo || {
      fingerprint: req.user.deviceFingerprint
    };
    
    const sessionValid = await sessionService.validateSession(
      req.user.sessionId,
      deviceInfo
    );
    
    if (!sessionValid.isValid) {
      throw new AuthError(sessionValid.reason || 'SESSION_INVALID');
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to enforce security level requirements
 * @param {Number} requiredLevel - Minimum security level required
 */
const requireSecurityLevel = (requiredLevel) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthError('AUTHENTICATION_REQUIRED');
      }
      
      // Get security level from user or session
      const userSecurityLevel = req.user.securityLevel || 1;
      
      if (userSecurityLevel < requiredLevel) {
        logger.warn('Insufficient security level', {
          component: COMPONENT,
          userId: req.user.id,
          userLevel: userSecurityLevel,
          requiredLevel
        });
        
        throw new AuthError('SECURITY_LEVEL_INSUFFICIENT', {
          currentLevel: userSecurityLevel,
          requiredLevel
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  authenticate,
  optionalAuth,
  requireRoles,
  extractUserFromToken,
  validateSession,
  requireSecurityLevel
};