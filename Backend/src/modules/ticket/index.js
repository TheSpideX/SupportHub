/**
 * Ticket Module
 * Handles ticket management, queries, and SLA tracking
 */

const express = require("express");
const logger = require("../../utils/logger");

// Import routes
const ticketRoutes = require("./routes/ticket.routes");
const queryRoutes = require("./routes/query.routes");
const slaRoutes = require("./routes/sla.routes");

// Import models
const Ticket = require("./models/ticket.model");
const Query = require("./models/query.model");
const SLAPolicy = require("./models/sla-policy.model");

// Import controllers
const ticketController = require("./controllers/ticket.controller");
const queryController = require("./controllers/query.controller");
const slaController = require("./controllers/sla.controller");

// Import services
const ticketService = require("./services/ticket.service");
const queryService = require("./services/query.service");
const slaService = require("./services/sla.service");

// Import WebSocket handlers
const ticketWs = require("./websocket/ticket.ws");

// Export module components
module.exports = {
  // Routes
  routes: {
    ticket: ticketRoutes,
    query: queryRoutes,
    sla: slaRoutes,
  },

  // Models
  models: {
    Ticket,
    Query,
    SLAPolicy,
  },

  // Controllers
  controllers: {
    ticketController,
    queryController,
    slaController,
  },

  // Services
  services: {
    ticketService,
    queryService,
    slaService,
  },

  // WebSocket handlers
  websocket: {
    ticketWs,
  },

  // Initialize module
  initialize: (app, primus) => {
    logger.info("Initializing ticket management module");

    // Register routes
    app.use("/api/tickets", ticketRoutes);
    app.use("/api/queries", queryRoutes);
    app.use("/api/sla", slaRoutes);

    // Initialize WebSocket handlers if Primus is available
    if (primus) {
      ticketWs.initTicketWebSocket(primus);
      logger.info("Ticket WebSocket handlers initialized");
    }

    logger.info("Ticket management module initialized");

    return app;
  },
};
