const { AppError } = require('../../../utils/errors');

/**
 * Middleware to check if user has required roles
 * @param {String[]} roles - Array of required roles
 */
exports.hasRoles = (roles = []) => {
  return (req, res, next) => {
    // Must be used after authenticate middleware
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }
    
    // Check if user has any of the required roles
    const hasRequiredRole = roles.some(role => req.user.role === role);
    
    if (!hasRequiredRole) {
      return next(new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
    }
    
    next();
  };
};

/**
 * Middleware to check if user has specific permissions
 * @param {String[]} permissions - Array of required permissions
 */
exports.hasPermissions = (permissions = []) => {
  return (req, res, next) => {
    // Must be used after authenticate middleware
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }
    
    // If user is admin, allow all operations
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Check if user has all required permissions
    // This assumes user has a permissions array
    const userPermissions = req.user.permissions || [];
    const hasAllPermissions = permissions.every(permission => 
      userPermissions.includes(permission)
    );
    
    if (!hasAllPermissions) {
      return next(new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
    }
    
    next();
  };
};

/**
 * Middleware to check if user owns the resource
 * @param {Function} getResourceUserId - Function to extract owner ID from request
 */
exports.isResourceOwner = (getResourceUserId) => {
  return async (req, res, next) => {
    // Must be used after authenticate middleware
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }
    
    // Admin can access all resources
    if (req.user.role === 'admin') {
      return next();
    }
    
    try {
      // Get the resource owner ID using the provided function
      const resourceUserId = await getResourceUserId(req);
      
      // Check if user is the owner
      if (resourceUserId && resourceUserId.toString() === req.user._id.toString()) {
        return next();
      }
      
      return next(new AppError('Access denied', 403, 'ACCESS_DENIED'));
    } catch (error) {
      next(error);
    }
  };
};