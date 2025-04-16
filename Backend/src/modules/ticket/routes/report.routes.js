/**
 * Report Routes
 * Handles API routes for ticket and SLA reports
 */

const express = require("express");
const router = express.Router();
const {
  authenticate,
} = require("../../../modules/auth/middleware/auth.middleware");
const { srs } = require("../../../modules/auth/middleware/role.middleware");
const validate = require("../../../middleware/validate");
const reportController = require("../controllers/report.controller");

/**
 * @route GET /api/reports/sla-performance
 * @desc Get SLA performance metrics
 * @access Private (Admin, Team Lead)
 */
router.get(
  "/sla-performance",
  authenticate,
  srs(["admin", "team_lead"]),
  reportController.getSLAPerformanceReport
);

/**
 * @route GET /api/reports/sla-breaches
 * @desc Get SLA breach report
 * @access Private (Admin, Team Lead)
 */
router.get(
  "/sla-breaches",
  authenticate,
  srs(["admin", "team_lead"]),
  reportController.getSLABreachReport
);

module.exports = router;
