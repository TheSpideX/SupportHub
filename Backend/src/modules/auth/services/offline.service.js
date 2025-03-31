const crypto = require('crypto');
const logger = require('../../../utils/logger');
const User = require('../models/user.model');
const Session = require('../models/session.model');
const tokenService = require('./token.service');
const { auth: authConfig } = require('../../../config');

/**
 * Service for handling offline authentication scenarios
 */
class OfflineAuthService {
  /**
   * Initialize offline authentication service
   */
  initialize() {
    logger.info('Initializing offline authentication service');
    
    // Set up configuration from the new config structure
    this.config = {
      maxOfflineTime: authConfig.offline?.maxOfflineTime || 24 * 60 * 60 * 1000, // 24 hours
      syncStrategy: authConfig.offline?.syncStrategy || 'immediate',
      securityLevel: authConfig.offline?.securityLevel || 'medium',
      tokenExpiryThreshold: authConfig.offline?.tokenExpiryThreshold || 60, // seconds
      enableFingerprinting: authConfig.offline?.enableFingerprinting !== false,
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
      }
    };
    
    logger.info('Offline authentication service initialized', { config: this.config });
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
      const user = await User.findById(userId).select('+securityProfile +passwordUpdatedAt');
      
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
      
      // Create offline package with WebSocket room information
      const offlinePackage = {
        userId: user._id,
        username: user.username,
        offlineToken,
        verificationHash,
        expiresAt,
        permissions: this.getOfflinePermissions(user),
        deviceFingerprint: session.deviceInfo?.fingerprint,
        tokenVersion: user.tokenVersion || 1,
        securityContext: this.getSecurityContext(user, session),
        rooms: this.getWebSocketRooms(user, session),
        version: '1.2'
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
   * Get WebSocket room identifiers for the user
   * @private
   */
  getWebSocketRooms(user, session) {
    return {
      user: `user:${user._id}`,
      device: `device:${session.deviceInfo?.deviceId || 'unknown'}`,
      session: `session:${session._id}`,
      tab: `tab:${session.metadata?.tabId || crypto.randomBytes(8).toString('hex')}`
    };
  }
  
  /**
   * Validate offline authentication data
   * @param {Object} offlinePackage - The offline authentication package
   * @param {Object} deviceInfo - Current device information
   * @returns {Object} - Validation result with session data
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
      
      // Verify device fingerprint if enabled and available
      if (this.config.enableFingerprinting && offlinePackage.deviceFingerprint && deviceInfo?.fingerprint) {
        if (offlinePackage.deviceFingerprint !== deviceInfo.fingerprint) {
          return {
            valid: false,
            reason: 'DEVICE_MISMATCH',
            message: 'Device fingerprint does not match'
          };
        }
      }
      
      // Create session data for client
      const sessionData = {
        userId: offlinePackage.userId,
        username: offlinePackage.username,
        permissions: offlinePackage.permissions,
        expiresAt: new Date(offlinePackage.expiresAt).getTime(),
        createdAt: Date.now(),
        lastActivity: Date.now(),
        id: crypto.randomBytes(16).toString('hex'),
        securityContext: offlinePackage.securityContext || {},
        rooms: offlinePackage.rooms || {},
        metadata: {
          isOffline: true,
          offlineCreatedAt: Date.now(),
          tabId: deviceInfo?.tabId || crypto.randomBytes(8).toString('hex')
        },
        _source: "offline"
      };
      
      return {
        valid: true,
        sessionData,
        offlineToken: offlinePackage.offlineToken
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
   * Get security context for offline use
   * @private
   */
  getSecurityContext(user, session) {
    return {
      level: this.config.securityLevel,
      offlineAccess: true,
      restrictedMode: true,
      lastVerified: Date.now(),
      deviceId: session.deviceInfo?.deviceId,
      origin: 'offline',
      socketRooms: {
        canJoin: ['user', 'device', 'session', 'tab'],
        canPublish: ['tab'],
        canSubscribe: ['user', 'device', 'session', 'tab']
      }
    };
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
      
      // Validate user exists and is active
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found or inactive');
      }
      
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
              
            case 'LOGIN':
            case 'LOGOUT':
            case 'REFRESH':
            case 'SOCKET_CONNECT':
            case 'SOCKET_DISCONNECT':
              // Handle auth-specific actions
              await this.processAuthAction(userId, action);
              results.succeeded++;
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
   * Process auth-specific offline actions
   * @private
   */
  async processAuthAction(userId, action) {
    logger.debug('Processing offline auth action', { userId, actionType: action.type });
    
    switch (action.type) {
      case 'LOGIN':
        // Nothing to do, user is already logged in if they're syncing
        break;
        
      case 'LOGOUT':
        // If user tried to logout while offline, we should invalidate their session now
        if (action.payload?.sessionId) {
          await Session.findOneAndUpdate(
            { _id: action.payload.sessionId, userId },
            { status: 'terminated', terminatedAt: new Date() }
          );
        }
        break;
        
      case 'REFRESH':
        // Nothing to do, token is refreshed during the sync process
        break;
        
      case 'SOCKET_CONNECT':
      case 'SOCKET_DISCONNECT':
        // Log socket connection attempts made while offline
        logger.info('Offline socket connection attempt', {
          userId,
          type: action.type,
          timestamp: action.timestamp,
          deviceInfo: action.payload?.deviceInfo
        });
        break;
    }
    
    return {
      action: action.id,
      success: true,
      timestamp: new Date()
    };
  }
  
  /**
   * Create offline token for authentication
   * @private
   * @param {Object} user - User object
   * @param {Object} session - Session object
   * @returns {String} Offline token
   */
  async createOfflineToken(user, session) {
    try {
      // Create a token with limited capabilities
      const tokenPayload = {
        userId: user._id,
        sessionId: session._id,
        deviceId: session.deviceInfo?.deviceId,
        tokenVersion: user.tokenVersion || 1,
        type: 'offline',
        scope: 'limited',
        exp: Math.floor((Date.now() + this.config.maxOfflineTime) / 1000)
      };
      
      // Sign token with a different secret for offline tokens
      const offlineToken = await tokenService.generateToken(
        tokenPayload,
        authConfig.jwt.offlineSecret || authConfig.jwt.secret,
        { expiresIn: Math.floor(this.config.maxOfflineTime / 1000) }
      );
      
      return offlineToken;
    } catch (error) {
      logger.error('Error creating offline token:', error);
      throw error;
    }
  }
  
  /**
   * Create verification hash for offline authentication
   * @private
   * @param {Object} user - User object
   * @returns {String} Verification hash
   */
  createVerificationHash(user) {
    // Create a hash that can be used to verify the user without storing the actual password
    // This is NOT the password hash, but a secondary verification mechanism
    const data = `${user._id}:${user.passwordUpdatedAt || ''}:${user.tokenVersion || 1}`;
    return crypto
      .createHmac('sha256', authConfig.jwt.secret)
      .update(data)
      .digest('hex');
  }
  
  /**
   * Get offline permissions for a user
   * @private
   * @param {Object} user - User object
   * @returns {Object} Offline permissions
   */
  getOfflinePermissions(user) {
    // Determine which permissions are available offline
    // This is typically a reduced set compared to online permissions
    const basePermissions = user.permissions || {};
    const offlinePermissions = {};
    
    // Filter permissions based on security level
    for (const [key, value] of Object.entries(basePermissions)) {
      if (this.isPermissionAllowedOffline(key, this.config.securityLevel)) {
        offlinePermissions[key] = value;
      }
    }
    
    return {
      ...offlinePermissions,
      offline: true,
      restrictedMode: true
    };
  }
  
  /**
   * Check if a permission is allowed offline
   * @private
   * @param {String} permission - Permission key
   * @param {String} securityLevel - Security level
   * @returns {Boolean} Is allowed
   */
  isPermissionAllowedOffline(permission, securityLevel) {
    // Define permissions allowed at each security level
    const allowedPermissions = {
      low: ['read', 'view', 'access', 'offline'],
      medium: ['read', 'view', 'access', 'offline', 'edit', 'update'],
      high: ['read', 'view', 'access', 'offline', 'edit', 'update', 'create']
    };
    
    // Check if permission is in the allowed list for the security level
    return allowedPermissions[securityLevel]?.some(p => permission.includes(p)) || false;
  }
  
  /**
   * Sign the offline package to prevent tampering
   * @private
   * @param {Object} offlinePackage - Offline authentication package
   * @returns {String} Signature
   */
  signOfflinePackage(offlinePackage) {
    // Create a copy without the signature field
    const packageToSign = { ...offlinePackage };
    delete packageToSign.signature;
    
    // Create signature
    return crypto
      .createHmac('sha256', authConfig.jwt.secret)
      .update(JSON.stringify(packageToSign))
      .digest('hex');
  }
  
  /**
   * Verify the offline package signature
   * @private
   * @param {Object} offlinePackage - Offline authentication package
   * @returns {Boolean} Verification result
   */
  verifyOfflinePackage(offlinePackage) {
    // Extract signature
    const { signature, ...packageToVerify } = offlinePackage;
    
    // Recreate signature
    const expectedSignature = crypto
      .createHmac('sha256', authConfig.jwt.secret)
      .update(JSON.stringify(packageToVerify))
      .digest('hex');
    
    // Compare signatures
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
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
