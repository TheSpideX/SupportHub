const deviceService = require('../services/device.service');
const tokenService = require('../services/token.service');
const securityService = require('../services/security.service');
const socketService = require('../services/socket.service');
const { ApiError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');
const { EVENT_NAMES } = require('../constants/event-names.constant');

/**
 * Device Controller - Handles device management operations
 */
class DeviceController {
  /**
   * Get all devices for the current user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getUserDevices(req, res) {
    const userId = req.user.id;
    const devices = await deviceService.getUserDevices(userId);
    
    // Mark current device
    const currentDeviceId = req.session.deviceId;
    const devicesWithCurrent = devices.map(device => ({
      ...device,
      isCurrent: device.deviceId === currentDeviceId
    }));
    
    res.json({ devices: devicesWithCurrent });
  }

  /**
   * Verify a device
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async verifyDevice(req, res) {
    const { deviceId, verificationCode } = req.body;
    const userId = req.user.id;
    
    try {
      const result = await deviceService.verifyDevice(userId, deviceId, verificationCode);
      
      // Notify all user's sockets about the device verification
      const userRoom = socketService.createRoomName('user', userId);
      req.io.to(userRoom).emit(EVENT_NAMES.DEVICE_VERIFIED, {
        deviceId,
        verifiedAt: new Date(),
        source: req.session.id
      });
      
      res.json(result);
    } catch (error) {
      logger.error(`Device verification failed: ${error.message}`);
      throw new ApiError(400, error.message);
    }
  }

  /**
   * Rename a device
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async renameDevice(req, res) {
    const { deviceId, name } = req.body;
    const userId = req.user.id;
    
    const device = await deviceService.renameDevice(userId, deviceId, name);
    res.json(device);
  }

  /**
   * Revoke a device (log it out)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async revokeDevice(req, res) {
    const { deviceId } = req.params;
    const userId = req.user.id;
    const currentDeviceId = req.session.deviceId;
    
    // Prevent revoking current device through this endpoint
    if (deviceId === currentDeviceId) {
      throw new ApiError(400, 'Cannot revoke current device. Use logout instead.');
    }
    
    await deviceService.revokeDevice(userId, deviceId);
    
    // Notify the device about revocation through WebSocket
    const deviceRoom = socketService.createRoomName('device', deviceId);
    req.io.to(deviceRoom).emit(EVENT_NAMES.DEVICE_REVOKED, {
      reason: 'manually_revoked',
      revokedBy: currentDeviceId,
      timestamp: Date.now()
    });
    
    res.json({ success: true, message: 'Device revoked successfully' });
  }

  /**
   * Revoke all devices except current one
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async revokeAllOtherDevices(req, res) {
    const userId = req.user.id;
    const currentDeviceId = req.session.deviceId;
    
    await deviceService.revokeAllDevicesExcept(userId, currentDeviceId);
    
    // Notify all user's devices except current one
    const userRoom = socketService.createRoomName('user', userId);
    const deviceRoom = socketService.createRoomName('device', currentDeviceId);
    
    req.io.to(userRoom).except(deviceRoom).emit(EVENT_NAMES.DEVICE_REVOKED, {
      reason: 'all_devices_revoked',
      revokedBy: currentDeviceId,
      timestamp: Date.now()
    });
    
    res.json({ success: true, message: 'All other devices revoked successfully' });
  }

  /**
   * Update device settings
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateDeviceSettings(req, res) {
    const { deviceId } = req.params;
    const userId = req.user.id;
    const settings = req.body;
    
    const updatedSettings = await deviceService.updateDeviceSettings(userId, deviceId, settings);
    res.json(updatedSettings);
  }
}

module.exports = new DeviceController();
