/**
 * Invite Code Service
 * Handles business logic for invite codes
 */

const InviteCode = require("../models/inviteCode.model");
const Organization = require("../models/organization.model");
const Team = require("../../team/models/team.model");
const User = require("../../auth/models/user.model");
const { ApiError } = require("../../../utils/errors");
const logger = require("../../../utils/logger");

/**
 * Generate a new invite code
 * @param {Object} data - Invite code data
 * @param {string} data.organizationId - Organization ID
 * @param {string} data.teamId - Team ID (optional)
 * @param {string} data.role - Role (team_lead or team_member)
 * @param {string} data.createdBy - User ID of the creator
 * @param {string} data.email - Email address (optional)
 * @param {number} data.expiryDays - Number of days until expiry (default: 7)
 * @returns {Promise<Object>} Created invite code
 */
exports.generateInviteCode = async (data) => {
  try {
    const { organizationId, teamId, role, createdBy, email, expiryDays = 7 } = data;

    // Verify organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }

    // Verify team exists if teamId is provided
    if (teamId) {
      const team = await Team.findById(teamId);
      if (!team) {
        throw new ApiError(404, "Team not found");
      }
      
      // Verify team belongs to the organization
      if (!organization.teams.includes(teamId)) {
        throw new ApiError(400, "Team does not belong to this organization");
      }
    }

    // Generate a unique invite code
    const code = await InviteCode.generateInviteCode();

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Create the invite code
    const inviteCode = await InviteCode.create({
      code,
      organizationId,
      teamId,
      role,
      createdBy,
      email,
      expiresAt,
      status: "active",
    });

    logger.info(`Created invite code: ${inviteCode.code} for role: ${role}`);
    return inviteCode;
  } catch (error) {
    logger.error("Error generating invite code:", error);
    throw error;
  }
};

/**
 * Validate an invite code
 * @param {string} code - Invite code
 * @returns {Promise<Object>} Validation result
 */
exports.validateInviteCode = async (code) => {
  try {
    const inviteCode = await InviteCode.findOne({ code })
      .populate("organizationId", "name orgId type")
      .populate("teamId", "name type");
    
    if (!inviteCode) {
      return {
        isValid: false,
        message: "Invalid invite code",
      };
    }

    if (inviteCode.status !== "active") {
      return {
        isValid: false,
        message: `Invite code is ${inviteCode.status}`,
        status: inviteCode.status,
      };
    }

    if (inviteCode.expiresAt < new Date()) {
      // Update status to expired
      inviteCode.status = "expired";
      await inviteCode.save();
      
      return {
        isValid: false,
        message: "Invite code has expired",
        status: "expired",
      };
    }

    return {
      isValid: true,
      message: "Valid invite code",
      inviteCode: {
        code: inviteCode.code,
        role: inviteCode.role,
        expiresAt: inviteCode.expiresAt,
      },
      organization: {
        id: inviteCode.organizationId._id,
        name: inviteCode.organizationId.name,
        orgId: inviteCode.organizationId.orgId,
        type: inviteCode.organizationId.type,
      },
      team: inviteCode.teamId ? {
        id: inviteCode.teamId._id,
        name: inviteCode.teamId.name,
        type: inviteCode.teamId.type,
      } : null,
    };
  } catch (error) {
    logger.error(`Error validating invite code ${code}:`, error);
    return {
      isValid: false,
      message: "Error validating invite code",
    };
  }
};

/**
 * Use an invite code to register a user
 * @param {string} code - Invite code
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result
 */
exports.useInviteCode = async (code, userId) => {
  try {
    // Validate the invite code
    const validation = await exports.validateInviteCode(code);
    
    if (!validation.isValid) {
      throw new ApiError(400, validation.message);
    }

    const inviteCode = await InviteCode.findOne({ code });
    const { organization, team, inviteCode: inviteCodeData } = validation;

    // Update user with organization and role information
    const userUpdate = {
      organizationId: organization.id,
      role: inviteCodeData.role === "team_lead" ? "team_lead" : "team_member",
    };

    if (team) {
      userUpdate.teamId = team.id;
    }

    await User.findByIdAndUpdate(userId, userUpdate);

    // If team exists, add user to the team
    if (team) {
      const teamDoc = await Team.findById(team.id);
      
      // Add user to team members if not already there
      if (!teamDoc.members.includes(userId)) {
        teamDoc.members.push(userId);
      }

      // If user is a team lead, update team with the lead
      if (inviteCodeData.role === "team_lead") {
        teamDoc.teamLead = userId;
      }

      await teamDoc.save();
    }

    // Mark invite code as used
    inviteCode.status = "used";
    inviteCode.usedAt = new Date();
    inviteCode.usedBy = userId;
    await inviteCode.save();

    logger.info(`User ${userId} registered using invite code ${code}`);
    return {
      success: true,
      organization,
      team,
      role: inviteCodeData.role,
    };
  } catch (error) {
    logger.error(`Error using invite code ${code}:`, error);
    throw error;
  }
};

/**
 * Get all invite codes for an organization
 * @param {string} organizationId - Organization ID
 * @param {Object} filters - Optional filters
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Invite codes and pagination info
 */
exports.getOrganizationInviteCodes = async (
  organizationId,
  filters = {},
  page = 1,
  limit = 10
) => {
  try {
    const query = { organizationId, ...filters };
    const skip = (page - 1) * limit;

    // Get invite codes with pagination
    const inviteCodes = await InviteCode.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("teamId", "name type")
      .populate("createdBy", "profile.firstName profile.lastName email")
      .populate("usedBy", "profile.firstName profile.lastName email")
      .lean();

    // Get total count
    const total = await InviteCode.countDocuments(query);

    return {
      inviteCodes,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error(`Error fetching invite codes for organization ${organizationId}:`, error);
    throw error;
  }
};

/**
 * Revoke an invite code
 * @param {string} code - Invite code
 * @returns {Promise<Object>} Result
 */
exports.revokeInviteCode = async (code) => {
  try {
    const inviteCode = await InviteCode.findOne({ code });
    
    if (!inviteCode) {
      throw new ApiError(404, "Invite code not found");
    }

    if (inviteCode.status !== "active") {
      throw new ApiError(400, `Cannot revoke invite code with status: ${inviteCode.status}`);
    }

    inviteCode.status = "revoked";
    await inviteCode.save();

    logger.info(`Invite code ${code} revoked`);
    return { success: true };
  } catch (error) {
    logger.error(`Error revoking invite code ${code}:`, error);
    throw error;
  }
};
