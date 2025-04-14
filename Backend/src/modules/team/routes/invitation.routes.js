/**
 * Invitation Routes
 * Handles routing for team invitations
 */

const express = require("express");
const router = express.Router();
const invitationController = require("../controllers/invitation.controller");
const {
  authenticateToken,
  optionalAuth,
} = require("../../auth/middleware/authenticate");
const { validateToken: csrfProtection } = require("../../auth/middleware/csrf");
const { apiRateLimit } = require("../../auth/middleware/rate-limit");
const { asyncHandler } = require("../../../utils/errorHandlers");
const validate = require("../../../middleware/validate");
const invitationValidation = require("../validations/invitation.validation");

// Apply rate limiting to all routes
router.use(apiRateLimit());

// Public routes (with optional auth)
router.get(
  "/verify/:code",
  optionalAuth,
  validate(invitationValidation.verifyInvitation),
  asyncHandler(invitationController.verifyInvitation)
);

// Protected routes
router.use(authenticateToken);

// Get current user's invitations
router.get(
  "/my-invitations",
  asyncHandler(invitationController.getMyInvitations)
);

// Accept invitation
router.post(
  "/accept/:code",
  csrfProtection,
  validate(invitationValidation.acceptInvitation),
  asyncHandler(invitationController.acceptInvitation)
);

// Revoke invitation
router.delete(
  "/:id",
  csrfProtection,
  validate(invitationValidation.revokeInvitation),
  asyncHandler(invitationController.revokeInvitation)
);

// Resend invitation
router.post(
  "/:id/resend",
  csrfProtection,
  validate(invitationValidation.resendInvitation),
  asyncHandler(invitationController.resendInvitation)
);

module.exports = router;
