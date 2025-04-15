/**
 * System Routes
 * Handles routes for system status and health checks
 */

const express = require("express");
const router = express.Router();
const systemController = require("../controllers/system.controller");
const { asyncHandler } = require("../../../utils/errorHandlers");
const { authenticateToken } = require("../../auth/middleware/authenticate");
const { hasRoles } = require("../../auth/middleware/authorize");

// Public health check endpoint
router.get("/health", asyncHandler(systemController.getHealthStatus));

// Public version info endpoint
router.get("/version", asyncHandler(systemController.getVersionInfo));

// Admin-only detailed system status endpoint
router.get(
  "/status",
  authenticateToken,
  hasRoles(["admin"]),
  asyncHandler(systemController.getSystemStatus)
);

// Admin-only system incidents endpoint
router.get(
  "/incidents",
  authenticateToken,
  hasRoles(["admin"]),
  asyncHandler(systemController.getSystemIncidents)
);

// Admin-only system metrics endpoint
router.get(
  "/metrics",
  authenticateToken,
  hasRoles(["admin"]),
  asyncHandler(systemController.getSystemMetrics)
);

module.exports = router;
