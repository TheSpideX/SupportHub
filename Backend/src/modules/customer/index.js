/**
 * Customer Management Module
 * Handles customer management operations
 */

const customerRoutes = require('./routes/customer.routes');
const customerController = require('./controllers/customer.controller');
const customerService = require('./services/customer.service');
const logger = require('../../utils/logger');

// Export module components
module.exports = {
  // Routes
  routes: {
    customer: customerRoutes,
  },
  
  // Controllers
  controllers: {
    customerController,
  },
  
  // Services
  services: {
    customerService,
  },
  
  // Initialize module
  initialize: (app) => {
    logger.info("Initializing customer management module");
    
    // Register routes
    app.use("/api/customers", customerRoutes);
    
    logger.info("Customer management module initialized");
    
    return app;
  },
};
