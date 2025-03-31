const { AppError } = require('../../../utils/errors');
const Session = require('../models/session.model');
const config = require('../config');
const { session: sessionConfig } = config;
const logger = require('../../../utils/logger');
const { ROOM_TYPES, createRoomName } = require('../services/session.service');
const cookie = require('cookie');
const tokenService = require('../services/token.service');
const cookieConfig = require('../config').cookies;

/**
 * Middleware to validate session state
 * Works alongside authenticateToken middleware
 */
exports.validateSession = async (req, res, next) => {
  try {
    // Skip if no user (not authenticated)
    if (!req.user) {
      return next();
    }
    
    // Skip if session already validated by authenticateToken
    if (req.session) {
      return next();
    }
    
    // Get session ID from token payload
    const sessionId = req.user.sessionId;
    
    if (!sessionId) {
      return next(new AppError('Session ID not found in token', 401, 'SESSION_NOT_FOUND'));
    }
    
    // Find session
    const session = await Session.findById(sessionId);
    
    if (!session) {
      return next(new AppError('Session not found', 401, 'SESSION_NOT_FOUND'));
    }
    
    // Validate session timeouts using the token service
    const validationResult = tokenService.validateSessionTimeouts(session);
    if (validationResult.error) {
      return next(new AppError(validationResult.error.message, 401, validationResult.error.code));
    }
    
    // Set session in request
    req.session = session;
    
    // Update session activity asynchronously
    Session.findByIdAndUpdate(
      sessionId,
      { lastActiveAt: new Date() },
      { new: true }
    ).catch(err => {
      logger.error('Failed to update session activity:', err);
    });
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to enforce session limits
 */
exports.enforceSessionLimits = async (req, res, next) => {
  try {
    // Only apply during login/registration
    if (!['POST:/api/auth/login', 'POST:/api/auth/register'].includes(`${req.method}:${req.path}`)) {
      return next();
    }
    
    // Skip if no user yet
    if (!req.user) {
      return next();
    }
    
    const userId = req.user._id;
    
    // Count active sessions
    const activeSessions = await Session.countDocuments({
      userId,
      expiresAt: { $gt: new Date() }
    });
    
    // Check if limit exceeded
    if (activeSessions >= sessionConfig.maxConcurrentSessions) {
      return next(new AppError(
        `Maximum of ${sessionConfig.maxConcurrentSessions} concurrent sessions allowed`,
        400,
        'MAX_SESSIONS_EXCEEDED'
      ));
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Track tab activity and update session
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
exports.trackTabActivity = async (req, res, next) => {
  try {
    // Skip if no session or no tab ID
    if (!req.session || !req.headers['x-tab-id']) {
      return next();
    }
    
    const tabId = req.headers['x-tab-id'];
    const sessionId = req.session._id;
    
    // Update tab activity asynchronously
    Session.updateTabActivity(sessionId, tabId)
      .catch(err => {
        logger.error(`Failed to update tab activity for tab ${tabId}:`, err);
      });
    
    next();
  } catch (error) {
    // Don't fail the request if tab tracking fails
    logger.error('Tab activity tracking error:', error);
    next();
  }
};

/**
 * WebSocket session middleware
 * @param {Object} io - Socket.io instance
 * @returns {Function} Socket.io middleware
 */
exports.socketSessionMiddleware = (io) => {
  return async (socket, next) => {
    try {
      // Extract cookies from socket request
      const cookies = socket.request.headers.cookie;
      if (!cookies) {
        logger.warn("Socket connection rejected: No cookies found");
        return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
      }

      // Parse cookies
      const parsedCookies = cookie.parse(cookies);
      const accessToken = parsedCookies[cookieConfig.names.ACCESS_TOKEN];
      
      if (!accessToken) {
        logger.warn("Socket connection rejected: No access token found");
        return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
      }

      // Validate token using the same service as HTTP routes
      const decoded = await tokenService.verifyAccessToken(accessToken);
      if (!decoded || !decoded.sessionId) {
        return next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
      }

      // Set user data in socket
      socket.data = {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        deviceId: decoded.deviceId,
        tabId: socket.handshake.query.tabId
      };
      
      // Use the session service to validate the session
      const session = await Session.findById(decoded.sessionId);
      
      if (!session) {
        return next(new AppError('Session not found', 401, 'SESSION_NOT_FOUND'));
      }
      
      // Validate session timeouts
      const validationResult = tokenService.validateSessionTimeouts(session);
      if (validationResult.error) {
        return next(new AppError(validationResult.error.message, 401, validationResult.error.code));
      }
      
      // Store session in socket
      socket.session = session;
      
      // Update tab in session if tabId provided
      if (socket.data.tabId) {
        await Session.updateTabActivity(decoded.sessionId, socket.data.tabId, socket.id);
      } else {
        // Just update session activity
        await Session.findByIdAndUpdate(
          decoded.sessionId,
          { lastActiveAt: new Date() },
          { new: true }
        );
      }
      
      // Join appropriate rooms based on hierarchy
      socket.join(createRoomName(ROOM_TYPES.USER, decoded.userId));
      socket.join(createRoomName(ROOM_TYPES.DEVICE, decoded.deviceId));
      socket.join(createRoomName(ROOM_TYPES.SESSION, decoded.sessionId));
      if (socket.data.tabId) {
        socket.join(createRoomName(ROOM_TYPES.TAB, socket.data.tabId));
      }
      
      // Setup socket event handlers for session management
      setupSocketSessionHandlers(socket, io);
      
      next();
    } catch (error) {
      logger.error('Socket session middleware error:', error);
      next(new AppError('Session validation failed', 401, 'SESSION_VALIDATION_FAILED'));
    }
  };
};

/**
 * Setup socket event handlers for session management
 * @param {Object} socket - Socket.io socket
 * @param {Object} io - Socket.io instance
 */
function setupSocketSessionHandlers(socket, io) {
  const { userId, sessionId, deviceId, tabId } = socket.data;
  
  // Handle tab activity updates
  socket.on('tab:active', async (data) => {
    try {
      if (!tabId) return;
      
      await Session.updateTabActivity(sessionId, tabId, socket.id, true);
      
      // Broadcast to other tabs in the same session
      socket.to(createRoomName(ROOM_TYPES.SESSION, sessionId))
        .emit('tab:status', { tabId, active: true });
        
      logger.debug(`Tab ${tabId} marked as active`);
    } catch (error) {
      logger.error(`Failed to update tab activity for ${tabId}:`, error);
    }
  });
  
  socket.on('tab:inactive', async (data) => {
    try {
      if (!tabId) return;
      
      await Session.updateTabActivity(sessionId, tabId, socket.id, false);
      
      // Broadcast to other tabs in the same session
      socket.to(createRoomName(ROOM_TYPES.SESSION, sessionId))
        .emit('tab:status', { tabId, active: false });
        
      logger.debug(`Tab ${tabId} marked as inactive`);
    } catch (error) {
      logger.error(`Failed to update tab activity for ${tabId}:`, error);
    }
  });
  
  // Handle session timeout acknowledgments
  socket.on('session:acknowledge_warning', async (data) => {
    try {
      const { warningType } = data;
      
      if (!warningType) return;
      
      // Update warning acknowledgment
      await Session.findByIdAndUpdate(
        sessionId,
        { 
          $set: { lastWarningAcknowledged: new Date() },
          $push: { 
            'warningsSent.$[elem].acknowledged': true 
          }
        },
        { 
          arrayFilters: [{ 'elem.warningType': warningType }],
          new: true 
        }
      );
      
      // Broadcast to all tabs in the session
      io.to(createRoomName(ROOM_TYPES.SESSION, sessionId))
        .emit('session:warning_acknowledged', { warningType });
        
      logger.debug(`Session warning ${warningType} acknowledged for session ${sessionId}`);
    } catch (error) {
      logger.error(`Failed to acknowledge warning for session ${sessionId}:`, error);
    }
  });
  
  // Handle session extension requests
  socket.on('session:extend', async (data, callback) => {
    try {
      // Check if session can be extended
      const session = await Session.findById(sessionId);
      
      if (!session) {
        return callback({ success: false, error: 'Session not found' });
      }
      
      // Check if session is extendable
      if (session.expiresAt && new Date() > session.expiresAt) {
        return callback({ success: false, error: 'Session already expired' });
      }
      
      // Extend session
      const extendedSession = await Session.findByIdAndUpdate(
        sessionId,
        { 
          lastActiveAt: new Date(),
          // Reset idle timeout warnings
          $pull: { warningsSent: { warningType: 'IDLE' } }
        },
        { new: true }
      );
      
      // Broadcast to all tabs in the session
      io.to(createRoomName(ROOM_TYPES.SESSION, sessionId))
        .emit('session:extended', { 
          expiresAt: extendedSession.expiresAt,
          lastActiveAt: extendedSession.lastActiveAt
        });
      
      callback({ 
        success: true, 
        expiresAt: extendedSession.expiresAt,
        lastActiveAt: extendedSession.lastActiveAt
      });
      
      logger.debug(`Session ${sessionId} extended`);
    } catch (error) {
      logger.error(`Failed to extend session ${sessionId}:`, error);
      callback({ success: false, error: 'Failed to extend session' });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', async () => {
    try {
      if (!tabId) return;
      
      // Mark tab as inactive
      await Session.updateTabActivity(sessionId, tabId, null, false);
      
      // Broadcast to other tabs in the same session
      socket.to(createRoomName(ROOM_TYPES.SESSION, sessionId))
        .emit('tab:status', { tabId, active: false, connected: false });
        
      logger.debug(`Tab ${tabId} disconnected`);
    } catch (error) {
      logger.error(`Failed to handle disconnect for tab ${tabId}:`, error);
    }
  });
}

/**
 * Middleware to attach session warning system to response
 */
exports.attachSessionWarningSystem = (req, res, next) => {
  if (!req.session) {
    return next();
  }
  
  // Attach method to send session warnings
  req.sendSessionWarning = async (warningType, message) => {
    try {
      const sessionId = req.session._id;
      
      // Record warning in session
      await Session.findByIdAndUpdate(
        sessionId,
        { 
          $push: { 
            warningsSent: {
              timestamp: new Date(),
              warningType,
              acknowledged: false
            }
          }
        },
        { new: true }
      );
      
      // Send warning via WebSocket if available
      if (req.io) {
        req.io.to(createRoomName(ROOM_TYPES.SESSION, sessionId))
          .emit('session:warning', { 
            type: warningType, 
            message,
            timestamp: new Date()
          });
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to send session warning ${warningType}:`, error);
      return false;
    }
  };
  
  next();
};
