/**
 * Ticket Module
 * Handles ticket management, queries, and SLA tracking
 */

const express = require("express");
const router = express.Router();

// Import routes
const ticketRoutes = require("./routes/ticket.routes");
const queryRoutes = require("./routes/query.routes");
const slaRoutes = require("./routes/sla.routes");

// Export models
const Ticket = require("./models/ticket.model");
const Query = require("./models/query.model");
const SLAPolicy = require("./models/sla-policy.model");

// Mount routes
router.use("/tickets", ticketRoutes);
router.use("/queries", queryRoutes);
router.use("/sla", slaRoutes);

module.exports = {
  router,
  Ticket,
  Query,
  SLAPolicy,
};
