/**
 * Notification Module
 * Handles notification creation and delivery
 */

const notificationRoutes = require('./routes/notification.routes');
const notificationController = require('./controllers/notification.controller');
const notificationService = require('./services/notification.service');
const logger = require('../../utils/logger');

// Export module components
module.exports = {
  // Routes
  routes: {
    notification: notificationRoutes,
  },
  
  // Controllers
  controllers: {
    notificationController,
  },
  
  // Services
  services: {
    notificationService,
  },
  
  // Initialize module
  initialize: (app) => {
    logger.info("Initializing notification module");
    
    // Register routes
    app.use("/api/notifications", notificationRoutes);
    
    logger.info("Notification module initialized");
    
    return app;
  },
};
