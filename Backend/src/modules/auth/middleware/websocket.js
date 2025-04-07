/**
 * WebSocket Authentication Middleware
 * Handles authentication and authorization for WebSocket connections
 *
 * This middleware validates HTTP-only cookies during WebSocket handshake
 * and manages room access based on the hierarchical room structure.
 */

const { verifyToken } = require("../services/token.service");
const { getSession } = require("../services/session.service");
const userService = require("../services/user.service");
const { validateObject } = require("./validate");

/**
 * Authenticates WebSocket connection using HTTP-only cookies
 * Uses the same validation logic as API routes for consistency
 *
 * @param {Object} socket - Socket.IO socket instance
 * @param {Function} next - Next middleware function
 */
const authenticateSocket = async (socket, next) => {
  try {
    // Access cookies from handshake
    const cookies = socket.request.headers.cookie;
    if (!cookies) {
      return next(new Error("Authentication required"));
    }

    // IMPROVEMENT: Use a proper cookie parsing library
    const parsedCookies = require("cookie").parse(cookies);
    const token = parsedCookies["accessToken"]; // Use the correct cookie name from config

    if (!token) {
      return next(new Error("Access token not found"));
    }

    // IMPROVEMENT: Use the token service for verification
    const tokenService = require("../services/token.service");
    const decoded = await tokenService.verifyAccessToken(token);

    // IMPROVEMENT: Check if token is blacklisted
    const isBlacklisted = await tokenService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return next(new Error("Token has been revoked"));
    }

    // IMPROVEMENT: Enhanced user data with more context
    socket.user = {
      id: decoded.sub || decoded.userId,
      sessionId: decoded.sessionId,
      deviceId: socket.handshake.query.deviceId || decoded.deviceId,
      tabId: socket.handshake.query.tabId,
      tokenExpiry: decoded.exp,
      authenticated: true,
      authTime: Date.now(),
    };

    // IMPROVEMENT: Log successful authentication
    const logger = require("../../../utils/logger");
    logger.debug(`Socket authenticated: ${socket.id}`, {
      userId: socket.user.id,
      sessionId: socket.user.sessionId,
      deviceId: socket.user.deviceId,
    });

    next();
  } catch (error) {
    const logger = require("../../../utils/logger");
    logger.debug(`Socket authentication failed: ${error.message}`);

    // IMPROVEMENT: More detailed error messages
    if (error.code === "TOKEN_EXPIRED") {
      return next(new Error("Authentication token expired"));
    } else if (error.code === "TOKEN_REVOKED") {
      return next(new Error("Authentication token revoked"));
    }

    next(new Error("Invalid authentication"));
  }
};

/**
 * Validates socket session and attaches session data
 *
 * @param {Object} socket - Socket.IO socket instance
 * @param {Function} next - Next middleware function
 */
const validateSocketSession = async (socket, next) => {
  try {
    const { sessionId } = socket.user;

    // Get session from database
    const session = await getSession(sessionId);
    if (!session || session.isRevoked) {
      return next(new Error("Invalid session"));
    }

    // Attach session data to socket
    socket.user.session = session;

    next();
  } catch (error) {
    next(new Error("Session validation failed"));
  }
};

/**
 * Authorizes room join requests based on hierarchical room structure
 *
 * @param {Object} socket - Socket.IO socket instance
 * @param {String} roomName - Name of room to join
 * @returns {Boolean} - Whether join is authorized
 */
const authorizeRoomJoin = (socket, roomName) => {
  // Extract room type and ID from room name
  const [roomType, roomId] = roomName.split(":");

  if (!socket.user) {
    return false;
  }

  switch (roomType) {
    case "user":
      // User can only join their own user room
      return roomId === socket.user.id;

    case "device":
      // User can only join their own device room
      return roomId === socket.user.deviceId;

    case "session":
      // User can only join their own session room
      return roomId === socket.user.sessionId;

    case "tab":
      // Tab rooms are validated by the tab ID which is generated client-side
      // and associated with the session during connection
      return socket.user.tabIds && socket.user.tabIds.includes(roomId);

    default:
      return false;
  }
};

/**
 * Handles token expiration events and notifications
 *
 * @param {Object} io - Socket.IO server instance
 * @param {String} userId - User ID
 * @param {Number} expiresIn - Seconds until token expires
 */
const handleTokenExpiration = (io, userId, expiresIn) => {
  // Send expiration warning when token is about to expire
  if (expiresIn <= 300) {
    // 5 minutes warning
    io.to(`user:${userId}`).emit("token:expiring", {
      expiresIn,
      timestamp: Date.now(),
    });
  }
};

/**
 * Validates WebSocket message data against schema
 * Reuses the existing validation system for consistency
 *
 * @param {Object} socket - Socket.IO socket instance
 * @param {String} eventName - Name of the event being validated
 * @param {Object} data - Data to validate
 * @param {Object} schema - Validation schema
 * @returns {Object|null} - Validation errors or null if valid
 */
const validateSocketMessage = (socket, eventName, data, schema) => {
  try {
    // Apply the same validation logic used in HTTP requests
    const errors = validateObject(data, schema);

    // If validation passes, return null (no errors)
    if (Object.keys(errors).length === 0) {
      return null;
    }

    // If validation fails, emit error event and return errors
    socket.emit("error", {
      event: eventName,
      code: "VALIDATION_ERROR",
      message: "Message validation failed",
      errors,
    });

    return errors;
  } catch (error) {
    // Handle unexpected validation errors
    socket.emit("error", {
      event: eventName,
      code: "VALIDATION_SYSTEM_ERROR",
      message: "Validation system error",
    });

    return { _system: "Validation system error" };
  }
};

/**
 * Creates a validated event handler
 * Wraps an event handler with validation using the specified schema
 *
 * @param {String} eventName - Name of the event
 * @param {Object} schema - Validation schema
 * @param {Function} handler - Event handler function(socket, data)
 * @returns {Function} - Wrapped handler with validation
 */
const createValidatedHandler = (eventName, schema, handler) => {
  return (socket, data) => {
    // Validate the incoming data
    const errors = validateSocketMessage(socket, eventName, data, schema);

    // If validation passed, call the handler
    if (!errors) {
      handler(socket, data);
    }
  };
};

module.exports = {
  authenticateSocket,
  validateSocketSession,
  authorizeRoomJoin,
  handleTokenExpiration,
  validateSocketMessage,
  createValidatedHandler,
};
