const tokenService = require('../services/token.service');
const sessionService = require('../services/session.service');
const { AppError } = require('../../../utils/errors');
const { asyncHandler } = require('../../../utils/errorHandlers');
const authConfig = require('../config');
const { token: tokenConfig, cookie: cookieConfig } = authConfig;
const logger = require('../../../utils/logger');
const jwt = require('jsonwebtoken');
const crossTabService = require('../services/cross-tab.service');

/**
 * Refresh tokens
 * @route POST /api/auth/token/refresh
 */
exports.refreshTokens = asyncHandler(async (req, res) => {
  // Get refresh token from cookie
  const refreshToken = req.cookies[cookieConfig.names.REFRESH_TOKEN];
  const { deviceId, tabId, isLeaderTab = false } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      code: 'REFRESH_TOKEN_MISSING',
      message: 'Refresh token is missing'
    });
  }
  
  try {
    // Refresh tokens and update session
    const result = await tokenService.refreshTokens(refreshToken, { deviceId, tabId });
    
    // Set cookies
    tokenService.setTokenCookies(res, {
      accessToken: result.accessToken, 
      refreshToken: result.refreshToken
    });
    
    // Notify other tabs/devices about token refresh via WebSocket
    if (req.io && result.session.userId) {
      tokenService.notifyTokenRefresh(req.io, result.session, { tabId, isLeaderTab, deviceId });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Tokens refreshed successfully',
      data: {
        session: {
          id: result.session._id,
          expiresAt: result.session.expiresAt,
          lastActivity: result.session.lastActiveAt,
          idleTimeout: result.session.idleTimeout
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
    const result = await tokenService.validateToken(tokenToValidate, type);
    return res.status(200).json(result);
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
  const { type = 'all', sessionId, deviceId, tabId } = req.body;
  const cookies = {
    refresh: req.cookies[cookieConfig.names.REFRESH_TOKEN],
    access: req.cookies[cookieConfig.names.ACCESS_TOKEN]
  };
  
  try {
    const result = await tokenService.revokeTokens({
      type,
      sessionId,
      deviceId,
      tabId,
      tokens: cookies
    });
    
    // Clear cookies based on revoked token types
    if (result.tokensRevoked.includes('refresh') || type === 'all') {
      res.clearCookie(cookieConfig.names.REFRESH_TOKEN, cookieConfig.refreshTokenOptions);
    }
    
    if (result.tokensRevoked.includes('access') || type === 'all') {
      res.clearCookie(cookieConfig.names.ACCESS_TOKEN, cookieConfig.accessTokenOptions);
    }
    
    if (result.tokensRevoked.includes('csrf') || type === 'all') {
      res.clearCookie(cookieConfig.names.CSRF_TOKEN, cookieConfig.csrfTokenOptions);
    }
    
    // Notify other tabs/devices about session termination via WebSocket
    if (req.io && result.sessionTerminated && result.userId) {
      tokenService.notifySessionTermination(req.io, {
        userId: result.userId,
        sessionId,
        deviceId,
        reason: 'user_logout'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: `${type} token(s) revoked successfully`
    });
  } catch (error) {
    logger.error('Token revocation error:', error);
    return res.status(500).json({
      success: false,
      code: 'TOKEN_REVOCATION_ERROR',
      message: 'Failed to revoke token(s)'
    });
  }
});

/**
 * Get token status
 * @route GET /api/auth/token/status
 */
exports.getTokenStatus = asyncHandler(async (req, res) => {
  // Get the access token from the cookie
  const accessToken = req.cookies[cookieConfig.names.ACCESS_TOKEN];
  
  if (!accessToken) {
    return res.status(401).json({
      status: 'error',
      code: 'ACCESS_TOKEN_MISSING',
      message: 'No access token found'
    });
  }
  
  try {
    const statusResult = await tokenService.getTokenStatus(accessToken);
    return res.status(200).json(statusResult);
  } catch (error) {
    // If token verification fails, return 401
    return res.status(401).json({
      status: 'error',
      code: error.name === 'TokenExpiredError' ? 'ACCESS_TOKEN_EXPIRED' : 'ACCESS_TOKEN_INVALID',
      message: error.name === 'TokenExpiredError' ? 'Access token has expired' : 'Invalid access token'
    });
  }
});

/**
 * Generate WebSocket token
 * @route POST /api/auth/token/ws-auth
 */
exports.generateWebSocketToken = asyncHandler(async (req, res) => {
  const { deviceId, tabId } = req.body;
  const userId = req.user?._id;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
  }
  
  if (!deviceId) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_DEVICE_ID',
      message: 'Device ID is required'
    });
  }
  
  try {
    const result = await tokenService.generateWebSocketToken(userId, {
      deviceId,
      tabId,
      sessionId: req.sessionId
    });
    
    return res.status(200).json({
      success: true,
      token: result.token,
      rooms: result.rooms
    });
  } catch (error) {
    logger.error('Error generating WebSocket token:', error);
    return res.status(500).json({
      success: false,
      code: 'WS_TOKEN_ERROR',
      message: 'Failed to generate WebSocket token'
    });
  }
});

/**
 * Send token expiration warning
 * @route POST /api/auth/token/expiration-warning
 * @private Internal use only
 */
exports.sendTokenExpirationWarning = asyncHandler(async (req, res) => {
  const { sessionId, userId, deviceId, warningThreshold = 60 } = req.body;
  
  if (!sessionId || !userId) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_PARAMETERS',
      message: 'Session ID and User ID are required'
    });
  }
  
  try {
    const result = await tokenService.sendExpirationWarning({
      sessionId,
      userId,
      deviceId,
      warningThreshold,
      io: req.io
    });
    
    return res.status(200).json({
      success: true,
      message: 'Token expiration warning sent'
    });
  } catch (error) {
    logger.error('Error sending token expiration warning:', error);
    return res.status(500).json({
      success: false,
      code: 'WARNING_SEND_ERROR',
      message: 'Failed to send token expiration warning'
    });
  }
});

/**
 * Broadcast security event
 * @route POST /api/auth/token/security-event
 * @private Internal use only
 */
exports.broadcastSecurityEvent = asyncHandler(async (req, res) => {
  const { userId, eventType, data = {} } = req.body;
  
  if (!userId || !eventType) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_PARAMETERS',
      message: 'User ID and event type are required'
    });
  }
  
  try {
    const result = await tokenService.broadcastSecurityEvent(req.io, userId, eventType, data);
    
    return res.status(200).json({
      success: true,
      message: 'Security event broadcasted'
    });
  } catch (error) {
    logger.error('Error broadcasting security event:', error);
    return res.status(500).json({
      success: false,
      code: 'BROADCAST_ERROR',
      message: 'Failed to broadcast security event'
    });
  }
});

/**
 * Validate WebSocket token
 */
exports.validateWebSocketToken = async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Token not provided'
    });
  }
  
  try {
    const decoded = await tokenService.verifyToken(token, 'ws');
    
    return res.status(200).json({
      success: true,
      valid: true,
      userId: decoded.sub,
      deviceId: decoded.deviceId,
      tabId: decoded.tabId
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      valid: false,
      reason: error.message
    });
  }
};

/**
 * Get token expiration
 */
exports.getTokenExpiration = async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Token not provided'
    });
  }
  
  try {
    const timeRemaining = tokenService.getTokenTimeRemaining(token);
    
    return res.status(200).json({
      success: true,
      expiresIn: timeRemaining,
      isExpiringSoon: timeRemaining < 300 // 5 minutes
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

/**
 * Send refresh notification
 */
exports.sendRefreshNotification = async (req, res) => {
  const userId = req.user._id;
  const sessionId = req.session?.id;
  
  try {
    // Use socket service to notify other tabs/devices
    const io = req.app.get('io');
    tokenService.notifyTokenRefresh(io, userId, sessionId);
    
    return res.status(200).json({
      success: true,
      message: 'Refresh notification sent'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to send refresh notification'
    });
  }
};
