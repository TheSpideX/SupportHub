const bcrypt = require('bcryptjs');
const { AuthError } = require('../errors');
const TokenService = require('../services/token.service');
const SecurityService = require('./security.service');
const SessionService = require('./session.service');
const User = require('../models/user.model');
const logger = require('../../../utils/logger');

/**
 * Auth Service class for handling authentication operations
 */
class AuthService {
  constructor() {
    this.COMPONENT = 'AuthService';
    
    // Initialize required services
    const UserService = require('../../users/services/user.service');
    this.userService = new UserService();
    
    const TokenService = require('../services/token.service');
    this.tokenService = new TokenService();
    
    const SessionService = require('./session.service');
    this.sessionService = new SessionService();
    
    const SecurityService = require('./security.service');
    this.securityService = new SecurityService();
    
    // Set the user model
    this.userModel = require('../models/user.model');
  }

  /**
   * Authenticate a user with email and password
   */
  async authenticateUser({ email, password, deviceInfo, rememberMe = false }) {
    try {
      logger.info('Authentication attempt', { component: this.COMPONENT, email });
      
      // Ensure deviceInfo is properly structured
      const safeDeviceInfo = deviceInfo || {};
      
      // Check rate limits before authentication
      try {
        await this.securityService.checkRateLimit(email, safeDeviceInfo);
      } catch (error) {
        logger.warn('Rate limit check failed', { 
          component: this.COMPONENT, 
          email,
          errorMessage: error.message || 'Unknown error' 
        });
        throw error; // Re-throw rate limit errors
      }

      // IMPORTANT: Explicitly select the password field
      const user = await this.userModel.findOne({ email }).select('+security.password');
      
      if (!user) {
        // Track failed login attempt for non-existent user
        await this.securityService.trackLoginAttempt(email, safeDeviceInfo, false);
        throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
      }

      // Check if user has a password
      if (!user.security || !user.security.password) {
        logger.error('Authentication failed: User has no password', {
          component: this.COMPONENT,
          userId: user._id
        });
        throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
      }

      // Verify password with extensive debugging
      console.log('DEBUG - Password verification attempt:', {
        email: user.email,
        userId: user._id.toString(),
        passwordProvided: password ? 'Yes' : 'No',
        passwordLength: password?.length || 0,
        hashedPasswordExists: user.security?.password ? 'Yes' : 'No',
        hashedPasswordLength: user.security?.password?.length || 0
      });

      // Try with different bcrypt compare options
      try {
        // Standard compare
        const isPasswordValid = await bcrypt.compare(password, user.security.password);
        
        // Try with trimmed password (in case of whitespace issues)
        const isPasswordValidTrimmed = await bcrypt.compare(password.trim(), user.security.password);
        
        console.log('DEBUG - Password verification results:', {
          standardCompare: isPasswordValid,
          trimmedCompare: isPasswordValidTrimmed
        });
        
        if (!isPasswordValid && !isPasswordValidTrimmed) {
          logger.warn('Authentication failed: Invalid password', { 
            component: this.COMPONENT, 
            userId: user._id 
          });
          
          // Track failed attempt
          await this.securityService.trackLoginAttempt(user._id, safeDeviceInfo, false);
          throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
        }
        
        // Use the successful comparison method
        const finalIsValid = isPasswordValid || isPasswordValidTrimmed;
        
        // If we get here, one of the comparisons worked
        if (finalIsValid) {
          console.log('DEBUG - Password verification succeeded with method:', {
            standardWorked: isPasswordValid,
            trimmedWorked: isPasswordValidTrimmed
          });
        }
      } catch (error) {
        console.error('DEBUG - Bcrypt comparison error:', error);
        throw new AuthError('Authentication error', 'INTERNAL_ERROR');
      }

      // Validate login attempt for suspicious activity
      await this.securityService.validateLoginAttempt(user, safeDeviceInfo);

      // Generate tokens
      const tokenPair = await this.tokenService.generateTokenPair(user, {
        deviceFingerprint: safeDeviceInfo?.fingerprint,
        rememberMe
      });

      // Create or update session
      const session = await this.sessionService.createSession(user._id, safeDeviceInfo, {
        rememberMe,
        refreshToken: tokenPair.refreshToken // Pass refreshToken in options
      });

      // Track successful login
      await this.securityService.trackLoginAttempt(user._id, safeDeviceInfo, true);

      // Prepare user data (exclude sensitive fields)
      const userData = {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        preferences: user.preferences || {}
      };

      // Prepare security context
      const securityContext = {
        lastLogin: new Date(),
        deviceInfo: safeDeviceInfo,
        sessionId: session._id,
        sessionExpiresAt: session.expiresAt
      };

      logger.info('Authentication successful', { 
        component: this.COMPONENT, 
        userId: user._id,
        sessionId: session._id
      });

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        user: userData,
        securityContext
      };
    } catch (error) {
      logger.error('Authentication error', {
        component: this.COMPONENT,
        code: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message || 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Refresh tokens using a valid refresh token
   * @param {String} refreshToken - Current refresh token
   * @param {Object} deviceInfo - Device information
   * @returns {Object} New token pair
   */
  async refreshTokens(refreshToken, deviceInfo) {
    try {
      logger.info('Token refresh attempt', { 
        component: this.COMPONENT,
        deviceFingerprint: deviceInfo?.fingerprint
      });

      // Verify refresh token
      const decoded = await this.tokenService.verifyToken(refreshToken, 'refresh');
      
      // Get user
      const user = await UserModel.findById(decoded.sub);
      if (!user) {
        logger.warn('Token refresh failed: User not found', { 
          component: this.COMPONENT, 
          tokenUserId: decoded.sub 
        });
        throw new AuthError('INVALID_TOKEN');
      }

      // Check token version (for forced logout)
      if (decoded.version !== user.tokenVersion) {
        logger.warn('Token refresh failed: Token version mismatch', { 
          component: this.COMPONENT, 
          userId: user._id,
          tokenVersion: decoded.version,
          userTokenVersion: user.tokenVersion
        });
        throw new AuthError('TOKEN_REVOKED');
      }

      // Validate session
      const session = await this.sessionService.getSessionById(decoded.sessionId);
      if (!session || !session.isActive) {
        logger.warn('Token refresh failed: Invalid session', { 
          component: this.COMPONENT, 
          userId: user._id,
          sessionId: decoded.sessionId
        });
        throw new AuthError('SESSION_EXPIRED');
      }

      // Check device fingerprint if available
      if (decoded.deviceFingerprint && 
          decoded.deviceFingerprint !== deviceInfo?.fingerprint) {
        logger.warn('Token refresh failed: Device fingerprint mismatch', { 
          component: this.COMPONENT, 
          userId: user._id
        });
        throw new AuthError('DEVICE_MISMATCH');
      }

      // Generate new token pair
      const tokenPair = await this.tokenService.generateTokenPair(user, {
        deviceFingerprint: deviceInfo?.fingerprint,
        rememberMe: session.rememberMe,
        sessionId: session._id
      });

      // Update session activity
      await this.sessionService.updateSessionActivity(session._id);

      logger.info('Token refresh successful', { 
        component: this.COMPONENT, 
        userId: user._id,
        sessionId: session._id
      });

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken
      };
    } catch (error) {
      logger.error('Token refresh error', { 
        component: this.COMPONENT, 
        error: error.message,
        code: error.code || 'UNKNOWN_ERROR'
      });
      throw error;
    }
  }

  /**
   * Log out a user by invalidating their session and refresh token
   * @param {String} userId - User ID
   * @param {String} refreshToken - Current refresh token
   * @param {Object} deviceInfo - Device information
   * @param {Boolean} allDevices - Whether to log out from all devices
   * @returns {Boolean} Success indicator
   */
  async logoutUser(userId, refreshToken, deviceInfo, allDevices = false) {
    try {
      logger.info('Logout attempt', { 
        component: this.COMPONENT, 
        userId,
        allDevices
      });

      // If refresh token provided, decode it to get session ID
      let sessionId;
      if (refreshToken) {
        try {
          const decoded = await this.tokenService.verifyToken(refreshToken, 'refresh');
          sessionId = decoded.sessionId;
        } catch (error) {
          // Continue even if token is invalid
          logger.warn('Invalid refresh token during logout', { 
            component: this.COMPONENT, 
            userId,
            error: error.message
          });
        }
      }

      // Blacklist the refresh token
      if (refreshToken) {
        await this.tokenService.blacklistToken(refreshToken);
      }

      // Terminate session(s)
      if (allDevices) {
        // Terminate all sessions and increment token version
        await this.sessionService.terminateAllSessions(userId);
        await UserModel.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
        
        logger.info('All sessions terminated', { component: this.COMPONENT, userId });
      } else if (sessionId) {
        // Terminate specific session
        await this.sessionService.terminateSession(sessionId);
        
        logger.info('Session terminated', { 
          component: this.COMPONENT, 
          userId,
          sessionId
        });
      }

      return true;
    } catch (error) {
      logger.error('Logout error', { 
        component: this.COMPONENT, 
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate a user session
   * @param {String} sessionId - Session ID
   * @param {Object} deviceInfo - Device information
   * @returns {Object} Session validation result
   */
  async validateSession(sessionId, deviceInfo) {
    try {
      logger.info('Session validation', { 
        component: this.COMPONENT, 
        sessionId,
        deviceFingerprint: deviceInfo?.fingerprint
      });

      const session = await this.sessionService.getSessionById(sessionId);
      
      if (!session) {
        logger.warn('Session validation failed: Session not found', { 
          component: this.COMPONENT, 
          sessionId 
        });
        return { isValid: false };
      }

      // Check if session is active
      if (!session.isActive) {
        logger.warn('Session validation failed: Session inactive', { 
          component: this.COMPONENT, 
          sessionId,
          userId: session.userId
        });
        return { isValid: false };
      }

      // Check if session has expired
      if (new Date() > session.expiresAt) {
        logger.warn('Session validation failed: Session expired', { 
          component: this.COMPONENT, 
          sessionId,
          userId: session.userId
        });
        
        // Terminate expired session
        await this.sessionService.terminateSession(sessionId);
        return { isValid: false };
      }

      // Check device fingerprint if available
      if (session.deviceFingerprint && 
          session.deviceFingerprint !== deviceInfo?.fingerprint) {
        logger.warn('Session validation failed: Device fingerprint mismatch', { 
          component: this.COMPONENT, 
          sessionId,
          userId: session.userId
        });
        return { isValid: false, reason: 'DEVICE_MISMATCH' };
      }

      // Update session activity
      await this.sessionService.updateSessionActivity(sessionId);

      logger.info('Session validation successful', { 
        component: this.COMPONENT, 
        sessionId,
        userId: session.userId
      });

      return {
        isValid: true,
        expiresAt: session.expiresAt,
        userId: session.userId,
        deviceInfo: session.deviceInfo
      };
    } catch (error) {
      logger.error('Session validation error', { 
        component: this.COMPONENT, 
        sessionId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new AuthService();
