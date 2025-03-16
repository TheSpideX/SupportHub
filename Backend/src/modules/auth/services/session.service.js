const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../../utils/logger');
const config = require('../config');
const securityConfig = config.security;
const geoip = require('geoip-lite');

// Import the Session model instead of redefining it
const Session = require('../models/session.model');

class SessionService {
  /**
   * Create a new session or update existing one
   * @param {string} userId - User ID
   * @param {Object} deviceInfo - Device information
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created or updated session
   */
  async createSession(userId, deviceInfo, options = {}) {
    try {
      const { rememberMe = false, refreshToken = null } = options;
      logger.info('Creating/updating session', { userId, deviceFingerprint: deviceInfo.fingerprint });
      
      // Check if session already exists for this device
      let session = await Session.findOne({
        user: userId,
        'deviceInfo.fingerprint': deviceInfo.fingerprint,
        isActive: true
      });

      // Calculate expiry date based on config
      const sessionDuration = rememberMe 
        ? securityConfig.session.extendedSessionTimeout || (7 * 24 * 60 * 60) // 7 days for remember me
        : securityConfig.session.sessionTimeout || (24 * 60 * 60); // 24 hours default
      
      const expiryDate = new Date(Date.now() + sessionDuration * 1000);

      // Resolve location from IP if available
      let location = deviceInfo.location;
      if (deviceInfo.ip && !location) {
        const geoData = geoip.lookup(deviceInfo.ip);
        if (geoData) {
          location = {
            city: geoData.city,
            country: geoData.country,
            coordinates: {
              latitude: geoData.ll[0],
              longitude: geoData.ll[1]
            }
          };
        }
      }

      // Create security context
      const securityContext = {
        ipAddress: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        createdAt: new Date(),
        rememberMe
      };

      if (session) {
        // Update existing session
        session.refreshToken = refreshToken;
        session.lastActivity = new Date();
        session.expiresAt = expiryDate;
        session.deviceInfo.userAgent = deviceInfo.userAgent || session.deviceInfo.userAgent;
        session.deviceInfo.ip = deviceInfo.ip || session.deviceInfo.ip;
        if (location) {
          session.deviceInfo.location = location;
        }
        session.securityContext = securityContext;
        await session.save();
        
        logger.info('Session updated', { sessionId: session._id, userId });
        return session;
      }

      // Create new session
      session = await Session.create({
        user: userId,
        deviceInfo: {
          fingerprint: deviceInfo.fingerprint,
          userAgent: deviceInfo.userAgent,
          ip: deviceInfo.ip,
          location
        },
        refreshToken,
        expiresAt: expiryDate,
        securityContext,
        metadata: {
          sessionId: uuidv4(),
          rememberMe,
          timezone: options.timezone,
          locale: options.locale
        }
      });

      logger.info('New session created', { sessionId: session._id, userId });
      return session;
    } catch (error) {
      logger.error('Error creating/updating session:', error);
      throw error;
    }
  }

  /**
   * Get active session by refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object|null>} Session object or null
   */
  async getSessionByRefreshToken(refreshToken) {
    return Session.findOne({
      refreshToken,
      isActive: true,
      expiresAt: { $gt: new Date() }
    }).populate('user', 'email username role lastLogin');
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Session object or null
   */
  async getSessionById(sessionId) {
    return Session.findById(sessionId)
      .populate('user', 'email username role lastLogin');
  }

  /**
   * Validate a session
   * @param {string} sessionId - Session ID
   * @param {Object} deviceInfo - Device information
   * @returns {Promise<Object>} Validation result
   */
  async validateSession(sessionId, deviceInfo) {
    try {
      logger.debug('Session validation started', { 
        component: 'SessionService',
        sessionId,
        deviceFingerprint: deviceInfo?.fingerprint ? 'Present' : 'Missing'
      });
      
      const session = await this.getSessionById(sessionId);
      
      logger.debug('Session lookup result', {
        component: 'SessionService',
        sessionId,
        sessionFound: !!session,
        isActive: session?.isActive,
        expiresAt: session?.expiresAt
      });
      
      if (!session) {
        logger.warn('Session validation failed: Session not found', { 
          component: 'SessionService',
          sessionId 
        });
        return { isValid: false, reason: 'SESSION_NOT_FOUND' };
      }

      // Check if session is active
      if (!session.isActive) {
        logger.warn('Session validation failed: Session inactive', { 
          component: 'SessionService',
          sessionId,
          endReason: session.endReason,
          endedAt: session.endedAt
        });
        return { isValid: false, reason: 'SESSION_INACTIVE' };
      }

      // Check if session has expired
      const now = new Date();
      const isExpired = now > session.expiresAt;
      
      logger.debug('Session expiration check', {
        component: 'SessionService',
        sessionId,
        currentTime: now.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        isExpired,
        timeRemaining: isExpired ? 'Expired' : `${Math.floor((session.expiresAt - now) / 1000)} seconds`
      });
      
      if (isExpired) {
        logger.warn('Session validation failed: Session expired', { 
          component: 'SessionService',
          sessionId,
          expiresAt: session.expiresAt,
          currentTime: now
        });
        await this.terminateSession(sessionId, 'expired');
        return { isValid: false, reason: 'SESSION_EXPIRED' };
      }

      // Check if securityConfig is defined
      const enforceDeviceBinding = typeof securityConfig !== 'undefined' && 
                                  securityConfig?.session?.enforceDeviceBinding;
      
      logger.debug('Device binding check configuration', {
        component: 'SessionService',
        securityConfigExists: typeof securityConfig !== 'undefined',
        enforceDeviceBinding,
        deviceFingerprintProvided: !!deviceInfo?.fingerprint,
        sessionDeviceFingerprint: session.deviceInfo.fingerprint
      });

      // Check device fingerprint if available and enforced
      if (enforceDeviceBinding && 
          deviceInfo?.fingerprint && 
          session.deviceInfo.fingerprint !== deviceInfo.fingerprint) {
        logger.warn('Session validation failed: Device fingerprint mismatch', { 
          component: 'SessionService',
          sessionId,
          expectedFingerprint: session.deviceInfo.fingerprint,
          providedFingerprint: deviceInfo.fingerprint
        });
        return { isValid: false, reason: 'DEVICE_MISMATCH' };
      }

      // Update last activity
      session.lastActivity = new Date();
      await session.save();
      
      logger.debug('Session validated successfully', {
        component: 'SessionService',
        sessionId,
        userId: session.user,
        lastActivity: session.lastActivity
      });

      return { 
        isValid: true, 
        session: {
          id: session._id,
          user: session.user,
          expiresAt: session.expiresAt,
          deviceInfo: session.deviceInfo,
          metadata: session.metadata
        }
      };
    } catch (error) {
      logger.error('Error validating session', {
        component: 'SessionService',
        sessionId,
        error: error.message,
        stack: error.stack
      });
      return { isValid: false, reason: 'VALIDATION_ERROR', error: error.message };
    }
  }

  /**
   * Terminate a session
   * @param {string} sessionId - Session ID
   * @param {string} reason - Reason for termination
   * @returns {Promise<Object|null>} Updated session or null
   */
  async terminateSession(sessionId, reason = 'logout') {
    try {
      const session = await Session.findById(sessionId);
      
      if (!session) {
        logger.warn('Session termination failed: Session not found', { sessionId });
        return null;
      }
      
      session.isActive = false;
      session.endedAt = new Date();
      session.endReason = reason;
      await session.save();
      
      logger.info('Session terminated', { sessionId, reason });
      return session;
    } catch (error) {
      logger.error('Error terminating session:', error);
      throw error;
    }
  }

  /**
   * Terminate all active sessions for a user
   * @param {string} userId - User ID
   * @param {Object} options - Options for termination
   * @returns {Promise<number>} Number of terminated sessions
   */
  async terminateAllSessions(userId, options = {}) {
    try {
      const { exceptSessionId, reason = 'terminated' } = options;
      
      const query = {
        user: userId,
        isActive: true
      };
      
      // Exclude current session if specified
      if (exceptSessionId) {
        query._id = { $ne: exceptSessionId };
      }
      
      const result = await Session.updateMany(query, {
        isActive: false,
        endedAt: new Date(),
        endReason: reason
      });
      
      logger.info('All sessions terminated for user', { 
        userId, 
        count: result.modifiedCount,
        exceptSessionId
      });
      
      return result.modifiedCount;
    } catch (error) {
      logger.error('Error terminating all sessions:', error);
      throw error;
    }
  }

  /**
   * Get all active sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of active sessions
   */
  async getActiveSessions(userId) {
    try {
      return Session.find({
        user: userId,
        isActive: true,
        expiresAt: { $gt: new Date() }
      }).select('-refreshToken');
    } catch (error) {
      logger.error('Error getting active sessions:', error);
      throw error;
    }
  }

  /**
   * Update session activity
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Updated session or null
   */
  async updateSessionActivity(sessionId) {
    try {
      const session = await Session.findById(sessionId);
      
      if (!session || !session.isActive) {
        return null;
      }
      
      session.lastActivity = new Date();
      await session.save();
      
      return session;
    } catch (error) {
      logger.error('Error updating session activity:', error);
      return null;
    }
  }

  /**
   * Extend session expiry
   * @param {string} sessionId - Session ID
   * @param {number} extensionSeconds - Seconds to extend
   * @returns {Promise<Object|null>} Updated session or null
   */
  async extendSession(sessionId, extensionSeconds = 3600) {
    try {
      const session = await Session.findById(sessionId);
      
      if (!session || !session.isActive) {
        return null;
      }
      
      // Calculate new expiry date
      const newExpiryDate = new Date(session.expiresAt);
      newExpiryDate.setSeconds(newExpiryDate.getSeconds() + extensionSeconds);
      
      session.expiresAt = newExpiryDate;
      await session.save();
      
      logger.info('Session extended', { sessionId, newExpiryDate });
      return session;
    } catch (error) {
      logger.error('Error extending session:', error);
      return null;
    }
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<number>} Number of cleaned sessions
   */
  async cleanupExpiredSessions() {
    try {
      const result = await Session.updateMany(
        { 
          isActive: true, 
          expiresAt: { $lt: new Date() } 
        },
        {
          isActive: false,
          endedAt: new Date(),
          endReason: 'expired'
        }
      );
      
      logger.info('Cleaned up expired sessions', { count: result.modifiedCount });
      return result.modifiedCount;
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
      throw error;
    }
  }

  /**
   * Sync session with frontend
   * @param {Object} syncData - Session sync data
   * @returns {Promise<Object>} Sync result
   */
  async syncSession(syncData) {
    try {
      const { sessionId, lastActivity, metrics } = syncData;
      
      const session = await Session.findOne({
        'metadata.sessionId': sessionId,
        isActive: true
      });
      
      if (!session) {
        return { status: 'invalid', reason: 'SESSION_NOT_FOUND' };
      }
      
      // Update last activity
      session.lastActivity = new Date(lastActivity);
      
      // Store metrics if provided
      if (metrics) {
        session.metadata.metrics = {
          ...session.metadata.metrics,
          ...metrics
        };
      }
      
      await session.save();
      
      // Check if session needs to be terminated for security reasons
      const securityCheck = await this.performSecurityCheck(session);
      if (!securityCheck.isValid) {
        await this.terminateSession(session._id, 'security_concern');
        return { status: 'terminated', reason: securityCheck.reason };
      }
      
      return { status: 'valid', expiresAt: session.expiresAt };
    } catch (error) {
      logger.error('Error syncing session:', error);
      return { status: 'error', reason: 'SYNC_ERROR' };
    }
  }

  /**
   * Perform security check on session
   * @param {Object} session - Session object
   * @returns {Promise<Object>} Security check result
   */
  async performSecurityCheck(session) {
    // This would implement security checks like:
    // - Suspicious location changes
    // - Multiple concurrent sessions
    // - Unusual activity patterns
    
    // For now, just a basic implementation
    return { isValid: true };
  }

  /**
   * Update session metadata
   * @param {string} sessionId - Session ID
   * @param {Object} metadata - Metadata to update
   * @returns {Promise<Object|null>} Updated session or null
   */
  async updateSessionMetadata(sessionId, metadata) {
    try {
      const session = await Session.findById(sessionId);
      
      if (!session || !session.isActive) {
        return null;
      }
      
      session.metadata = {
        ...session.metadata,
        ...metadata
      };
      
      await session.save();
      return session;
    } catch (error) {
      logger.error('Error updating session metadata:', error);
      return null;
    }
  }
}

module.exports = SessionService;
