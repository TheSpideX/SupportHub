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
const authRoutes = require('./routes/auth.routes');
const logger = require('../../utils/logger');

// Export models
const User = require('./models/user.model');
const Token = require('./models/token.model');
const Session = require('./models/session.model');
const SecurityEvent = require('./models/security-event.model');

// Export services
const authService = require('./services/auth.service');
const tokenService = require('./services/token.service');
const sessionService = require('./services/session.service');

// Export controllers
const authController = require('./controllers/auth.controller');
const securityController = require('./controllers/security.controller');
const sessionController = require('./controllers/session.controller');

// Export middleware
const authMiddleware = require('./middleware/authenticate');
const csrfMiddleware = require('./middleware/csrf');
const rateLimitMiddleware = require('./middleware/rate-limit');

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
  
  // Setup scheduled tasks for token and session cleanup
  if (tokenService.setupTokenCleanup) {
    tokenService.setupTokenCleanup();
  }
  
  if (sessionService.setupSessionCleanup) {
    sessionService.setupSessionCleanup();
  }
  
  logger.info('Auth Module Initialized');
};

module.exports = {
  initializeAuthModule,
  // Export other components
  models: { User, Token, Session, SecurityEvent },
  controllers: { authController, securityController, sessionController },
  services: { authService, tokenService, sessionService },
  middleware: { authMiddleware, csrfMiddleware, rateLimitMiddleware }
};
