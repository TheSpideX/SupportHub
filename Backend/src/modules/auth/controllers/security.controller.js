const asyncHandler = require('express-async-handler');
const SecurityService = require('../services/security.service');
const DeviceService = require('../services/device.service');
const AuthError = require('../errors/auth.error');
const logger = require('../../../utils/logger');

const COMPONENT = 'security.controller';

/**
 * Security controller for handling security-related operations
 */
const securityController = {
  /**
   * Verify a new device using verification code
   * @route POST /api/auth/verify-device
   */
  verifyDevice: asyncHandler(async (req, res) => {
    const { verificationCode, deviceInfo } = req.body;
    const userId = req.user.id;

    if (!verificationCode || !deviceInfo) {
      throw new AuthError('MISSING_REQUIRED_FIELDS', 'Verification code and device info are required');
    }

    const securityService = new SecurityService();
    const deviceService = new DeviceService();

    // Verify the device
    const verified = await securityService.verifyDevice(userId, verificationCode, deviceInfo);
    
    if (!verified) {
      throw new AuthError('INVALID_VERIFICATION_CODE', 'Invalid verification code');
    }

    // Add device to trusted devices
    const device = await deviceService.trustDevice(userId, deviceInfo);

    logger.info('Device verified successfully', {
      component: COMPONENT,
      userId,
      deviceId: device._id
    });

    return res.json({
      success: true,
      device: {
        id: device._id,
        name: device.name,
        trusted: device.trusted,
        lastUsed: device.lastUsed
      }
    });
  }),

  /**
   * Process password change request
   * @route POST /api/auth/change-password
   */
  changePassword: asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      throw new AuthError('MISSING_REQUIRED_FIELDS', 'Current and new passwords are required');
    }

    const securityService = new SecurityService();

    // Check if new password meets policy requirements
    const passwordValidation = await securityService.validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      throw new AuthError('WEAK_PASSWORD', passwordValidation.message);
    }

    // Check if password has been breached
    const isBreached = await securityService.isPasswordBreached(newPassword);
    if (isBreached) {
      throw new AuthError('BREACHED_PASSWORD', 'This password has appeared in data breaches. Please choose a different password.');
    }

    // Change the password
    await securityService.changePassword(userId, currentPassword, newPassword);

    // Optionally invalidate all sessions except current one
    if (req.body.invalidateAllSessions) {
      await securityService.invalidateAllSessions(userId, req.sessionId);
    }

    logger.info('Password changed successfully', {
      component: COMPONENT,
      userId
    });

    return res.json({
      success: true,
      message: 'Password changed successfully'
    });
  }),

  /**
   * Get security status information
   * @route GET /api/auth/security-status
   */
  getSecurityStatus: asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const securityService = new SecurityService();
    const deviceService = new DeviceService();

    // Get security information
    const securityInfo = await securityService.getUserSecurityInfo(userId);
    const knownDevices = await deviceService.getUserDevices(userId);
    const lastLogin = await securityService.getLastLoginInfo(userId);
    const securityEvents = await securityService.getRecentSecurityEvents(userId, 5);
    const passwordStatus = await securityService.getPasswordStatus(userId);

    return res.json({
      mfaEnabled: securityInfo.mfaEnabled,
      mfaMethod: securityInfo.mfaMethod,
      knownDevices: knownDevices.map(device => ({
        id: device._id,
        name: device.name,
        lastUsed: device.lastUsed,
        userAgent: device.userAgent,
        trusted: device.trusted,
        current: device.fingerprint === req.deviceInfo?.fingerprint
      })),
      lastLogin,
      securityEvents,
      passwordStatus,
      securityScore: await securityService.calculateSecurityScore(userId)
    });
  }),

  /**
   * Revoke a trusted device
   * @route POST /api/auth/revoke-device
   */
  revokeDevice: asyncHandler(async (req, res) => {
    const { deviceId } = req.body;
    const userId = req.user.id;

    if (!deviceId) {
      throw new AuthError('MISSING_REQUIRED_FIELDS', 'Device ID is required');
    }

    const deviceService = new DeviceService();
    
    // Check if device belongs to user
    const device = await deviceService.getDeviceById(deviceId);
    if (!device || device.user.toString() !== userId) {
      throw new AuthError('DEVICE_NOT_FOUND', 'Device not found');
    }

    // Check if trying to revoke current device
    if (device.fingerprint === req.deviceInfo?.fingerprint) {
      throw new AuthError('CANNOT_REVOKE_CURRENT_DEVICE', 'Cannot revoke current device');
    }

    // Revoke the device
    await deviceService.revokeDevice(deviceId);
    
    // Terminate all sessions associated with this device
    const securityService = new SecurityService();
    await securityService.terminateDeviceSessions(userId, device.fingerprint);

    logger.info('Device revoked successfully', {
      component: COMPONENT,
      userId,
      deviceId
    });

    return res.json({
      success: true,
      message: 'Device revoked successfully'
    });
  }),

  /**
   * Enable or disable two-factor authentication
   * @route POST /api/auth/toggle-mfa
   */
  toggleMfa: asyncHandler(async (req, res) => {
    const { enabled, method, verificationCode } = req.body;
    const userId = req.user.id;

    const securityService = new SecurityService();

    if (enabled) {
      // Enable MFA
      const result = await securityService.enableMfa(userId, method, verificationCode);
      return res.json({
        success: true,
        mfaEnabled: true,
        mfaMethod: method,
        backupCodes: result.backupCodes
      });
    } else {
      // Disable MFA
      await securityService.disableMfa(userId, verificationCode);
      return res.json({
        success: true,
        mfaEnabled: false
      });
    }
  }),

  /**
   * Setup MFA - generate secret and QR code
   * @route POST /api/auth/setup-mfa
   */
  setupMfa: asyncHandler(async (req, res) => {
    const { method } = req.body;
    const userId = req.user.id;

    const securityService = new SecurityService();
    const setupInfo = await securityService.setupMfa(userId, method);

    return res.json({
      success: true,
      secret: setupInfo.secret,
      qrCode: setupInfo.qrCode,
      method
    });
  }),

  /**
   * Lock user account
   * @route POST /api/auth/lock-account
   */
  lockAccount: asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { reason } = req.body;

    const securityService = new SecurityService();
    await securityService.lockUserAccount(userId, reason);

    // Terminate all sessions
    await securityService.terminateAllSessions(userId);

    logger.info('Account locked by user', {
      component: COMPONENT,
      userId,
      reason
    });

    return res.json({
      success: true,
      message: 'Account locked successfully'
    });
  }),

  /**
   * Get IP restrictions
   * @route GET /api/auth/ip-restrictions
   */
  getIpRestrictions: asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const securityService = new SecurityService();
    
    const restrictions = await securityService.getIpRestrictions(userId);
    
    return res.json(restrictions);
  }),

  /**
   * Update IP restrictions
   * @route POST /api/auth/ip-restrictions
   */
  updateIpRestrictions: asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { enabled, allowedIps, blockedIps, allowUnknown } = req.body;
    
    const securityService = new SecurityService();
    await securityService.updateIpRestrictions(userId, {
      enabled,
      allowedIps,
      blockedIps,
      allowUnknown
    });
    
    logger.info('IP restrictions updated', {
      component: COMPONENT,
      userId
    });
    
    return res.json({
      success: true,
      message: 'IP restrictions updated successfully'
    });
  })
};

module.exports = securityController;