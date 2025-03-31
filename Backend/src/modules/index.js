/**
 * Modules Index
 * 
 * This file exports all application modules and provides initialization functions
 * for setting up the entire application with proper module dependencies.
 */

const auth = require('./auth');
const logger = require('../utils/logger');

/**
 * Initialize all application modules
 * @param {Object} app - Express application
 * @param {Object} io - Socket.IO server instance
 * @param {Object} config - Configuration object
 */
const initializeModules = async (app, io, config = {}) => {
  logger.info('Initializing application modules');
  
  try {
    // Initialize auth module with WebSocket support
    await auth.init(app, io, config.auth);
    
    // Initialize other modules here as needed
    // await otherModule.init(app, config.otherModule);
    
    logger.info('All modules initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize modules:', error);
    throw error;
  }
};

/**
 * Shutdown all application modules
 */
const shutdownModules = async () => {
  logger.info('Shutting down application modules');
  
  try {
    // Shutdown auth module
    await auth.shutdownAuthModule();
    
    // Shutdown other modules here as needed
    // await otherModule.shutdown();
    
    logger.info('All modules shut down successfully');
  } catch (error) {
    logger.error('Error during modules shutdown:', error);
    throw error;
  }
};

module.exports = {
  auth,
  // Add other modules here as they are created
  
  // Module lifecycle functions
  initializeModules,
  shutdownModules
};
