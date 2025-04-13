/**
 * Primus configuration and setup
 */
const logger = require("../utils/logger");
const corsConfig = require("./cors.config");
const primusService = require("../services/primus.service");

/**
 * Sets up Primus with the HTTP server
 * @param {Object} httpServer - HTTP server instance
 * @param {Object} services - Services to use (e.g., crossTabService)
 * @returns {Object} Primus server instance
 */
const setupPrimus = async (httpServer, services = {}) => {
  try {
    // Import Redis clients
    const { redisClient, isRedisAvailable } = require("./redis");

    // Create Primus server with configuration
    const primusOptions = {
      transformer: "websockets",
      pathname: "/primus",
      parser: "json",
      compression: true,
      pingInterval: 30000, // 30 seconds
      maxLength: 500000, // Max message size
      cors: {
        origin: corsConfig.origin || "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      // Enable debugging
      debug: process.env.NODE_ENV !== "production",
      // Transport options
      transport: {
        // Allow both polling and websockets
        transports: ["polling", "websocket"],
      },
    };

    // Log the CORS configuration
    logger.debug("Primus CORS configuration:", {
      origin: corsConfig.origin,
      methods: ["GET", "POST"],
      credentials: true,
    });

    // Initialize Primus with services
    const primus = primusService.initializePrimus(
      httpServer,
      primusOptions,
      services
    );

    // Use Redis for scaling if available
    if (isRedisAvailable()) {
      try {
        // Note: For production, you would add Redis adapter here
        // This would require additional setup with primus-redis-rooms or similar
        logger.info(
          "Primus initialized without Redis adapter (not implemented)"
        );
      } catch (error) {
        logger.error("Failed to set up Redis adapter for Primus:", error);
      }
    } else {
      logger.warn("Redis not available, Primus using in-memory storage");
    }

    logger.info("Primus server initialized");
    return primus;
  } catch (error) {
    logger.error("Failed to initialize Primus:", error);
    throw error;
  }
};

module.exports = {
  setupPrimus,
};
