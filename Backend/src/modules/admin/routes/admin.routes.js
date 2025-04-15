/**
 * Admin Routes
 * Provides routes for administrative functions
 */

const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const { asyncHandler } = require("../../../utils/errorHandlers");
const { authenticateToken } = require("../../auth/middleware/authenticate");
const { hasRoles } = require("../../auth/middleware/authorize");

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(hasRoles(["admin"]));

// Rate limit management
router.post("/rate-limit/reset", asyncHandler(adminController.resetRateLimit));

module.exports = router;
