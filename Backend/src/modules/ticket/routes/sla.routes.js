/**
 * SLA Routes
 * Defines API routes for SLA policy operations
 */

const express = require("express");
const router = express.Router();
const slaController = require("../controllers/sla.controller");
const { authenticate } = require("../../auth/middleware/auth.middleware");
const { srs } = require("../../auth/middleware/role.middleware");

// Protect all routes
router.use(authenticate);

// Create a new SLA policy
router.post("/policies", srs(["admin"]), slaController.createSLAPolicy);

// Get SLA policies for organization
router.get(
  "/policies",
  srs(["admin", "team_lead"]),
  slaController.getSLAPolicies
);

// Get SLA policy by ID
router.get(
  "/policies/:id",
  srs(["admin", "team_lead"]),
  slaController.getSLAPolicyById
);

// Update SLA policy
router.put("/policies/:id", srs(["admin"]), slaController.updateSLAPolicy);

// Delete SLA policy
router.delete("/policies/:id", srs(["admin"]), slaController.deleteSLAPolicy);

// Apply SLA policy to ticket
router.post(
  "/apply/:ticketId",
  srs(["admin", "team_lead"]),
  slaController.applyPolicyToTicket
);

// Pause SLA for a ticket
router.post(
  "/pause/:ticketId",
  srs(["admin", "team_lead", "technical", "support"]),
  slaController.pauseSLA
);

// Resume SLA for a ticket
router.post(
  "/resume/:ticketId",
  srs(["admin", "team_lead", "technical", "support"]),
  slaController.resumeSLA
);

// Check SLA breaches for all active tickets
router.post("/check-breaches", srs(["admin"]), slaController.checkSLABreaches);

module.exports = router;
