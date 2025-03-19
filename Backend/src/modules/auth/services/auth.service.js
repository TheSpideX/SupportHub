/**
 * Auth Service
 * Handles authentication operations and coordinates between token and session services
 */
const bcrypt = require('bcryptjs');
const User = require('../models/user.model'); // Updated path to user model
const tokenService = require('./token.service');
const sessionService = require('./session.service');
const { security: securityConfig } = require('../config');
const logger = require('../../../utils/logger');
const { AuthError } = require('../../../utils/errors');

class AuthService {
  /**
   * Login a user
   * @param {String} email - User email
   * @param {String} password - User password
   * @param {Object} deviceInfo - Device information
   * @returns {Promise<Object>} User and tokens
   */
  async login(email, password, deviceInfo = {}) {
    try {
      // Find user by email
      const user = await User.findOne({ email });
      
      if (!user) {
        throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
      }
      
      // Check if account is locked
      if (user.isLocked) {
        const lockUntil = new Date(user.lockUntil);
        if (lockUntil > new Date()) {
          throw new AuthError(
            `Account locked until ${lockUntil.toISOString()}`,
            'ACCOUNT_LOCKED'
          );
        }
        // If lock has expired, unlock the account
        user.isLocked = false;
        user.lockUntil = null;
        user.failedLoginAttempts = 0;
        await user.save();
      }
      
      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        // Increment failed login attempts
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        
        // Check if account should be locked
        if (user.failedLoginAttempts >= securityConfig.lockout.maxAttempts) {
          user.isLocked = true;
          user.lockUntil = new Date(Date.now() + securityConfig.lockout.durationMinutes * 60 * 1000);
          await user.save();
          
          throw new AuthError(
            `Account locked due to too many failed attempts. Try again after ${securityConfig.lockout.durationMinutes} minutes.`,
            'ACCOUNT_LOCKED'
          );
        }
        
        await user.save();
        throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
      }
      
      // Reset failed login attempts
      if (user.failedLoginAttempts > 0) {
        user.failedLoginAttempts = 0;
        await user.save();
      }
      
      // Generate tokens
      const tokens = await tokenService.generateAuthTokens(user);
      
      // Create session
      const session = await sessionService.createSession(user, deviceInfo);
      
      // Return user data and tokens
      return {
        user: this.sanitizeUser(user),
        tokens,
        session
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Register a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user
   */
  async register(userData) {
    try {
      // Check if email already exists
      const existingUser = await User.findOne({ email: userData.email });
      
      if (existingUser) {
        throw new AuthError('Email already in use', 'EMAIL_IN_USE');
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // Create user
      const user = new User({
        ...userData,
        password: hashedPassword,
        tokenVersion: 0,
        failedLoginAttempts: 0,
        isLocked: false,
        isActive: true
      });
      
      await user.save();
      
      return this.sanitizeUser(user);
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Logout a user
   * @param {String} refreshToken - Refresh token
   * @param {String} sessionId - Session ID
   * @returns {Promise<Boolean>} Success status
   */
  async logout(refreshToken, sessionId) {
    try {
      // Delete refresh token
      if (refreshToken) {
        await tokenService.deleteRefreshToken(refreshToken);
      }
      
      // End session
      if (sessionId) {
        await sessionService.endSession(sessionId, 'user_logout');
      }
      
      return true;
    } catch (error) {
      logger.error('Logout error:', error);
      return false;
    }
  }

  /**
   * Logout from all devices
   * @param {String} userId - User ID
   * @param {String} currentSessionId - Current session ID to exclude
   * @returns {Promise<Boolean>} Success status
   */
  async logoutAll(userId, currentSessionId = null) {
    try {
      // Delete all refresh tokens
      await tokenService.deleteAllUserTokens(userId);
      
      // End all sessions except current
      await sessionService.endAllUserSessions(userId, currentSessionId, 'user_logout_all');
      
      return true;
    } catch (error) {
      logger.error('Logout all error:', error);
      return false;
    }
  }

  /**
   * Refresh tokens
   * @param {String} refreshToken - Refresh token
   * @param {String} sessionId - Session ID
   * @returns {Promise<Object>} New tokens
   */
  async refreshTokens(refreshToken, sessionId) {
    try {
      // Verify refresh token
      const decoded = tokenService.verifyRefreshToken(refreshToken);
      
      // Get user
      const user = await User.findById(decoded.sub);
      
      if (!user) {
        throw new AuthError('User not found', 'USER_NOT_FOUND');
      }
      
      // Verify token version
      if (user.tokenVersion !== decoded.tokenVersion) {
        throw new AuthError('Token revoked', 'TOKEN_REVOKED');
      }
      
      // Verify session
      if (sessionId) {
        const session = await sessionService.getSessionById(sessionId);
        
        if (!session) {
          throw new AuthError('Session not found', 'SESSION_NOT_FOUND');
        }
        
        if (sessionService.isSessionExpired(session)) {
          await sessionService.endSession(sessionId, 'session_expired');
          throw new AuthError('Session expired', 'SESSION_EXPIRED');
        }
        
        // Update session activity
        await sessionService.updateSessionActivity(sessionId);
      }
      
      // Rotate refresh token
      const tokens = await tokenService.rotateRefreshToken(refreshToken, user);
      
      return { tokens, user: this.sanitizeUser(user) };
    } catch (error) {
      logger.error('Refresh tokens error:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {String} userId - User ID
   * @returns {Promise<Object>} User object
   */
  async getUserById(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new AuthError('User not found', 'USER_NOT_FOUND');
      }
      
      return this.sanitizeUser(user);
    } catch (error) {
      logger.error('Get user by ID error:', error);
      throw error;
    }
  }

  /**
   * Change password
   * @param {String} userId - User ID
   * @param {String} currentPassword - Current password
   * @param {String} newPassword - New password
   * @returns {Promise<Boolean>} Success status
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new AuthError('User not found', 'USER_NOT_FOUND');
      }
      
      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      
      if (!isPasswordValid) {
        throw new AuthError('Current password is incorrect', 'INVALID_PASSWORD');
      }
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password and increment token version to invalidate existing tokens
      user.password = hashedPassword;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      user.passwordChangedAt = new Date();
      
      await user.save();
      
      // Invalidate all tokens and sessions
      await tokenService.deleteAllUserTokens(userId);
      await sessionService.endAllUserSessions(userId, null, 'password_changed');
      
      return true;
    } catch (error) {
      logger.error('Change password error:', error);
      throw error;
    }
  }

  /**
   * Request password reset
   * @param {String} email - User email
   * @returns {Promise<Object>} Reset token info
   */
  async requestPasswordReset(email) {
    try {
      const user = await User.findOne({ email });
      
      if (!user) {
        // Return success even if user not found for security
        return { success: true };
      }
      
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = Date.now() + 3600000; // 1 hour
      
      // Hash token for storage
      const hashedResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
      
      // Save to user
      user.resetToken = hashedResetToken;
      user.resetTokenExpiry = resetTokenExpiry;
      await user.save();
      
      return {
        success: true,
        userId: user._id,
        resetToken,
        expiry: resetTokenExpiry
      };
    } catch (error) {
      logger.error('Request password reset error:', error);
      throw error;
    }
  }

  /**
   * Reset password with token
   * @param {String} resetToken - Reset token
   * @param {String} newPassword - New password
   * @returns {Promise<Boolean>} Success status
   */
  async resetPassword(resetToken, newPassword) {
    try {
      // Hash token for comparison
      const hashedResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
      
      // Find user with valid token
      const user = await User.findOne({
        resetToken: hashedResetToken,
        resetTokenExpiry: { $gt: Date.now() }
      });
      
      if (!user) {
        throw new AuthError('Invalid or expired reset token', 'INVALID_RESET_TOKEN');
      }
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update user
      user.password = hashedPassword;
      user.resetToken = undefined;
      user.resetTokenExpiry = undefined;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      user.passwordChangedAt = new Date();
      
      await user.save();
      
      // Invalidate all tokens and sessions
      await tokenService.deleteAllUserTokens(user._id);
      await sessionService.endAllUserSessions(user._id, null, 'password_reset');
      
      return true;
    } catch (error) {
      logger.error('Reset password error:', error);
      throw error;
    }
  }

  /**
   * Sanitize user object for client response
   * @param {Object} user - User object
   * @returns {Object} Sanitized user object
   */
  sanitizeUser(user) {
    const sanitized = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      permissions: user.permissions || [],
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
    
    // Add additional fields if they exist
    if (user.profileImage) sanitized.profileImage = user.profileImage;
    if (user.lastLogin) sanitized.lastLogin = user.lastLogin;
    if (user.preferences) sanitized.preferences = user.preferences;
    
    return sanitized;
  }
}

module.exports = new AuthService();
