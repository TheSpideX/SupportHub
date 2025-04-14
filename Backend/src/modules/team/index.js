/**
 * Team Management Module
 * Handles team creation, management, and invitation system
 */

const express = require("express");
const logger = require("../../utils/logger");

// Import models
const Team = require("./models/team.model");
const Invitation = require("./models/invitation.model");

// Import controllers
const teamController = require("./controllers/team.controller");
const invitationController = require("./controllers/invitation.controller");

// Import services
const teamService = require("./services/team.service");
const invitationService = require("./services/invitation.service");

// Import routes
const teamRoutes = require("./routes/team.routes");
const invitationRoutes = require("./routes/invitation.routes");

// Import middleware
const { authenticateToken } = require("../auth/middleware/authenticate");
const { validateToken: csrfProtection } = require("../auth/middleware/csrf");
const { apiRateLimit } = require("../auth/middleware/rate-limit");

// Export module components
module.exports = {
  // Routes
  routes: {
    team: teamRoutes,
    invitation: invitationRoutes,
  },
  
  // Models
  models: {
    Team,
    Invitation,
  },
  
  // Controllers
  controllers: {
    teamController,
    invitationController,
  },
  
  // Services
  services: {
    teamService,
    invitationService,
  },
  
  // Initialize module
  initialize: (app) => {
    logger.info("Initializing team management module");
    
    // Register routes
    app.use("/api/teams", teamRoutes);
    app.use("/api/invitations", invitationRoutes);
    
    logger.info("Team management module initialized");
    
    return app;
  },
};
