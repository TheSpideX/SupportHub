/**
 * Team Controller
 * Handles HTTP requests for team management
 */

const teamService = require("../services/team.service");
const { ApiError } = require("../../../utils/errors");
const logger = require("../../../utils/logger");

/**
 * Create a new team
 * @route POST /api/teams
 * @access Private - Admin only
 */
exports.createTeam = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const userId = req.user._id;

    const team = await teamService.createTeam({ name, description }, userId);

    res.status(201).json({
      success: true,
      data: team,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all teams
 * @route GET /api/teams
 * @access Private - Admin only
 */
exports.getAllTeams = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, ...filters } = req.query;
    const userId = req.user._id;

    // Check if user is admin, if not, only return teams they are a member of
    const isAdmin = req.user.role === "admin";
    
    let result;
    if (isAdmin) {
      result = await teamService.getAllTeams(filters, parseInt(page), parseInt(limit));
    } else {
      // For non-admins, only return teams they are a member of
      const userTeams = await teamService.getUserTeams(userId);
      result = {
        teams: userTeams,
        pagination: {
          total: userTeams.length,
          page: 1,
          limit: userTeams.length,
          pages: 1,
        },
      };
    }

    res.status(200).json({
      success: true,
      data: result.teams,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get team by ID
 * @route GET /api/teams/:id
 * @access Private - Team members, team lead, or admin
 */
exports.getTeamById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Check if user is admin or team member
    const isAdmin = req.user.role === "admin";
    const membership = await teamService.checkTeamMembership(userId, id);

    if (!isAdmin && !membership.isMember) {
      throw new ApiError(403, "Not authorized to view this team");
    }

    const team = await teamService.getTeamById(id);

    res.status(200).json({
      success: true,
      data: team,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update team
 * @route PUT /api/teams/:id
 * @access Private - Team lead or admin
 */
exports.updateTeam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.user._id;

    const team = await teamService.updateTeam(
      id,
      { name, description },
      userId
    );

    res.status(200).json({
      success: true,
      data: team,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete team
 * @route DELETE /api/teams/:id
 * @access Private - Admin only
 */
exports.deleteTeam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const result = await teamService.deleteTeam(id, userId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add member to team
 * @route POST /api/teams/:id/members
 * @access Private - Team lead or admin
 */
exports.addTeamMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId: memberId, role } = req.body;
    const userId = req.user._id;

    const team = await teamService.addTeamMember(
      id,
      { userId: memberId, role },
      userId
    );

    res.status(200).json({
      success: true,
      data: team,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove member from team
 * @route DELETE /api/teams/:id/members/:memberId
 * @access Private - Team lead or admin
 */
exports.removeTeamMember = async (req, res, next) => {
  try {
    const { id, memberId } = req.params;
    const userId = req.user._id;

    const team = await teamService.removeTeamMember(id, memberId, userId);

    res.status(200).json({
      success: true,
      data: team,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change team lead
 * @route PUT /api/teams/:id/lead
 * @access Private - Current team lead or admin
 */
exports.changeTeamLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newLeadId } = req.body;
    const userId = req.user._id;

    const team = await teamService.changeTeamLead(id, newLeadId, userId);

    res.status(200).json({
      success: true,
      data: team,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get teams for current user
 * @route GET /api/teams/my-teams
 * @access Private
 */
exports.getMyTeams = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const teams = await teamService.getUserTeams(userId);

    res.status(200).json({
      success: true,
      data: teams,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check team membership
 * @route GET /api/teams/:id/membership
 * @access Private
 */
exports.checkTeamMembership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const membership = await teamService.checkTeamMembership(userId, id);

    res.status(200).json({
      success: true,
      data: membership,
    });
  } catch (error) {
    next(error);
  }
};
