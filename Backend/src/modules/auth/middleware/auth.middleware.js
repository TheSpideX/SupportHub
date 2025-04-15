/**
 * Auth Middleware
 * Provides authentication and authorization middleware functions
 */

const { AppError } = require('../../../utils/errors');
const { authenticateToken } = require('./authenticate');
const { hasRoles, hasPermissions } = require('./authorize');

/**
 * Authenticate middleware - wrapper around authenticateToken
 */
exports.authenticate = authenticateToken;

/**
 * Authorize middleware - wrapper around hasRoles
 * @param {String[]} roles - Array of allowed roles
 */
exports.authorize = (roles = []) => {
  return hasRoles(roles);
};

/**
 * Check permissions middleware - wrapper around hasPermissions
 * @param {String[]} permissions - Array of required permissions
 */
exports.checkPermissions = (permissions = []) => {
  return hasPermissions(permissions);
};
