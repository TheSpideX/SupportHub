/**
 * Admin Module
 * Provides administrative functions for system management
 */

const express = require('express');
const logger = require('../../utils/logger');
const adminRoutes = require('./routes/admin.routes');
const adminController = require('./controllers/admin.controller');

// Export module components
module.exports = {
  // Routes
  routes: {
    admin: adminRoutes,
  },
  
  // Controllers
  controllers: {
    adminController,
  },
  
  // Initialize module
  initialize: (app) => {
    logger.info("Initializing admin module");
    
    // Register routes
    app.use("/api/admin", adminRoutes);
    
    logger.info("Admin module initialized");
    
    return app;
  },
};
