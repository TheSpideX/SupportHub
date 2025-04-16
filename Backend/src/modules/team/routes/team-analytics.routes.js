/**
 * Team Analytics Routes
 * Handles API routes for team analytics
 */

const express = require("express");
const router = express.Router();
const {
  authenticate,
} = require("../../../modules/auth/middleware/authenticate");
const {
  authorizeRoles,
} = require("../../../modules/auth/middleware/authorize");
const validate = require("../../../middleware/validate");
const teamAnalyticsController = require("../controllers/team-analytics.controller");

/**
 * @route GET /api/team-analytics/performance
 * @desc Get team performance metrics
 * @access Private (Admin, Team Lead)
 */
router.get(
  "/performance",
  authenticate,
  authorizeRoles(["admin", "team_lead"]),
  teamAnalyticsController.getTeamPerformance
);

/**
 * @route GET /api/team-analytics/workload
 * @desc Get team workload metrics
 * @access Private (Admin, Team Lead)
 */
router.get(
  "/workload",
  authenticate,
  authorizeRoles(["admin", "team_lead"]),
  teamAnalyticsController.getTeamWorkload
);

module.exports = router;
