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

const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('../../utils/logger');
const config = require('./config');
const socketIO = require('../../config/socket');

// Export models
const User = require('./models/user.model');
const Token = require('./models/token.model');
const Session = require('./models/session.model');
const SecurityEvent = require('./models/security-event.model');

// Export services
const authService = require('./services/auth.service');
const tokenService = require('./services/token.service');
const sessionService = require('./services/session.service');
const securityService = require('./services/security.service');

// Export controllers
const authController = require('./controllers/auth.controller');
const tokenController = require('./controllers/token.controller');
const sessionController = require('./controllers/session.controller');
const securityController = require('./controllers/security.controller');

// Export middleware
const authMiddleware = require('./middleware/authenticate');
const sessionMiddleware = require('./middleware/session');
const csrfMiddleware = require('./middleware/csrf');
const rateLimitMiddleware = require('./middleware/rate-limit');

// Import routes
const authRoutes = require('./routes');

/**
 * Initialize the auth module
 * @param {Object} app - Express application
 * @param {Object} config - Configuration object
 */
const initializeAuthModule = (app, config = {}) => {
  logger.info('Initializing Auth Module');
  
  // Apply middleware
  app.use(cookieParser(config.cookieSecret || process.env.COOKIE_SECRET || 'default-cookie-secret'));
  
  // Register routes
  app.use('/api/auth', authRoutes);
  
  // Setup scheduled tasks for token cleanup
  tokenService.setupTokenCleanup();
  
  // Initialize session service (which sets up cleanup internally)
  // The session service doesn't have a setupSessionCleanup method directly
  // It's called within the initialize method
  sessionService.initialize({
    store: config.session?.store,
    timeouts: config.session?.timeouts,
    tracking: config.session?.tracking
  });
  
  // Initialize security monitoring
  securityService.initializeSecurityMonitoring();
  
  logger.info('Auth Module Initialized');
};

module.exports = {
  initializeAuthModule,
  // Export models
  models: { 
    User, 
    Token, 
    Session, 
    SecurityEvent 
  },
  // Export controllers
  controllers: { 
    authController, 
    tokenController,
    sessionController, 
    securityController 
  },
  // Export services
  services: { 
    authService, 
    tokenService, 
    sessionService,
    securityService 
  },
  // Export middleware
  middleware: { 
    auth: authMiddleware, 
    session: sessionMiddleware,
    csrf: csrfMiddleware, 
    rateLimit: rateLimitMiddleware 
  }
};

/**
 * Initialize the authentication module
 * Sets up all required auth services and configurations
 */
exports.initializeAuthModule = function() {
  logger.info('Initializing authentication module');
  
  try {
    // Initialize token service
    tokenService.initialize({
      accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
      refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
      accessTokenExpiry: config.tokens.access.expiry,
      refreshTokenExpiry: config.tokens.refresh.expiry
    });
    logger.info('Token service initialized');
    
    // Initialize session service
    sessionService.initialize({
      store: config.session.store,
      timeouts: config.session.timeouts,
      tracking: config.session.tracking
    });
    logger.info('Session service initialized');
    
    // Initialize security service
    securityService.initializeSecurityMonitoring();
    logger.info('Security service initialized');
    
    // Set up WebSocket handlers for real-time session updates
    const io = socketIO.getIO();
    if (io) {
      sessionService.setupSessionWebSockets(io);
      logger.info('Session WebSocket handlers set up');
    } else {
      logger.warn('Socket.io not available, skipping WebSocket setup');
    }
    
    logger.info('Authentication module initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize authentication module:', error);
    throw error;
  }
};

/**
 * Shutdown the authentication module
 * Cleans up resources and connections
 */
exports.shutdownAuthModule = function() {
  logger.info('Shutting down authentication module');
  
  try {
    // Perform cleanup tasks
    sessionService.cleanup(); // Make sure this method exists
    securityService.stopMonitoring();
    
    logger.info('Authentication module shut down successfully');
  } catch (error) {
    logger.error('Error during authentication module shutdown:', error);
    throw error;
  }
};
