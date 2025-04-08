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
    // Try to get token from multiple sources
    let token;

    // DIRECT CONSOLE LOGS FOR DEBUGGING
    console.log("========== WEBSOCKET AUTH DEBUG ==========");
    console.log("Socket ID:", socket.id);
    console.log("Handshake auth:", JSON.stringify(socket.handshake.auth));
    console.log("Handshake query:", JSON.stringify(socket.handshake.query));
    console.log("Cookie header:", socket.request.headers.cookie);
    console.log("==========================================");

    // 1. Try to get token from auth data
    if (socket.handshake.auth && socket.handshake.auth.token) {
      token = socket.handshake.auth.token;
      console.log("Found token in auth data:", token.substring(0, 20) + "...");
    }

    // 2. If not found, try to get from cookies
    if (!token && socket.request.headers.cookie) {
      const parsedCookies = require("cookie").parse(
        socket.request.headers.cookie
      );
      const cookieConfig = require("../config/cookie.config");
      token = parsedCookies[cookieConfig.names.ACCESS_TOKEN];
      if (token) {
        console.log("Found token in cookies:", token.substring(0, 20) + "...");
      }
    }

    // 3. If still not found, check query parameters
    if (!token && socket.handshake.query && socket.handshake.query.token) {
      token = socket.handshake.query.token;
      console.log(
        "Found token in query parameters:",
        token.substring(0, 20) + "..."
      );
    }

    if (!token) {
      console.log("No access token found in any source");
      return next(new Error("No access token found"));
    }

    // Log token for debugging
    console.log("Token found:", token.substring(0, 20) + "...");

    // IMPROVEMENT: Use the token service for verification
    const tokenService = require("../services/token.service");
    try {
      const decoded = await tokenService.verifyAccessToken(token);
      console.log("Token verified successfully");
      console.log("Decoded token:", decoded);

      // IMPROVEMENT: Check if token is blacklisted
      const isBlacklisted = await tokenService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        return next(new Error("Token has been revoked"));
      }

      // IMPROVEMENT: Validate session
      const sessionService = require("../services/session.service");
      const session = await sessionService.getSessionById(decoded.sessionId);

      if (!session || !session.isActive) {
        console.log("Session expired or invalid");
        return next(new Error("Session expired or invalid"));
      }

      // Store session in socket for later use
      socket.session = session;

      // IMPROVEMENT: Validate device if deviceId is provided
      if (decoded.deviceId) {
        const deviceService = require("../services/device.service");
        const device = await deviceService.getDeviceById(decoded.deviceId);

        if (!device) {
          console.log("Device not found");
          return next(new Error("Device not found"));
        }

        // Store device in socket for later use
        socket.device = device;
      }

      // IMPROVEMENT: Enhanced user data with more context
      socket.user = {
        id: decoded.sub || decoded.userId,
        role: decoded.role || "user",
        sessionId: decoded.sessionId,
        deviceId: socket.handshake.auth.deviceId || decoded.deviceId,
        tabId: socket.handshake.auth.tabId,
        tokenExpiry: decoded.exp,
        authenticated: true,
        authTime: Date.now(),
      };

      console.log("Authentication successful for user:", socket.user.id);
      console.log("Device ID:", socket.user.deviceId);
      console.log("Tab ID:", socket.user.tabId);

      next();
    } catch (error) {
      console.error("Authentication error:", error.message);

      // IMPROVEMENT: More detailed error messages
      if (error.name === "TokenExpiredError") {
        return next(new Error("Authentication token expired"));
      } else if (error.code === "TOKEN_REVOKED") {
        return next(new Error("Authentication token revoked"));
      }

      // Default error message
      return next(new Error("Invalid authentication: " + error.message));
    }
  } catch (error) {
    console.error("Unexpected error in authenticateSocket:", error);
    return next(new Error("Authentication failed: " + error.message));
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
