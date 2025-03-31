const { AppError } = require('../../../utils/errors');

/**
 * Core authorization logic for checking roles
 * @param {Object} user - User object with role property
 * @param {String[]} roles - Array of required roles
 * @returns {Boolean} Whether user has any of the required roles
 */
const checkRoles = (user, roles = []) => {
  if (!user) return false;
  return roles.some(role => user.role === role);
};

/**
 * Core authorization logic for checking permissions
 * @param {Object} user - User object with role and permissions properties
 * @param {String[]} permissions - Array of required permissions
 * @returns {Boolean} Whether user has all required permissions
 */
const checkPermissions = (user, permissions = []) => {
  if (!user) return false;
  
  // Admin bypass - admins have all permissions
  if (user.role === 'admin') return true;
  
  // Check if user has all required permissions
  const userPermissions = user.permissions || [];
  return permissions.every(permission => userPermissions.includes(permission));
};

/**
 * HTTP middleware to check if user has required roles
 * @param {String[]} roles - Array of required roles
 */
exports.hasRoles = (roles = []) => {
  return (req, res, next) => {
    // Must be used after authenticate middleware
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }
    
    if (!checkRoles(req.user, roles)) {
      return next(new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
    }
    
    next();
  };
};

/**
 * HTTP middleware to check if user has specific permissions
 * @param {String[]} permissions - Array of required permissions
 */
exports.hasPermissions = (permissions = []) => {
  return (req, res, next) => {
    // Must be used after authenticate middleware
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }
    
    if (!checkPermissions(req.user, permissions)) {
      return next(new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
    }
    
    next();
  };
};

/**
 * Socket.IO middleware to check if user has required roles
 * @param {String[]} roles - Array of required roles
 */
exports.socketHasRoles = (roles = []) => {
  return (socket, next) => {
    // Must be used after socket authentication middleware
    if (!socket.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }
    
    if (!checkRoles(socket.user, roles)) {
      return next(new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
    }
    
    next();
  };
};

/**
 * Socket.IO middleware to check if user has specific permissions
 * @param {String[]} permissions - Array of required permissions
 */
exports.socketHasPermissions = (permissions = []) => {
  return (socket, next) => {
    // Must be used after socket authentication middleware
    if (!socket.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }
    
    if (!checkPermissions(socket.user, permissions)) {
      return next(new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
    }
    
    next();
  };
};

/**
 * Core resource ownership check logic
 * @param {Object} user - User object
 * @param {String} resourceUserId - ID of resource owner
 * @returns {Boolean} Whether user owns the resource
 */
const checkResourceOwnership = (user, resourceUserId) => {
  if (!user || !resourceUserId) return false;
  
  // Admin bypass
  if (user.role === 'admin') return true;
  
  // Check if user is the owner
  return resourceUserId.toString() === user._id.toString();
};

/**
 * HTTP middleware to check if user owns the resource
 * @param {Function} getResourceUserId - Function to extract owner ID from request
 */
exports.isResourceOwner = (getResourceUserId) => {
  return async (req, res, next) => {
    // Must be used after authenticate middleware
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }
    
    try {
      // Get the resource owner ID using the provided function
      const resourceUserId = await getResourceUserId(req);
      
      if (checkResourceOwnership(req.user, resourceUserId)) {
        return next();
      }
      
      return next(new AppError('Access denied', 403, 'ACCESS_DENIED'));
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Socket middleware to check if user owns the resource
 * @param {Function} getResourceUserId - Function to extract owner ID from socket and data
 */
exports.socketIsResourceOwner = (getResourceUserId) => {
  return async (socket, data, next) => {
    // Must be used after socket authentication middleware
    if (!socket.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }
    
    try {
      // Get the resource owner ID using the provided function
      const resourceUserId = await getResourceUserId(socket, data);
      
      if (checkResourceOwnership(socket.user, resourceUserId)) {
        return next();
      }
      
      return next(new AppError('Access denied', 403, 'ACCESS_DENIED'));
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Apply authorization to socket events
 * @param {Object} socket - Socket.IO socket
 * @param {Object} eventHandlers - Map of event names to handler functions
 * @param {Object} authRules - Map of event names to authorization rules
 */
exports.applySocketEventAuthorization = (socket, eventHandlers, authRules) => {
  // Create a proxy for the socket.on method
  const originalOn = socket.on;
  
  // Replace socket.on with our authorized version
  socket.on = function(eventName, handler) {
    // Skip for internal events
    if (eventName.startsWith('socket.') || 
        eventName === 'disconnect' || 
        eventName === 'error' ||
        eventName === 'connect_error') {
      return originalOn.call(this, eventName, handler);
    }
    
    // Get authorization rules for this event
    const rules = authRules[eventName] || {};
    
    // Create authorized handler
    const authorizedHandler = function(...args) {
      const callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;
      const data = args[0] || {};
      
      // Create next function for authorization
      const next = (error) => {
        if (error) {
          if (callback) {
            return callback({
              status: 'error',
              code: error.code || 'AUTHORIZATION_ERROR',
              message: error.message || 'Authorization failed'
            });
          }
          return socket.emit('error', {
            status: 'error',
            code: error.code || 'AUTHORIZATION_ERROR',
            message: error.message || 'Authorization failed'
          });
        }
        
        // If authorized, call the original handler
        try {
          if (callback) {
            return handler.call(socket, data, callback);
          }
          return handler.call(socket, data);
        } catch (handlerError) {
          if (callback) {
            return callback({
              status: 'error',
              code: 'INTERNAL_ERROR',
              message: 'Internal server error'
            });
          }
          socket.emit('error', {
            status: 'error',
            code: 'INTERNAL_ERROR',
            message: 'Internal server error'
          });
        }
      };
      
      // Apply authorization middleware
      const authMiddleware = exports.socketEventAuthorize(rules);
      authMiddleware(socket, eventName, data, next);
    };
    
    // Register the authorized handler
    return originalOn.call(this, eventName, authorizedHandler);
  };
  
  // Register all event handlers with authorization
  Object.entries(eventHandlers).forEach(([eventName, handler]) => {
    socket.on(eventName, handler);
  });
  
  return socket;
};

/**
 * Create socket namespace with authorization
 * @param {Object} io - Socket.IO instance
 * @param {String} namespace - Namespace path
 * @param {Object} options - Configuration options
 * @returns {Object} Configured namespace with authorization
 */
exports.createAuthorizedNamespace = (io, namespace, options = {}) => {
  const ns = io.of(namespace);
  
  // Apply authentication middleware
  ns.use((socket, next) => {
    // Authentication middleware should set socket.user from HTTP-only cookies
    // This assumes the cookie-parser and session middleware have been applied
    if (!socket.request.cookies) {
      return next(new AppError('No cookies found', 401, 'AUTH_REQUIRED'));
    }
    
    // The actual authentication logic should be implemented in a separate middleware
    // that sets socket.user based on the HTTP-only cookies
    
    // If we have a user loader function, use it to load the user
    if (options.loadUser && socket.request.session && socket.request.session.userId) {
      return options.loadUser(socket.request.session.userId)
        .then(user => {
          if (!user) {
            return next(new AppError('User not found', 404, 'USER_NOT_FOUND'));
          }
          socket.user = user;
          // Also set in socket.data for compatibility
          socket.data = socket.data || {};
          socket.data.userId = user._id.toString();
          next();
        })
        .catch(err => next(err));
    }
    
    // If no user loader, check if socket.user is set by auth middleware
    if (!socket.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
    }
    
    next();
  });
  
  // Apply role-based authorization if specified
  if (options.roles && options.roles.length > 0) {
    ns.use(exports.socketHasRoles(options.roles));
  }
  
  // Apply permission-based authorization if specified
  if (options.permissions && options.permissions.length > 0) {
    ns.use(exports.socketHasPermissions(options.permissions));
  }
  
  // Apply room authorization if specified
  if (options.roomAuthorization) {
    // Override the socket.join method to check authorization
    const originalJoin = socket => socket.join;
    socket.prototype.join = function(room, callback) {
      // Create room authorization middleware
      const roomAuth = exports.socketCanJoinRoom(options.roomAuthorization.getRoomInfo);
      
      // Apply room authorization
      roomAuth(this, room, (err) => {
        if (err) {
          if (typeof callback === 'function') {
            return callback(err);
          }
          return this.emit('error', {
            status: 'error',
            code: err.code || 'ROOM_ACCESS_DENIED',
            message: err.message || 'Cannot join room'
          });
        }
        
        // Call original join method
        return originalJoin.call(this, room, callback);
      });
    };
  }
  
  // Set up connection handler with event authorization
  ns.on('connection', (socket) => {
    // Apply event authorization
    if (options.eventAuthorization) {
      exports.applySocketEventAuthorization(
        socket, 
        options.eventHandlers || {}, 
        options.eventAuthorization || {}
      );
    }
    
    // Call the connection handler if provided
    if (options.onConnection) {
      options.onConnection(socket);
    }
  });
  
  return ns;
};

/**
 * Core room access check logic
 * @param {Object} user - User object
 * @param {Object} roomInfo - Room information
 * @returns {Boolean} Whether user can access the room
 */
const checkRoomAccess = (user, roomInfo) => {
  if (!user || !roomInfo) return false;
  
  // Admin bypass
  if (user.role === 'admin') return true;
  
  // Check room type and apply appropriate rules
  const roomType = roomInfo.type;
  const userId = user._id.toString();
  
  switch (roomType) {
    case 'user':
      // User can only access their own user room
      return roomInfo.userId === userId;
      
    case 'device':
      // User can access device rooms for their devices
      return roomInfo.userId === userId;
      
    case 'session':
      // User can access session rooms for their sessions
      return roomInfo.userId === userId;
      
    case 'tab':
      // User can access tab rooms for their tabs
      return roomInfo.userId === userId;
      
    default:
      // For custom room types, check explicit permissions
      if (roomInfo.ownerId && roomInfo.ownerId.toString() === userId) {
        return true; // User is the owner
      }
      
      if (roomInfo.allowedUsers && roomInfo.allowedUsers.includes(userId)) {
        return true; // User is explicitly allowed
      }
      
      if (roomInfo.public) {
        return true; // Room is public
      }
      
      return false;
  }
};

/**
 * Socket room authorization middleware
 * @param {Function} getRoomInfo - Function to get room info from room name
 * @returns {Function} Room authorization middleware
 */
exports.socketCanJoinRoom = (getRoomInfo) => {
  return async (socket, room, next) => {
    try {
      // Must be used after socket authentication middleware
      if (!socket.user) {
        return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
      }
      
      // Parse room name to extract type and ID
      // Expected format: {type}:{id} (e.g., user:123, device:456)
      const roomInfo = await getRoomInfo(room);
      
      if (!roomInfo) {
        return next(new AppError('Room not found', 404, 'ROOM_NOT_FOUND'));
      }
      
      if (checkRoomAccess(socket.user, roomInfo)) {
        return next();
      }
      
      return next(new AppError('Access denied', 403, 'ACCESS_DENIED'));
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Socket event authorization middleware factory
 * @param {Object} options - Authorization options
 * @returns {Function} Event authorization middleware
 */
exports.socketEventAuthorize = (options = {}) => {
  return (socket, eventName, data, next) => {
    try {
      // Must be used after socket authentication middleware
      if (!socket.user) {
        return next(new AppError('Authentication required', 401, 'AUTH_REQUIRED'));
      }
      
      // Check roles if specified
      if (options.roles && options.roles.length > 0) {
        if (!checkRoles(socket.user, options.roles)) {
          return next(new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
        }
      }
      
      // Check permissions if specified
      if (options.permissions && options.permissions.length > 0) {
        if (!checkPermissions(socket.user, options.permissions)) {
          return next(new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS'));
        }
      }
      
      // Check resource ownership if specified
      if (options.resourceOwnership && typeof options.getResourceUserId === 'function') {
        return options.getResourceUserId(socket, data)
          .then(resourceUserId => {
            if (checkResourceOwnership(socket.user, resourceUserId)) {
              return next();
            }
            return next(new AppError('Access denied', 403, 'ACCESS_DENIED'));
          })
          .catch(err => next(err));
      }
      
      // If we got here, authorization passed
      next();
    } catch (error) {
      next(error);
    }
  };
};
