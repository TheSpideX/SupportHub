/**
 * Team Service
 * Handles business logic for team management
 */

const mongoose = require("mongoose");
const Team = require("../models/team.model");
const User = require("../../auth/models/user.model");
const logger = require("../../../utils/logger");
const { ApiError } = require("../../../utils/errors");

/**
 * Create a new team
 * @param {Object} teamData - Team data
 * @param {string} userId - User ID creating the team
 * @param {mongoose.ClientSession} [session] - MongoDB session for transactions
 * @returns {Promise<Team>} Created team
 */
exports.createTeam = async (teamData, userId, session = null) => {
  try {
    // Check if team name already exists within the same organization
    const query = {
      name: teamData.name,
      organizationId: teamData.organizationId,
    };

    const existingTeam = await Team.findOne(query);

    if (existingTeam) {
      throw new ApiError(400, "Team name already exists in this organization");
    }

    // Create team with session if provided
    const teamDoc = {
      name: teamData.name,
      description: teamData.description,
      teamType: teamData.teamType || "support", // Default to support if not specified
      createdBy: userId,
      organizationId: teamData.organizationId, // Add organizationId
    };

    const team = await Team.create(teamDoc);

    logger.info(`Team created with type: ${team.teamType}`);

    // Add creator as team lead
    await team.addMember({
      userId,
      role: "lead",
      invitedBy: userId,
    });

    logger.info(`Team created: ${team.name} (${team._id}) by user ${userId}`);
    return team;
  } catch (error) {
    logger.error(`Error creating team: ${error.message}`, error);
    throw error;
  }
};

/**
 * Get all teams
 * @param {Object} filters - Optional filters
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Teams and pagination info
 */
exports.getAllTeams = async (filters = {}, page = 1, limit = 10) => {
  try {
    const query = { ...filters };
    const skip = (page - 1) * limit;

    // Get teams with pagination
    const teams = await Team.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("leadId", "profile.firstName profile.lastName email")
      .populate("createdBy", "profile.firstName profile.lastName email")
      .lean();

    // Get total count
    const total = await Team.countDocuments(query);

    return {
      teams,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error(`Error getting teams: ${error.message}`, error);
    throw error;
  }
};

/**
 * Get team by ID
 * @param {string} teamId - Team ID
 * @returns {Promise<Team>} Team
 */
exports.getTeamById = async (teamId) => {
  try {
    // Check if teamId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      logger.warn(`Invalid team ID format: ${teamId}`);
      throw new ApiError(400, "Invalid team ID format");
    }

    // First get the team with populated fields
    const team = await Team.findById(teamId)
      .populate("leadId", "profile.firstName profile.lastName email")
      .populate("createdBy", "profile.firstName profile.lastName email")
      .populate("members.userId", "profile.firstName profile.lastName email")
      .populate(
        "members.invitedBy",
        "profile.firstName profile.lastName email"
      );

    // If team exists, check for members without populated userId
    if (team) {
      // Find members that don't have userId populated
      const membersToUpdate = team.members.filter(
        (member) => !member.userId && member._id
      );

      if (membersToUpdate.length > 0) {
        logger.info(
          `Found ${membersToUpdate.length} members without populated userId`
        );

        // For each member without userId, try to find the user by _id
        const User = require("../../auth/models/user.model");

        for (const member of membersToUpdate) {
          try {
            // Try to find the user by the member's _id
            const user = await User.findById(member._id);
            if (user) {
              // If found, set the userId field
              member.userId = user;
              logger.info(`Updated member ${member._id} with user data`);
            }
          } catch (err) {
            logger.warn(
              `Could not find user for member ${member._id}: ${err.message}`
            );
          }
        }
      }
    }

    if (!team) {
      throw new ApiError(404, "Team not found");
    }

    return team;
  } catch (error) {
    // If it's already an ApiError, just rethrow it
    if (error instanceof ApiError) {
      throw error;
    }

    logger.error(`Error getting team: ${error.message}`, error);
    throw new ApiError(500, `Error getting team: ${error.message}`);
  }
};

/**
 * Update team
 * @param {string} teamId - Team ID
 * @param {Object} updateData - Data to update
 * @param {string} userId - User ID performing the update
 * @returns {Promise<Team>} Updated team
 */
exports.updateTeam = async (teamId, updateData, userId) => {
  try {
    const team = await Team.findById(teamId);

    if (!team) {
      throw new ApiError(404, "Team not found");
    }

    // Check if user is admin or team lead
    const isTeamLead = team.isTeamLead(userId);
    const user = await User.findById(userId);
    const isAdmin = user && user.role === "admin";

    if (!isAdmin && !isTeamLead) {
      throw new ApiError(403, "Not authorized to update team");
    }

    // Check if name is being updated and if it already exists
    if (updateData.name && updateData.name !== team.name) {
      const existingTeam = await Team.findOne({ name: updateData.name });
      if (existingTeam) {
        throw new ApiError(400, "Team name already exists");
      }
    }

    // Update allowed fields
    const allowedFields = ["name", "description"];
    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        team[field] = updateData[field];
      }
    });

    await team.save();
    logger.info(`Team updated: ${team.name} (${team._id}) by user ${userId}`);

    return team;
  } catch (error) {
    logger.error(`Error updating team: ${error.message}`, error);
    throw error;
  }
};

/**
 * Delete team
 * @param {string} teamId - Team ID
 * @param {string} userId - User ID performing the deletion
 * @returns {Promise<Object>} Deletion result
 */
exports.deleteTeam = async (teamId, userId) => {
  try {
    const team = await Team.findById(teamId);

    if (!team) {
      throw new ApiError(404, "Team not found");
    }

    // Check if user is admin
    const user = await User.findById(userId);
    const isAdmin = user && user.role === "admin";

    if (!isAdmin) {
      throw new ApiError(403, "Only admins can delete teams");
    }

    // Delete team using findByIdAndDelete instead of deprecated remove() method
    await Team.findByIdAndDelete(teamId);
    logger.info(`Team deleted: ${team.name} (${team._id}) by user ${userId}`);

    return { success: true, message: "Team deleted successfully" };
  } catch (error) {
    logger.error(`Error deleting team: ${error.message}`, error);
    throw error;
  }
};

/**
 * Add member to team
 * @param {string} teamId - Team ID
 * @param {Object} memberData - Member data
 * @param {string} userId - User ID performing the action
 * @returns {Promise<Team>} Updated team
 */
exports.addTeamMember = async (teamId, memberData, userId) => {
  try {
    const team = await Team.findById(teamId);

    if (!team) {
      throw new ApiError(404, "Team not found");
    }

    // Check if user is admin or team lead
    const isTeamLead = team.isTeamLead(userId);
    const user = await User.findById(userId);
    const isAdmin = user && user.role === "admin";

    if (!isAdmin && !isTeamLead) {
      throw new ApiError(403, "Not authorized to add team members");
    }

    // Check if member exists
    const memberUser = await User.findById(memberData.userId);
    if (!memberUser) {
      throw new ApiError(404, "User not found");
    }

    // Add member
    await team.addMember({
      userId: memberData.userId,
      role: memberData.role || "member",
      invitedBy: userId,
    });

    logger.info(
      `Member added to team: ${memberData.userId} to ${team.name} (${team._id}) by user ${userId}`
    );

    return team;
  } catch (error) {
    logger.error(`Error adding team member: ${error.message}`, error);
    throw error;
  }
};

/**
 * Remove member from team
 * @param {string} teamId - Team ID
 * @param {string} memberId - Member ID to remove
 * @param {string} userId - User ID performing the action
 * @returns {Promise<Team>} Updated team
 */
exports.removeTeamMember = async (teamId, memberId, userId) => {
  try {
    const team = await Team.findById(teamId);

    if (!team) {
      throw new ApiError(404, "Team not found");
    }

    // Check if user is admin or team lead
    const isTeamLead = team.isTeamLead(userId);
    const user = await User.findById(userId);
    const isAdmin = user && user.role === "admin";

    if (!isAdmin && !isTeamLead) {
      throw new ApiError(403, "Not authorized to remove team members");
    }

    // Check if member is the team lead
    if (team.leadId && team.leadId.toString() === memberId) {
      throw new ApiError(
        400,
        "Cannot remove team lead. Assign a new lead first."
      );
    }

    // Remove member
    await team.removeMember(memberId);

    logger.info(
      `Member removed from team: ${memberId} from ${team.name} (${team._id}) by user ${userId}`
    );

    return team;
  } catch (error) {
    logger.error(`Error removing team member: ${error.message}`, error);
    throw error;
  }
};

/**
 * Change team lead
 * @param {string} teamId - Team ID
 * @param {string} newLeadId - New lead user ID
 * @param {string} userId - User ID performing the action
 * @returns {Promise<Team>} Updated team
 */
exports.changeTeamLead = async (teamId, newLeadId, userId) => {
  try {
    const team = await Team.findById(teamId);

    if (!team) {
      throw new ApiError(404, "Team not found");
    }

    // Check if user is admin or current team lead
    const isTeamLead = team.isTeamLead(userId);
    const user = await User.findById(userId);
    const isAdmin = user && user.role === "admin";

    if (!isAdmin && !isTeamLead) {
      throw new ApiError(403, "Not authorized to change team lead");
    }

    // Check if new lead exists
    const newLeadUser = await User.findById(newLeadId);
    if (!newLeadUser) {
      throw new ApiError(404, "User not found");
    }

    // Check if new lead is already a member
    const isMember = team.isMember(newLeadId);

    // Update current lead to member if exists
    if (team.leadId) {
      const currentLeadIndex = team.members.findIndex(
        (member) => member.userId.toString() === team.leadId.toString()
      );

      if (currentLeadIndex !== -1) {
        team.members[currentLeadIndex].role = "member";
      }
    }

    // Add new lead or update existing member
    if (isMember) {
      const memberIndex = team.members.findIndex(
        (member) => member.userId.toString() === newLeadId
      );

      if (memberIndex !== -1) {
        team.members[memberIndex].role = "lead";
      }
    } else {
      team.members.push({
        userId: newLeadId,
        role: "lead",
        joinedAt: new Date(),
        invitedBy: userId,
      });
    }

    // Update team lead ID
    team.leadId = newLeadId;
    await team.save();

    logger.info(
      `Team lead changed: ${newLeadId} for ${team.name} (${team._id}) by user ${userId}`
    );

    return team;
  } catch (error) {
    logger.error(`Error changing team lead: ${error.message}`, error);
    throw error;
  }
};

/**
 * Get teams for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Teams
 */
exports.getUserTeams = async (userId) => {
  try {
    const teams = await Team.find({
      "members.userId": userId,
    })
      .populate("leadId", "profile.firstName profile.lastName email")
      .populate("createdBy", "profile.firstName profile.lastName email")
      .lean();

    return teams;
  } catch (error) {
    logger.error(`Error getting user teams: ${error.message}`, error);
    throw error;
  }
};

/**
 * Check if user is in a team
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID
 * @returns {Promise<Object>} Team membership info
 */
exports.checkTeamMembership = async (userId, teamId) => {
  try {
    // Check if teamId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      logger.warn(`Invalid team ID format: ${teamId}`);
      return {
        isMember: false,
        isLead: false,
        role: null,
        team: null,
        error: "Invalid team ID format",
      };
    }

    const team = await Team.findById(teamId);

    if (!team) {
      return { isMember: false, isLead: false, role: null, team: null };
    }

    const isMember = team.isMember(userId);
    const isLead = team.isTeamLead(userId);

    return {
      isMember,
      isLead,
      role: isLead ? "lead" : isMember ? "member" : null,
      team: isMember ? team : null,
    };
  } catch (error) {
    logger.error(`Error checking team membership: ${error.message}`, error);
    throw error;
  }
};

/**
 * Find a team by invitation code
 * @param {string} code - Invitation code
 * @returns {Promise<Team|null>} Team or null if not found
 */
exports.findTeamByInvitationCode = async (code) => {
  try {
    // Find team with this code that is not used and not expired
    const team = await Team.findOne({
      "invitationCodes.code": code,
      "invitationCodes.isUsed": false,
      "invitationCodes.expiresAt": { $gt: new Date() },
    });

    return team;
  } catch (error) {
    logger.error(
      `Error finding team by invitation code: ${error.message}`,
      error
    );
    throw error;
  }
};
