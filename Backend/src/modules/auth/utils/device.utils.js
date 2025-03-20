/**
 * Device utilities for handling device information
 */
const crypto = require('crypto');

const deviceUtils = {
  /**
   * Normalize device information from request
   * @param {Object} clientInfo - Client information object
   * @returns {Object} Normalized device info
   */
  normalizeDeviceInfo: (clientInfo) => {
    return {
      userAgent: clientInfo.userAgent || 'unknown',
      browser: getBrowserInfo(clientInfo.userAgent),
      os: getOSInfo(clientInfo.userAgent),
      device: clientInfo.device || 'unknown',
      deviceType: getDeviceType(clientInfo.userAgent),
      ipAddress: clientInfo.ipAddress || 'unknown'
    };
  },

  /**
   * Generate a device ID from device information
   * @param {Object} deviceInfo - Device information
   * @returns {String} Device ID
   */
  generateDeviceId: (deviceInfo) => {
    const data = `${deviceInfo.userAgent}|${deviceInfo.ipAddress || ''}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  },

  /**
   * Check if device is known/trusted
   * @param {Object} deviceInfo - Current device info
   * @param {Array} knownDevices - List of known devices
   * @returns {Boolean} True if device is known
   */
  isKnownDevice: (deviceInfo, knownDevices = []) => {
    if (!deviceInfo || !knownDevices.length) return false;
    
    const deviceId = deviceUtils.generateDeviceId(deviceInfo);
    return knownDevices.some(device => 
      device.fingerprint === deviceId || 
      (device.userAgent === deviceInfo.userAgent && device.ipHash === hashIp(deviceInfo.ipAddress))
    );
  }
};

/**
 * Get browser information from user agent
 * @param {String} userAgent - User agent string
 * @returns {String} Browser name and version
 */
function getBrowserInfo(userAgent) {
  if (!userAgent) return 'unknown';
  
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Edg')) return 'Edge';
  if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) return 'Internet Explorer';
  
  return 'Other';
}

/**
 * Get OS information from user agent
 * @param {String} userAgent - User agent string
 * @returns {String} OS name
 */
function getOSInfo(userAgent) {
  if (!userAgent) return 'unknown';
  
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac')) return 'MacOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  
  return 'Other';
}

/**
 * Get device type from user agent
 * @param {String} userAgent - User agent string
 * @returns {String} Device type
 */
function getDeviceType(userAgent) {
  if (!userAgent) return 'unknown';
  
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) return 'tablet';
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(userAgent)) return 'mobile';
  
  return 'desktop';
}

/**
 * Hash IP address for storage
 * @param {String} ip - IP address
 * @returns {String} Hashed IP
 */
function hashIp(ip) {
  if (!ip) return '';
  return crypto.createHash('sha256').update(ip).digest('hex');
}

module.exports = deviceUtils;