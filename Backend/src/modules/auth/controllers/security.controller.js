/**
 * Security Controller
 * Handles security-related endpoints including:
 * - CSRF token generation
 * - Device verification
 * - Security context validation
 * - Suspicious activity reporting
 * - WebSocket security integration
 */
const securityService = require('../services/security.service');
const { AuthError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');

/**
 * Generate a CSRF token
 * @route GET /api/auth/csrf-token
 */
exports.generateCsrfToken = (req, res, next) => {
  try {
    const token = securityService.generateCsrfToken(res);
    return res.status(200).json({ success: true, token });
  } catch (error) {
    logger.error('CSRF token generation error:', error);
    next(error);
  }
};

/**
 * Verify a device
 * @route POST /api/auth/verify-device
 */
exports.verifyDevice = async (req, res, next) => {
  try {
    const { userId, verificationCode, deviceInfo } = req.body;
    
    if (!userId || !verificationCode || !deviceInfo) {
      return next(new AuthError('Missing required verification information', 400));
    }
    
    const verified = await securityService.verifyDevice(userId, verificationCode, deviceInfo);
    
    if (!verified) {
      return next(new AuthError('Device verification failed', 400));
    }
    
    // Notify connected clients about device verification via WebSocket
    if (req.io) {
      await securityService.notifyDeviceVerification(req.io, userId, deviceInfo.deviceId);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Device verified successfully'
    });
  } catch (error) {
    logger.error('Device verification error:', error);
    next(error);
  }
};

/**
 * Validate security context
 * @route POST /api/auth/validate-context
 */
exports.validateSecurityContext = async (req, res, next) => {
  try {
    const { securityContext } = req.body;
    const userId = req.user ? req.user._id : null;
    
    if (!securityContext || !userId) {
      return next(new AuthError('Invalid security context', 400));
    }
    
    const isValid = await securityService.validateSecurityContext(securityContext, userId);
    
    return res.status(200).json({
      success: true,
      valid: isValid
    });
  } catch (error) {
    logger.error('Security context validation error:', error);
    next(error);
  }
};

/**
 * Report suspicious activity
 * @route POST /api/auth/report-activity
 */
exports.reportSuspiciousActivity = async (req, res, next) => {
  try {
    const { activityType, details } = req.body;
    const userId = req.user ? req.user._id : null;
    
    const event = await securityService.logSecurityEvent(userId, activityType, details);
    
    // Broadcast security event to all user's devices via WebSocket
    if (req.io && userId) {
      await securityService.broadcastSecurityEvent(req.io, userId, activityType, details);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Activity reported successfully',
      eventId: event._id
    });
  } catch (error) {
    logger.error('Activity reporting error:', error);
    next(error);
  }
};

/**
 * Create security context
 * @route POST /api/auth/create-context
 */
exports.createSecurityContext = async (req, res, next) => {
  try {
    const { deviceInfo } = req.body;
    const userId = req.user ? req.user._id : null;
    
    if (!deviceInfo || !userId) {
      return next(new AuthError('Missing required information', 400));
    }
    
    const securityContext = await securityService.createSecurityContext(userId, deviceInfo);
    
    return res.status(200).json({
      success: true,
      securityContext
    });
  } catch (error) {
    logger.error('Security context creation error:', error);
    next(error);
  }
};

/**
 * Get security events for user
 * @route GET /api/auth/security-events
 */
exports.getSecurityEvents = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { limit = 10, page = 1, type } = req.query;
    
    const events = await securityService.getSecurityEvents(userId, {
      limit: parseInt(limit),
      page: parseInt(page),
      type
    });
    
    return res.status(200).json({
      success: true,
      events
    });
  } catch (error) {
    logger.error('Error fetching security events:', error);
    next(error);
  }
};

/**
 * Initialize WebSocket security for a specific socket
 * @route POST /api/auth/init-socket-security
 */
exports.initSocketSecurity = async (req, res, next) => {
  try {
    const { socketId } = req.body;
    const userId = req.user._id;
    const sessionId = req.session.id;
    const deviceId = req.session.deviceId;
    
    if (!socketId || !userId) {
      return next(new AuthError('Missing required information', 400));
    }
    
    // Get socket instance from io
    const io = req.io;
    if (!io) {
      return next(new AuthError('WebSocket server not available', 500));
    }
    
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      return next(new AuthError('Socket not found', 404));
    }
    
    // Initialize security for this socket using hierarchical room structure
    await securityService.initializeSocketSecurity(socket, {
      userId,
      sessionId,
      deviceId
    });
    
    return res.status(200).json({
      success: true,
      message: 'Socket security initialized'
    });
  } catch (error) {
    logger.error('Socket security initialization error:', error);
    next(error);
  }
};

/**
 * Join security rooms for WebSocket
 * @route POST /api/auth/join-security-rooms
 */
exports.joinSecurityRooms = async (req, res, next) => {
  try {
    const { socketId } = req.body;
    const userId = req.user._id;
    const deviceId = req.session.deviceId;
    
    if (!socketId || !userId) {
      return next(new AuthError('Socket ID and User ID are required', 400));
    }
    
    // Get socket instance from io
    const io = req.io;
    if (!io) {
      return next(new AuthError('WebSocket server not available', 500));
    }
    
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      return next(new AuthError('Socket not found', 404));
    }
    
    // Join security rooms using service
    await securityService.joinSecurityRooms(socket, {
      userId,
      deviceId
    });
    
    return res.status(200).json({
      success: true,
      message: 'Joined security rooms successfully'
    });
  } catch (error) {
    logger.error('Error joining security rooms:', error);
    next(new AuthError('Failed to join security rooms', 500));
  }
};

/**
 * Get user's active devices
 * @route GET /api/auth/active-devices
 */
exports.getActiveDevices = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    const devices = await securityService.getActiveDevices(userId);
    
    return res.status(200).json({
      success: true,
      devices
    });
  } catch (error) {
    logger.error('Error fetching active devices:', error);
    next(error);
  }
};

/**
 * Revoke device access
 * @route POST /api/auth/revoke-device
 */
exports.revokeDevice = async (req, res, next) => {
  try {
    const { deviceId } = req.body;
    const userId = req.user._id;
    
    if (!deviceId) {
      return next(new AuthError('Device ID is required', 400));
    }
    
    await securityService.revokeDevice(userId, deviceId);
    
    // Notify device about revocation via WebSocket
    if (req.io) {
      await securityService.notifyDeviceRevocation(req.io, userId, deviceId);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Device access revoked successfully'
    });
  } catch (error) {
    logger.error('Device revocation error:', error);
    next(error);
  }
};
