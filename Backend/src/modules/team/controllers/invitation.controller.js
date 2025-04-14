/**
 * Invitation Controller
 * Handles HTTP requests for team invitations
 */

const invitationService = require("../services/invitation.service");
const { ApiError } = require("../../../utils/errors");
const logger = require("../../../utils/logger");

/**
 * Create a new invitation
 * @route POST /api/teams/:teamId/invitations
 * @access Private - Team lead or admin
 */
exports.createInvitation = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { email, role } = req.body;
    const userId = req.user._id;

    const invitation = await invitationService.createInvitation(
      { teamId, email, role },
      userId
    );

    res.status(201).json({
      success: true,
      data: invitation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all invitations for a team
 * @route GET /api/teams/:teamId/invitations
 * @access Private - Team lead or admin
 */
exports.getTeamInvitations = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    const userId = req.user._id;

    const filters = status ? { status } : {};
    const result = await invitationService.getTeamInvitations(
      teamId,
      userId,
      filters,
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      data: result.invitations,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify invitation
 * @route GET /api/invitations/verify/:code
 * @access Public
 */
exports.verifyInvitation = async (req, res, next) => {
  try {
    const { code } = req.params;

    const result = await invitationService.verifyInvitation(code);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Accept invitation
 * @route POST /api/invitations/accept/:code
 * @access Private
 */
exports.acceptInvitation = async (req, res, next) => {
  try {
    const { code } = req.params;
    const userId = req.user._id;

    const result = await invitationService.acceptInvitation(code, userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke invitation
 * @route DELETE /api/invitations/:id
 * @access Private - Team lead, admin, or invitation creator
 */
exports.revokeInvitation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const invitation = await invitationService.revokeInvitation(id, userId);

    res.status(200).json({
      success: true,
      data: invitation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resend invitation
 * @route POST /api/invitations/:id/resend
 * @access Private - Team lead, admin, or invitation creator
 */
exports.resendInvitation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const invitation = await invitationService.resendInvitation(id, userId);

    res.status(200).json({
      success: true,
      data: invitation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user invitations
 * @route GET /api/invitations/my-invitations
 * @access Private
 */
exports.getMyInvitations = async (req, res, next) => {
  try {
    const { email } = req.user;

    const invitations = await invitationService.getUserInvitations(email);

    res.status(200).json({
      success: true,
      data: invitations,
    });
  } catch (error) {
    next(error);
  }
};
