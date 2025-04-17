/**
 * Ticket Routes
 * Defines API routes for ticket operations
 */

const express = require("express");
const router = express.Router();
const ticketController = require("../controllers/ticket.controller");
const { authenticate } = require("../../auth/middleware/auth.middleware");
const { srs } = require("../../auth/middleware/role.middleware");
const logger = require("../../../utils/logger");

// Protect all routes
router.use(authenticate);

// Create a new ticket
router.post(
  "/",
  srs(["admin", "team_lead", "support", "customer"]),
  ticketController.createTicket
);

// Get tickets with filters
router.get(
  "/",
  srs(["admin", "team_lead", "technical", "support", "customer"]),
  ticketController.getTickets
);

// Get ticket statistics
router.get(
  "/statistics",
  srs(["admin", "team_lead", "technical", "support", "customer"]),
  ticketController.getTicketStatistics
);

// Get tickets created by the current user
router.get(
  "/created-by-me",
  srs(["support"]),
  ticketController.getTicketsCreatedByMe
);

// Get ticket by ID
router.get(
  "/:id",
  srs(["admin", "team_lead", "technical", "support", "customer"]),
  ticketController.getTicketById
);

// Get ticket audit log
router.get(
  "/:id/audit-log",
  srs(["admin", "team_lead", "technical", "support", "customer"]),
  ticketController.getTicketAuditLog
);

// Update ticket
router.put(
  "/:id",
  srs(["admin", "team_lead", "technical", "support"]),
  ticketController.updateTicket
);

// Add comment to ticket
router.post(
  "/:id/comments",
  srs(["admin", "team_lead", "technical", "support", "customer"]),
  ticketController.addComment
);

// Assign ticket to user
router.post(
  "/:id/assign",
  srs(["admin", "team_lead"]),
  ticketController.assignTicket
);

// Assign ticket to team
router.post(
  "/:id/assign-team",
  srs(["admin", "team_lead"]),
  ticketController.assignTicketToTeam
);

// Get tickets for the team lead's team
router.get("/my-team", srs(["team_lead"]), ticketController.getMyTeamTickets);

module.exports = router;
