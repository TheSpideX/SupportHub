/**
 * Session Controller
 * Handles all session-related operations
 */
const { AppError } = require('../../../utils/errors');
const sessionService = require('../services/session.service');
const tokenService = require('../services/token.service');
const cookieConfig = require('../config/cookie.config');
const logger = require('../../../utils/logger');
const asyncHandler = require('../../../utils/asyncHandler');

/**
 * Validate session
 * @route GET /api/auth/session/validate
 */
exports.validateSession = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const sessionId = req.session.id;
    
    // Validate session using service
    const validationResult = await sessionService.validateSession(sessionId);
    
    if (!validationResult.valid) {
      return res.status(200).json({
        success: true,
        authenticated: false,
        reason: validationResult.reason
      });
    }
    
    // Refresh tokens and set cookies
    const { accessToken, refreshToken } = await tokenService.generateAuthTokens(
      userId,
      req.user.security.tokenVersion,
      sessionId,
      validationResult.session.rememberMe || false
    );
    
    // Set both HTTP-only token cookies
    tokenService.setTokenCookies(res, { accessToken, refreshToken });
    
    // Get session info using service
    const sessionInfo = await sessionService.getSessionInfo(sessionId);
    
    return res.status(200).json({
      success: true,
      authenticated: true,
      data: {
        user: { id: userId },
        session: sessionInfo
      }
    });
  } catch (error) {
    logger.error('Session validation error:', error);
    return next(new AppError('Failed to validate session', 500, 'SESSION_VALIDATION_ERROR'));
  }
};

/**
 * Synchronize session across tabs
 * @route POST /api/auth/session/sync
 */
exports.syncSession = async (req, res, next) => {
  try {
    const sessionId = req.session.id;
    const { tabId, clientInfo, scope, deviceId } = req.body;
    
    // Sync session using service
    const syncResult = await sessionService.syncSession(sessionId, {
      tabId,
      clientInfo,
      userId: req.user._id,
      scope: scope || 'device',
      deviceId: deviceId
    });
    
    if (!syncResult.success) {
      return next(new AppError(syncResult.message, syncResult.statusCode, syncResult.code));
    }
    
    // Broadcast event if WebSocket is available
    if (req.io) {
      await sessionService.broadcastSessionEvent(
        req.io, 
        sessionId, 
        'session-update', 
        syncResult.eventData
      );
    }
    
    return res.status(200).json({
      success: true,
      data: syncResult.sessionInfo
    });
  } catch (error) {
    logger.error('Session sync error:', error);
    return next(new AppError('Failed to sync session', 500, 'SESSION_SYNC_ERROR'));
  }
};

/**
 * Acknowledge session timeout warning
 * @route POST /api/auth/session/timeout-warning/acknowledge
 */
exports.acknowledgeTimeoutWarning = async (req, res, next) => {
  try {
    const sessionId = req.session.id;
    const { warningId } = req.body;
    
    if (!warningId) {
      return next(new AppError('Warning ID is required', 400));
    }
    
    // Acknowledge warning using service
    const result = await sessionService.acknowledgeWarning(sessionId, warningId);
    
    if (!result.success) {
      return next(new AppError(result.message, result.statusCode));
    }
    
    // Broadcast event if WebSocket is available
    if (req.io) {
      await sessionService.broadcastSessionEvent(
        req.io,
        sessionId,
        'warning-acknowledged',
        { warningId }
      );
    }
    
    return res.status(200).json({
      success: true,
      message: 'Warning acknowledged'
    });
  } catch (error) {
    logger.error('Error acknowledging timeout warning:', error);
    return next(new AppError('Failed to acknowledge warning', 500));
  }
};

/**
 * Extend session
 * @route POST /api/auth/session/extend
 */
exports.extendSession = async (req, res, next) => {
  try {
    const sessionId = req.session.id;
    const { reason } = req.body;
    
    // Extend session using service
    const result = await sessionService.extendSession(sessionId, reason);
    
    if (!result.success) {
      return next(new AppError(result.message, result.statusCode));
    }
    
    // Broadcast event if WebSocket is available
    if (req.io) {
      await sessionService.broadcastSessionEvent(
        req.io,
        sessionId,
        'session-extended',
        result.eventData
      );
    }
    
    return res.status(200).json({
      success: true,
      message: 'Session extended',
      data: result.sessionInfo
    });
  } catch (error) {
    logger.error('Error extending session:', error);
    return next(new AppError('Failed to extend session', 500));
  }
};

/**
 * Poll for session events (fallback when WebSocket is down)
 * @route GET /api/auth/session/events
 */
exports.pollSessionEvents = async (req, res, next) => {
  try {
    const sessionId = req.session.id;
    const { lastEventId } = req.query;
    
    // Get events and update activity using service
    const result = await sessionService.pollSessionEvents(sessionId, lastEventId);
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error polling session events:', error);
    return next(new AppError('Failed to poll session events', 500));
  }
};

/**
 * Check authentication status
 * @route GET /api/auth/session/check
 */
exports.checkAuthStatus = async (req, res) => {
  // Get access token from cookie
  const accessToken = req.cookies[cookieConfig.names.ACCESS_TOKEN];
  
  if (!accessToken) {
    return res.status(200).json({
      authenticated: false,
      reason: 'NO_TOKEN'
    });
  }
  
  try {
    // Use service to check auth status
    const result = await sessionService.checkAuthStatus(accessToken);
    
    return res.status(200).json(result);
  } catch (error) {
    return res.status(200).json({
      authenticated: false,
      reason: error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    });
  }
};

/**
 * Join session rooms for WebSocket
 * @route POST /api/auth/session/join-rooms
 */
exports.joinSessionRooms = async (req, res, next) => {
  try {
    const { socketId, tabId } = req.body;
    const userId = req.user._id;
    const sessionId = req.session.id;
    
    if (!socketId || !tabId) {
      return next(new AppError('Socket ID and Tab ID are required', 400));
    }
    
    // Get socket instance from io
    const io = req.io;
    if (!io) {
      return next(new AppError('WebSocket server not available', 500));
    }
    
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      return next(new AppError('Socket not found', 404));
    }
    
    // Join hierarchical rooms using service
    await sessionService.joinSessionRooms(socket, {
      userId,
      sessionId,
      tabId,
      deviceId: req.session.deviceId
    });
    
    return res.status(200).json({
      success: true,
      message: 'Joined session rooms successfully'
    });
  } catch (error) {
    logger.error('Error joining session rooms:', error);
    return next(new AppError('Failed to join session rooms', 500));
  }
};

/**
 * Get active sessions for user
 * @route GET /api/auth/session/active
 */
exports.getActiveSessions = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    const sessions = await sessionService.getActiveSessions(userId);
    
    return res.status(200).json({
      success: true,
      data: sessions
    });
  } catch (error) {
    logger.error('Error fetching active sessions:', error);
    return next(new AppError('Failed to fetch active sessions', 500));
  }
};

/**
 * Terminate session
 * @route POST /api/auth/session/terminate
 */
exports.terminateSession = async (req, res, next) => {
  try {
    const { targetSessionId } = req.body;
    const userId = req.user._id;
    
    if (!targetSessionId) {
      return next(new AppError('Session ID is required', 400));
    }
    
    // Terminate session using service
    const result = await sessionService.terminateSession(targetSessionId, userId);
    
    if (!result.success) {
      return next(new AppError(result.message, result.statusCode));
    }
    
    // Broadcast termination event if WebSocket is available
    if (req.io) {
      await sessionService.broadcastSessionTermination(
        req.io,
        userId,
        targetSessionId,
        'user-terminated'
      );
    }
    
    return res.status(200).json({
      success: true,
      message: 'Session terminated successfully'
    });
  } catch (error) {
    logger.error('Error terminating session:', error);
    return next(new AppError('Failed to terminate session', 500));
  }
};

/**
 * Update session state
 */
exports.updateSessionState = asyncHandler(async (req, res) => {
  const { state } = req.body;
  const userId = req.user._id;
  const sessionId = req.session._id;
  const deviceId = req.device._id;
  const tabId = req.headers['x-tab-id'];
  
  // Use cross-tab service to update state with proper synchronization
  await crossTabService.updateSharedState(
    userId,
    deviceId,
    tabId,
    'session',
    state,
    true // sync across tabs
  );
  
  // Return success
  res.status(200).json({
    status: 'success',
    message: 'Session state updated'
  });
});

/**
 * Get session state
 */
exports.getSessionState = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const deviceId = req.device._id;
  
  // Get synchronized state
  const state = await crossTabService.getSharedState(userId, deviceId, 'session');
  
  res.status(200).json({
    status: 'success',
    data: {
      state
    }
  });
});
