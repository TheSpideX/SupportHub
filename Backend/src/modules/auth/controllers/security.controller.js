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

/**
 * Get security notifications
 * Fallback for WebSocket security events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getSecurityNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get notifications from the security service
    const securityService = require('../services/security.service');
    const notifications = await securityService.getUserNotifications(userId);
    
    return res.status(200).json({
      success: true,
      data: notifications
    });
  } catch (error) {
    logger.error('Error getting security notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve security notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Report security issue
 * Handles user-reported security concerns
 * @route POST /api/auth/security/report
 */
exports.reportSecurityIssue = async (req, res, next) => {
  try {
    const { issueType, description } = req.body;
    const userId = req.user ? req.user._id : null;
    
    // Log the security issue
    const event = await securityService.logSecurityEvent(userId, 'security_issue_report', {
      issueType,
      description,
      reportedAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    // Broadcast security event to all user's devices via WebSocket if appropriate
    if (req.io && userId && issueType === 'critical') {
      await securityService.broadcastSecurityEvent(req.io, userId, 'security_issue_reported', {
        issueType,
        timestamp: Date.now()
      });
    }
    
    // Create a notification for the security team
    await securityService.createSecurityNotification({
      type: 'security_issue',
      title: `Security Issue: ${issueType}`,
      message: `A user has reported a security issue: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`,
      metadata: {
        issueType,
        userId: userId ? userId.toString() : 'anonymous',
        reportedAt: new Date()
      },
      severity: issueType.includes('critical') ? 'critical' : 'high',
      actionRequired: true,
      actionType: 'review'
    });
    
    return res.status(200).json({
      success: true,
      message: 'Security issue reported successfully',
      eventId: event._id
    });
  } catch (error) {
    logger.error('Security issue reporting error:', error);
    next(error);
  }
};

/**
 * Acknowledge a security event
 * @route POST /api/auth/security/events/:eventId/acknowledge
 */
exports.acknowledgeSecurityEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.user._id;
    
    if (!eventId) {
      return next(new AuthError('Event ID is required', 400));
    }
    
    // Acknowledge the security event
    const acknowledged = await securityService.acknowledgeSecurityEvent(eventId, userId);
    
    if (!acknowledged) {
      return next(new AuthError('Failed to acknowledge security event', 400));
    }
    
    // If WebSocket is available, notify other devices about the acknowledgment
    if (req.io) {
      await securityService.notifySecurityEventAcknowledged(req.io, userId, eventId);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Security event acknowledged successfully'
    });
  } catch (error) {
    logger.error('Security event acknowledgment error:', error);
    next(error);
  }
};

/**
 * Get security settings
 * @route GET /api/auth/security/settings
 */
exports.getSecuritySettings = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const settings = await securityService.getUserSecuritySettings(userId);
    
    return res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('Error fetching security settings:', error);
    next(error);
  }
};

/**
 * Update security settings
 * @route PUT /api/auth/security/settings
 */
exports.updateSecuritySettings = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { requireMfa, sessionTimeout, trustedDevicesOnly } = req.body;
    
    const updatedSettings = await securityService.updateUserSecuritySettings(userId, {
      requireMfa,
      sessionTimeout,
      trustedDevicesOnly
    });
    
    return res.status(200).json({
      success: true,
      message: 'Security settings updated successfully',
      data: updatedSettings
    });
  } catch (error) {
    logger.error('Error updating security settings:', error);
    next(error);
  }
};

/**
 * Setup 2FA
 * @route POST /api/auth/security/2fa/setup
 */
exports.setup2FA = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    const setupData = await securityService.setup2FAForUser(userId);
    
    return res.status(200).json({
      success: true,
      data: setupData
    });
  } catch (error) {
    logger.error('Error setting up 2FA:', error);
    next(error);
  }
};

/**
 * Verify 2FA setup
 * @route POST /api/auth/security/2fa/verify-setup
 */
exports.verify2FASetup = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { token } = req.body;
    
    const verified = await securityService.verify2FASetup(userId, token);
    
    if (!verified) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Two-factor authentication enabled successfully'
    });
  } catch (error) {
    logger.error('Error verifying 2FA setup:', error);
    next(error);
  }
};

/**
 * Disable 2FA
 * @route POST /api/auth/security/2fa/disable
 */
exports.disable2FA = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { token } = req.body;
    
    const disabled = await securityService.disable2FA(userId, token);
    
    if (!disabled) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Two-factor authentication disabled successfully'
    });
  } catch (error) {
    logger.error('Error disabling 2FA:', error);
    next(error);
  }
};

/**
 * Verify 2FA token
 * @route POST /api/auth/security/2fa/verify
 */
exports.verify2FAToken = async (req, res, next) => {
  try {
    const { token, sessionId } = req.body;
    
    const verification = await securityService.verify2FAToken(token, sessionId);
    
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        message: verification.message || 'Invalid verification token'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Token verified successfully',
      data: verification.data
    });
  } catch (error) {
    logger.error('Error verifying 2FA token:', error);
    next(error);
  }
};

/**
 * Verify device
 * @route POST /api/auth/security/devices/verify
 */
exports.verifyDevice = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { deviceId, verificationCode } = req.body;
    
    const verified = await securityService.verifyUserDevice(userId, deviceId, verificationCode);
    
    if (!verified) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Device verified successfully'
    });
  } catch (error) {
    logger.error('Error verifying device:', error);
    next(error);
  }
};

/**
 * Remove trusted device
 * @route DELETE /api/auth/security/devices/:deviceId
 */
exports.removeTrustedDevice = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { deviceId } = req.params;
    
    const removed = await securityService.removeTrustedDevice(userId, deviceId);
    
    if (!removed) {
      return res.status(400).json({
        success: false,
        message: 'Failed to remove device'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Device removed successfully'
    });
  } catch (error) {
    logger.error('Error removing trusted device:', error);
    next(error);
  }
};

/**
 * Get security events
 * @route GET /api/auth/security/events
 */
exports.getSecurityEvents = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, type } = req.query;
    
    const events = await securityService.getUserSecurityEvents(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      type
    });
    
    return res.status(200).json({
      success: true,
      data: events.data,
      pagination: events.pagination
    });
  } catch (error) {
    logger.error('Error fetching security events:', error);
    next(error);
  }
};

/**
 * Get security notifications
 * @route GET /api/auth/security/notifications
 */
exports.getSecurityNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    
    const notifications = await securityService.getUserSecurityNotifications(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      unreadOnly: unreadOnly === 'true'
    });
    
    return res.status(200).json({
      success: true,
      data: notifications.data,
      pagination: notifications.pagination
    });
  } catch (error) {
    logger.error('Error fetching security notifications:', error);
    next(error);
  }
};
