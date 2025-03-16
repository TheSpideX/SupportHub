const mongoose = require('mongoose');
const logger = require('../../../utils/logger');

// Define TrustedDevice model if it doesn't exist
const TrustedDevice = mongoose.models.TrustedDevice || mongoose.model('TrustedDevice', new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fingerprint: { type: String, required: true },
  name: { type: String },
  userAgent: { type: String },
  lastUsed: { type: Date, default: Date.now },
  trusted: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
}));

class DeviceService {
  /**
   * Check if a device is trusted for a user
   */
  async isDeviceTrusted(userId, fingerprint) {
    try {
      const device = await TrustedDevice.findOne({
        user: userId,
        fingerprint,
        trusted: true
      });
      
      return !!device;
    } catch (error) {
      logger.error('Error checking trusted device:', error);
      return false;
    }
  }

  /**
   * Trust a device for a user
   */
  async trustDevice(userId, deviceInfo) {
    try {
      const { fingerprint, userAgent, name } = deviceInfo;
      
      // Check if device already exists
      let device = await TrustedDevice.findOne({
        user: userId,
        fingerprint
      });
      
      if (device) {
        // Update existing device
        device.trusted = true;
        device.lastUsed = new Date();
        device.userAgent = userAgent || device.userAgent;
        if (name) device.name = name;
        await device.save();
        return device;
      }
      
      // Create new trusted device
      device = await TrustedDevice.create({
        user: userId,
        fingerprint,
        userAgent,
        name: name || `Device ${new Date().toLocaleDateString()}`
      });
      
      return device;
    } catch (error) {
      logger.error('Error trusting device:', error);
      throw error;
    }
  }

  /**
   * Untrust a device
   */
  async untrustDevice(userId, fingerprint) {
    return TrustedDevice.findOneAndUpdate(
      { user: userId, fingerprint },
      { trusted: false }
    );
  }

  /**
   * Get all trusted devices for a user
   */
  async getUserDevices(userId) {
    return TrustedDevice.find({
      user: userId,
      trusted: true
    }).sort({ lastUsed: -1 });
  }

  /**
   * Update device last used timestamp
   */
  async updateDeviceUsage(userId, fingerprint) {
    return TrustedDevice.findOneAndUpdate(
      { user: userId, fingerprint },
      { lastUsed: new Date() }
    );
  }
}

module.exports = DeviceService;
