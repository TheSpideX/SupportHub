/**
 * Organization Module
 * Handles organization management in the multi-tenant system
 */

const organizationRoutes = require("./routes/organization.routes");
const Organization = require("./models/organization.model");
const organizationController = require("./controllers/organization.controller");
const organizationService = require("./services/organization.service");
const logger = require("../../utils/logger");

// Export module components
module.exports = {
  // Routes
  routes: {
    organization: organizationRoutes,
  },
  
  // Models
  models: {
    Organization,
  },
  
  // Controllers
  controllers: {
    organizationController,
  },
  
  // Services
  services: {
    organizationService,
  },
  
  // Initialize module
  initialize: (app) => {
    logger.info("Initializing organization management module");
    
    // Register routes
    app.use("/api/organizations", organizationRoutes);
    
    logger.info("Organization management module initialized");
    
    return app;
  },
};
