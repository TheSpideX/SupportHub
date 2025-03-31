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
const socketIO = require("../../config/socket");
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
const socketService = require("./services/socket.service");

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
const { authenticateSocket } = require("./middleware/websocket");

// Import routes
const authRoutes = require("./routes");

/**
 * Initialize the auth module
 * @param {Object} app - Express application
 * @param {Object} io - Socket.IO server instance
 * @param {Object} config - Configuration object
 */
const initializeAuthModule = (app, io, config = {}) => {
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
  securityService.initializeSecurityMonitoring();

  // Initialize WebSocket authentication if Socket.IO is provided
  if (io) {
    // Apply Socket.IO authentication middleware
    io.use(socketAuthMiddleware);

    // Initialize room registry service
    roomRegistryService.initialize({
      io,
      redis: config.redis,
      roomConfig: config.websocket?.rooms || {},
    });

    // Initialize event propagation engine
    eventPropagation.initialize({
      io,
      roomRegistry: roomRegistryService,
      eventConfig: config.websocket?.events || {},
    });

    // Setup Socket.IO event handlers
    socketService.setupSocketHandlers(io, {
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
  initializeAuthModule,
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
    authService,
    tokenService,
    sessionService,
    securityService,
    deviceService,
    socketService,
    roomRegistryService,
    eventPropagation,
  },
  // Export middleware
  middleware: {
    auth: authMiddleware,
    session: sessionMiddleware,
    csrf: csrfMiddleware,
    rateLimit: rateLimitMiddleware,
    socketAuth: socketAuthMiddleware,
  },
};

/**
 * Initialize the authentication module
 * Sets up all required auth services and configurations
 */
exports.init = async (app, io, config = {}) => {
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

    // Initialize WebSocket services if Socket.IO is provided
    if (io) {
      // Apply Socket.IO authentication middleware
      io.use(socketAuthMiddleware);

      // Initialize room registry service
      if (!roomRegistryService.isInitialized) {
        await roomRegistryService.initialize({
          io,
          redis: config.redis,
          roomConfig: config.websocket?.rooms || {},
        });
      } else {
        logger.debug("Room registry already initialized");
      }

      // Initialize event propagation engine
      if (!eventPropagation.isInitialized) {
        await eventPropagation.initialize({
          io,
          roomRegistry: roomRegistryService,
          eventConfig: config.websocket?.events || {},
        });
      } else {
        logger.debug("Event propagation engine already initialized");
      }

      // Setup Socket.IO event handlers
      socketService.setupSocketHandlers(io, {
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
exports.shutdownAuthModule = async function () {
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
