/**
 * Invite Code Routes
 * Handles routes for invite code operations
 */

const express = require("express");
const router = express.Router();
const inviteCodeController = require("../controllers/inviteCode.controller");
const { authenticate, authorize } = require("../../auth/middleware/auth.middleware");

// Validate invite code (public route)
router.get("/validate/:code", inviteCodeController.validateInviteCode);

// Generate invite code (requires authentication and authorization)
router.post(
  "/generate",
  authenticate,
  authorize(["admin", "team_lead"]),
  inviteCodeController.generateInviteCode
);

// List invite codes for a team
router.get(
  "/team/:teamId",
  authenticate,
  authorize(["admin", "team_lead"]),
  inviteCodeController.getTeamInviteCodes
);

// Revoke invite code
router.post(
  "/revoke/:code",
  authenticate,
  authorize(["admin", "team_lead"]),
  inviteCodeController.revokeInviteCode
);

module.exports = router;
