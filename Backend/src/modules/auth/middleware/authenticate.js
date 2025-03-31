const tokenService = require('../services/token.service');
const User = require('../models/user.model');
const { AppError } = require('../../../utils/errors');
const cookieConfig = require('../config/cookie.config');
const socketConfig = require('../config/websocket.config');
const cookie = require('cookie');

/**
 * Core authentication logic shared between HTTP and WebSocket
 * @param {string} accessToken - Access token to verify
 * @param {Object} options - Authentication options
 * @returns {Object} Authentication result with user and decoded token
 */
const authenticateCore = async (accessToken, options = {}) => {
  if (!accessToken) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }
  
  // Verify token
  let decoded;
  try {
    decoded = await tokenService.verifyAccessToken(accessToken);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Token expired', 401, 'TOKEN_EXPIRED');
    }
    throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }
  
  // Check if user exists
  const user = await User.findById(decoded.userId || decoded.sub);
  
  if (!user) {
    throw new AppError('User not found', 401, 'USER_NOT_FOUND');
  }
  
  // Check if token was issued before password change
  if (user.passwordChangedAt && decoded.iat < user.passwordChangedAt.getTime() / 1000) {
    throw new AppError('Password changed, please login again', 401, 'PASSWORD_CHANGED');
  }
  
  return { user, decoded };
};

/**
 * Extract cookies from request or socket
 * @param {Object} req - HTTP request or socket.request
 * @returns {Object} Parsed cookies
 */
const extractCookies = (req) => {
  if (!req) return {};
  
  // For HTTP requests
  if (req.cookies) return req.cookies;
  
  // For WebSocket requests
  if (req.headers && req.headers.cookie) {
    return cookie.parse(req.headers.cookie);
  }
  
  return {};
};

/**
 * Setup token expiration monitoring and notifications
 * @param {Object} socket - Socket.IO socket
 * @param {number} expiresAt - Token expiration timestamp
 */
const setupTokenExpiryMonitoring = (socket, expiresAt) => {
  if (!expiresAt) return;
  
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = expiresAt - now;
  
  // Notify client before token expires
  if (expiresIn > 0) {
    const warningTime = Math.min(60, expiresIn * 0.8); // 80% of remaining time or 60 seconds
    setTimeout(() => {
      if (socket.connected) {
        socket.emit('token:expiring', { expiresIn: expiresIn - warningTime });
      }
    }, warningTime * 1000);
  }
};

/**
 * Authentication middleware for HTTP requests
 */
exports.authenticateToken = async (req, res, next) => {
  try {
    // Get token from cookies
    const cookies = extractCookies(req);
    const accessToken = cookies[cookieConfig.names.ACCESS_TOKEN];
    
    try {
      const { user, decoded } = await authenticateCore(accessToken);
      
      // Add token expiration info to response headers and request object
      if (decoded.exp) {
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = decoded.exp - now;
        res.set('X-Token-Expires-In', expiresIn.toString());
        req.tokenExpiry = decoded.exp;
      }
      
      // Add user to request
      req.user = user;
      req.session = {
        id: decoded.sessionId
      };
      
      next();
    } catch (error) {
      next(error);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Authentication middleware for WebSocket connections
 * @param {Object} socket - Socket.IO socket
 * @param {Function} next - Next middleware function
 */
exports.authenticateSocketConnection = async (socket, next) => {
  try {
    // Extract cookies from socket request
    const cookies = extractCookies(socket.request);
    if (Object.keys(cookies).length === 0) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }
    
    const accessToken = cookies[cookieConfig.names.ACCESS_TOKEN];
    
    try {
      const { user, decoded } = await authenticateCore(accessToken);
      
      // Store authentication data in socket
      socket.data = {
        userId: user._id.toString(),
        sessionId: decoded.sessionId,
        deviceId: socket.handshake.query.deviceId || decoded.deviceId,
        tabId: socket.handshake.query.tabId,
        user: user // Store user object for easy access
      };
      
      // Add expiry information
      if (decoded.exp) {
        socket.data.tokenExpiry = decoded.exp;
        setupTokenExpiryMonitoring(socket, decoded.exp);
      }
      
      // Join appropriate rooms based on authentication
      exports.joinSocketRooms(socket);
      
      next();
    } catch (error) {
      // Try token refresh if access token is expired
      if (error.code === 'TOKEN_EXPIRED' && 
          socketConfig.authentication.cookies.allowReconnectWithExpiredAccess &&
          cookies[cookieConfig.names.REFRESH_TOKEN]) {
        try {
          const refreshToken = cookies[cookieConfig.names.REFRESH_TOKEN];
          const refreshResult = await tokenService.refreshAccessToken(refreshToken);
          
          if (refreshResult && refreshResult.accessToken) {
            const { user, decoded } = await authenticateCore(refreshResult.accessToken);
            
            // Store authentication data in socket
            socket.data = {
              userId: user._id.toString(),
              sessionId: decoded.sessionId,
              deviceId: socket.handshake.query.deviceId || decoded.deviceId,
              tabId: socket.handshake.query.tabId,
              user: user
            };
            
            // Add expiry information
            if (decoded.exp) {
              socket.data.tokenExpiry = decoded.exp;
              setupTokenExpiryMonitoring(socket, decoded.exp);
            }
            
            // Join appropriate rooms
            exports.joinSocketRooms(socket);
            
            // Notify about token refresh
            socket.emit('token:refreshed', { 
              expiresAt: decoded.exp,
              sessionId: decoded.sessionId
            });
            
            next();
            return;
          }
        } catch (refreshError) {
          return next(new AppError('Authentication failed', 401, 'AUTH_FAILED'));
        }
      }
      
      next(error);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to check user role
 * @param {string[]} roles - Allowed roles
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Permission denied', 403, 'FORBIDDEN'));
    }
    
    next();
  };
};

/**
 * Socket role restriction middleware
 * @param {string[]} roles - Allowed roles
 */
exports.socketRestrictTo = (...roles) => {
  return async (socket, next) => {
    try {
      if (!socket.data || !socket.data.userId) {
        return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
      }
      
      // Use cached user if available
      const user = socket.data.user || await User.findById(socket.data.userId);
      
      if (!user) {
        return next(new AppError('User not found', 401, 'USER_NOT_FOUND'));
      }
      
      if (!roles.includes(user.role)) {
        return next(new AppError('Permission denied', 403, 'FORBIDDEN'));
      }
      
      // Cache user for future checks
      if (!socket.data.user) {
        socket.data.user = user;
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Optional authentication middleware
 * Attempts to authenticate but continues if token is missing or invalid
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    const cookies = extractCookies(req);
    const accessToken = cookies[cookieConfig.names.ACCESS_TOKEN];
    
    if (!accessToken) {
      return next(); // Continue without authentication
    }
    
    try {
      const { user, decoded } = await authenticateCore(accessToken);
      
      // Add user to request
      req.user = user;
      req.session = {
        id: decoded.sessionId
      };
    } catch (error) {
      // Continue without authentication if token is invalid
    }
    
    next();
  } catch (error) {
    next();
  }
};

/**
 * Optional socket authentication middleware
 * Attempts to authenticate but continues if token is missing or invalid
 */
exports.optionalSocketAuth = async (socket, next) => {
  try {
    const cookies = extractCookies(socket.request);
    const accessToken = cookies[cookieConfig.names.ACCESS_TOKEN];
    
    if (!accessToken) {
      return next(); // Continue without authentication
    }
    
    try {
      const { user, decoded } = await authenticateCore(accessToken);
      
      // Store authentication data in socket
      socket.data = {
        userId: user._id.toString(),
        sessionId: decoded.sessionId,
        deviceId: socket.handshake.query.deviceId || decoded.deviceId,
        tabId: socket.handshake.query.tabId,
        user: user
      };
      
      // Add expiry information and join rooms
      if (decoded.exp) {
        socket.data.tokenExpiry = decoded.exp;
        setupTokenExpiryMonitoring(socket, decoded.exp);
      }
      
      // Join appropriate rooms
      exports.joinSocketRooms(socket);
    } catch (error) {
      // Continue without authentication if token is invalid
    }
    
    next();
  } catch (error) {
    next();
  }
};

/**
 * Join socket to appropriate rooms based on authentication
 * @param {Object} socket - Socket.IO socket
 */
exports.joinSocketRooms = (socket) => {
  if (!socket.data || !socket.data.userId) return;
  
  // Join user room
  socket.join(`user:${socket.data.userId}`);
  
  // Join session room if available
  if (socket.data.sessionId) {
    socket.join(`session:${socket.data.sessionId}`);
  }
  
  // Join device room if available
  if (socket.data.deviceId) {
    socket.join(`device:${socket.data.deviceId}`);
  }
  
  // Join tab room if available
  if (socket.data.tabId) {
    socket.join(`tab:${socket.data.tabId}`);
  }
};
