const jwt = require('jsonwebtoken');
const { AppError } = require('../../../utils/errors');
const User = require('../models/user.model');
const Session = require('../models/session.model');
const TokenBlacklist = require('../models/token-blacklist.model');
const config = require('../config');
const { token: tokenConfig, cookie: cookieConfig } = config;

/**
 * Middleware to authenticate requests using HTTP-only cookies
 */
exports.authenticateToken = async (req, res, next) => {
  try {
    // Get token from HTTP-only cookie
    const token = req.cookies[cookieConfig.names.ACCESS_TOKEN];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required'
        }
      });
    }
    
    try {
      // Verify the token
      const decoded = jwt.verify(token, tokenConfig.ACCESS_TOKEN_SECRET);
      
      // Check if token is blacklisted
      const blacklisted = await TokenBlacklist.findOne({ tokenId: decoded.jti });
      if (blacklisted) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_REVOKED',
            message: 'Token has been revoked'
          }
        });
      }
      
      // Find the user
      const user = await User.findById(decoded.sub);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
      }
      
      // Set user in request
      req.user = user;
      next();
    } catch (tokenError) {
      // Handle token verification errors
      if (tokenError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Token expired'
          }
        });
      }
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token'
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't require authentication
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies[cookieConfig.names.ACCESS_TOKEN];
    
    if (!token) {
      return next();
    }
    
    const decoded = jwt.verify(token, tokenConfig.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded.sub);
    
    if (user) {
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

/**
 * Refresh token middleware
 * Refreshes the access token using the refresh token
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies[cookieConfig.names.REFRESH_TOKEN];
    
    if (!refreshToken) {
      return next(new AppError('Refresh token required', 401, 'REFRESH_TOKEN_REQUIRED'));
    }
    
    const decoded = jwt.verify(refreshToken, tokenConfig.REFRESH_TOKEN_SECRET);
    
    // Check if token is blacklisted
    const blacklisted = await TokenBlacklist.findOne({ tokenId: decoded.jti });
    if (blacklisted) {
      return next(new AppError('Refresh token has been revoked', 401, 'TOKEN_REVOKED'));
    }
    
    // Find the user
    const user = await User.findById(decoded.sub);
    if (!user) {
      return next(new AppError('User not found', 401, 'USER_NOT_FOUND'));
    }
    
    // Find the session
    const session = await Session.findOne({ 
      userId: user._id,
      refreshToken: { $exists: true }
    });
    
    if (!session) {
      return next(new AppError('Session not found', 401, 'SESSION_NOT_FOUND'));
    }
    
    // Generate new tokens
    const tokenService = require('../services/token.service');
    const { accessToken, refreshToken: newRefreshToken } = await tokenService.generateTokens(user, session);
    
    // Set cookies
    tokenService.setTokenCookies(res, accessToken, newRefreshToken);
    
    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Refresh token expired', 401, 'REFRESH_TOKEN_EXPIRED'));
    }
    return next(new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN'));
  }
};
