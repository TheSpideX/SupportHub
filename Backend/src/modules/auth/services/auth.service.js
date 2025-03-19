const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const Session = require('../models/session.model');
const config = require('../config');
const { AuthError } = require('../../../utils/errors');
const logger = require('../../../utils/logger');
const SecurityService = require('./security.service');

const COMPONENT = 'AuthService';

class AuthService {
  /**
   * Auth Service Constructor
   * @param {Object} dependencies - Service dependencies
   * @param {Object} dependencies.userModel - User model
   * @param {Object} dependencies.sessionModel - Session model
   * @param {Object} dependencies.securityService - Security service
   * @param {Object} dependencies.config - Auth configuration
   */
  constructor(dependencies = {}) {
    this.userModel = dependencies.userModel || User;
    this.sessionModel = dependencies.sessionModel || Session; // Make sure Session model is imported
    this.securityService = dependencies.securityService || new SecurityService();
    this.config = dependencies.config || config;
    this.auditService = dependencies.auditService;
    
    // Validate required dependencies
    if (!this.userModel) {
      logger.error('User model not provided to AuthService', {
        component: COMPONENT
      });
    }
    
    if (!this.sessionModel) {
      logger.error('Session model not provided to AuthService', {
        component: COMPONENT
      });
    }
    
    logger.info('AuthService initialized with SecurityService', {
      component: COMPONENT
    });
  }

  /**
   * Authenticate a user with email and password
   * @param {Object} credentials - User credentials
   * @param {string} credentials.email - User email
   * @param {string} credentials.password - User password
   * @param {boolean} credentials.rememberMe - Whether to remember the user
   * @param {Object} deviceInfo - Device information
   * @returns {Promise<Object>} - Authenticated user and session
   */
  async authenticateUser(credentials, deviceInfo = {}) {
    // If credentials is passed as a single object with all properties
    const { email, password, rememberMe = false, deviceInfo: credentialsDeviceInfo } = credentials;
    
    // Use deviceInfo from credentials if provided, otherwise use the second parameter
    const finalDeviceInfo = credentialsDeviceInfo || deviceInfo;
    
    try {
      // Find user by email WITH password field explicitly selected
      const user = await User.findOne({ email }).select('+security.password');
      
      console.log('DEBUG - User found:', {
        found: !!user,
        userId: user?._id,
        hasSecurityObject: !!user?.security,
        hasPasswordField: !!user?.security?.password,
        passwordFieldType: typeof user?.security?.password,
        passwordLength: user?.security?.password?.length || 0
      });
      
      // If user not found, delay response and throw error
      if (!user) {
        await this._handleFailedAttempt(email, finalDeviceInfo);
        throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
      }
      
      // Check if account is locked
      if (user.security.lockUntil && user.security.lockUntil > Date.now()) {
        const remainingTime = Math.ceil((user.security.lockUntil - Date.now()) / 1000 / 60);
        throw new AuthError(
          `Account is locked. Try again in ${remainingTime} minutes`, 
          'ACCOUNT_LOCKED'
        );
      }
      
      // Debug password comparison
      console.log('DEBUG - Before password comparison:', {
        passwordInput: password.substring(0, 4) + '...',
        storedPasswordExists: !!user.security.password,
        storedPasswordType: typeof user.security.password,
        storedPasswordPreview: user.security.password ? 
          user.security.password.substring(0, 10) + '...' : 'N/A'
      });
      
      // Compare passwords
      try {
        const isMatch = await user.comparePassword(password);
        
        if (!isMatch) {
          await user.incrementLoginAttempts();
          await this._handleFailedAttempt(email, finalDeviceInfo);
          throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
        }
        
        // Reset login attempts on successful login
        await user.resetLoginAttempts();
        
        // Validate login attempt for suspicious activity
        await this.securityService.validateLoginAttempt(user, finalDeviceInfo);
        
        // Create or update session with the rememberMe value from credentials
        const session = await this._createSession(user._id, finalDeviceInfo, { rememberMe });
        
        // Return authenticated user and session
        return {
          user,
          session
        };
      } catch (error) {
        console.log('DEBUG - Password comparison error details:', {
          errorMessage: error.message,
          errorName: error.name,
          errorStack: error.stack
        });
        
        logger.error('Password comparison error', {
          component: COMPONENT,
          error: error.message,
          userId: user._id
        });
        
        throw new AuthError('Authentication error', 'INTERNAL_ERROR');
      }
    } catch (error) {
      if (!(error instanceof AuthError)) {
        logger.error('Authentication error', { 
          component: COMPONENT, 
          email,
          error: error.message 
        });
        throw new AuthError('Authentication failed', 'AUTHENTICATION_ERROR');
      }
      throw error;
    }
  }
  
  /**
   * Register a new user
   * @param {Object} userData - User data
   * @returns {Object} Created user
   */
  async registerUser({ email, password, firstName, lastName, deviceInfo }) {
    try {
      // Check if email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new AuthError('Email already in use', 'EMAIL_IN_USE');
      }
      
      // Validate password against policy
      await this._validatePassword(password);
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user
      const user = await User.create({
        email,
        firstName,
        lastName,
        security: {
          password: hashedPassword,
          tokenVersion: 0,
          loginAttempts: 0,
          lastLogin: null
        }
      });
      
      // Log security event
      await securityService.logSecurityEvent('USER_REGISTERED', {
        userId: user._id,
        deviceInfo
      });
      
      return user;
    } catch (error) {
      if (!(error instanceof AuthError)) {
        logger.error('User registration error', { 
          component: COMPONENT, 
          email,
          error: error.message 
        });
        throw new AuthError('Registration failed', 'REGISTRATION_ERROR');
      }
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
        component: COMPONENT,
        deviceFingerprint: deviceInfo?.fingerprint
      });

      // Verify refresh token
      const decoded = await tokenService.verifyToken(refreshToken, 'refresh');
      
      // Get user
      const user = await User.findById(decoded.sub);
      if (!user) {
        logger.warn('Token refresh failed: User not found', { 
          component: COMPONENT, 
          tokenUserId: decoded.sub 
        });
        throw new AuthError('INVALID_TOKEN');
      }

      // Check token version (for forced logout)
      if (decoded.version !== user.security.tokenVersion) {
        logger.warn('Token refresh failed: Token version mismatch', { 
          component: COMPONENT, 
          userId: user._id,
          tokenVersion: decoded.version,
          userTokenVersion: user.security.tokenVersion
        });
        throw new AuthError('TOKEN_REVOKED');
      }

      // Validate session
      const session = await Session.findById(decoded.sessionId);
      if (!session || !session.isActive) {
        logger.warn('Token refresh failed: Invalid session', { 
          component: COMPONENT, 
          userId: user._id,
          sessionId: decoded.sessionId
        });
        throw new AuthError('SESSION_EXPIRED');
      }

      // Check device fingerprint if available
      if (decoded.deviceFingerprint && 
          decoded.deviceFingerprint !== deviceInfo?.fingerprint) {
        logger.warn('Token refresh failed: Device fingerprint mismatch', { 
          component: COMPONENT, 
          userId: user._id
        });
        throw new AuthError('DEVICE_MISMATCH');
      }

      // Generate new token pair
      const tokenPair = await tokenService.generateTokenPair(user, {
        deviceFingerprint: deviceInfo?.fingerprint,
        rememberMe: session.rememberMe,
        sessionId: session._id
      });

      // Update session activity
      await Session.findByIdAndUpdate(session._id, { lastActive: Date.now() });

      logger.info('Token refresh successful', { 
        component: COMPONENT, 
        userId: user._id,
        sessionId: session._id
      });

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken
      };
    } catch (error) {
      logger.error('Token refresh error', { 
        component: COMPONENT, 
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
        component: COMPONENT, 
        userId,
        allDevices
      });

      // If refresh token provided, decode it to get session ID
      let sessionId;
      if (refreshToken) {
        try {
          const decoded = await tokenService.verifyToken(refreshToken, 'refresh');
          sessionId = decoded.sessionId;
        } catch (error) {
          // Continue even if token is invalid
          logger.warn('Invalid refresh token during logout', { 
            component: COMPONENT, 
            userId,
            error: error.message
          });
        }
      }

      // Blacklist the refresh token
      if (refreshToken) {
        await tokenService.blacklistToken(refreshToken);
      }

      // Terminate session(s)
      if (allDevices) {
        // Terminate all sessions and increment token version
        await Session.deleteMany({ userId });
        await User.findByIdAndUpdate(userId, { $inc: { 'security.tokenVersion': 1 } });
        
        logger.info('All sessions terminated', { component: COMPONENT, userId });
      } else if (sessionId) {
        // Terminate specific session
        await Session.findByIdAndDelete(sessionId);
        
        logger.info('Session terminated', { 
          component: COMPONENT, 
          userId,
          sessionId
        });
      }

      return true;
    } catch (error) {
      logger.error('Logout error', { 
        component: COMPONENT, 
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
        component: COMPONENT, 
        sessionId,
        deviceFingerprint: deviceInfo?.fingerprint
      });

      const session = await Session.findById(sessionId);
      
      if (!session) {
        logger.warn('Session validation failed: Session not found', { 
          component: COMPONENT, 
          sessionId 
        });
        return { isValid: false };
      }

      // Check if session is active
      if (!session.isActive) {
        logger.warn('Session validation failed: Session inactive', { 
          component: COMPONENT, 
          sessionId,
          userId: session.userId
        });
        return { isValid: false };
      }

      // Check if session has expired
      if (new Date() > session.expiresAt) {
        logger.warn('Session validation failed: Session expired', { 
          component: COMPONENT, 
          sessionId,
          userId: session.userId
        });
        
        // Terminate expired session
        await Session.findByIdAndDelete(sessionId);
        return { isValid: false };
      }

      // Check device fingerprint if available
      if (session.deviceFingerprint && 
          session.deviceFingerprint !== deviceInfo?.fingerprint) {
        logger.warn('Session validation failed: Device fingerprint mismatch', { 
          component: COMPONENT, 
          sessionId,
          userId: session.userId
        });
        return { isValid: false, reason: 'DEVICE_MISMATCH' };
      }

      // Update session activity
      await Session.findByIdAndUpdate(sessionId, { lastActive: Date.now() });

      logger.info('Session validation successful', { 
        component: COMPONENT, 
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
        component: COMPONENT, 
        sessionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Logout a user and invalidate their tokens
   * @param {Object} params - Logout parameters
   * @returns {Boolean} Success status
   */
  async logoutUser({ userId, sessionId, allDevices = false }) {
    try {
      logger.info('Logout attempt', { component: COMPONENT, userId });
      
      if (allDevices) {
        // Invalidate all sessions for this user
        await Session.updateMany(
          { userId },
          { status: 'terminated', terminatedAt: new Date() }
        );
        
        // Increment token version to invalidate all tokens
        await User.findByIdAndUpdate(userId, {
          $inc: { 'security.tokenVersion': 1 }
        });
        
        logger.info('Logged out from all devices', { component: COMPONENT, userId });
      } else if (sessionId) {
        // Invalidate specific session
        await Session.findByIdAndUpdate(
          sessionId,
          { status: 'terminated', terminatedAt: new Date() }
        );
        
        logger.info('Logged out from specific session', { 
          component: COMPONENT, 
          userId,
          sessionId 
        });
      }
      
      return true;
    } catch (error) {
      logger.error('Logout error', { 
        component: COMPONENT, 
        userId,
        error: error.message 
      });
      throw new AuthError('Logout failed', 'LOGOUT_ERROR');
    }
  }

  /**
   * Verify email with verification token
   * @param {String} token - Email verification token
   * @returns {Object} Verification result
   */
  async verifyEmail(token) {
    try {
      // Find verification record
      const verification = await EmailVerification.findOne({ token });
      
      if (!verification) {
        throw new AuthError('Invalid verification token', 'INVALID_TOKEN');
      }
      
      // Check if token is expired
      if (verification.expiresAt < new Date()) {
        throw new AuthError('Verification token expired', 'TOKEN_EXPIRED');
      }
      
      // Update user's email verification status
      await User.findByIdAndUpdate(verification.userId, {
        'emailVerified': true
      });
      
      // Delete verification record
      await EmailVerification.deleteOne({ _id: verification._id });
      
      return { success: true };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Email verification failed', 'VERIFICATION_ERROR');
    }
  }

  /**
   * Sanitize user object for client response
   * @param {Object} user - User document
   * @returns {Object} Sanitized user object
   */
  sanitizeUser(user) {
    if (!user) return null;
    
    // Create a clean user object without sensitive data
    const sanitizedUser = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role || 'user',
      emailVerified: user.emailVerified || false,
      twoFactorEnabled: user.security?.twoFactorEnabled || false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
    
    return sanitizedUser;
  }

  /**
   * Create or update a user session
   * @param {string} userId - User ID
   * @param {Object} deviceInfo - Device information
   * @param {Object} options - Session options
   * @param {boolean} options.rememberMe - Whether to remember the session
   * @returns {Promise<Object>} - Created or updated session
   * @private
   */
  async _createSession(userId, deviceInfo, options = {}) {
    const { rememberMe = false } = options;
    
    try {
      // Get session configuration
      const sessionConfig = this.config.session || {};
      
      // Calculate session expiry based on rememberMe flag
      const expiresAt = new Date();
      const sessionDuration = rememberMe 
        ? (sessionConfig.extendedSessionTimeout || 7 * 24 * 60 * 60) // 7 days for remember me
        : (sessionConfig.sessionTimeout || 24 * 60 * 60); // 24 hours for regular session
      
      expiresAt.setSeconds(expiresAt.getSeconds() + sessionDuration);
      
      // Create a new session document
      const session = await this.sessionModel.create({
        userId,
        deviceInfo: {
          fingerprint: deviceInfo.fingerprint,
          userAgent: deviceInfo.userAgent,
          ip: deviceInfo.ip || '0.0.0.0',
          location: deviceInfo.location || {}
        },
        isActive: true,
        expiresAt,
        rememberMe
      });
      
      return session;
    } catch (error) {
      logger.error('Failed to create session', {
        component: COMPONENT,
        userId,
        error: error.message
      });
      throw new AuthError('Failed to create session', 'SESSION_CREATION_FAILED');
    }
  }
}

module.exports = new AuthService();
