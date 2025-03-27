const crypto = require("crypto");
const { redisClient } = require("../../../config/redis");
const logger = require("../../../utils/logger");

// Constants
const DEVICE_HISTORY_KEY_PREFIX = "device:history:";
const DEVICE_VERIFICATION_KEY_PREFIX = "device:verification:";
const DEVICE_HISTORY_TTL = 60 * 60 * 24 * 90; // 90 days
const SUSPICIOUS_SCORE_THRESHOLD = 50;

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
 * @returns {Promise<string|null>} - Device fingerprint or null
 */
const recordDeviceInfo = async (userId, deviceInfo) => {
  try {
    const fingerprint = generateEnhancedFingerprint(deviceInfo);
    const historyKey = `${DEVICE_HISTORY_KEY_PREFIX}${userId}`;
    const now = Date.now();

    // Create device record
    const deviceRecord = {
      fingerprint,
      userAgent: deviceInfo.userAgent || "",
      ip: deviceInfo.ip || "",
      firstSeen: now,
      lastSeen: now,
      useCount: 1,
    };

    // Check if device already exists
    const existingDeviceJson = await redisClient.hget(historyKey, fingerprint);

    if (existingDeviceJson) {
      const existingDevice = JSON.parse(existingDeviceJson);
      deviceRecord.firstSeen = existingDevice.firstSeen;
      deviceRecord.useCount = (existingDevice.useCount || 0) + 1;
      deviceRecord.lastSeen = now;
    }

    // Update device record
    await redisClient.hset(
      historyKey,
      fingerprint,
      JSON.stringify(deviceRecord)
    );
    await redisClient.expire(historyKey, DEVICE_HISTORY_TTL);

    // Return the fingerprint
    return fingerprint;
  } catch (error) {
    logger.error("Error recording device info:", error);
    return null;
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
    const historyKey = `${DEVICE_HISTORY_KEY_PREFIX}${userId}`;

    // Get user's device history
    const devices = await redisClient.hgetall(historyKey);

    if (!devices || Object.keys(devices).length === 0) {
      // First device for this user - automatically trusted
      return {
        isKnown: false,
        isVerified: true,
        suspiciousScore: 0,
        isValid: true,
      };
    }

    // Check if this device exists in history
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

module.exports = {
  generateEnhancedFingerprint,
  recordDeviceInfo,
  verifyDeviceConsistency,
};
