const tokenService = require('../services/token.service');
const User = require('../models/user.model');
const { AppError } = require('../../../utils/errors');
const cookieConfig = require('../config/cookie.config');

/**
 * Authentication middleware
 */
exports.authenticateToken = async (req, res, next) => {
  try {
    // Get token from cookies
    const accessToken = req.cookies[cookieConfig.names.ACCESS_TOKEN];
    
    if (!accessToken) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }
    
    // Verify token
    let decoded;
    try {
      decoded = await tokenService.verifyAccessToken(accessToken);
      
      // Add token expiration info to response headers and request object
      if (decoded.exp) {
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = decoded.exp - now;
        res.set('X-Token-Expires-In', expiresIn.toString());
        req.tokenExpiry = decoded.exp; // Add expiry to request object
      }
      
    } catch (error) {
      console.log('Token verification error:', error.message);
      if (error.name === 'TokenExpiredError') {
        return next(new AppError('Token expired', 401, 'TOKEN_EXPIRED'));
      }
      return next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
    }
    
    // Check if user exists
    const user = await User.findById(decoded.userId || decoded.sub);
    
    if (!user) {
      return next(new AppError('User not found', 401, 'USER_NOT_FOUND'));
    }
    
    // Check if token was issued before password change
    if (user.passwordChangedAt && decoded.iat < user.passwordChangedAt.getTime() / 1000) {
      return next(new AppError('Password changed, please login again', 401, 'PASSWORD_CHANGED'));
    }
    
    // Add user to request
    req.user = user;
    req.session = {
      id: decoded.sessionId
    };
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check user role
 * @param {string[]} roles - Allowed roles
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Permission denied', 403, 'FORBIDDEN'));
    }
    
    next();
  };
};

/**
 * Optional authentication middleware
 * Attempts to authenticate but continues if token is missing or invalid
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    // Get token from cookies
    const accessToken = req.cookies.accessToken;
    
    if (!accessToken) {
      return next(); // Continue without authentication
    }
    
    // Verify token
    try {
      const decoded = jwt.verify(accessToken, tokenConfig.secrets.access);
      
      // Check if user exists
      const user = await User.findById(decoded.userId);
      
      if (user) {
        // Add user to request
        req.user = user;
        req.session = {
          id: decoded.sessionId
        };
      }
    } catch (error) {
      // Continue without authentication if token is invalid
    }
    
    next();
  } catch (error) {
    next();
  }
};
