/**
 * Session Service
 * Manages user sessions, tracking, and synchronization
 */
const crypto = require('crypto');
const { session: sessionConfig, cookie: cookieConfig } = require('../config');
const SessionModel = require('../models/session.model');
const logger = require('../../../utils/logger');

class SessionService {
  /**
   * Create a new session
   * @param {Object} user - User object
   * @param {Object} deviceInfo - Device information
   * @returns {Promise<Object>} Created session
   */
  async createSession(user, deviceInfo = {}) {
    try {
      const userId = user.id || user._id;
      
      // Generate session ID
      const sessionId = this.generateSessionId();
      
      // Check if max sessions reached
      await this.enforceSessionLimit(userId);
      
      // Create session document
      const session = new SessionModel({
        sessionId,
        user: userId,
        userAgent: deviceInfo.userAgent,
        ip: deviceInfo.ip,
        device: {
          type: deviceInfo.deviceType || 'unknown',
          name: deviceInfo.deviceName || 'unknown',
          os: deviceInfo.os || 'unknown',
          browser: deviceInfo.browser || 'unknown'
        },
        lastActive: new Date(),
        expiresAt: new Date(Date.now() + sessionConfig.absoluteTimeout * 1000),
        isActive: true
      });
      
      // Save session
      await session.save();
      
      return session;
    } catch (error) {
      logger.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Generate a unique session ID
   * @returns {String} Session ID
   */
  generateSessionId() {
    return crypto.randomBytes(sessionConfig.idLength / 2).toString('hex');
  }

  /**
   * Enforce session limit per user
   * @param {String} userId - User ID
   */
  async enforceSessionLimit(userId) {
    try {
      // Count active sessions
      const count = await SessionModel.countDocuments({ 
        user: userId, 
        isActive: true 
      });
      
      // If under limit, no action needed
      if (count < sessionConfig.maxConcurrentSessions) {
        return;
      }
      
      // Get oldest sessions to remove
      const oldestSessions = await SessionModel.find({ 
        user: userId, 
        isActive: true 
      })
      .sort({ lastActive: 1 })
      .limit(count - sessionConfig.maxConcurrentSessions + 1);
      
      // Deactivate oldest sessions
      if (oldestSessions.length > 0) {
        const sessionIds = oldestSessions.map(s => s._id);
        await SessionModel.updateMany(
          { _id: { $in: sessionIds } },
          { isActive: false, endedAt: new Date() }
        );
        
        logger.info(`Deactivated ${sessionIds.length} old sessions for user ${userId}`);
      }
    } catch (error) {
      logger.error('Error enforcing session limit:', error);
      throw error;
    }
  }

  /**
   * Get session by ID
   * @param {String} sessionId - Session ID
   * @returns {Promise<Object>} Session object
   */
  async getSessionById(sessionId) {
    try {
      return await SessionModel.findOne({ sessionId, isActive: true });
    } catch (error) {
      logger.error('Error getting session by ID:', error);
      throw error;
    }
  }

  /**
   * Update session activity
   * @param {String} sessionId - Session ID
   * @returns {Promise<Boolean>} Success status
   */
  async updateSessionActivity(sessionId) {
    try {
      const result = await SessionModel.updateOne(
        { sessionId, isActive: true },
        { 
          lastActive: new Date(),
          $inc: { activityCount: 1 }
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('Error updating session activity:', error);
      return false;
    }
  }

  /**
   * End a session
   * @param {String} sessionId - Session ID
   * @param {String} reason - Reason for ending session
   * @returns {Promise<Boolean>} Success status
   */
  async endSession(sessionId, reason = 'user_logout') {
    try {
      const result = await SessionModel.updateOne(
        { sessionId, isActive: true },
        { 
          isActive: false, 
          endedAt: new Date(),
          endReason: reason
        }
      );
      
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('Error ending session:', error);
      return false;
    }
  }

  /**
   * End all sessions for a user
   * @param {String} userId - User ID
   * @param {String} currentSessionId - Current session ID to exclude
   * @param {String} reason - Reason for ending sessions
   * @returns {Promise<Number>} Number of sessions ended
   */
  async endAllUserSessions(userId, currentSessionId = null, reason = 'user_logout_all') {
    try {
      const query = { 
        user: userId, 
        isActive: true 
      };
      
      // Exclude current session if provided
      if (currentSessionId) {
        query.sessionId = { $ne: currentSessionId };
      }
      
      const result = await SessionModel.updateMany(
        query,
        { 
          isActive: false, 
          endedAt: new Date(),
          endReason: reason
        }
      );
      
      return result.modifiedCount;
    } catch (error) {
      logger.error('Error ending all user sessions:', error);
      return 0;
    }
  }

  /**
   * Get all active sessions for a user
   * @param {String} userId - User ID
   * @returns {Promise<Array>} Array of session objects
   */
  async getUserSessions(userId) {
    try {
      return await SessionModel.find({ 
        user: userId, 
        isActive: true 
      })
      .sort({ createdAt: -1 });
    } catch (error) {
      logger.error('Error getting user sessions:', error);
      throw error;
    }
  }

  /**
   * Set session cookie
   * @param {Object} res - Express response object
   * @param {String} sessionId - Session ID
   */
  setSessionCookie(res, sessionId) {
    res.cookie(cookieConfig.names.SESSION_ID, sessionId, {
      ...cookieConfig.baseOptions,
      maxAge: sessionConfig.absoluteTimeout * 1000
    });
  }

  /**
   * Clear session cookie
   * @param {Object} res - Express response object
   */
  clearSessionCookie(res) {
    res.cookie(cookieConfig.names.SESSION_ID, '', {
      ...cookieConfig.baseOptions,
      maxAge: 0
    });
  }

  /**
   * Check if session is expired
   * @param {Object} session - Session object
   * @returns {Boolean} Whether session is expired
   */
  isSessionExpired(session) {
    if (!session || !session.isActive) {
      return true;
    }
    
    // Check absolute timeout
    if (session.expiresAt < new Date()) {
      return true;
    }
    
    // Check idle timeout
    const lastActiveTime = new Date(session.lastActive).getTime();
    const idleTimeMs = Date.now() - lastActiveTime;
    
    return idleTimeMs > sessionConfig.idleTimeout * 1000;
  }

  /**
   * Sync session data
   * @param {String} sessionId - Session ID
   * @param {Object} data - Session data to sync
   * @returns {Promise<Boolean>} Success status
   */
  async syncSessionData(sessionId, data = {}) {
    try {
      // Update session with provided data
      const result = await SessionModel.updateOne(
        { sessionId, isActive: true },
        { 
          lastActive: new Date(),
          $set: { 
            'syncData.lastSynced': new Date(),
            ...Object.entries(data).reduce((acc, [key, value]) => {
              acc[`syncData.${key}`] = value;
              return acc;
            }, {})
          }
        }
      );
      
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('Error syncing session data:', error);
      return false;
    }
  }

  /**
   * Clean up expired sessions
   * @returns {Promise<Number>} Number of sessions cleaned up
   */
  async cleanupExpiredSessions() {
    try {
      // Mark sessions as inactive if they've expired
      const result = await SessionModel.updateMany(
        { 
          isActive: true,
          $or: [
            { expiresAt: { $lt: new Date() } },
            { lastActive: { $lt: new Date(Date.now() - sessionConfig.idleTimeout * 1000) } }
          ]
        },
        { 
          isActive: false,
          endedAt: new Date(),
          endReason: 'expired'
        }
      );
      
      return result.modifiedCount;
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }
}

module.exports = new SessionService();
