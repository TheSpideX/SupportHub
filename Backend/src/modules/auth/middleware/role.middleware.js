/**
 * Role Middleware
 * Implements Role-Based Access Control (RBAC) for the application
 * Based on the SRS requirements for different user roles and permissions
 */

const { ApiError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');
const { USER_ROLES, ROLE_HIERARCHY, hasPermission } = require('../constants/roles.constant');

/**
 * Middleware to check if user has required roles
 * SRS - Security Requirements: Role-Based Access Control (RBAC)
 * 
 * @param {String[]} allowedRoles - Array of roles that have access
 * @returns {Function} Express middleware
 */
exports.srs = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      // Must be authenticated to check roles
      if (!req.user) {
        logger.warn('Role check attempted without authentication');
        return next(new ApiError(401, 'Authentication required'));
      }

      const userRole = req.user.role;
      
      // If user is admin, they have access to everything
      if (userRole === USER_ROLES.ADMIN) {
        return next();
      }
      
      // Check if user's role is in the allowed roles
      if (allowedRoles.includes(userRole)) {
        return next();
      }
      
      // Log the access denial
      logger.warn(`Access denied: User ${req.user._id} with role ${userRole} attempted to access a route requiring roles: ${allowedRoles.join(', ')}`);
      
      // Return forbidden error
      return next(new ApiError(403, 'Insufficient permissions'));
    } catch (error) {
      logger.error('Error in role middleware:', error);
      return next(new ApiError(500, 'Internal server error'));
    }
  };
};

/**
 * Middleware to check if user has specific permissions
 * SRS - Security Requirements: Role-Based Access Control (RBAC)
 * 
 * @param {String[]} requiredPermissions - Array of permissions required
 * @returns {Function} Express middleware
 */
exports.requirePermissions = (requiredPermissions = []) => {
  return (req, res, next) => {
    try {
      // Must be authenticated to check permissions
      if (!req.user) {
        logger.warn('Permission check attempted without authentication');
        return next(new ApiError(401, 'Authentication required'));
      }

      const userRole = req.user.role;
      
      // If user is admin, they have all permissions
      if (userRole === USER_ROLES.ADMIN) {
        return next();
      }
      
      // Check if user's role has all required permissions
      const hasAllPermissions = requiredPermissions.every(permission => 
        hasPermission(userRole, permission)
      );
      
      if (hasAllPermissions) {
        return next();
      }
      
      // Log the access denial
      logger.warn(`Permission denied: User ${req.user._id} with role ${userRole} attempted to access a route requiring permissions: ${requiredPermissions.join(', ')}`);
      
      // Return forbidden error
      return next(new ApiError(403, 'Insufficient permissions'));
    } catch (error) {
      logger.error('Error in permission middleware:', error);
      return next(new ApiError(500, 'Internal server error'));
    }
  };
};

/**
 * Middleware to check if user is the owner of a resource
 * SRS - Security Requirements: Role-Based Access Control (RBAC)
 * 
 * @param {Function} getResourceUserId - Function to extract resource owner ID from request
 * @returns {Function} Express middleware
 */
exports.isResourceOwner = (getResourceUserId) => {
  return async (req, res, next) => {
    try {
      // Must be authenticated to check ownership
      if (!req.user) {
        logger.warn('Ownership check attempted without authentication');
        return next(new ApiError(401, 'Authentication required'));
      }

      const userId = req.user._id.toString();
      const userRole = req.user.role;
      
      // If user is admin, they have access to all resources
      if (userRole === USER_ROLES.ADMIN) {
        return next();
      }
      
      // Get the resource owner ID using the provided function
      const resourceUserId = await getResourceUserId(req);
      
      if (!resourceUserId) {
        logger.warn(`Resource ownership check failed: Could not determine resource owner`);
        return next(new ApiError(400, 'Invalid resource'));
      }
      
      // Check if user is the owner
      if (resourceUserId.toString() === userId) {
        return next();
      }
      
      // Log the access denial
      logger.warn(`Ownership denied: User ${userId} attempted to access a resource owned by ${resourceUserId}`);
      
      // Return forbidden error
      return next(new ApiError(403, 'Access denied'));
    } catch (error) {
      logger.error('Error in ownership middleware:', error);
      return next(new ApiError(500, 'Internal server error'));
    }
  };
};

/**
 * Middleware to check if user is a team lead of the specified team
 * SRS - User Classes: Team Lead manages team workloads and oversees ticket assignments
 * 
 * @param {Function} getTeamId - Function to extract team ID from request
 * @returns {Function} Express middleware
 */
exports.isTeamLead = (getTeamId) => {
  return async (req, res, next) => {
    try {
      // Must be authenticated to check team lead status
      if (!req.user) {
        logger.warn('Team lead check attempted without authentication');
        return next(new ApiError(401, 'Authentication required'));
      }

      const userId = req.user._id.toString();
      const userRole = req.user.role;
      
      // If user is admin, they have access to all teams
      if (userRole === USER_ROLES.ADMIN) {
        return next();
      }
      
      // Only team leads can proceed
      if (userRole !== USER_ROLES.TEAM_LEAD) {
        logger.warn(`Team lead access denied: User ${userId} with role ${userRole} is not a team lead`);
        return next(new ApiError(403, 'Only team leads can perform this action'));
      }
      
      // Get the team ID using the provided function
      const teamId = await getTeamId(req);
      
      if (!teamId) {
        logger.warn(`Team lead check failed: Could not determine team ID`);
        return next(new ApiError(400, 'Invalid team'));
      }
      
      // Check if user is a lead of this team
      // This would typically involve a database query to check team membership
      // For now, we'll assume the user's teams are populated in req.user.teams
      const isLeadOfTeam = req.user.teams && 
                           req.user.teams.some(team => 
                             team.teamId.toString() === teamId.toString() && 
                             team.role === 'lead'
                           );
      
      if (isLeadOfTeam) {
        return next();
      }
      
      // Log the access denial
      logger.warn(`Team lead access denied: User ${userId} is not a lead of team ${teamId}`);
      
      // Return forbidden error
      return next(new ApiError(403, 'You are not a lead of this team'));
    } catch (error) {
      logger.error('Error in team lead middleware:', error);
      return next(new ApiError(500, 'Internal server error'));
    }
  };
};
