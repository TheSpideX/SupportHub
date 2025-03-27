/**
 * Security Service
 * Handles security-specific concerns including:
 * - Rate limiting detection
 * - CSRF protection
 * - Security context validation
 * - Suspicious activity detection
 * - Device fingerprinting
 */
const securityConfig = require('../config/security.config');
const cookieConfig = require('../config/cookie.config');
const { AuthError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');
const tokenService = require('./token.service');
const sessionService = require('./session.service');
const User = require('../models/user.model');
const SecurityEvent = require('../models/security-event.model');
const DeviceInfo = require('../models/device-info.model');

class SecurityService {
  constructor() {
    this.tokenService = tokenService;
  }

  /**
   * Validate security context from client
   * @param {Object} securityContext - Client security context
   * @param {String} userId - User ID
   * @returns {Promise<Boolean>} Validation result
   */
  async validateSecurityContext(securityContext, userId) {
    try {
      if (!securityContext || !securityContext.id) {
        logger.warn('Invalid security context format');
        return false;
      }

      // Check if context exists in database
      const storedContext = await SecurityEvent.findOne({
        contextId: securityContext.id,
        userId
      });

      if (!storedContext) {
        logger.warn(`Security context ${securityContext.id} not found for user ${userId}`);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Security context validation error:', error);
      return false;
    }
  }

  /**
   * Detect suspicious activity
   * @param {Object} activity - Activity data
   * @param {String} userId - User ID
   * @returns {Promise<Boolean>} True if suspicious
   */
  async detectSuspiciousActivity(activity, userId) {
    try {
      // Get user's known devices and IP addresses
      const knownDevices = await DeviceInfo.find({ userId });
      
      // Check if IP is known
      const isKnownIP = knownDevices.some(device => 
        device.ipHash === activity.ipHash
      );
      
      // Check if device fingerprint is known
      const isKnownDevice = knownDevices.some(device => 
        device.fingerprint === activity.deviceFingerprint
      );
      
      // Check for location change
      const hasLocationChanged = knownDevices.some(device => 
        device.ipHash !== activity.ipHash && 
        device.fingerprint === activity.deviceFingerprint
      );
      
      // Log suspicious activity
      if (!isKnownIP || !isKnownDevice || hasLocationChanged) {
        await this.logSecurityEvent(userId, 'suspicious_activity', {
          isKnownIP,
          isKnownDevice,
          hasLocationChanged,
          deviceFingerprint: activity.deviceFingerprint,
          ipHash: activity.ipHash,
          userAgent: activity.userAgent
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Suspicious activity detection error:', error);
      return false;
    }
  }

  /**
   * Handle failed authentication attempt
   * @param {String} userId - User ID (if known)
   * @param {String} email - Email used in attempt
   * @param {Object} deviceInfo - Device information
   * @returns {Promise<void>}
   */
  async handleFailedAttempt(userId, email, deviceInfo) {
    try {
      // Log the failed attempt
      await this.logSecurityEvent(userId, 'failed_login_attempt', {
        email,
        deviceInfo
      });
      
      // If user exists, update failed attempts
      if (userId) {
        const user = await User.findById(userId);
        
        if (user) {
          user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
          
          // Check if account should be locked
          if (user.failedLoginAttempts >= securityConfig.lockout.maxAttempts) {
            user.isLocked = true;
            user.lockUntil = new Date(Date.now() + securityConfig.lockout.durationMinutes * 60 * 1000);
            
            await this.logSecurityEvent(userId, 'account_locked', {
              reason: 'too_many_failed_attempts',
              lockUntil: user.lockUntil
            });
          }
          
          await user.save();
        }
      }
    } catch (error) {
      logger.error('Failed attempt handling error:', error);
    }
  }

  /**
   * Reset failed attempts counter
   * @param {String} userId - User ID
   * @returns {Promise<void>}
   */
  async resetFailedAttempts(userId) {
    try {
      const user = await User.findById(userId);
      
      if (user && user.failedLoginAttempts > 0) {
        user.failedLoginAttempts = 0;
        await user.save();
      }
    } catch (error) {
      logger.error('Reset failed attempts error:', error);
    }
  }

  /**
   * Generate CSRF token and set in cookie
   * @param {Object} res - Express response object
   * @returns {String} CSRF token
   */
  generateCsrfToken(res) {
    const csrfToken = this.tokenService.generateCsrfToken();
    
    // Set CSRF token in cookie using the correct config
    res.cookie(cookieConfig.names.CSRF_TOKEN, csrfToken, {
      httpOnly: false, // Must be accessible to JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    
    return csrfToken;
  }

  /**
   * Validate CSRF token
   * @param {String} token - CSRF token from request header
   * @param {String} cookieToken - CSRF token from cookie
   * @returns {Boolean} Validation result
   */
  validateCsrfToken(token, cookieToken) {
    if (!token || !cookieToken) {
      return false;
    }
    
    return token === cookieToken;
  }

  /**
   * Log security event
   * @param {String} userId - User ID
   * @param {String} eventType - Event type
   * @param {Object} details - Event details
   * @returns {Promise<Object>} Created event
   */
  async logSecurityEvent(userId, eventType, details = {}) {
    try {
      const event = new SecurityEvent({
        userId,
        eventType,
        details,
        timestamp: new Date(),
        contextId: details.contextId || undefined
      });
      
      await event.save();
      return event;
    } catch (error) {
      logger.error('Security event logging error:', error);
      return null;
    }
  }

  /**
   * Get recent security events for user
   * @param {String} userId - User ID
   * @param {Number} limit - Maximum number of events to return
   * @returns {Promise<Array>} Security events
   */
  async getRecentSecurityEvents(userId, limit = 10) {
    try {
      return await SecurityEvent.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit);
    } catch (error) {
      logger.error('Get security events error:', error);
      return [];
    }
  }

  /**
   * Verify a new device
   * @param {String} userId - User ID
   * @param {String} verificationCode - Verification code
   * @param {Object} deviceInfo - Device information
   * @returns {Promise<Boolean>} Verification result
   */
  async verifyDevice(userId, verificationCode, deviceInfo) {
    try {
      // Verify the code (implementation depends on how codes are stored)
      const isValid = await this.validateVerificationCode(userId, verificationCode);
      
      if (!isValid) {
        return false;
      }
      
      // Add device to known devices
      await this.addKnownDevice(userId, deviceInfo);
      
      // Log the verification
      await this.logSecurityEvent(userId, 'device_verified', {
        deviceInfo
      });
      
      return true;
    } catch (error) {
      logger.error('Device verification error:', error);
      return false;
    }
  }

  /**
   * Add device to known devices
   * @param {String} userId - User ID
   * @param {Object} deviceInfo - Device information
   * @returns {Promise<Object>} Created device info
   */
  async addKnownDevice(userId, deviceInfo) {
    try {
      // Check if device already exists
      const existingDevice = await DeviceInfo.findOne({
        userId,
        fingerprint: deviceInfo.fingerprint
      });
      
      if (existingDevice) {
        // Update existing device
        existingDevice.lastSeen = new Date();
        existingDevice.ipHash = deviceInfo.ipHash;
        existingDevice.userAgent = deviceInfo.userAgent;
        await existingDevice.save();
        return existingDevice;
      }
      
      // Create new device
      const device = new DeviceInfo({
        userId,
        fingerprint: deviceInfo.fingerprint,
        ipHash: deviceInfo.ipHash,
        userAgent: deviceInfo.userAgent,
        name: deviceInfo.name || 'Unknown device',
        firstSeen: new Date(),
        lastSeen: new Date(),
        isTrusted: true
      });
      
      await device.save();
      return device;
    } catch (error) {
      logger.error('Add known device error:', error);
      return null;
    }
  }

  /**
   * Get user security information
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Security information
   */
  async getUserSecurityInfo(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new AuthError('User not found', 'USER_NOT_FOUND');
      }
      
      return {
        mfaEnabled: user.mfaEnabled || false,
        lastPasswordChange: user.lastPasswordChange,
        securityLevel: user.securityLevel || 'medium',
        accountLocked: user.isLocked || false,
        lockUntil: user.lockUntil
      };
    } catch (error) {
      logger.error('Get user security info error:', error);
      throw error;
    }
  }

  /**
   * Get last login information
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Last login info
   */
  async getLastLoginInfo(userId) {
    try {
      const lastLogin = await SecurityEvent.findOne({
        userId,
        eventType: 'login_success'
      }).sort({ timestamp: -1 });
      
      if (!lastLogin) {
        return null;
      }
      
      return {
        timestamp: lastLogin.timestamp,
        ipHash: lastLogin.details.ipHash,
        deviceInfo: lastLogin.details.deviceInfo
      };
    } catch (error) {
      logger.error('Get last login info error:', error);
      return null;
    }
  }

  /**
   * Get password status
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Password status
   */
  async getPasswordStatus(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new AuthError('User not found', 'USER_NOT_FOUND');
      }
      
      const lastPasswordChange = user.lastPasswordChange || user.createdAt;
      const passwordAgeDays = Math.floor((Date.now() - lastPasswordChange) / (1000 * 60 * 60 * 24));
      
      // Get expiry days based on security level
      const securityLevel = user.securityLevel || 'medium';
      const expiryDays = securityConfig.levels[securityLevel].passwordExpiryDays;
      
      return {
        lastChanged: lastPasswordChange,
        ageInDays: passwordAgeDays,
        expiresInDays: Math.max(0, expiryDays - passwordAgeDays),
        needsChange: passwordAgeDays >= expiryDays
      };
    } catch (error) {
      logger.error('Get password status error:', error);
      throw error;
    }
  }

  /**
   * Check if request is rate limited
   * @param {String} actionType - Action type (login, register, etc.)
   * @param {String} identifier - Identifier (IP, user ID, etc.)
   * @returns {Promise<Boolean>} True if rate limited
   */
  async isRateLimited(actionType, identifier) {
    // This would typically use Redis or another store to track rate limits
    // For now, return false as the actual implementation depends on your rate limiting strategy
    return false;
  }

  /**
   * Validate verification code
   * @param {String} userId - User ID
   * @param {String} code - Verification code
   * @returns {Promise<Boolean>} Validation result
   */
  async validateVerificationCode(userId, code) {
    // Implementation depends on how verification codes are stored
    // This is a placeholder
    return true;
  }

  /**
   * Initialize security monitoring
   */
  initializeSecurityMonitoring() {
    // Set up scheduled security audits
    this.setupSecurityAudits();
    
    // Initialize suspicious activity detection
    this.initializeSuspiciousActivityDetection();
    
    // Set up event listeners for security events
    this.setupSecurityEventListeners();
    
    logger.info('Security monitoring initialized');
  }

  /**
   * Set up scheduled security audits
   */
  setupSecurityAudits() {
    // Schedule security audits to run daily
    const auditInterval = process.env.SECURITY_AUDIT_INTERVAL || 24 * 60 * 60 * 1000; // 24 hours
    
    setInterval(async () => {
      try {
        await this.runSecurityAudit();
        logger.debug('Completed scheduled security audit');
      } catch (error) {
        logger.error('Error during security audit:', error);
      }
    }, auditInterval);
    
    logger.info(`Security audits scheduled to run every ${auditInterval/3600000} hours`);
  }

  /**
   * Run security audit
   */
  async runSecurityAudit() {
    try {
      // Check for suspicious patterns in login attempts
      await this.checkLoginPatterns();
      
      // Check for unusual session activity
      await this.checkSessionActivity();
      
      // Check for potential brute force attempts
      await this.checkBruteForceAttempts();
      
      logger.info('Security audit completed');
    } catch (error) {
      logger.error('Failed to complete security audit:', error);
      throw error;
    }
  }

  /**
   * Initialize suspicious activity detection
   */
  initializeSuspiciousActivityDetection() {
    // Implementation depends on your security strategy
    logger.info('Suspicious activity detection initialized');
  }

  /**
   * Set up security event listeners
   */
  setupSecurityEventListeners() {
    // Implementation depends on your event system
    logger.info('Security event listeners set up');
  }

  /**
   * Check for suspicious login patterns
   */
  async checkLoginPatterns() {
    // Implementation depends on your security strategy
    logger.debug('Checked login patterns');
  }

  /**
   * Check for unusual session activity
   */
  async checkSessionActivity() {
    // Implementation depends on your security strategy
    logger.debug('Checked session activity');
  }

  /**
   * Check for potential brute force attempts
   */
  async checkBruteForceAttempts() {
    // Implementation depends on your security strategy
    logger.debug('Checked for brute force attempts');
  }
}

module.exports = new SecurityService();
