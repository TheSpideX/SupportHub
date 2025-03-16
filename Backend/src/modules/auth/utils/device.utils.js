const crypto = require('crypto');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');
const { TrustedDevice } = require('../models/trusted-device.model');
const redis = require('../../../config/redis');
const logger = require('../../../utils/logger');
const config = require('../config/security.config');

/**
 * Generate a fingerprint from device information
 * @param {Object} deviceInfo - Device information from client
 * @returns {string} Device fingerprint hash
 */
const generateFingerprint = (deviceInfo) => {
  if (!deviceInfo) {
    throw new Error('Device info is required');
  }

  // Extract key components for fingerprinting
  const components = [
    deviceInfo.userAgent || '',
    deviceInfo.platform || '',
    deviceInfo.screenResolution || '',
    deviceInfo.timezone || '',
    deviceInfo.language || '',
    // Use client-provided fingerprint if available
    deviceInfo.fingerprint || ''
  ];

  // Create a hash of the components
  return crypto.createHash('sha256')
    .update(components.join('|'))
    .digest('hex');
};

/**
 * Normalize device information to a standard format
 * @param {Object} rawInfo - Raw device information from client
 * @param {Object} req - Express request object (optional)
 * @returns {Object} Normalized device information
 */
const normalizeDeviceInfo = (rawInfo, req = null) => {
  if (!rawInfo) {
    return createBasicDeviceInfo(req);
  }

  // Parse user agent
  const uaParser = new UAParser(rawInfo.userAgent);
  const browser = uaParser.getBrowser();
  const os = uaParser.getOS();
  const device = uaParser.getDevice();

  // Get IP address from request if available
  const ipAddress = req ? (
    req.headers['x-forwarded-for'] || 
    req.connection.remoteAddress || 
    'unknown'
  ) : (rawInfo.ip || 'unknown');

  // Get geolocation data if available
  let location = null;
  if (ipAddress && ipAddress !== 'unknown' && ipAddress !== '127.0.0.1') {
    try {
      const geo = geoip.lookup(ipAddress);
      if (geo) {
        location = {
          country: geo.country,
          region: geo.region,
          city: geo.city,
          timezone: geo.timezone
        };
      }
    } catch (error) {
      logger.warn('Failed to get geolocation data', { error: error.message });
    }
  }

  // Normalize the device info
  return {
    fingerprint: rawInfo.fingerprint || generateFingerprint(rawInfo),
    userAgent: rawInfo.userAgent || 'unknown',
    browser: {
      name: browser.name || 'unknown',
      version: browser.version || 'unknown'
    },
    os: {
      name: os.name || 'unknown',
      version: os.version || 'unknown'
    },
    device: {
      type: device.type || 'unknown',
      vendor: device.vendor || 'unknown',
      model: device.model || 'unknown'
    },
    screenResolution: rawInfo.screenResolution || 'unknown',
    timezone: rawInfo.timezone || 'unknown',
    language: rawInfo.language || 'unknown',
    ipAddress: sanitizeIp(ipAddress),
    location,
    // Include additional data if provided
    colorDepth: rawInfo.colorDepth,
    hardwareConcurrency: rawInfo.hardwareConcurrency,
    deviceMemory: rawInfo.deviceMemory,
    touchSupport: rawInfo.touchSupport,
    // Timestamp for when this info was collected
    collectedAt: new Date().toISOString()
  };
};

/**
 * Create basic device info from request
 * @param {Object} req - Express request object
 * @returns {Object} Basic device info
 */
const createBasicDeviceInfo = (req) => {
  if (!req) {
    return {
      fingerprint: 'unknown',
      userAgent: 'unknown',
      ipAddress: 'unknown',
      collectedAt: new Date().toISOString()
    };
  }

  const userAgent = req.headers['user-agent'] || 'unknown';
  const ipAddress = req.headers['x-forwarded-for'] || 
                    req.connection.remoteAddress || 
                    'unknown';

  const uaParser = new UAParser(userAgent);
  const browser = uaParser.getBrowser();
  const os = uaParser.getOS();

  return {
    fingerprint: generateFingerprint({ userAgent }),
    userAgent,
    browser: {
      name: browser.name || 'unknown',
      version: browser.version || 'unknown'
    },
    os: {
      name: os.name || 'unknown',
      version: os.version || 'unknown'
    },
    ipAddress: sanitizeIp(ipAddress),
    collectedAt: new Date().toISOString()
  };
};

/**
 * Check if a device is known for a user
 * @param {string} userId - User ID
 * @param {string} fingerprint - Device fingerprint
 * @returns {Promise<boolean>} True if device is known
 */
const isKnownDevice = async (userId, fingerprint) => {
  if (!userId || !fingerprint) {
    return false;
  }

  try {
    // First check Redis cache for faster lookups
    const cacheKey = `known_devices:${userId}`;
    const cachedDevices = await redis.smembers(cacheKey);
    
    if (cachedDevices && cachedDevices.includes(fingerprint)) {
      return true;
    }

    // If not in cache, check database
    const device = await TrustedDevice.findOne({
      user: userId,
      fingerprint,
      trusted: true
    });

    // If found in database, add to cache for future lookups
    if (device) {
      await redis.sadd(cacheKey, fingerprint);
      await redis.expire(cacheKey, config.deviceVerification.cacheTTL || 86400); // Default 24h
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Error checking known device', { error: error.message, userId });
    // Default to false on error to be safe
    return false;
  }
};

/**
 * Store device information for a user
 * @param {string} userId - User ID
 * @param {Object} deviceInfo - Device information
 * @param {boolean} trusted - Whether this device is trusted
 * @returns {Promise<Object>} Stored device information
 */
const storeDeviceInfo = async (userId, deviceInfo, trusted = false) => {
  if (!userId || !deviceInfo) {
    throw new Error('User ID and device info are required');
  }

  try {
    // Normalize device info if not already normalized
    const normalizedInfo = deviceInfo.fingerprint ? 
      deviceInfo : normalizeDeviceInfo(deviceInfo);
    
    // Check if device already exists
    let device = await TrustedDevice.findOne({
      user: userId,
      fingerprint: normalizedInfo.fingerprint
    });

    const now = new Date();
    
    if (device) {
      // Update existing device
      device.lastUsed = now;
      device.userAgent = normalizedInfo.userAgent || device.userAgent;
      device.browser = normalizedInfo.browser || device.browser;
      device.os = normalizedInfo.os || device.os;
      device.ipAddress = normalizedInfo.ipAddress || device.ipAddress;
      device.location = normalizedInfo.location || device.location;
      
      if (trusted) {
        device.trusted = true;
        device.verifiedAt = now;
      }
      
      await device.save();
    } else {
      // Create new device record
      device = await TrustedDevice.create({
        user: userId,
        fingerprint: normalizedInfo.fingerprint,
        name: `Device on ${now.toLocaleDateString()}`,
        userAgent: normalizedInfo.userAgent,
        browser: normalizedInfo.browser,
        os: normalizedInfo.os,
        device: normalizedInfo.device,
        screenResolution: normalizedInfo.screenResolution,
        timezone: normalizedInfo.timezone,
        language: normalizedInfo.language,
        ipAddress: normalizedInfo.ipAddress,
        location: normalizedInfo.location,
        trusted,
        createdAt: now,
        lastUsed: now,
        verifiedAt: trusted ? now : null
      });
    }

    // If device is trusted, add to Redis cache
    if (trusted) {
      const cacheKey = `known_devices:${userId}`;
      await redis.sadd(cacheKey, normalizedInfo.fingerprint);
      await redis.expire(cacheKey, config.deviceVerification.cacheTTL || 86400);
    }

    return device;
  } catch (error) {
    logger.error('Error storing device info', { error: error.message, userId });
    throw error;
  }
};

/**
 * Compare two device fingerprints for similarity
 * @param {string} fingerprint1 - First fingerprint
 * @param {string} fingerprint2 - Second fingerprint
 * @returns {boolean} True if fingerprints are similar
 */
const areSimilarFingerprints = (fingerprint1, fingerprint2) => {
  if (!fingerprint1 || !fingerprint2) {
    return false;
  }
  
  // For exact match
  if (fingerprint1 === fingerprint2) {
    return true;
  }
  
  // For partial match (useful when fingerprints are generated differently but from same device)
  // This is a simplified approach - in production you might want a more sophisticated comparison
  const minLength = Math.min(fingerprint1.length, fingerprint2.length);
  const similarity = [...Array(minLength)].filter((_, i) => fingerprint1[i] === fingerprint2[i]).length / minLength;
  
  return similarity > 0.8; // 80% similarity threshold
};

/**
 * Sanitize IP address for privacy
 * @param {string} ip - IP address
 * @returns {string} Sanitized IP address
 */
const sanitizeIp = (ip) => {
  if (!ip || ip === 'unknown') {
    return 'unknown';
  }
  
  // For IPv4
  if (ip.includes('.')) {
    return ip.replace(/(\d+\.\d+\.\d+\.)\d+/, '$1*');
  }
  
  // For IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return [...parts.slice(0, 4), '*', '*', '*', '*'].join(':');
  }
  
  return ip;
};

/**
 * Get device name from device info
 * @param {Object} deviceInfo - Device information
 * @returns {string} Human-readable device name
 */
const getDeviceName = (deviceInfo) => {
  if (!deviceInfo) {
    return 'Unknown Device';
  }
  
  let name = '';
  
  // Add device type if available
  if (deviceInfo.device && deviceInfo.device.type && deviceInfo.device.type !== 'unknown') {
    name += deviceInfo.device.type.charAt(0).toUpperCase() + deviceInfo.device.type.slice(1);
  }
  
  // Add device model if available
  if (deviceInfo.device && deviceInfo.device.model && deviceInfo.device.model !== 'unknown') {
    name += name ? ` ${deviceInfo.device.model}` : deviceInfo.device.model;
  }
  
  // Add OS if available
  if (deviceInfo.os && deviceInfo.os.name && deviceInfo.os.name !== 'unknown') {
    name += name ? ` (${deviceInfo.os.name}` : deviceInfo.os.name;
    
    // Add OS version if available
    if (deviceInfo.os.version && deviceInfo.os.version !== 'unknown') {
      name += ` ${deviceInfo.os.version}`;
    }
    
    name += name.includes('(') ? ')' : '';
  }
  
  // Add browser if available
  if (deviceInfo.browser && deviceInfo.browser.name && deviceInfo.browser.name !== 'unknown') {
    name += name ? ` - ${deviceInfo.browser.name}` : deviceInfo.browser.name;
  }
  
  // Fallback if we couldn't determine anything
  if (!name) {
    name = 'Unknown Device';
  }
  
  return name;
};

/**
 * Detect suspicious device activity
 * @param {string} userId - User ID
 * @param {Object} deviceInfo - Current device information
 * @returns {Promise<Object>} Assessment with risk level and reasons
 */
const detectSuspiciousDevice = async (userId, deviceInfo) => {
  if (!userId || !deviceInfo) {
    return { isRisky: true, riskLevel: 'high', reasons: ['Missing user ID or device info'] };
  }
  
  try {
    // Get user's recent devices
    const recentDevices = await TrustedDevice.find({
      user: userId,
      lastUsed: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    }).sort({ lastUsed: -1 }).limit(5);
    
    const assessment = {
      isRisky: false,
      riskLevel: 'low',
      reasons: []
    };
    
    // Check if this is first time login
    if (recentDevices.length === 0) {
      assessment.isRisky = true;
      assessment.riskLevel = 'medium';
      assessment.reasons.push('First time login');
    }
    
    // Check for location change
    if (deviceInfo.location && recentDevices.length > 0) {
      const lastLocation = recentDevices[0].location;
      
      if (lastLocation && 
          deviceInfo.location.country && 
          lastLocation.country !== deviceInfo.location.country) {
        assessment.isRisky = true;
        assessment.riskLevel = 'high';
        assessment.reasons.push(`Location change from ${lastLocation.country} to ${deviceInfo.location.country}`);
      }
    }
    
    // Check for OS/browser change
    if (recentDevices.length > 0) {
      const lastDevice = recentDevices[0];
      
      if (lastDevice.os && deviceInfo.os && 
          lastDevice.os.name !== deviceInfo.os.name) {
        assessment.isRisky = true;
        assessment.riskLevel = 'medium';
        assessment.reasons.push(`OS change from ${lastDevice.os.name} to ${deviceInfo.os.name}`);
      }
      
      if (lastDevice.browser && deviceInfo.browser && 
          lastDevice.browser.name !== deviceInfo.browser.name) {
        assessment.isRisky = true;
        assessment.riskLevel = 'medium';
        assessment.reasons.push(`Browser change from ${lastDevice.browser.name} to ${deviceInfo.browser.name}`);
      }
    }
    
    return assessment;
  } catch (error) {
    logger.error('Error detecting suspicious device', { error: error.message, userId });
    return { 
      isRisky: true, 
      riskLevel: 'medium', 
      reasons: ['Error analyzing device risk'] 
    };
  }
};

module.exports = {
  generateFingerprint,
  normalizeDeviceInfo,
  isKnownDevice,
  storeDeviceInfo,
  areSimilarFingerprints,
  sanitizeIp,
  getDeviceName,
  detectSuspiciousDevice,
  createBasicDeviceInfo
};