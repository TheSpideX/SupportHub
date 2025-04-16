/**
 * Team Routes
 * Handles routing for team management
 */

const express = require("express");
const router = express.Router();
const teamController = require("../controllers/team.controller");
const invitationController = require("../controllers/invitation.controller");
const invitationCodeController = require("../controllers/invitation-code.controller");
const { authenticateToken } = require("../../auth/middleware/authenticate");
const { validateToken: csrfProtection } = require("../../auth/middleware/csrf");
const { apiRateLimit } = require("../../auth/middleware/rate-limit");
const { asyncHandler } = require("../../../utils/errorHandlers");
const validate = require("../../../middleware/validate");
const teamValidation = require("../validations/team.validation");
const invitationValidation = require("../validations/invitation.validation");
const invitationCodeValidation = require("../validations/invitation-code.validation");

// Public route for validating invitation codes (no auth required)
router.get(
  "/invitation-codes/:code/validate",
  validate(invitationCodeValidation.validateInvitationCode),
  asyncHandler(invitationCodeController.validateInvitationCode)
);

// Apply middleware to all other routes
router.use(authenticateToken);
router.use(apiRateLimit());

// Get current user's teams
router.get("/my-teams", asyncHandler(teamController.getMyTeams));

// Team CRUD operations
router.post(
  "/",
  csrfProtection,
  validate(teamValidation.createTeam),
  asyncHandler(teamController.createTeam)
);

router.get("/", asyncHandler(teamController.getAllTeams));

router.get("/:id", asyncHandler(teamController.getTeamById));

router.put(
  "/:id",
  csrfProtection,
  validate(teamValidation.updateTeam),
  asyncHandler(teamController.updateTeam)
);

router.delete("/:id", csrfProtection, asyncHandler(teamController.deleteTeam));

// Team membership operations
router.get("/:id/membership", asyncHandler(teamController.checkTeamMembership));

// Get team members
router.get("/:id/members", asyncHandler(teamController.getTeamMembers));

router.post(
  "/:id/members",
  csrfProtection,
  validate(teamValidation.addTeamMember),
  asyncHandler(teamController.addTeamMember)
);

router.delete(
  "/:id/members/:memberId",
  csrfProtection,
  validate(teamValidation.removeTeamMember),
  asyncHandler(teamController.removeTeamMember)
);

router.put(
  "/:id/lead",
  csrfProtection,
  validate(teamValidation.changeTeamLead),
  asyncHandler(teamController.changeTeamLead)
);

// Team invitations
router.post(
  "/:teamId/invitations",
  csrfProtection,
  validate(invitationValidation.createInvitation),
  asyncHandler(invitationController.createInvitation)
);

router.get(
  "/:teamId/invitations",
  asyncHandler(invitationController.getTeamInvitations)
);

// Invitation code operations
router.post(
  "/:teamId/invitation-codes",
  csrfProtection,
  validate(invitationCodeValidation.generateInvitationCode),
  asyncHandler(invitationCodeController.generateInvitationCode)
);

router.get(
  "/:teamId/invitation-codes",
  validate(invitationCodeValidation.listInvitationCodes),
  asyncHandler(invitationCodeController.listInvitationCodes)
);

router.delete(
  "/:teamId/invitation-codes/:codeId",
  csrfProtection,
  validate(invitationCodeValidation.revokeInvitationCode),
  asyncHandler(invitationCodeController.revokeInvitationCode)
);

// This route was moved to the top of the file to make it public

module.exports = router;
