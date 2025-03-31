/**
 * WebSocket Controller
 * Handles WebSocket-specific authentication and authorization
 * 
 * This controller provides functions for WebSocket connections,
 * room management, and event handling while reusing existing
 * services to avoid duplication.
 */

const tokenService = require('../services/token.service');
const sessionService = require('../services/session.service');
const securityService = require('../services/security.service');
const socketService = require('../services/socket.service');
const eventPropagationService = require('../services/event-propagation.service');
const { EVENT_NAMES } = require('../constants');
const logger = require('../../../utils/logger');

/**
 * Authenticate WebSocket connection
 * Reuses token service for validation
 * 
 * @param {Object} socket - Socket.IO socket
 * @param {Function} next - Next middleware function
 */
exports.authenticateConnection = async (socket, next) => {
  try {
    // Extract token from cookies (handled by middleware)
    const token = socket.handshake.auth.token || 
                  (socket.request.cookies && socket.request.cookies.accessToken);
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    // Validate token using existing token service
    const decoded = await tokenService.verifyAccessToken(token);
    
    // Attach user data to socket
    socket.user = {
      id: decoded.userId || decoded.sub,
      sessionId: decoded.sessionId,
      deviceId: decoded.deviceId
    };
    
    // Update session activity
    await sessionService.updateSessionActivity(decoded.sessionId);
    
    next();
  } catch (error) {
    logger.error('WebSocket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

/**
 * Authorize room join request
 * Uses socket service for room validation
 * 
 * @param {Object} socket - Socket.IO socket
 * @param {String} roomName - Room to join
 * @returns {Boolean} - Whether join is authorized
 */
exports.authorizeRoomJoin = (socket, roomName) => {
  try {
    // Use socket service to validate room access
    return socketService.validateRoomAccess(socket.user, roomName);
  } catch (error) {
    logger.error('Room authorization error:', error);
    return false;
  }
};

/**
 * Handle token expiration notification
 * Uses token service for expiration check
 * 
 * @param {Object} io - Socket.IO server instance
 * @param {String} userId - User ID
 */
exports.handleTokenExpiration = async (io, userId) => {
  try {
    // Get all active sessions for user
    const sessions = await sessionService.getActiveSessions(userId);
    
    // Check each session's token expiration
    for (const session of sessions) {
      const expiresIn = await tokenService.getTokenExpirationTime(session.id);
      
      // If token is about to expire, notify user
      if (expiresIn <= 300) { // 5 minutes warning
        const userRoom = socketService.createRoomName('user', userId);
        
        // Use event propagation service to emit to all relevant rooms
        eventPropagationService.emitWithPropagation(io, {
          eventName: EVENT_NAMES.TOKEN_EXPIRING,
          sourceRoom: {
            type: 'user',
            id: userId
          },
          data: {
            sessionId: session.id,
            expiresIn,
            timestamp: Date.now()
          },
          direction: 'down',
          targetRooms: ['device', 'session', 'tab']
        });
      }
    }
  } catch (error) {
    logger.error('Token expiration handling error:', error);
  }
};

/**
 * Process token refresh from WebSocket
 * Uses token service for refresh
 * 
 * @param {Object} socket - Socket.IO socket
 * @param {Object} data - Refresh data
 */
exports.processTokenRefresh = async (socket, data) => {
  try {
    const { refreshToken } = data;
    const userId = socket.user.id;
    const sessionId = socket.user.sessionId;
    
    // Use token service to refresh tokens
    const tokens = await tokenService.refreshAuthTokens(refreshToken, userId, sessionId);
    
    // Emit new tokens to client
    socket.emit(EVENT_NAMES.TOKEN_REFRESHED, {
      success: true,
      message: 'Tokens refreshed successfully'
    });
    
    // Notify other tabs about the refresh
    const sessionRoom = socketService.createRoomName('session', sessionId);
    socket.to(sessionRoom).emit(EVENT_NAMES.TOKEN_REFRESHED, {
      success: true,
      message: 'Tokens refreshed by another tab'
    });
    
    return tokens;
  } catch (error) {
    logger.error('WebSocket token refresh error:', error);
    socket.emit(EVENT_NAMES.TOKEN_REFRESH_FAILED, {
      success: false,
      message: 'Token refresh failed'
    });
    return null;
  }
};

/**
 * Handle security event
 * Uses security service for event processing
 * 
 * @param {Object} io - Socket.IO server instance
 * @param {String} userId - User ID
 * @param {String} eventType - Security event type
 * @param {Object} eventData - Event data
 */
exports.handleSecurityEvent = async (io, userId, eventType, eventData) => {
  try {
    // Process security event using security service
    await securityService.processSecurityEvent(userId, eventType, eventData);
    
    // Determine propagation direction based on event type
    const direction = securityService.getEventPropagationDirection(eventType);
    
    // Use event propagation service to emit to appropriate rooms
    eventPropagationService.emitWithPropagation(io, {
      eventName: eventType,
      sourceRoom: {
        type: 'user',
        id: userId
      },
      data: {
        ...eventData,
        userId,
        timestamp: Date.now()
      },
      direction,
      targetRooms: ['device', 'session', 'tab']
    });
  } catch (error) {
    logger.error('Security event handling error:', error);
  }
};

/**
 * Register socket event handlers
 * Sets up all event listeners for a socket
 * 
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket.IO socket
 */
exports.registerEventHandlers = (io, socket) => {
  // Token events
  socket.on(EVENT_NAMES.REQUEST_TOKEN_REFRESH, (data) => 
    this.processTokenRefresh(socket, data));
  
  // Room events
  socket.on(EVENT_NAMES.JOIN_ROOM, (data) => {
    const { roomName } = data;
    if (this.authorizeRoomJoin(socket, roomName)) {
      socket.join(roomName);
      socket.emit(EVENT_NAMES.ROOM_JOINED, { roomName });
    } else {
      socket.emit(EVENT_NAMES.ROOM_JOIN_FAILED, { 
        roomName, 
        message: 'Not authorized to join this room' 
      });
    }
  });
  
  // Session events
  socket.on(EVENT_NAMES.UPDATE_ACTIVITY, () => {
    sessionService.updateSessionActivity(socket.user.sessionId);
  });
  
  // Disconnect handling
  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}, User: ${socket.user?.id}`);
  });
};