/**
 * WebSocket Initialization
 * Sets up Primus WebSocket server
 */

const Primus = require("primus");
const PrimusRooms = require("primus-rooms");
const jwt = require("jsonwebtoken");
const config = require("../config/config");
const logger = require("../utils/logger");
const User = require("../modules/auth/models/user.model");

// Import WebSocket handlers
const ticketWs = require("../modules/ticket/websocket/ticket.ws");

let primusInstance = null;

/**
 * Initialize WebSocket server
 * @param {Object} server - HTTP server instance
 */
exports.initWebSocket = (server) => {
  logger.info("Initializing WebSocket server");

  // Create Primus instance
  const primus = new Primus(server, {
    transformer: "websockets",
    pathname: "/ws",
    parser: "JSON",
  });

  // Add rooms plugin
  primus.plugin("rooms", PrimusRooms);

  // Authentication middleware
  primus.authorize(async (req, done) => {
    try {
      // Get token from query or headers
      const token =
        req.query.token ||
        req.headers.authorization?.split(" ")[1] ||
        req.headers.token;

      if (!token) {
        return done(new Error("No token provided"));
      }

      // Verify token
      const decoded = jwt.verify(token, config.jwtSecret);

      // Get user
      const user = await User.findById(decoded.id);

      if (!user) {
        return done(new Error("User not found"));
      }

      // Attach user to request
      req.user = user;

      done();
    } catch (error) {
      logger.error("WebSocket authorization error:", error);
      done(error);
    }
  });

  // Initialize handlers
  ticketWs.initTicketWebSocket(primus);

  // Store instance
  primusInstance = primus;

  // Handle connection errors
  primus.on("error", (err) => {
    logger.error("Primus error:", err);
  });

  logger.info("WebSocket server initialized");

  return primus;
};

/**
 * Get Primus instance
 * @returns {Object} Primus instance
 */
exports.getPrimus = () => {
  return primusInstance;
};

/**
 * Send event to room
 * @param {string} room - Room name
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
exports.sendToRoom = (room, event, data) => {
  if (!primusInstance) {
    logger.error("Primus instance not available");
    return;
  }

  primusInstance.room(room).write({
    event,
    data,
  });
};

/**
 * Send event to user
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
exports.sendToUser = (userId, event, data) => {
  if (!primusInstance) {
    logger.error("Primus instance not available");
    return;
  }

  primusInstance.room(`user:${userId}`).write({
    event,
    data,
  });
};

/**
 * Send event to organization
 * @param {string} organizationId - Organization ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
exports.sendToOrganization = (organizationId, event, data) => {
  if (!primusInstance) {
    logger.error("Primus instance not available");
    return;
  }

  primusInstance.room(`org:${organizationId}`).write({
    event,
    data,
  });
};
