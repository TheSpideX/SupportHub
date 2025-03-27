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
 */

const express = require("express");
const cookieParser = require("cookie-parser");
const logger = require("../../utils/logger");
const config = require("./config");
const socketIO = require("../../config/socket");

// Export models
const User = require("./models/user.model");
const Token = require("./models/token.model");
const Session = require("./models/session.model");
const SecurityEvent = require("./models/security-event.model");

// Export services
const authService = require("./services/auth.service");
const tokenService = require("./services/token.service");
const sessionService = require("./services/session.service");
const securityService = require("./services/security.service");

// Export controllers
const authController = require("./controllers/auth.controller");
const tokenController = require("./controllers/token.controller");
const sessionController = require("./controllers/session.controller");
const securityController = require("./controllers/security.controller");

// Export middleware
const authMiddleware = require("./middleware/authenticate");
const sessionMiddleware = require("./middleware/session");
const csrfMiddleware = require("./middleware/csrf");
const rateLimitMiddleware = require("./middleware/rate-limit");

// Import routes
const authRoutes = require("./routes");

/**
 * Initialize the auth module
 * @param {Object} app - Express application
 * @param {Object} config - Configuration object
 */
const initializeAuthModule = (app, config = {}) => {
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
  // The session service doesn't have a setupSessionCleanup method directly
  // It's called within the initialize method
  sessionService.initialize({
    store: config.session?.store,
    timeouts: config.session?.timeouts,
    tracking: config.session?.tracking,
  });

  // Initialize security monitoring
  securityService.initializeSecurityMonitoring();

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
  },
  // Export controllers
  controllers: {
    authController,
    tokenController,
    sessionController,
    securityController,
  },
  // Export services
  services: {
    authService,
    tokenService,
    sessionService,
    securityService,
  },
  // Export middleware
  middleware: {
    auth: authMiddleware,
    session: sessionMiddleware,
    csrf: csrfMiddleware,
    rateLimit: rateLimitMiddleware,
  },
};

/**
 * Initialize the authentication module
 * Sets up all required auth services and configurations
 */
exports.init = async (app, config = {}) => {
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
    await sessionService.cleanup(); // Now this will properly await
    securityService.stopMonitoring();

    logger.info("Authentication module shut down successfully");
  } catch (error) {
    logger.error("Error during authentication module shutdown:", error);
    throw error;
  }
};
