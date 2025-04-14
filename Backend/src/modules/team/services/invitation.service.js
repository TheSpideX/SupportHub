/**
 * Invitation Service
 * Handles business logic for team invitations
 */

const Invitation = require("../models/invitation.model");
const Team = require("../models/team.model");
const User = require("../../auth/models/user.model");
const logger = require("../../../utils/logger");
const { ApiError } = require("../../../utils/errors");
const emailService = require("../../auth/services/email.service");

/**
 * Create a new invitation
 * @param {Object} invitationData - Invitation data
 * @param {string} userId - User ID creating the invitation
 * @returns {Promise<Invitation>} Created invitation
 */
exports.createInvitation = async (invitationData, userId) => {
  try {
    const { teamId, email, role } = invitationData;

    // Check if team exists
    const team = await Team.findById(teamId);
    if (!team) {
      throw new ApiError(404, "Team not found");
    }

    // Check if user is admin or team lead
    const isTeamLead = team.isTeamLead(userId);
    const user = await User.findById(userId);
    const isAdmin = user && user.role === "admin";

    if (!isAdmin && !isTeamLead) {
      throw new ApiError(403, "Not authorized to create invitations");
    }

    // Check if email is already registered
    const existingUser = await User.findOne({ email });
    
    // Check if user is already a member
    if (existingUser && team.isMember(existingUser._id)) {
      throw new ApiError(400, "User is already a member of this team");
    }

    // Create invitation
    const invitation = await Invitation.createInvitation(
      {
        teamId,
        email,
        role: role || "member",
        invitedBy: userId,
      },
      7 // 7 days expiration
    );

    // Send invitation email
    await sendInvitationEmail(invitation, team, user);

    logger.info(
      `Invitation created: ${invitation.code} for ${email} to team ${team.name} by user ${userId}`
    );

    return invitation;
  } catch (error) {
    logger.error(`Error creating invitation: ${error.message}`, error);
    throw error;
  }
};

/**
 * Get all invitations for a team
 * @param {string} teamId - Team ID
 * @param {string} userId - User ID requesting invitations
 * @param {Object} filters - Optional filters
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Invitations and pagination info
 */
exports.getTeamInvitations = async (
  teamId,
  userId,
  filters = {},
  page = 1,
  limit = 10
) => {
  try {
    // Check if team exists
    const team = await Team.findById(teamId);
    if (!team) {
      throw new ApiError(404, "Team not found");
    }

    // Check if user is admin or team lead
    const isTeamLead = team.isTeamLead(userId);
    const user = await User.findById(userId);
    const isAdmin = user && user.role === "admin";

    if (!isAdmin && !isTeamLead) {
      throw new ApiError(403, "Not authorized to view invitations");
    }

    const query = { teamId, ...filters };
    const skip = (page - 1) * limit;

    // Get invitations with pagination
    const invitations = await Invitation.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("invitedBy", "profile.firstName profile.lastName email")
      .populate("acceptedBy", "profile.firstName profile.lastName email")
      .lean();

    // Get total count
    const total = await Invitation.countDocuments(query);

    return {
      invitations,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error(`Error getting team invitations: ${error.message}`, error);
    throw error;
  }
};

/**
 * Verify invitation
 * @param {string} code - Invitation code
 * @returns {Promise<Object>} Invitation and team info
 */
exports.verifyInvitation = async (code) => {
  try {
    const invitation = await Invitation.verifyInvitation(code);

    if (!invitation) {
      throw new ApiError(400, "Invalid or expired invitation");
    }

    // Get team info
    const team = await Team.findById(invitation.teamId)
      .select("name description")
      .lean();

    if (!team) {
      throw new ApiError(404, "Team not found");
    }

    // Get inviter info
    const inviter = await User.findById(invitation.invitedBy)
      .select("profile.firstName profile.lastName email")
      .lean();

    return {
      invitation,
      team,
      inviter,
    };
  } catch (error) {
    logger.error(`Error verifying invitation: ${error.message}`, error);
    throw error;
  }
};

/**
 * Accept invitation
 * @param {string} code - Invitation code
 * @param {string} userId - User ID accepting the invitation
 * @returns {Promise<Object>} Result with team and invitation
 */
exports.acceptInvitation = async (code, userId) => {
  try {
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Verify invitation
    const invitation = await Invitation.verifyInvitation(code);
    if (!invitation) {
      throw new ApiError(400, "Invalid or expired invitation");
    }

    // Check if invitation email matches user email
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ApiError(
        403,
        "This invitation was sent to a different email address"
      );
    }

    // Accept invitation
    const result = await Invitation.acceptInvitation(code, userId);

    logger.info(
      `Invitation accepted: ${code} by user ${userId} for team ${result.team._id}`
    );

    return result;
  } catch (error) {
    logger.error(`Error accepting invitation: ${error.message}`, error);
    throw error;
  }
};

/**
 * Revoke invitation
 * @param {string} invitationId - Invitation ID
 * @param {string} userId - User ID revoking the invitation
 * @returns {Promise<Invitation>} Updated invitation
 */
exports.revokeInvitation = async (invitationId, userId) => {
  try {
    const invitation = await Invitation.findById(invitationId);

    if (!invitation || invitation.status !== "pending") {
      throw new ApiError(404, "Invitation not found or already processed");
    }

    // Check if team exists
    const team = await Team.findById(invitation.teamId);
    if (!team) {
      throw new ApiError(404, "Team not found");
    }

    // Check if user is admin or team lead
    const isTeamLead = team.isTeamLead(userId);
    const user = await User.findById(userId);
    const isAdmin = user && user.role === "admin";

    if (!isAdmin && !isTeamLead && invitation.invitedBy.toString() !== userId) {
      throw new ApiError(403, "Not authorized to revoke this invitation");
    }

    // Revoke invitation
    invitation.status = "revoked";
    await invitation.save();

    logger.info(
      `Invitation revoked: ${invitation._id} by user ${userId} for team ${team._id}`
    );

    return invitation;
  } catch (error) {
    logger.error(`Error revoking invitation: ${error.message}`, error);
    throw error;
  }
};

/**
 * Resend invitation
 * @param {string} invitationId - Invitation ID
 * @param {string} userId - User ID resending the invitation
 * @returns {Promise<Invitation>} Updated invitation
 */
exports.resendInvitation = async (invitationId, userId) => {
  try {
    const invitation = await Invitation.findById(invitationId);

    if (!invitation) {
      throw new ApiError(404, "Invitation not found");
    }

    // Check if invitation is pending or expired
    if (invitation.status !== "pending" && invitation.status !== "expired") {
      throw new ApiError(400, "Cannot resend invitation that is not pending or expired");
    }

    // Check if team exists
    const team = await Team.findById(invitation.teamId);
    if (!team) {
      throw new ApiError(404, "Team not found");
    }

    // Check if user is admin or team lead
    const isTeamLead = team.isTeamLead(userId);
    const user = await User.findById(userId);
    const isAdmin = user && user.role === "admin";

    if (!isAdmin && !isTeamLead && invitation.invitedBy.toString() !== userId) {
      throw new ApiError(403, "Not authorized to resend this invitation");
    }

    // Update invitation
    invitation.status = "pending";
    invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await invitation.save();

    // Send invitation email
    await sendInvitationEmail(invitation, team, user);

    logger.info(
      `Invitation resent: ${invitation._id} by user ${userId} for team ${team._id}`
    );

    return invitation;
  } catch (error) {
    logger.error(`Error resending invitation: ${error.message}`, error);
    throw error;
  }
};

/**
 * Get user invitations
 * @param {string} email - User email
 * @returns {Promise<Array>} Invitations
 */
exports.getUserInvitations = async (email) => {
  try {
    const invitations = await Invitation.find({
      email: email.toLowerCase(),
      status: "pending",
      expiresAt: { $gt: new Date() },
    })
      .populate("teamId", "name description")
      .populate("invitedBy", "profile.firstName profile.lastName email")
      .lean();

    return invitations;
  } catch (error) {
    logger.error(`Error getting user invitations: ${error.message}`, error);
    throw error;
  }
};

/**
 * Clean up expired invitations
 * @returns {Promise<number>} Number of expired invitations
 */
exports.cleanupExpiredInvitations = async () => {
  try {
    const count = await Invitation.cleanupExpiredInvitations();
    logger.info(`Cleaned up ${count} expired invitations`);
    return count;
  } catch (error) {
    logger.error(`Error cleaning up expired invitations: ${error.message}`, error);
    throw error;
  }
};

/**
 * Send invitation email
 * @param {Invitation} invitation - Invitation object
 * @param {Team} team - Team object
 * @param {User} inviter - User who created the invitation
 * @returns {Promise<void>}
 */
async function sendInvitationEmail(invitation, team, inviter) {
  try {
    const inviterName = `${inviter.profile.firstName} ${inviter.profile.lastName}`;
    const invitationUrl = `${process.env.CLIENT_URL}/invitations/accept/${invitation.code}`;
    
    await emailService.sendEmail({
      to: invitation.email,
      subject: `Invitation to join ${team.name} team`,
      template: "team-invitation",
      data: {
        inviterName,
        teamName: team.name,
        teamDescription: team.description,
        role: invitation.role,
        invitationUrl,
        expiresAt: invitation.expiresAt,
        code: invitation.code,
      },
    });
  } catch (error) {
    logger.error(`Error sending invitation email: ${error.message}`, error);
    // Don't throw error to prevent invitation creation failure
  }
}
