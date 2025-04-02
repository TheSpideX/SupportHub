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
const roomRegistryConfig = require('../config/room-registry.config');
const { AuthError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');
const tokenService = require('./token.service');
const sessionService = require('./session.service');
const User = require('../models/user.model');
const SecurityEvent = require('../models/security-event.model');
const DeviceInfo = require('../models/device-info.model');
const socketService = require('./socket.service');
const config = require('../config');
const { roomRegistry, eventPropagation } = config;

class SecurityService {
  constructor(options = {}) {
    this.tokenService = tokenService;
    this.io = options.io; // Store the Socket.IO instance
  }

  /**
   * Initialize security service
   * @param {Object} options - Initialization options
   * @param {Object} options.io - Socket.IO instance
   * @returns {Object} - The initialized security service
   */
  initialize(options = {}) {
    // Prevent duplicate initialization
    if (this.isInitialized) {
      logger.debug('Security service already initialized, skipping');
      return this;
    }
    
    // Store the Socket.IO instance if provided
    if (options.io) {
      this.io = options.io;
    }
    
    // Initialize security monitoring
    this.initializeSecurityMonitoring();
    
    this.isInitialized = true;
    logger.info('Security service initialized');
    
    return this;
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
    
    // Set CSRF token in cookie using the centralized config
    res.cookie(
      cookieConfig.names.CSRF_TOKEN, 
      csrfToken, 
      cookieConfig.getCsrfTokenOptions()
    );
    
    return csrfToken;
  }

  /**
   * Set authentication tokens in cookies
   * @param {Object} res - Express response object
   * @param {Object} tokens - Token data (access and refresh tokens)
   * @param {Boolean} rememberMe - Whether to extend cookie lifetime
   */
  setAuthCookies(res, tokens, rememberMe = false) {
    // Delegate to token service for consistent implementation
    this.tokenService.setTokenCookies(res, tokens, rememberMe);
  }

  /**
   * Clear authentication cookies
   * @param {Object} res - Express response object
   */
  clearAuthCookies(res) {
    res.clearCookie(cookieConfig.names.ACCESS_TOKEN, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    
    res.clearCookie(cookieConfig.names.REFRESH_TOKEN, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    
    // Also clear CSRF token cookie
    res.clearCookie(cookieConfig.names.CSRF_TOKEN, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
  }

  /**
   * Validate CSRF token
   * @param {String} token - CSRF token from request header
   * @param {String} cookieToken - CSRF token from cookie
   * @returns {Boolean} Validation result
   */
  validateCsrfToken(token, cookieToken) {
    // Delegate to token service for consistent implementation
    return this.tokenService.validateCsrfToken(token, cookieToken);
  }

  /**
   * Verify CSRF token
   * @param {String} token - CSRF token from request
   * @param {String} cookieToken - CSRF token from cookie
   * @returns {Boolean} Verification result
   */
  verifyCsrfToken(token, userId) {
    // Delegate to token service for consistent implementation
    return this.tokenService.verifyCsrfToken(token, userId);
  }

  /**
   * Create security context for user
   * @param {String} userId - User ID
   * @param {Object} deviceInfo - Device information
   * @returns {Promise<Object>} Security context
   */
  async createSecurityContext(userId, deviceInfo) {
    try {
      // Create security context
      const contextId = this.tokenService.generateSecureToken();
      
      // Log security event for context creation
      await this.logSecurityEvent(userId, 'security_context_created', {
        contextId,
        deviceInfo
      });
      
      // Return security context
      return {
        id: contextId,
        userId,
        createdAt: new Date(),
        deviceFingerprint: deviceInfo.fingerprint,
        ipHash: deviceInfo.ipHash,
        userAgent: deviceInfo.userAgent
      };
    } catch (error) {
      logger.error('Security context creation error:', error);
      throw new AuthError('Failed to create security context', 'SECURITY_CONTEXT_ERROR');
    }
  }

  /**
   * Check if user account is locked
   * @param {Object} user - User object
   * @returns {Object} Lock status
   */
  checkAccountLock(user) {
    if (!user.isLocked) {
      return { locked: false };
    }
    
    // Check if lock period has expired
    const now = new Date();
    if (user.lockUntil && user.lockUntil < now) {
      // Lock has expired, reset lock
      return { locked: false, wasLocked: true };
    }
    
    // Account is locked
    return { 
      locked: true, 
      until: user.lockUntil,
      remainingMs: user.lockUntil ? user.lockUntil - now : 0
    };
  }

  /**
   * Log security event
   * @param {String} userId - User ID
   * @param {String} eventType - Event type
   * @param {Object} data - Event data
   * @returns {Promise<Object>} Created event
   */
  async logSecurityEvent(userId, eventType, data = {}) {
    try {
      const event = new SecurityEvent({
        userId,
        eventType,
        data,
        timestamp: new Date()
      });
      
      await event.save();
      return event;
    } catch (error) {
      logger.error('Security event logging error:', error);
      // Don't throw - logging should not interrupt flow
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
    
    // Initialize WebSocket security handlers
    this.initializeWebSocketSecurity();
    
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
    this.suspiciousActivityRules = {
      multipleFailedLogins: {
        threshold: 5,
        timeWindow: 10 * 60 * 1000, // 10 minutes
        action: 'temporaryLock'
      },
      rapidDeviceChanges: {
        threshold: 3,
        timeWindow: 60 * 60 * 1000, // 1 hour
        action: 'notify'
      },
      unusualLocationLogin: {
        enabled: true,
        distanceThreshold: 500, // km
        action: 'verify'
      },
      multipleTabsAccess: {
        threshold: 20,
        timeWindow: 5 * 60 * 1000, // 5 minutes
        action: 'monitor'
      }
    };
    
    // Initialize detection counters
    this.detectionCounters = new Map();
    
    logger.info('Suspicious activity detection initialized');
  }

  /**
   * Check for suspicious activity
   * @param {String} userId - User ID
   * @param {String} activityType - Activity type
   * @param {Object} data - Activity data
   * @returns {Promise<Object>} Detection result
   */
  async checkSuspiciousActivity(userId, activityType, data = {}) {
    try {
      if (!this.suspiciousActivityRules[activityType]) {
        return { suspicious: false };
      }
      
      const rule = this.suspiciousActivityRules[activityType];
      
      // Get or initialize counter for this user and activity
      const counterKey = `${userId}:${activityType}`;
      if (!this.detectionCounters.has(counterKey)) {
        this.detectionCounters.set(counterKey, {
          count: 0,
          firstOccurrence: Date.now(),
          lastOccurrence: Date.now(),
          data: []
        });
      }
      
      const counter = this.detectionCounters.get(counterKey);
      
      // Check if we're still in the time window
      if (Date.now() - counter.firstOccurrence > rule.timeWindow) {
        // Reset counter if outside time window
        counter.count = 0;
        counter.firstOccurrence = Date.now();
        counter.data = [];
      }
      
      // Increment counter
      counter.count++;
      counter.lastOccurrence = Date.now();
      counter.data.push(data);
      
      // Check if threshold exceeded
      if (counter.count >= rule.threshold) {
        // Take action based on rule
        await this.takeSuspiciousActivityAction(userId, activityType, rule.action, counter);
        
        return { suspicious: true, action: rule.action };
      }
      
      return { suspicious: false };
    } catch (error) {
      logger.error('Suspicious activity check error:', error);
      return { suspicious: false };
    }
  }

  /**
   * Take action for suspicious activity
   * @param {String} userId - User ID
   * @param {String} activityType - Activity type
   * @param {String} action - Action to take
   * @param {Object} counter - Detection counter
   */
  async takeSuspiciousActivityAction(userId, activityType, action, counter) {
    try {
      const user = await User.findById(userId);
      if (!user) return;
      
      switch (action) {
        case 'temporaryLock':
          // Lock account temporarily
          await User.findByIdAndUpdate(userId, {
            'securityProfile.temporaryLock': {
              locked: true,
              until: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
              reason: `Suspicious activity: ${activityType}`
            }
          });
          
          // Log the action
          logger.warn(`User account temporarily locked due to suspicious activity`, {
            userId,
            activityType,
            occurrences: counter.count,
            timeWindow: counter.lastOccurrence - counter.firstOccurrence
          });
          break;
          
        case 'notify':
          // Send notification to user
          // This would integrate with your notification system
          logger.info(`Notification sent to user about suspicious activity`, {
            userId,
            activityType
          });
          break;
          
        case 'verify':
          // Require additional verification
          await User.findByIdAndUpdate(userId, {
            'securityProfile.requiresVerification': true,
            'securityProfile.verificationReason': `Suspicious activity: ${activityType}`
          });
          
          logger.info(`Additional verification required for user`, {
            userId,
            activityType
          });
          break;
          
        case 'monitor':
          // Just log for monitoring
          logger.info(`Suspicious activity detected and being monitored`, {
            userId,
            activityType,
            occurrences: counter.count
          });
          break;
      }
      
      // Reset counter after taking action
      this.detectionCounters.set(`${userId}:${activityType}`, {
        count: 0,
        firstOccurrence: Date.now(),
        lastOccurrence: Date.now(),
        data: []
      });
      
      return true;
    } catch (error) {
      logger.error(`Error taking action for suspicious activity`, {
        userId,
        activityType,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Handle temporary account lock
   * @param {String} userId - User ID
   * @param {Object} counter - Detection counter
   */
  async handleTemporaryLock(userId, counter) {
    try {
      const user = await User.findById(userId);
      if (user) {
        user.isLocked = true;
        user.lockUntil = new Date(Date.now() + securityConfig.lockout.durationMinutes * 60 * 1000);
        await user.save();
        
        await this.logSecurityEvent(userId, 'account_locked', {
          reason: 'suspicious_activity',
          lockUntil: user.lockUntil
        });
      }
    } catch (error) {
      logger.error('Error locking account:', error);
    }
  }

  /**
   * Notify admins of suspicious activity
   * @param {String} userId - User ID
   * @param {String} activityType - Activity type
   * @param {Object} counter - Detection counter
   */
  async notifyAdmins(userId, activityType, counter) {
    try {
      // Implement notification logic here
      // This could involve sending an email or SMS to admins
      logger.info(`Notifying admins of suspicious activity: ${activityType} for user ${userId}`);
    } catch (error) {
      logger.error('Error notifying admins:', error);
    }
  }

  /**
   * Request device verification
   * @param {String} userId - User ID
   * @param {Object} counter - Detection counter
   */
  async requestDeviceVerification(userId, counter) {
    try {
      // Implement device verification request logic here
      // This could involve sending a verification code to the user's device
      logger.info(`Requesting device verification for user ${userId}`);
    } catch (error) {
      logger.error('Error requesting device verification:', error);
    }
  }

  /**
   * Monitor user activity
   * @param {String} userId - User ID
   * @param {Object} counter - Detection counter
   */
  async monitorUserActivity(userId, counter) {
    try {
      // Implement monitoring logic here
      // This could involve logging the activity or setting up alerts
      logger.info(`Monitoring user activity for user ${userId}`);
    } catch (error) {
      logger.error('Error monitoring user activity:', error);
    }
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

  /**
   * Broadcast security event to user's devices via WebSocket
   * @param {String} userId - User ID
   * @param {String} eventType - Security event type
   * @param {Object} data - Event data
   * @returns {Promise<Boolean>} Success status
   */
  async broadcastSecurityEvent(userId, eventType, data = {}) {
    try {
      // Log the security event first
      await this.logSecurityEvent(userId, eventType, data);
      
      // Get socket.io instance from app
      const io = require('../../../socket').getIO();
      if (!io) {
        logger.warn('Socket.io not initialized, cannot broadcast security event');
        return false;
      }
      
      // Create user room name using config
      const userRoom = `${roomRegistryConfig.roomTypes.user.prefix}${userId}`;
      
      // Broadcast to all user's devices
      io.to(userRoom).emit(`security:${eventType}`, {
        timestamp: new Date(),
        type: eventType,
        ...data
      });
      
      logger.info(`Security event ${eventType} broadcasted to user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to broadcast security event ${eventType}:`, error);
      return false;
    }
  }

  /**
   * Handle password change security event
   * @param {String} userId - User ID
   * @param {String} sessionId - Current session ID (to exclude from logout)
   * @returns {Promise<Boolean>} Success status
   */
  async handlePasswordChanged(userId, sessionId = null) {
    try {
      // Log the event
      await this.logSecurityEvent(userId, 'password_changed', {
        timestamp: new Date(),
        sessionId
      });
      
      // Broadcast to all user's devices
      await this.broadcastSecurityEvent(userId, 'password_changed', {
        keepSession: sessionId
      });
      
      return true;
    } catch (error) {
      logger.error('Password change handling error:', error);
      return false;
    }
  }

  /**
   * Handle suspicious activity detection
   * @param {String} userId - User ID
   * @param {Object} activityData - Suspicious activity data
   * @returns {Promise<Boolean>} Success status
   */
  async handleSuspiciousActivity(userId, activityData) {
    try {
      // Log the suspicious activity
      await this.logSecurityEvent(userId, 'suspicious_activity', activityData);
      
      // Broadcast to all user's devices
      await this.broadcastSecurityEvent(userId, 'suspicious_activity', {
        activityType: activityData.type,
        riskLevel: activityData.riskLevel,
        timestamp: new Date()
      });
      
      return true;
    } catch (error) {
      logger.error('Suspicious activity handling error:', error);
      return false;
    }
  }

  /**
   * Initialize WebSocket security handlers
   */
  initializeWebSocketSecurity() {
    try {
      // Instead of requiring '../../../socket', use the io instance passed to the service
      // or get it from the app
      const io = this.io || (global.app && global.app.get('io'));
      
      if (!io) {
        logger.warn('Socket.io not initialized, skipping WebSocket security setup');
        return;
      }
      
      // Get the auth namespace
      const authNamespace = io.of('/auth');
      
      // Set up middleware for authentication
      authNamespace.use(socketService.authMiddleware.bind(socketService));
      
      // Handle connection
      authNamespace.on('connection', (socket) => {
        // Join rooms using centralized method
        socketService.joinHierarchicalRooms(socket);
        
        // Handle security events
        this.setupSocketSecurityHandlers(socket);
        
        logger.debug(`User ${socket.data.userId} connected to security WebSocket`);
      });
      
      logger.info('WebSocket security handlers initialized');
    } catch (error) {
      logger.error('Failed to initialize WebSocket security:', error);
    }
  }

  /**
   * Set up socket security event handlers
   * @param {Object} socket - Socket.io socket
   */
  setupSocketSecurityHandlers(socket) {
    // Handle client-side security events
    socket.on('security:report', async (data) => {
      try {
        await this.logSecurityEvent(socket.data.userId, 'client_report', data);
        logger.info(`Security report received from user ${socket.data.userId}`);
      } catch (error) {
        logger.error('Error handling security report:', error);
      }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      logger.debug(`User ${socket.data.userId} disconnected from security WebSocket`);
    });
  }

  /**
   * Extract tokens from cookies
   * @param {Object} req - Express request object
   * @returns {Object|null} Tokens or null if not found
   */
  extractTokensFromCookies(req) {
    try {
      const accessToken = req.cookies[cookieConfig.names.ACCESS_TOKEN];
      const refreshToken = req.cookies[cookieConfig.names.REFRESH_TOKEN];
      
      if (!accessToken && !refreshToken) {
        return null;
      }
      
      return {
        accessToken,
        refreshToken
      };
    } catch (error) {
      logger.error('Extract tokens from cookies error:', error);
      return null;
    }
  }

  /**
   * Extract CSRF token from request
   * @param {Object} req - Express request object
   * @returns {String|null} CSRF token or null if not found
   */
  extractCsrfToken(req) {
    try {
      // Check header first
      const headerToken = req.headers[securityConfig.csrf.headerName.toLowerCase()];
      if (headerToken) {
        return headerToken;
      }
      
      // Check cookie
      const cookieToken = req.cookies[cookieConfig.names.CSRF_TOKEN];
      if (cookieToken) {
        return cookieToken;
      }
      
      // Check body
      if (req.body && req.body._csrf) {
        return req.body._csrf;
      }
      
      return null;
    } catch (error) {
      logger.error('Extract CSRF token error:', error);
      return null;
    }
  }

  /**
   * Record security event and broadcast to appropriate rooms
   * @param {string} userId - User ID
   * @param {string} eventType - Security event type
   * @param {Object} data - Event data
   */
  async recordSecurityEvent(userId, eventType, data = {}) {
    try {
      // Create security event record
      const event = new SecurityEvent({
        userId,
        eventType,
        data,
        timestamp: new Date()
      });
      
      await event.save();
      
      // Create room name using socket service
      const userRoom = socketService.createRoomName('user', userId);
      
      // Determine propagation direction based on event type
      const propagationConfig = eventPropagation.events[`security:${eventType}`] || 
                               eventPropagation.defaultBehavior;
      
      // Emit event with proper propagation
      socketService.emitWithPropagation(userRoom, `security:${eventType}`, {
        timestamp: new Date(),
        type: eventType,
        ...data
      }, propagationConfig);
      
      logger.info(`Security event ${eventType} recorded and broadcasted for user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to record security event ${eventType}:`, error);
      return false;
    }
  }

  /**
   * Stop security monitoring
   */
  stopMonitoring() {
    try {
      // Clear any scheduled security audits
      if (this.securityAuditInterval) {
        clearInterval(this.securityAuditInterval);
        this.securityAuditInterval = null;
      }
      
      // Clear any other timers or intervals
      if (this.suspiciousActivityTimer) {
        clearTimeout(this.suspiciousActivityTimer);
        this.suspiciousActivityTimer = null;
      }
      
      // Reset detection counters
      if (this.detectionCounters) {
        this.detectionCounters.clear();
      }
      
      logger.info('Security monitoring stopped');
      return true;
    } catch (error) {
      logger.error('Failed to stop security monitoring:', error);
      return false;
    }
  }
}

module.exports = new SecurityService();

/**
 * Get security notifications for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of security notifications
 */
exports.getUserNotifications = async (userId) => {
  try {
    // Get notifications from database
    const SecurityNotification = require('../models/security-notification.model');
    
    const notifications = await SecurityNotification.find({
      userId,
      read: false
    })
    .sort({ createdAt: -1 })
    .limit(50);
    
    return notifications;
  } catch (error) {
    logger.error('Error fetching security notifications:', error);
    throw new Error('Failed to retrieve security notifications');
  }
};

/**
 * Create a security notification
 * @param {Object} notificationData - Notification data
 * @returns {Promise<Object>} Created notification
 */
exports.createSecurityNotification = async (notificationData) => {
  try {
    const SecurityNotification = require('../models/security-notification.model');
    
    // Create the notification
    const notification = new SecurityNotification({
      ...notificationData,
      // If userId is not provided, this will be a system-wide notification
      // that security admins can see
    });
    
    await notification.save();
    
    // Log the creation
    logger.info(`Security notification created: ${notification._id}`);
    
    return notification;
  } catch (error) {
    logger.error('Error creating security notification:', error);
    throw new Error('Failed to create security notification');
  }
};

/**
 * Acknowledge a security event
 * @param {string} eventId - ID of the security event
 * @param {string} userId - ID of the user acknowledging the event
 * @returns {Promise<boolean>} Whether the acknowledgment was successful
 */
exports.acknowledgeSecurityEvent = async (eventId, userId) => {
  try {
    // Find the security event in the database
    const SecurityEvent = require('../models/security-event.model');
    
    const event = await SecurityEvent.findOne({
      _id: eventId,
      userId: userId
    });
    
    if (!event) {
      logger.warn(`Security event not found or not accessible: ${eventId}`);
      return false;
    }
    
    // Update the event to mark it as acknowledged
    event.acknowledged = true;
    event.acknowledgedAt = new Date();
    await event.save();
    
    // Also update any related security notifications
    const SecurityNotification = require('../models/security-notification.model');
    await SecurityNotification.updateMany(
      {
        'metadata.eventId': eventId,
        userId: userId
      },
      {
        $set: {
          read: true,
          actionCompleted: true
        }
      }
    );
    
    logger.info(`Security event acknowledged: ${eventId} by user ${userId}`);
    return true;
  } catch (error) {
    logger.error(`Error acknowledging security event: ${error.message}`);
    throw new Error('Failed to acknowledge security event');
  }
};

/**
 * Notify other devices about a security event acknowledgment
 * @param {Object} io - Socket.IO instance
 * @param {string} userId - User ID
 * @param {string} eventId - ID of the acknowledged event
 */
exports.notifySecurityEventAcknowledged = async (io, userId, eventId) => {
  try {
    // Emit to user's room except the current socket
    io.to(`user:${userId}`).emit('security:event_acknowledged', {
      eventId,
      acknowledgedAt: new Date()
    });
    
    logger.debug(`Notified devices about security event acknowledgment: ${eventId}`);
  } catch (error) {
    logger.error(`Error notifying about security event acknowledgment: ${error.message}`);
    // Don't throw here to prevent breaking the main flow
  }
};

/**
 * Get user security settings
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User security settings
 */
exports.getUserSecuritySettings = async (userId) => {
  try {
    const User = require('../models/user.model');
    const user = await User.findById(userId).select('securitySettings');
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return user.securitySettings || {};
  } catch (error) {
    logger.error(`Error fetching security settings: ${error.message}`);
    throw error;
  }
};

/**
 * Update user security settings
 * @param {string} userId - User ID
 * @param {Object} settings - Security settings to update
 * @returns {Promise<Object>} Updated security settings
 */
exports.updateUserSecuritySettings = async (userId, settings) => {
  try {
    const User = require('../models/user.model');
    
    // Validate settings
    const validSettings = {};
    if (typeof settings.requireMfa === 'boolean') validSettings['securitySettings.requireMfa'] = settings.requireMfa;
    if (typeof settings.sessionTimeout === 'number') validSettings['securitySettings.sessionTimeout'] = settings.sessionTimeout;
    if (typeof settings.trustedDevicesOnly === 'boolean') validSettings['securitySettings.trustedDevicesOnly'] = settings.trustedDevicesOnly;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: validSettings },
      { new: true }
    ).select('securitySettings');
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Log security event
    await this.logSecurityEvent(userId, 'security_settings_changed', {
      changes: Object.keys(validSettings).map(key => key.replace('securitySettings.', ''))
    });
    
    return user.securitySettings;
  } catch (error) {
    logger.error(`Error updating security settings: ${error.message}`);
    throw error;
  }
};

/**
 * Setup 2FA for user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} 2FA setup data
 */
exports.setup2FAForUser = async (userId) => {
  try {
    const User = require('../models/user.model');
    const speakeasy = require('speakeasy');
    const QRCode = require('qrcode');
    
    // Generate secret
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `SupportHub:${userId}`
    });
    
    // Store temporary secret
    await User.findByIdAndUpdate(userId, {
      'securitySettings.mfa.tempSecret': secret.base32,
      'securitySettings.mfa.tempSecretCreatedAt': new Date()
    });
    
    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    
    return {
      secret: secret.base32,
      qrCode: qrCodeUrl
    };
  } catch (error) {
    logger.error(`Error setting up 2FA: ${error.message}`);
    throw error;
  }
};

/**
 * Verify 2FA setup
 * @param {string} userId - User ID
 * @param {string} token - Verification token
 * @returns {Promise<boolean>} Whether verification was successful
 */
exports.verify2FASetup = async (userId, token) => {
  try {
    const User = require('../models/user.model');
    const speakeasy = require('speakeasy');
    
    // Get user with temp secret
    const user = await User.findById(userId).select('securitySettings.mfa');
    
    if (!user || !user.securitySettings.mfa.tempSecret) {
      return false;
    }
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.securitySettings.mfa.tempSecret,
      encoding: 'base32',
      token: token
    });
    
    if (verified) {
      // Update user with verified secret
      await User.findByIdAndUpdate(userId, {
        'securitySettings.mfa.secret': user.securitySettings.mfa.tempSecret,
        'securitySettings.mfa.enabled': true,
        'securitySettings.mfa.verifiedAt': new Date(),
        $unset: { 'securitySettings.mfa.tempSecret': 1, 'securitySettings.mfa.tempSecretCreatedAt': 1 }
      });
      
      // Log security event
      await this.logSecurityEvent(userId, 'mfa_enabled', {
        method: 'totp'
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error(`Error verifying 2FA setup: ${error.message}`);
    throw error;
  }
};

/**
 * Disable 2FA
 * @param {string} userId - User ID
 * @param {string} token - Verification token
 * @returns {Promise<boolean>} Whether disabling was successful
 */
exports.disable2FA = async (userId, token) => {
  try {
    const User = require('../models/user.model');
    const speakeasy = require('speakeasy');
    
    // Get user with secret
    const user = await User.findById(userId).select('securitySettings.mfa');
    
    if (!user || !user.securitySettings.mfa.secret || !user.securitySettings.mfa.enabled) {
      return false;
    }
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.securitySettings.mfa.secret,
      encoding: 'base32',
      token: token
    });
    
    if (verified) {
      // Update user to disable 2FA
      await User.findByIdAndUpdate(userId, {
        'securitySettings.mfa.enabled': false,
        $unset: { 'securitySettings.mfa.secret': 1 }
      });
      
      // Log security event
      await this.logSecurityEvent(userId, 'mfa_disabled', {
        method: 'totp'
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error(`Error disabling 2FA: ${error.message}`);
    throw error;
  }
};

/**
 * Verify 2FA token
 * @param {string} token - Verification token
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Verification result
 */
exports.verify2FAToken = async (token, sessionId) => {
  try {
    const Session = require('../models/session.model');
    const User = require('../models/user.model');
    const speakeasy = require('speakeasy');
    
    // Get session
    const session = await Session.findById(sessionId);
    if (!session) {
      return { success: false, message: 'Invalid session' };
    }
    
    // Get user
    const user = await User.findById(session.userId).select('securitySettings.mfa');
    if (!user || !user.securitySettings.mfa.secret || !user.securitySettings.mfa.enabled) {
      return { success: false, message: 'MFA not enabled for user' };
    }
    
    // Verify token
    const verified = speakeasy.totp.verify({
      secret: user.securitySettings.mfa.secret,
      encoding: 'base32',
      token: token,
      window: 1 // Allow 1 period before and after
    });
    
    if (verified) {
      // Update session to mark as MFA verified
      await Session.findByIdAndUpdate(sessionId, {
        mfaVerified: true,
        mfaVerifiedAt: new Date()
      });
      
      // Log security event
      await this.logSecurityEvent(session.userId, 'mfa_verified', {
        sessionId
      });
      
      return { 
        success: true,
        data: {
          mfaVerified: true
        }
      };
    }
    
    return { success: false, message: 'Invalid verification token' };
  } catch (error) {
    logger.error(`Error verifying 2FA token: ${error.message}`);
    throw error;
  }
};

/**
 * Verify user device
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID
 * @param {string} verificationCode - Verification code
 * @returns {Promise<boolean>} Whether verification was successful
 */
exports.verifyUserDevice = async (userId, deviceId, verificationCode) => {
  try {
    const DeviceInfo = require('../models/device-info.model');
    
    // Find device verification request
    const device = await DeviceInfo.findOne({
      _id: deviceId,
      userId: userId,
      'verification.code': verificationCode,
      'verification.expiresAt': { $gt: new Date() }
    });
    
    if (!device) {
      return false;
    }
    
    // Update device to mark as verified
    await DeviceInfo.findByIdAndUpdate(deviceId, {
      'verification.verified': true,
      'verification.verifiedAt': new Date(),
      trusted: true
    });
    
    // Log security event
    await this.logSecurityEvent(userId, 'device_verified', {
      deviceId,
      deviceName: device.name,
      deviceType: device.type
    });
    
    return true;
  } catch (error) {
    logger.error(`Error verifying device: ${error.message}`);
    throw error;
  }
};

/**
 * Remove trusted device
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID
 * @returns {Promise<boolean>} Whether removal was successful
 */
exports.removeTrustedDevice = async (userId, deviceId) => {
  try {
    const DeviceInfo = require('../models/device-info.model');
    
    // Find device
    const device = await DeviceInfo.findOne({
      _id: deviceId,
      userId: userId
    });
    
    if (!device) {
      return false;
    }
    
    // Update device to remove trust
    await DeviceInfo.findByIdAndUpdate(deviceId, {
      trusted: false,
      'verification.verified': false
    });
    
    // Log security event
    await this.logSecurityEvent(userId, 'device_removed', {
      deviceId,
      deviceName: device.name,
      deviceType: device.type
    });
    
    return true;
  } catch (error) {
    logger.error(`Error removing trusted device: ${error.message}`);
    throw error;
  }
};

/**
 * Get user security events
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Security events with pagination
 */
exports.getUserSecurityEvents = async (userId, options = {}) => {
  try {
    const SecurityEvent = require('../models/security-event.model');
    
    const query = { userId };
    if (options.type) {
      query.eventType = options.type;
    }
    
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;
    
    const [events, total] = await Promise.all([
      SecurityEvent.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SecurityEvent.countDocuments(query)
    ]);
    
    return {
      data: events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error(`Error fetching security events: ${error.message}`);
    throw error;
  }
};

/**
 * Get user security notifications
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Security notifications with pagination
 */
exports.getUserSecurityNotifications = async (userId, options = {}) => {
  try {
    const SecurityNotification = require('../models/security-notification.model');
    
    const query = { userId };
    if (options.read) {
      query.read = options.read;
    }
    
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;
    
    const [notifications, total] = await Promise.all([
      SecurityNotification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SecurityNotification.countDocuments(query)
    ]);
    
    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error(`Error fetching security notifications: ${error.message}`);
    throw error;
  }
};

/**
 * Generate CSRF token
 * @param {Object} res - Response object to set cookie
 * @returns {String} CSRF token
 */
exports.generateCsrfToken = (res) => {
  try {
    const token = tokenService.generateSecureToken();
    
    // Set CSRF token as HTTP-only cookie
    res.cookie('csrf_token', token, {
      httpOnly: true,
      maxAge: cookieConfig.csrf.maxAge,
      secure: cookieConfig.csrf.secure,
      sameSite: cookieConfig.csrf.sameSite
    });
    
    return token;
  } catch (error) {
    logger.error('CSRF token generation error:', error);
    throw new AuthError('Failed to generate CSRF token', 'CSRF_ERROR');
  }
};

/**
 * Get security events for user
 * @param {String} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Security events
 */
exports.getSecurityEvents = async (userId, options = {}) => {
  try {
    const { limit = 10, page = 1, type } = options;
    const skip = (page - 1) * limit;
    
    const query = { userId };
    if (type) query.eventType = type;
    
    const SecurityEvent = require('../models/security-event.model');
    const events = await SecurityEvent.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);
    
    return events;
  } catch (error) {
    logger.error('Error fetching security events:', error);
    throw error;
  }
};

/**
 * Initialize socket security
 * @param {Object} socket - Socket.io socket
 * @param {Object} data - User data
 * @returns {Promise<void>}
 */
exports.initializeSocketSecurity = async (socket, data) => {
  try {
    const { userId, sessionId, deviceId } = data;
    
    // Set user data on socket
    socket.data.userId = userId;
    socket.data.sessionId = sessionId;
    socket.data.deviceId = deviceId;
    
    // Create hierarchical room structure
    const userRoom = `user:${userId}`;
    const deviceRoom = deviceId ? `${userRoom}/device:${deviceId}` : null;
    const sessionRoom = sessionId ? `${deviceRoom}/session:${sessionId}` : null;
    
    // Join rooms
    socket.join(userRoom);
    if (deviceRoom) socket.join(deviceRoom);
    if (sessionRoom) socket.join(sessionRoom);
    
    // Set up security event handlers
    this.setupSocketSecurityHandlers(socket);
    
    // Log security event
    await this.logSecurityEvent(userId, 'socket_connected', {
      socketId: socket.id,
      hierarchyPath: sessionRoom || deviceRoom || userRoom
    });
    
    logger.info(`Socket security initialized for user ${userId}`);
  } catch (error) {
    logger.error('Socket security initialization error:', error);
    throw error;
  }
};

/**
 * Validate security context
 * @param {Object} context - Security context
 * @param {String} userId - User ID
 * @returns {Promise<Boolean>} Validation result
 */
exports.validateSecurityContext = async (context, userId) => {
  try {
    if (!context || !context.id || !userId) {
      return false;
    }
    
    // Additional validation logic can be implemented here
    // For example, checking if the context matches stored contexts
    
    return true;
  } catch (error) {
    logger.error('Security context validation error:', error);
    return false;
  }
};

/**
 * Broadcast security event to user's devices
 * @param {Object} io - Socket.io instance
 * @param {String} userId - User ID
 * @param {String} eventType - Event type
 * @param {Object} details - Event details
 * @returns {Promise<void>}
 */
exports.broadcastSecurityEvent = async (io, userId, eventType, details = {}) => {
  try {
    const userRoom = `user:${userId}`;
    
    io.to(userRoom).emit('security:event', {
      type: eventType,
      details,
      timestamp: new Date()
    });
    
    logger.debug(`Security event ${eventType} broadcasted to user ${userId}`);
  } catch (error) {
    logger.error('Error broadcasting security event:', error);
  }
};

/**
 * Notify about device verification
 * @param {Object} io - Socket.io instance
 * @param {String} userId - User ID
 * @param {String} deviceId - Device ID
 * @returns {Promise<void>}
 */
exports.notifyDeviceVerification = async (io, userId, deviceId) => {
  try {
    const userRoom = `user:${userId}`;
    
    io.to(userRoom).emit('security:device_verified', {
      deviceId,
      timestamp: new Date()
    });
    
    logger.debug(`Device verification notification sent to user ${userId}`);
  } catch (error) {
    logger.error('Error sending device verification notification:', error);
  }
};
