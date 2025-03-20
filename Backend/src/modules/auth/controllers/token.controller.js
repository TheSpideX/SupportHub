const tokenService = require('../services/token.service');
const sessionService = require('../services/session.service');
const { AppError } = require('../../../utils/errors');
const { asyncHandler } = require('../../../utils/errorHandlers');
const authConfig = require('../config');
const { token: tokenConfig, cookie: cookieConfig } = authConfig;
const logger = require('../../../utils/logger');
const jwt = require('jsonwebtoken');

/**
 * Refresh tokens
 * @route POST /api/auth/token/refresh
 */
exports.refreshTokens = asyncHandler(async (req, res) => {
  // Get refresh token from cookie
  const refreshToken = req.cookies[cookieConfig.names.REFRESH_TOKEN];
  
  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      code: 'REFRESH_TOKEN_MISSING',
      message: 'Refresh token is missing'
    });
  }
  
  try {
    // Refresh tokens and update session
    const { tokens, session } = await tokenService.refreshTokens(refreshToken);
    
    // Set cookies
    tokenService.setTokenCookies(res, tokens);
    
    // Return session metadata for frontend session monitoring
    return res.status(200).json({
      success: true,
      message: 'Tokens refreshed successfully',
      data: {
        session: {
          id: session._id,
          expiresAt: session.expiresAt,
          lastActivity: session.lastActiveAt,
          idleTimeout: session.idleTimeout
        }
      }
    });
  } catch (error) {
    // Handle specific token errors with proper error codes
    if (error.code === 'TOKEN_EXPIRED' || error.code === 'REFRESH_TOKEN_EXPIRED') {
      return res.status(401).json({
        success: false,
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Refresh token has expired, please login again'
      });
    } else if (error.code === 'INVALID_TOKEN' || error.code === 'REFRESH_TOKEN_INVALID') {
      return res.status(401).json({
        success: false,
        code: 'REFRESH_TOKEN_INVALID',
        message: 'Invalid refresh token'
      });
    } else if (error.code === 'SESSION_EXPIRED') {
      return res.status(401).json({
        success: false,
        code: 'SESSION_EXPIRED',
        message: 'Your session has expired, please login again'
      });
    }
    
    // For other errors
    logger.error('Token refresh error:', error);
    return res.status(500).json({
      success: false,
      code: 'TOKEN_REFRESH_ERROR',
      message: 'Failed to refresh token'
    });
  }
});

/**
 * Generate CSRF token
 * @route GET /api/auth/token/csrf
 */
exports.generateCsrfToken = asyncHandler(async (req, res) => {
  const csrfToken = await tokenService.generateCsrfToken(req.user?._id);
  
  // Set CSRF token cookie
  res.cookie(cookieConfig.names.CSRF_TOKEN, csrfToken, {
    ...cookieConfig.csrfTokenOptions,
    httpOnly: false // CSRF token needs to be accessible to JavaScript
  });
  
  return res.status(200).json({
    success: true,
    csrfToken
  });
});

/**
 * Validate token
 * @route POST /api/auth/token/validate
 */
exports.validateToken = asyncHandler(async (req, res) => {
  const { token, type = 'access' } = req.body;
  
  // If no token provided, check cookies
  const tokenToValidate = token || req.cookies[
    type === 'access' 
      ? cookieConfig.names.ACCESS_TOKEN 
      : cookieConfig.names.REFRESH_TOKEN
  ];
  
  if (!tokenToValidate) {
    return res.status(200).json({
      valid: false,
      message: 'No token provided'
    });
  }
  
  try {
    // Validate token based on type
    const decoded = type === 'access'
      ? await tokenService.verifyAccessToken(tokenToValidate)
      : await tokenService.verifyRefreshToken(tokenToValidate);
    
    // Get session information if available
    let sessionData = null;
    if (decoded.sessionId) {
      try {
        const session = await sessionService.getSessionById(decoded.sessionId);
        if (session) {
          sessionData = {
            id: session.id,
            expiresAt: session.expiresAt,
            lastActivity: session.lastActiveAt
          };
        }
      } catch (err) {
        logger.warn('Session lookup failed during token validation', { error: err.message });
      }
    }
    
    return res.status(200).json({
      valid: true,
      userId: decoded.sub || decoded.userId,
      sessionId: decoded.sessionId,
      session: sessionData
    });
  } catch (error) {
    return res.status(200).json({
      valid: false,
      message: error.message || 'Invalid token'
    });
  }
});

/**
 * Revoke token
 * @route POST /api/auth/token/revoke
 */
exports.revokeToken = asyncHandler(async (req, res) => {
  const { type = 'all', sessionId } = req.body;
  
  if (type === 'refresh' || type === 'all') {
    const refreshToken = req.cookies[cookieConfig.names.REFRESH_TOKEN];
    if (refreshToken) {
      await tokenService.revokeToken(refreshToken, 'refresh');
      res.clearCookie(cookieConfig.names.REFRESH_TOKEN, cookieConfig.refreshTokenOptions);
    }
  }
  
  if (type === 'access' || type === 'all') {
    const accessToken = req.cookies[cookieConfig.names.ACCESS_TOKEN];
    if (accessToken) {
      await tokenService.revokeToken(accessToken, 'access');
      res.clearCookie(cookieConfig.names.ACCESS_TOKEN, cookieConfig.accessTokenOptions);
    }
  }
  
  if (type === 'csrf' || type === 'all') {
    res.clearCookie(cookieConfig.names.CSRF_TOKEN, cookieConfig.csrfTokenOptions);
  }
  
  // End session if sessionId is provided
  if (sessionId && type === 'all') {
    await sessionService.endSession(sessionId, 'user_logout');
  }
  
  return res.status(200).json({
    success: true,
    message: `${type} token(s) revoked successfully`
  });
});

/**
 * Get token status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getTokenStatus = async (req, res) => {
  try {
    // Get the access token from the cookie
    const accessToken = req.cookies.access_token;
    
    if (!accessToken) {
      return res.status(401).json({
        status: 'error',
        message: 'No access token found'
      });
    }
    
    // Verify the token without throwing an error
    try {
      const decoded = jwt.verify(accessToken, tokenConfig.access.secret);
      
      // Calculate time until expiry in seconds
      const expiresIn = Math.floor((decoded.exp * 1000 - Date.now()) / 1000);
      
      return res.status(200).json({
        status: 'success',
        data: {
          expiresIn,
          isValid: expiresIn > 0
        }
      });
    } catch (error) {
      // If token verification fails, return 401
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or expired token'
      });
    }
  } catch (error) {
    logger.error('Error checking token status:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};
