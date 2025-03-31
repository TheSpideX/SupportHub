const crypto = require("crypto");
const { redisClient } = require("../../../config/redis");
const logger = require("../../../utils/logger");
const Device = require("../models/device.model");
const User = require("../models/user.model");
const Session = require("../models/session.model");
const mongoose = require("mongoose");
const { socketManager } = require("../../../config/socket");
const { AuthError } = require("../../../utils/errors");
const roomRegistry = require("./room-registry.service");

// Constants
const DEVICE_HISTORY_KEY_PREFIX = "device:history:";
const DEVICE_VERIFICATION_KEY_PREFIX = "device:verification:";
const DEVICE_HISTORY_TTL = 60 * 60 * 24 * 90; // 90 days
const SUSPICIOUS_SCORE_THRESHOLD = 50;
const VERIFICATION_CODE_TTL = 60 * 10; // 10 minutes

// Room prefixes for WebSocket hierarchy
const ROOM_PREFIX = {
  USER: "user:",
  DEVICE: "device:",
  SESSION: "session:",
  TAB: "tab:"
};

/**
 * Generate enhanced device fingerprint
 * @param {Object} deviceInfo - Device information
 * @returns {string} - Enhanced fingerprint
 */
const generateEnhancedFingerprint = (deviceInfo) => {
  try {
    const fingerprintData = [
      deviceInfo.userAgent || "",
      deviceInfo.ip || "",
      deviceInfo.browser || "",
      deviceInfo.os || "",
      deviceInfo.device || "",
      deviceInfo.screen || "",
      deviceInfo.language || "",
      deviceInfo.timezone || "",
      deviceInfo.platform || "",
    ];

    // Create a more detailed fingerprint
    const enhancedFingerprint = crypto
      .createHash("sha256")
      .update(fingerprintData.join("::"))
      .digest("hex");

    return enhancedFingerprint;
  } catch (error) {
    logger.error("Error generating enhanced fingerprint:", error);

    // Fallback to basic fingerprinting if error
    return crypto
      .createHash("sha256")
      .update(deviceInfo.userAgent || "unknown")
      .digest("hex");
  }
};

/**
 * Record device information for a user
 * @param {string} userId - User ID
 * @param {Object} deviceInfo - Device information
 * @returns {Promise<Object>} - Device record with fingerprint
 */
const recordDeviceInfo = async (userId, deviceInfo) => {
  try {
    const fingerprint = generateEnhancedFingerprint(deviceInfo);
    const now = Date.now();
    
    // First, update Redis for quick access during the session
    const historyKey = `${DEVICE_HISTORY_KEY_PREFIX}${userId}`;
    
    // Create device record for Redis
    const deviceRecord = {
      fingerprint,
      userAgent: deviceInfo.userAgent || "",
      ip: deviceInfo.ip || "",
      firstSeen: now,
      lastSeen: now,
      useCount: 1,
    };

    // Check if device already exists in Redis
    const existingDeviceJson = await redisClient.hget(historyKey, fingerprint);

    if (existingDeviceJson) {
      const existingDevice = JSON.parse(existingDeviceJson);
      deviceRecord.firstSeen = existingDevice.firstSeen;
      deviceRecord.useCount = (existingDevice.useCount || 0) + 1;
      deviceRecord.lastSeen = now;
    }

    // Update Redis device record
    await redisClient.hset(
      historyKey,
      fingerprint,
      JSON.stringify(deviceRecord)
    );
    await redisClient.expire(historyKey, DEVICE_HISTORY_TTL);
    
    // Now, update or create the persistent Device record in MongoDB
    let device = await Device.findOne({
      userId: mongoose.Types.ObjectId(userId),
      fingerprint: fingerprint
    });
    
    if (device) {
      // Update existing device
      device.lastActive = new Date(now);
      device.userAgent = deviceInfo.userAgent || device.userAgent;
      
      // Add IP to the list if it's new
      if (deviceInfo.ip && !device.ipAddresses.includes(deviceInfo.ip)) {
        device.ipAddresses.push(deviceInfo.ip);
      }
      
      await device.save();
    } else {
      // Create new device
      const deviceId = crypto.randomBytes(16).toString('hex');
      
      // Create hierarchical room paths
      const userRoom = `${ROOM_PREFIX.USER}${userId}`;
      const deviceRoom = `${ROOM_PREFIX.DEVICE}${deviceId}`;
      
      device = new Device({
        deviceId,
        userId: mongoose.Types.ObjectId(userId),
        name: deviceInfo.name || `Device on ${new Date().toLocaleDateString()}`,
        fingerprint,
        userAgent: deviceInfo.userAgent || "",
        browser: deviceInfo.browser || "",
        os: deviceInfo.os || "",
        deviceType: getDeviceType(deviceInfo),
        ipAddresses: deviceInfo.ip ? [deviceInfo.ip] : [],
        hierarchyPath: {
          userRoom,
          deviceRoom
        },
        activeSessions: [],
        isVerified: false,
        trustScore: 20 // Initial low trust score for new devices
      });
      
      await device.save();
      
      // Also update user's device hierarchy
      await User.findByIdAndUpdate(userId, {
        $set: {
          [`security.deviceHierarchy.${deviceId}`]: {
            deviceId,
            sessions: [],
            lastActive: new Date(now),
            isVerified: false
          }
        }
      });
      
      // Emit device:new event to user room
      socketManager.emitToRoom(userRoom, 'security:device_new', {
        deviceId,
        deviceName: device.name,
        deviceType: device.deviceType,
        needsVerification: true
      });
    }

    return {
      ...deviceRecord,
      deviceId: device.deviceId,
      isVerified: device.isVerified
    };
  } catch (error) {
    logger.error("Error recording device info:", error);
    return { fingerprint: null, error: error.message };
  }
};

/**
 * Link a session to a device
 * @param {string} deviceId - Device ID
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} - Success status
 */
const linkSessionToDevice = async (deviceId, sessionId) => {
  try {
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return false;
    }
    
    // Add session to device if not already present
    if (!device.activeSessions.includes(sessionId)) {
      device.activeSessions.push(sessionId);
      await device.save();
      
      // Update user's device hierarchy
      await User.findByIdAndUpdate(device.userId, {
        $addToSet: {
          [`security.deviceHierarchy.${deviceId}.sessions`]: sessionId
        }
      });
      
      // Update session with device reference
      await Session.findByIdAndUpdate(sessionId, {
        $set: {
          deviceId,
          hierarchyPath: {
            userRoom: device.hierarchyPath.userRoom,
            deviceRoom: device.hierarchyPath.deviceRoom,
            sessionRoom: `${ROOM_PREFIX.SESSION}${sessionId}`
          }
        }
      });
    }
    
    return true;
  } catch (error) {
    logger.error("Error linking session to device:", error);
    return false;
  }
};

/**
 * Verify device consistency with user history
 * @param {string} userId - User ID
 * @param {Object} deviceInfo - Device information
 * @returns {Promise<Object>} - Verification results
 */
const verifyDeviceConsistency = async (userId, deviceInfo) => {
  try {
    const fingerprint = generateEnhancedFingerprint(deviceInfo);
    
    // Check MongoDB first for persistent device records
    const device = await Device.findOne({
      userId: mongoose.Types.ObjectId(userId),
      fingerprint
    });
    
    if (device) {
      // Device exists in MongoDB
      return {
        isKnown: true,
        isVerified: device.isVerified,
        suspiciousScore: calculateSuspiciousScore(device),
        lastSeen: device.lastActive,
        deviceId: device.deviceId,
        isValid: true
      };
    }
    
    // Fall back to Redis for recently seen devices not yet in MongoDB
    const historyKey = `${DEVICE_HISTORY_KEY_PREFIX}${userId}`;
    const devices = await redisClient.hgetall(historyKey);

    if (!devices || Object.keys(devices).length === 0) {
      // First device for this user - automatically trusted but not verified
      return {
        isKnown: false,
        isVerified: false,
        suspiciousScore: 30, // New device, moderate suspicion
        isValid: true,
      };
    }

    // Check if this device exists in Redis history
    const existingDeviceJson = devices[fingerprint];

    if (existingDeviceJson) {
      const existingDevice = JSON.parse(existingDeviceJson);
      const daysSinceFirstSeen =
        (Date.now() - existingDevice.firstSeen) / (1000 * 60 * 60 * 24);
      const daysSinceLastSeen =
        (Date.now() - existingDevice.lastSeen) / (1000 * 60 * 60 * 24);

      // Calculate trust score based on history
      const useCount = existingDevice.useCount || 1;
      let suspiciousScore = 0;

      // Device hasn't been used in a while
      if (daysSinceLastSeen > 30) {
        suspiciousScore += 20;
      }

      // New device (less than 3 days old)
      if (daysSinceFirstSeen < 3) {
        suspiciousScore += 10;
      }

      // Rarely used device
      if (useCount < 3) {
        suspiciousScore += 10;
      }

      return {
        isKnown: true,
        isVerified: suspiciousScore < SUSPICIOUS_SCORE_THRESHOLD,
        suspiciousScore,
        lastSeen: existingDevice.lastSeen,
        useCount,
        isValid: true,
      };
    }

    // Unknown device - moderately suspicious
    return {
      isKnown: false,
      isVerified: false,
      suspiciousScore: 40,
      isValid: true,
    };
  } catch (error) {
    logger.error("Error verifying device consistency:", error);

    // Error case - allow but flag as suspicious
    return {
      isKnown: false,
      isVerified: false,
      suspiciousScore: 70,
      error: error.message,
      isValid: true,
    };
  }
};

/**
 * Generate verification code for a new device
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID
 * @returns {Promise<string>} - Verification code
 */
const generateVerificationCode = async (userId, deviceId) => {
  try {
    // Generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `${DEVICE_VERIFICATION_KEY_PREFIX}${userId}:${deviceId}`;
    
    // Store in Redis with expiration
    await redisClient.set(key, code);
    await redisClient.expire(key, VERIFICATION_CODE_TTL);
    
    return code;
  } catch (error) {
    logger.error("Error generating verification code:", error);
    throw error;
  }
};

/**
 * Verify a device using verification code
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID
 * @param {string} code - Verification code
 * @returns {Promise<boolean>} - Verification result
 */
const verifyDevice = async (userId, deviceId, code) => {
  try {
    const key = `${DEVICE_VERIFICATION_KEY_PREFIX}${userId}:${deviceId}`;
    const storedCode = await redisClient.get(key);
    
    if (!storedCode || storedCode !== code) {
      return false;
    }
    
    // Code is valid, mark device as verified
    const device = await Device.findOne({
      userId: mongoose.Types.ObjectId(userId),
      deviceId
    });
    
    if (!device) {
      return false;
    }
    
    // Update device verification status
    device.isVerified = true;
    device.verifiedAt = new Date();
    device.trustScore = 80; // High initial trust for verified devices
    await device.save();
    
    // Update user's device hierarchy
    await User.findByIdAndUpdate(userId, {
      $set: {
        [`security.deviceHierarchy.${deviceId}.isVerified`]: true
      }
    });
    
    // Delete the verification code
    await redisClient.del(key);
    
    // Emit device verification event to user and device rooms
    const userRoom = `${ROOM_PREFIX.USER}${userId}`;
    const deviceRoom = `${ROOM_PREFIX.DEVICE}${deviceId}`;
    
    socketManager.emitToRoom(userRoom, 'security:device_verified', {
      deviceId,
      deviceName: device.name
    });
    
    socketManager.emitToRoom(deviceRoom, 'security:device_verified', {
      deviceId,
      deviceName: device.name
    });
    
    return true;
  } catch (error) {
    logger.error("Error verifying device:", error);
    return false;
  }
};

/**
 * Revoke a device and all its sessions
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID
 * @returns {Promise<boolean>} - Success status
 */
const revokeDevice = async (userId, deviceId) => {
  try {
    const device = await Device.findOne({
      userId: mongoose.Types.ObjectId(userId),
      deviceId
    });
    
    if (!device) {
      return false;
    }
    
    // Get all active sessions for this device
    const sessions = await Session.find({
      deviceId,
      isActive: true
    });
    
    // Revoke all sessions
    for (const session of sessions) {
      session.isActive = false;
      session.revokedAt = new Date();
      session.revokedReason = 'device_revoked';
      await session.save();
      
      // Emit session termination event
      const sessionRoom = `${ROOM_PREFIX.SESSION}${session._id}`;
      socketManager.emitToRoom(sessionRoom, 'session:terminated', {
        reason: 'device_revoked'
      });
    }
    
    // Update device status
    device.isRevoked = true;
    device.revokedAt = new Date();
    device.activeSessions = [];
    await device.save();
    
    // Update user's device hierarchy
    await User.findByIdAndUpdate(userId, {
      $set: {
        [`security.deviceHierarchy.${deviceId}.isRevoked`]: true,
        [`security.deviceHierarchy.${deviceId}.sessions`]: []
      }
    });
    
    // Emit device revocation event to user room
    const userRoom = `${ROOM_PREFIX.USER}${userId}`;
    socketManager.emitToRoom(userRoom, 'security:device_revoked', {
      deviceId,
      deviceName: device.name
    });
    
    return true;
  } catch (error) {
    logger.error("Error revoking device:", error);
    return false;
  }
};

/**
 * Get user's devices
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - List of user devices
 */
const getUserDevices = async (userId) => {
  try {
    const devices = await Device.find({
      userId: mongoose.Types.ObjectId(userId)
    }).sort({ lastActive: -1 });
    
    return devices.map(device => ({
      deviceId: device.deviceId,
      name: device.name,
      browser: device.browser,
      os: device.os,
      deviceType: device.deviceType,
      isVerified: device.isVerified,
      lastActive: device.lastActive,
      firstSeen: device.createdAt,
      activeSessions: device.activeSessions.length
    }));
  } catch (error) {
    logger.error("Error getting user devices:", error);
    return [];
  }
};

/**
 * Calculate suspicious score for a device
 * @param {Object} device - Device document
 * @returns {number} - Suspicious score
 */
const calculateSuspiciousScore = (device) => {
  let score = 0;
  
  // Base score for verified devices
  if (device.isVerified) {
    score = 10; // Low base score for verified devices
  } else {
    score = 30; // Higher base score for unverified devices
  }
  
  // Check last activity
  const daysSinceLastActive = 
    (Date.now() - device.lastActive.getTime()) / (1000 * 60 * 60 * 24);
  
  // Device hasn't been used in a while
  if (daysSinceLastActive > 30) {
    score += 20;
  } else if (daysSinceLastActive > 7) {
    score += 10;
  }
  
  // Check device age
  const daysSinceCreated = 
    (Date.now() - device.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  
  // New device (less than 3 days old)
  if (daysSinceCreated < 3) {
    score += 15;
  }
  
  // Adjust based on trust score if available
  if (device.trustScore) {
    score = Math.max(0, score - (device.trustScore / 10));
  }
  
  return Math.min(100, score);
};

/**
 * Determine device type from user agent
 * @param {Object} deviceInfo - Device information
 * @returns {string} - Device type
 */
const getDeviceType = (deviceInfo) => {
  const ua = deviceInfo.userAgent || '';
  
  if (/mobile/i.test(ua)) {
    return 'mobile';
  } else if (/tablet/i.test(ua)) {
    return 'tablet';
  } else if (/windows|macintosh|linux/i.test(ua)) {
    return 'desktop';
  }
  
  return 'unknown';
};

/**
 * Subscribe a socket to the appropriate device room
 * @param {Object} socket - Socket.io socket
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID
 * @param {string} sessionId - Session ID
 * @param {string} tabId - Tab ID
 * @returns {Promise<boolean>} - Success status
 */
const subscribeToDeviceRooms = async (socket, userId, deviceId, sessionId, tabId) => {
  try {
    // Create room hierarchy using the room registry
    const rooms = await roomRegistry.createRoomHierarchy(userId, deviceId, sessionId, tabId);
    
    // Join all rooms
    await socket.join(rooms.userRoom);
    await socket.join(rooms.deviceRoom);
    await socket.join(rooms.sessionRoom);
    await socket.join(rooms.tabRoom);
    
    // Store room info in socket for cleanup
    socket.deviceRooms = rooms;
    
    // Update session with tab information
    await Session.findByIdAndUpdate(sessionId, {
      $addToSet: { activeTabs: tabId }
    });
    
    logger.debug(`Socket ${socket.id} subscribed to rooms: ${JSON.stringify(rooms)}`);
    
    return true;
  } catch (error) {
    logger.error("Error subscribing to device rooms:", error);
    return false;
  }
};

/**
 * Assess device security and trust level
 * @param {string} userId - User ID
 * @param {Object} deviceInfo - Device information
 * @returns {Promise<Object>} - Security assessment
 */
const assessDeviceSecurity = async (userId, deviceInfo) => {
  try {
    const fingerprint = generateEnhancedFingerprint(deviceInfo);
    
    // Get device from database
    const device = await Device.findOne({
      userId: mongoose.Types.ObjectId(userId),
      fingerprint
    });
    
    if (!device) {
      return {
        isKnown: false,
        trustLevel: 'low',
        riskLevel: 'medium',
        riskFactors: ['new_device'],
        requiresVerification: true
      };
    }
    
    // Calculate suspicious score
    const suspiciousScore = calculateSuspiciousScore(device);
    
    // Determine risk level based on suspicious score
    let riskLevel = 'low';
    if (suspiciousScore > 70) {
      riskLevel = 'high';
    } else if (suspiciousScore > 40) {
      riskLevel = 'medium';
    }
    
    // Determine trust level based on verification status and history
    let trustLevel = 'medium';
    if (device.isVerified && device.trustScore > 70) {
      trustLevel = 'high';
    } else if (!device.isVerified || device.trustScore < 30) {
      trustLevel = 'low';
    }
    
    // Determine risk factors
    const riskFactors = [];
    if (suspiciousScore > 40) riskFactors.push('suspicious_behavior');
    if (!device.isVerified) riskFactors.push('unverified_device');
    if (device.ipAddresses.length > 5) riskFactors.push('multiple_locations');
    
    return {
      isKnown: true,
      deviceId: device.deviceId,
      trustLevel,
      riskLevel,
      riskFactors,
      requiresVerification: !device.isVerified,
      lastSeen: device.lastActive
    };
  } catch (error) {
    logger.error("Error assessing device security:", error);
    throw new AuthError("Failed to assess device security", "SECURITY_ASSESSMENT_FAILED");
  }
};

module.exports = {
  generateEnhancedFingerprint,
  recordDeviceInfo,
  verifyDeviceConsistency,
  generateVerificationCode,
  verifyDevice,
  getUserDevices,
  linkSessionToDevice,
  revokeDevice,
  subscribeToDeviceRooms,
  assessDeviceSecurity,
  ROOM_PREFIX
};
