/**
 * Query Routes
 * Defines API routes for customer query operations
 */

const express = require("express");
const router = express.Router();
const queryController = require("../controllers/query.controller");
const { authenticate } = require("../../auth/middleware/auth.middleware");
const { srs } = require("../../auth/middleware/role.middleware");

// Protect all routes
router.use(authenticate);

// Get customer's own queries
router.get("/my-queries", srs(["customer"]), queryController.getMyQueries);

// Create a new customer query
router.post("/", srs(["customer"]), queryController.createQuery);

// Get queries with filters
router.get(
  "/",
  srs(["admin", "team_lead", "support_member"]),
  queryController.getQueries
);

// Get query by ID
router.get(
  "/:id",
  srs(["admin", "team_lead", "support_member", "customer"]),
  queryController.getQueryById
);

// Update query
router.put(
  "/:id",
  srs(["admin", "team_lead", "support_member"]),
  queryController.updateQuery
);

// Add comment to query
router.post(
  "/:id/comments",
  srs(["admin", "team_lead", "support_member", "customer"]),
  queryController.addComment
);

// Assign query to support team member
router.post(
  "/:id/assign",
  srs(["admin", "team_lead"]),
  queryController.assignQuery
);

// Convert query to ticket
router.post(
  "/:id/convert",
  srs(["admin", "team_lead", "support_member"]),
  queryController.convertToTicket
);

module.exports = router;
