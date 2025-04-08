/**
 * Authentication Module
 *
 * This module handles all authentication-related functionality including:
 * - User authentication (login, logout, registration)
 * - Session management
 * - Token handling (JWT, refresh tokens)
 * - Two-factor authentication
 * - Password management
 * - Email verification
 * - WebSocket authentication with hierarchical rooms
 */

const express = require("express");
const cookieParser = require("cookie-parser");
const logger = require("../../utils/logger");
const config = require("./config");
const primusConfig = require("../../config/primus");
const roomRegistryService = require("./services/room-registry.service");
const eventPropagation = require("./services/event-propagation.service");

// Export models
const User = require("./models/user.model");
const Token = require("./models/token.model");
const Session = require("./models/session.model");
const SecurityEvent = require("./models/security-event.model");
const Device = require("./models/device.model");
const Tab = require("./models/tab.model");

// Export services
const authService = require("./services/auth.service");
const tokenService = require("./services/token.service");
const sessionService = require("./services/session.service");
const securityService = require("./services/security.service");
const deviceService = require("./services/device.service");
const primusService = require("../../services/primus.service");
const primusAdapterService = require("./services/primus-adapter.service");
const offlineService = require("./services/offline.service");

// Export controllers
const authController = require("./controllers/auth.controller");
const tokenController = require("./controllers/token.controller");
const sessionController = require("./controllers/session.controller");
const securityController = require("./controllers/security.controller");
const deviceController = require("./controllers/device.controller");

// Export middleware
const authMiddleware = require("./middleware/authenticate");
const sessionMiddleware = require("./middleware/session");
const csrfMiddleware = require("./middleware/csrf");
const rateLimitMiddleware = require("./middleware/rate-limit");
// Import Primus authentication middleware
const { authenticatePrimus } = require("./middleware/primus-auth");

// Import routes
const authRoutes = require("./routes");

/**
 * Initialize the auth module
 * @param {Object} app - Express application
 * @param {Object} primus - Primus server instance
 * @param {Object} config - Configuration object
 */
const initializeAuthModule = (app, primus, config = {}) => {
  logger.info("Initializing Auth Module");

  // Apply middleware
  app.use(
    cookieParser(
      config.cookieSecret ||
        process.env.COOKIE_SECRET ||
        "default-cookie-secret"
    )
  );

  // Register routes
  app.use("/api/auth", authRoutes);

  // Setup scheduled tasks for token cleanup
  tokenService.setupTokenCleanup();

  // Initialize session service (which sets up cleanup internally)
  sessionService.initialize({
    store: config.session?.store,
    timeouts: config.session?.timeouts,
    tracking: config.session?.tracking,
  });

  // Initialize security monitoring
  securityService.initialize({ primus });

  // Initialize WebSocket authentication if Primus is provided
  if (primus) {
    // Authentication is handled at the connection level in Primus service
    // No middleware needed here as it's already set up in the Primus service

    // Initialize room registry service
    roomRegistryService.initialize({
      primus,
      redis: config.redis,
      roomConfig: config.websocket?.rooms || {},
    });

    // Initialize event propagation engine
    eventPropagation.initialize({
      primus,
      roomRegistry: roomRegistryService,
      eventConfig: config.websocket?.events || {},
    });

    // Setup Primus event handlers
    primusAdapterService.setupSocketHandlers(primus, {
      roomRegistry: roomRegistryService,
      eventPropagation,
      authService,
      tokenService,
      sessionService,
      securityService,
    });

    logger.info("WebSocket Authentication System Initialized");
  }

  logger.info("Auth Module Initialized");
};

module.exports = {
  initialize: initializeAuthModule,
  init: initializeAuthModule,
  shutdown: async function () {
    logger.info("Shutting down authentication module");

    try {
      // Perform cleanup tasks
      await sessionService.cleanup();

      // Check if stopMonitoring exists before calling it
      if (typeof securityService.stopMonitoring === "function") {
        securityService.stopMonitoring();
      } else {
        logger.warn("Security service stopMonitoring function not found");
      }

      // Cleanup WebSocket services if initialized
      if (roomRegistryService && roomRegistryService.isInitialized) {
        await roomRegistryService.cleanup();
      }

      if (eventPropagation && eventPropagation.isInitialized) {
        await eventPropagation.cleanup();
      }

      logger.info("Authentication module shut down successfully");
    } catch (error) {
      logger.error("Error during authentication module shutdown:", error);
      throw error;
    }
  },
  // Export models
  models: {
    User,
    Token,
    Session,
    SecurityEvent,
    Device,
    Tab,
  },
  // Export controllers
  controllers: {
    authController,
    tokenController,
    sessionController,
    securityController,
    deviceController,
  },
  // Export services
  services: {
    auth: authService,
    token: tokenService,
    session: sessionService,
    security: securityService,
    primus: primusAdapterService,
    device: deviceService,
    offline: offlineService,
  },
  // Export middleware
  middleware: {
    authenticate: authMiddleware,
    session: sessionMiddleware,
    csrf: csrfMiddleware,
    rateLimit: rateLimitMiddleware,
    socketAuth: authenticatePrimus,
  },
};

/**
 * Initialize the authentication module
 * Sets up all required auth services and configurations
 */
exports.init = async (app, primus, config = {}) => {
  try {
    logger.info("Initializing Auth Module");

    // Initialize token service (only if not already initialized)
    if (!tokenService.isInitialized) {
      tokenService.initialize();
    } else {
      logger.debug("Token service already initialized");
    }

    // Initialize session service (only if not already initialized)
    if (!sessionService.isInitialized) {
      sessionService.initialize({
        store: config.session?.store,
        timeouts: config.session?.timeouts,
        tracking: config.session?.tracking,
      });
    } else {
      logger.debug("Session service already initialized");
    }

    // Initialize security service (only if not already initialized)
    if (!securityService.isInitialized) {
      securityService.initializeSecurityMonitoring();
    } else {
      logger.debug("Security service already initialized");
    }

    // Initialize WebSocket services if Primus is provided
    if (primus) {
      // Authentication is handled at the connection level in Primus service
      // No middleware needed here as it's already set up in the Primus service

      // Initialize room registry service
      if (!roomRegistryService.isInitialized) {
        await roomRegistryService.initialize({
          primus,
          redis: config.redis,
          roomConfig: config.websocket?.rooms || {},
        });
      } else {
        logger.debug("Room registry already initialized");
      }

      // Initialize event propagation engine
      if (!eventPropagation.isInitialized) {
        await eventPropagation.initialize({
          primus,
          roomRegistry: roomRegistryService,
          eventConfig: config.websocket?.events || {},
        });
      } else {
        logger.debug("Event propagation engine already initialized");
      }

      // Setup Primus event handlers
      primusAdapterService.setupSocketHandlers(primus, {
        roomRegistry: roomRegistryService,
        eventPropagation,
        authService,
        tokenService,
        sessionService,
        securityService,
      });

      logger.info("WebSocket Authentication System Initialized");
    }

    // Register routes
    app.use("/api/auth", authRoutes);

    logger.info("Auth Module Initialized");
  } catch (error) {
    logger.error("Failed to initialize authentication module:", error);
    throw error;
  }
};

/**
 * Shutdown the authentication module
 * Cleans up resources and connections
 */
const shutdownAuthModule = async function () {
  logger.info("Shutting down authentication module");

  try {
    // Perform cleanup tasks
    await sessionService.cleanup();
    securityService.stopMonitoring();

    // Cleanup WebSocket services if initialized
    if (roomRegistryService.isInitialized) {
      await roomRegistryService.cleanup();
    }

    if (eventPropagation.isInitialized) {
      await eventPropagation.cleanup();
    }

    logger.info("Authentication module shut down successfully");
  } catch (error) {
    logger.error("Error during authentication module shutdown:", error);
    throw error;
  }
};
