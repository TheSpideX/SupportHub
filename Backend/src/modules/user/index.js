/**
 * User Management Module
 * Handles user management operations
 */

const userRoutes = require('./routes/user.routes');
const userController = require('./controllers/user.controller');
const userService = require('./services/user.service');
const logger = require('../../utils/logger');

// Export module components
module.exports = {
  // Routes
  routes: {
    user: userRoutes,
  },
  
  // Controllers
  controllers: {
    userController,
  },
  
  // Services
  services: {
    userService,
  },
  
  // Initialize module
  initialize: (app) => {
    logger.info("Initializing user management module");
    
    // Register routes
    app.use("/api/users", userRoutes);
    
    logger.info("User management module initialized");
    
    return app;
  },
};
