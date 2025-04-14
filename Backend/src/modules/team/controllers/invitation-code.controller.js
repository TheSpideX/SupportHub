/**
 * Invitation Code Controller
 * Handles HTTP requests for invitation code management
 */

const invitationService = require('../services/invitation.service');
const teamService = require('../services/team.service');
const { ApiError } = require('../../../utils/errors');
const crypto = require('crypto');

/**
 * Generate a new invitation code
 * @route POST /api/teams/:teamId/invitation-codes
 * @access Private - Admin or Team Lead only
 */
exports.generateInvitationCode = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { role } = req.body;
    const userId = req.user._id;

    // Check if user has permission to generate codes
    const membership = await teamService.checkTeamMembership(userId, teamId);
    
    // Only admin or team lead can generate invitation codes
    const isAdmin = req.user.role === 'admin';
    
    if (!isAdmin && (!membership.isLead || membership.team.leadId.toString() !== userId.toString())) {
      throw new ApiError(403, 'Only team lead or admin can generate invitation codes');
    }
    
    // Team leads can only generate member codes, admins can generate both
    if (!isAdmin && role === 'lead') {
      throw new ApiError(403, 'Only admins can generate team lead invitation codes');
    }

    // Generate a secure random code (6 characters)
    const code = crypto.randomBytes(3).toString('hex');
    
    // Set expiration (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Add code to team
    const team = await teamService.getTeamById(teamId);
    
    team.invitationCodes.push({
      code,
      role,
      createdBy: userId,
      createdAt: new Date(),
      expiresAt,
      isUsed: false
    });

    await team.save();

    res.status(201).json({
      success: true,
      data: {
        code,
        role,
        expiresAt,
        teamId,
        teamName: team.name,
        teamType: team.teamType
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all invitation codes for a team
 * @route GET /api/teams/:teamId/invitation-codes
 * @access Private - Admin or Team Lead only
 */
exports.listInvitationCodes = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const userId = req.user._id;

    // Check if user has permission to view codes
    const membership = await teamService.checkTeamMembership(userId, teamId);
    
    // Only admin or team lead can view invitation codes
    const isAdmin = req.user.role === 'admin';
    
    if (!isAdmin && (!membership.isLead || membership.team.leadId.toString() !== userId.toString())) {
      throw new ApiError(403, 'Only team lead or admin can view invitation codes');
    }

    const team = await teamService.getTeamById(teamId);
    
    // Return only active codes (not used and not expired)
    const activeCodes = team.invitationCodes.filter(code => 
      !code.isUsed && new Date(code.expiresAt) > new Date()
    );

    res.status(200).json({
      success: true,
      data: activeCodes.map(code => ({
        id: code._id,
        code: code.code,
        role: code.role,
        createdAt: code.createdAt,
        expiresAt: code.expiresAt,
        createdBy: code.createdBy
      }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke an invitation code
 * @route DELETE /api/teams/:teamId/invitation-codes/:codeId
 * @access Private - Admin or Team Lead only
 */
exports.revokeInvitationCode = async (req, res, next) => {
  try {
    const { teamId, codeId } = req.params;
    const userId = req.user._id;

    // Check if user has permission to revoke codes
    const membership = await teamService.checkTeamMembership(userId, teamId);
    
    // Only admin or team lead can revoke invitation codes
    const isAdmin = req.user.role === 'admin';
    
    if (!isAdmin && (!membership.isLead || membership.team.leadId.toString() !== userId.toString())) {
      throw new ApiError(403, 'Only team lead or admin can revoke invitation codes');
    }

    const team = await teamService.getTeamById(teamId);
    
    // Find the code
    const codeIndex = team.invitationCodes.findIndex(code => 
      code._id.toString() === codeId
    );
    
    if (codeIndex === -1) {
      throw new ApiError(404, 'Invitation code not found');
    }
    
    // Check if code is already used
    if (team.invitationCodes[codeIndex].isUsed) {
      throw new ApiError(400, 'Cannot revoke a code that has already been used');
    }
    
    // Remove the code
    team.invitationCodes.splice(codeIndex, 1);
    await team.save();

    res.status(200).json({
      success: true,
      message: 'Invitation code revoked successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validate an invitation code (without using it)
 * @route GET /api/invitation-codes/:code/validate
 * @access Public
 */
exports.validateInvitationCode = async (req, res, next) => {
  try {
    const { code } = req.params;
    
    // Find team with this code
    const team = await teamService.findTeamByInvitationCode(code);
    
    if (!team) {
      throw new ApiError(400, 'Invalid or expired invitation code');
    }
    
    // Get code details
    const invitationCode = team.invitationCodes.find(c => c.code === code);
    
    // Check if code is valid
    if (invitationCode.isUsed) {
      throw new ApiError(400, 'This invitation code has already been used');
    }
    
    if (new Date(invitationCode.expiresAt) < new Date()) {
      throw new ApiError(400, 'This invitation code has expired');
    }
    
    res.status(200).json({
      success: true,
      data: {
        teamId: team._id,
        teamName: team.name,
        teamType: team.teamType,
        role: invitationCode.role,
        expiresAt: invitationCode.expiresAt
      }
    });
  } catch (error) {
    next(error);
  }
};
