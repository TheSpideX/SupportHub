const crypto = require('crypto');
const logger = require('../../../utils/logger');
const User = require('../models/user.model');
const Session = require('../models/session.model');
const tokenService = require('./token.service');
const config = require('../config');

/**
 * Service for handling offline authentication scenarios
 */
class OfflineAuthService {
  /**
   * Initialize offline authentication service
   */
  initialize() {
    logger.info('Initializing offline authentication service');
    
    // Set up configuration
    this.config = {
      maxOfflineTime: config.offline?.maxOfflineTime || 24 * 60 * 60 * 1000, // 24 hours
      syncStrategy: config.offline?.syncStrategy || 'immediate',
      securityLevel: config.offline?.securityLevel || 'medium'
    };
    
    logger.info('Offline authentication service initialized');
  }
  
  /**
   * Generate offline authentication data for a user
   * This creates a secure package that can be used for limited offline authentication
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @returns {Object} - Offline authentication package
   */
  async generateOfflineAuthData(userId, sessionId) {
    try {
      const user = await User.findById(userId).select('+securityProfile');
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const session = await Session.findOne({ _id: sessionId, userId });
      
      if (!session) {
        throw new Error('Session not found');
      }
      
      // Create offline token with limited capabilities
      const offlineToken = await this.createOfflineToken(user, session);
      
      // Create verification hash (not the actual password)
      const verificationHash = this.createVerificationHash(user);
      
      // Generate expiration timestamp
      const expiresAt = new Date(Date.now() + this.config.maxOfflineTime);
      
      // Create offline package
      const offlinePackage = {
        userId: user._id,
        username: user.username,
        offlineToken,
        verificationHash,
        expiresAt,
        permissions: this.getOfflinePermissions(user),
        deviceFingerprint: session.deviceInfo?.fingerprint,
        version: '1.0'
      };
      
      // Sign the package
      offlinePackage.signature = this.signOfflinePackage(offlinePackage);
      
      logger.info('Generated offline authentication package', { userId, sessionId });
      
      return offlinePackage;
    } catch (error) {
      logger.error('Failed to generate offline authentication data:', error);
      throw error;
    }
  }
  
  /**
   * Validate offline authentication data
   * @param {Object} offlinePackage - The offline authentication package
   * @param {Object} deviceInfo - Current device information
   * @returns {Object} - Validation result
   */
  validateOfflineAuthData(offlinePackage, deviceInfo) {
    try {
      // Check if package is expired
      if (new Date(offlinePackage.expiresAt) < new Date()) {
        return {
          valid: false,
          reason: 'EXPIRED',
          message: 'Offline authentication data has expired'
        };
      }
      
      // Verify signature
      if (!this.verifyOfflinePackage(offlinePackage)) {
        return {
          valid: false,
          reason: 'INVALID_SIGNATURE',
          message: 'Offline authentication data has been tampered with'
        };
      }
      
      // Verify device fingerprint if available
      if (offlinePackage.deviceFingerprint && deviceInfo?.fingerprint) {
        if (offlinePackage.deviceFingerprint !== deviceInfo.fingerprint) {
          return {
            valid: false,
            reason: 'DEVICE_MISMATCH',
            message: 'Device fingerprint does not match'
          };
        }
      }
      
      return {
        valid: true,
        userId: offlinePackage.userId,
        username: offlinePackage.username,
        permissions: offlinePackage.permissions,
        expiresAt: offlinePackage.expiresAt
      };
    } catch (error) {
      logger.error('Error validating offline authentication data:', error);
      return {
        valid: false,
        reason: 'VALIDATION_ERROR',
        message: 'Failed to validate offline authentication data'
      };
    }
  }
  
  /**
   * Synchronize offline actions when coming back online
   * @param {string} userId - User ID
   * @param {Array} offlineActions - Actions performed while offline
   * @returns {Object} - Synchronization result
   */
  async synchronizeOfflineActions(userId, offlineActions) {
    try {
      logger.info('Synchronizing offline actions', { userId, actionCount: offlineActions.length });
      
      const results = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        conflicts: 0,
        details: []
      };
      
      // Process each action in sequence
      for (const action of offlineActions) {
        results.processed++;
        
        try {
          // Process based on action type
          switch (action.type) {
            case 'READ':
              // Read actions don't need server-side processing
              results.succeeded++;
              break;
              
            case 'UPDATE':
              // Process update action
              await this.processOfflineUpdate(userId, action);
              results.succeeded++;
              break;
              
            case 'CREATE':
              // Process create action
              const createResult = await this.processOfflineCreate(userId, action);
              if (createResult.conflict) {
                results.conflicts++;
              } else {
                results.succeeded++;
              }
              results.details.push(createResult);
              break;
              
            default:
              logger.warn('Unknown offline action type', { type: action.type });
              results.failed++;
              results.details.push({
                action: action.id,
                success: false,
                reason: 'UNKNOWN_ACTION_TYPE'
              });
          }
        } catch (error) {
          logger.error('Failed to process offline action:', error, { actionId: action.id });
          results.failed++;
          results.details.push({
            action: action.id,
            success: false,
            reason: 'PROCESSING_ERROR',
            message: error.message
          });
        }
      }
      
      logger.info('Offline action synchronization completed', results);
      return results;
    } catch (error) {
      logger.error('Failed to synchronize offline actions:', error);
      throw error;
    }
  }
  
  /**
   * Create an offline token
   * @private
   */
  async createOfflineToken(user, session) {
    // Implementation depends on your token strategy
    const payload = {
      userId: user._id,
      username: user.username,
      type: 'offline',
      scope: 'limited',
      deviceId: session.deviceInfo?.deviceId
    };
    
    return tokenService.signToken(payload, process.env.OFFLINE_TOKEN_SECRET, {
      expiresIn: this.config.maxOfflineTime / 1000 // Convert to seconds
    });
  }
  
  /**
   * Create verification hash (not storing actual password)
   * @private
   */
  createVerificationHash(user) {
    // Create a hash that can be used for limited verification
    // This is NOT the user's password hash
    const data = `${user._id}:${user.passwordUpdatedAt}:${process.env.OFFLINE_HASH_SECRET}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Get permissions available offline
   * @private
   */
  getOfflinePermissions(user) {
    // Determine which permissions are available offline
    // This should be a limited subset of the user's permissions
    const offlinePermissions = [];
    
    // Add basic permissions
    offlinePermissions.push('read:profile');
    offlinePermissions.push('read:settings');
    
    // Add role-based offline permissions
    if (user.role === 'admin') {
      offlinePermissions.push('read:reports');
    }
    
    return offlinePermissions;
  }
  
  /**
   * Sign the offline package to prevent tampering
   * @private
   */
  signOfflinePackage(offlinePackage) {
    // Create a copy without the signature
    const packageCopy = { ...offlinePackage };
    delete packageCopy.signature;
    
    // Create signature
    const data = JSON.stringify(packageCopy);
    return crypto
      .createHmac('sha256', process.env.OFFLINE_PACKAGE_SECRET)
      .update(data)
      .digest('hex');
  }
  
  /**
   * Verify the offline package signature
   * @private
   */
  verifyOfflinePackage(offlinePackage) {
    // Extract the signature
    const providedSignature = offlinePackage.signature;
    
    // Create a copy without the signature
    const packageCopy = { ...offlinePackage };
    delete packageCopy.signature;
    
    // Create expected signature
    const data = JSON.stringify(packageCopy);
    const expectedSignature = crypto
      .createHmac('sha256', process.env.OFFLINE_PACKAGE_SECRET)
      .update(data)
      .digest('hex');
    
    // Compare signatures
    return crypto.timingSafeEqual(
      Buffer.from(providedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }
  
  /**
   * Process offline update action
   * @private
   */
  async processOfflineUpdate(userId, action) {
    // Implementation depends on your data model
    logger.debug('Processing offline update action', { userId, actionId: action.id });
    
    // This is a placeholder implementation
    return {
      action: action.id,
      success: true,
      timestamp: new Date()
    };
  }
  
  /**
   * Process offline create action
   * @private
   */
  async processOfflineCreate(userId, action) {
    // Implementation depends on your data model
    logger.debug('Processing offline create action', { userId, actionId: action.id });
    
    // This is a placeholder implementation
    return {
      action: action.id,
      success: true,
      conflict: false,
      timestamp: new Date()
    };
  }
}

// Export singleton instance
module.exports = new OfflineAuthService();