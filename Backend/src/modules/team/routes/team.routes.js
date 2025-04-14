/**
 * Team Routes
 * Handles routing for team management
 */

const express = require("express");
const router = express.Router();
const teamController = require("../controllers/team.controller");
const invitationController = require("../controllers/invitation.controller");
const { authenticateToken } = require("../../auth/middleware/authenticate");
const { validateToken: csrfProtection } = require("../../auth/middleware/csrf");
const { apiRateLimit } = require("../../auth/middleware/rate-limit");
const { asyncHandler } = require("../../../utils/errorHandlers");
const validate = require("../../../middleware/validate");
const teamValidation = require("../validations/team.validation");
const invitationValidation = require("../validations/invitation.validation");

// Apply middleware to all routes
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

module.exports = router;
