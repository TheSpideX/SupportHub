/**
 * Invite Code Controller
 * Handles HTTP requests for invite code operations
 */

const { asyncHandler } = require("../../../utils/errorHandlers");
const inviteCodeService = require("../services/inviteCode.service");
const logger = require("../../../utils/logger");

/**
 * Validate an invite code
 * @route GET /api/invite-codes/validate/:code
 * @access Public
 */
exports.validateInviteCode = asyncHandler(async (req, res) => {
  const { code } = req.params;

  const result = await inviteCodeService.validateInviteCode(code);

  res.status(200).json({
    status: "success",
    data: result,
  });
});

/**
 * Generate an invite code
 * @route POST /api/invite-codes/generate
 * @access Private (Admin, Team Lead)
 */
exports.generateInviteCode = asyncHandler(async (req, res) => {
  const { teamId, role, email, expiryDays } = req.body;
  const userId = req.user._id;
  const organizationId = req.user.organizationId;

  // Validate required fields
  if (!teamId || !role) {
    return res.status(400).json({
      status: "error",
      message: "Team ID and role are required",
    });
  }

  // Validate role
  if (role !== "team_lead" && role !== "team_member") {
    return res.status(400).json({
      status: "error",
      message: "Role must be either 'team_lead' or 'team_member'",
    });
  }

  // Generate invite code
  const inviteCode = await inviteCodeService.generateInviteCode({
    organizationId,
    teamId,
    role,
    createdBy: userId,
    email,
    expiryDays,
  });

  res.status(201).json({
    status: "success",
    message: "Invite code generated successfully",
    data: inviteCode,
  });
});

/**
 * Get invite codes for a team
 * @route GET /api/invite-codes/team/:teamId
 * @access Private (Admin, Team Lead)
 */
exports.getTeamInviteCodes = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { status, page = 1, limit = 10 } = req.query;
  const organizationId = req.user.organizationId;

  // Build filters
  const filters = { status };

  // Get invite codes
  const result = await inviteCodeService.getOrganizationInviteCodes(
    organizationId,
    { teamId, ...filters },
    page,
    limit
  );

  res.status(200).json({
    status: "success",
    data: result,
  });
});

/**
 * Revoke an invite code
 * @route POST /api/invite-codes/revoke/:code
 * @access Private (Admin, Team Lead)
 */
exports.revokeInviteCode = asyncHandler(async (req, res) => {
  const { code } = req.params;

  // Revoke invite code
  const result = await inviteCodeService.revokeInviteCode(code);

  res.status(200).json({
    status: "success",
    message: "Invite code revoked successfully",
    data: result,
  });
});
