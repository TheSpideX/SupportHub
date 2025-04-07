/**
 * Auth Service
 * Handles authentication operations and coordinates between token and session services
 */
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/user.model");
const tokenService = require("./token.service");
const sessionService = require("./session.service");
const securityService = require("./security.service");
const socketService = require("./socket.service");
const config = require("../config");
const { security: securityConfig, cookie: cookieConfig } = config;
const { roomRegistry } = config;
const logger = require("../../../utils/logger");
const { AuthError } = require("../../../utils/errors");
const deviceService = require("./device.service");

class AuthService {
  constructor() {
    // Cookie configuration
    this.cookieConfig = {
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      },
      tokenCookieName: "auth_token",
      refreshCookieName: "refresh_token",
      csrfCookieName: "csrf_token",
      sessionCookieName: "session_id",
    };

    logger.info("Auth service initialized with cookie support");
  }

  /**
   * Set authentication cookies
   * @param {Object} res - Express response object
   * @param {Object} tokens - Token data
   * @param {Object} options - Additional options
   */
  setAuthCookies(res, tokens, options = {}) {
    const { accessToken, refreshToken, csrfToken, sessionId } = tokens;
    const { maxAge, rememberMe } = options;

    // Calculate expiration times
    const accessExpires = maxAge || config.auth.jwt.expiresIn * 1000;
    const refreshExpires = rememberMe
      ? config.auth.jwt.refreshExpiresIn * 1000
      : accessExpires;

    // Set access token cookie
    res.cookie(this.cookieConfig.tokenCookieName, accessToken, {
      ...this.cookieConfig.cookieOptions,
      maxAge: accessExpires,
    });

    // Set refresh token cookie
    res.cookie(this.cookieConfig.refreshCookieName, refreshToken, {
      ...this.cookieConfig.cookieOptions,
      maxAge: refreshExpires,
    });

    // Set CSRF token cookie (not httpOnly so JS can access it)
    if (csrfToken) {
      res.cookie(this.cookieConfig.csrfCookieName, csrfToken, {
        ...this.cookieConfig.cookieOptions,
        httpOnly: false,
        maxAge: accessExpires,
      });
    }

    // Set session ID cookie
    if (sessionId) {
      res.cookie(this.cookieConfig.sessionCookieName, sessionId, {
        ...this.cookieConfig.cookieOptions,
        maxAge: refreshExpires,
      });
    }

    logger.debug("Auth cookies set successfully");
  }

  /**
   * Clear authentication cookies
   * @param {Object} res - Express response object
   */
  clearAuthCookies(res) {
    // Clear all auth cookies
    res.clearCookie(
      this.cookieConfig.tokenCookieName,
      this.cookieConfig.cookieOptions
    );
    res.clearCookie(
      this.cookieConfig.refreshCookieName,
      this.cookieConfig.cookieOptions
    );
    res.clearCookie(this.cookieConfig.csrfCookieName, {
      ...this.cookieConfig.cookieOptions,
      httpOnly: false,
    });
    res.clearCookie(
      this.cookieConfig.sessionCookieName,
      this.cookieConfig.cookieOptions
    );

    logger.debug("Auth cookies cleared successfully");
  }

  /**
   * Login a user with HTTP-only cookie support
   * @param {String} email - User email
   * @param {String} password - User password
   * @param {Object} deviceInfo - Device information
   * @param {Boolean} rememberMe - Whether to extend token lifetime
   * @param {Object} res - Express response object for setting cookies
   * @returns {Promise<Object>} User and session data (tokens handled via cookies)
   */
  async login(email, password, deviceInfo = {}, rememberMe = false, res) {
    try {
      // Find user by email - select the security.password field
      const user = await User.findOne({ email }).select("+security.password");

      if (!user) {
        throw new AuthError("Invalid email or password", "INVALID_CREDENTIALS");
      }

      // Check if user has a password in the security object
      if (!user.security || !user.security.password) {
        logger.error(`User ${user._id} has no password set`);
        throw new AuthError("Account configuration error", "ACCOUNT_ERROR");
      }

      // Verify password - ensure both arguments are defined
      if (!password) {
        throw new AuthError("Password is required", "INVALID_CREDENTIALS");
      }

      // Check if account is locked
      if (user.security.lockUntil && user.security.lockUntil > new Date()) {
        throw new AuthError(
          `Account locked until ${user.security.lockUntil.toISOString()}`,
          "ACCOUNT_LOCKED"
        );
      }

      // Verify password using the security.password field
      const isPasswordValid = await bcrypt.compare(
        password,
        user.security.password
      );

      if (!isPasswordValid) {
        // Increment failed login attempts
        user.security.loginAttempts = (user.security.loginAttempts || 0) + 1;

        // Check if account should be locked
        if (user.security.loginAttempts >= securityConfig.lockout.maxAttempts) {
          user.security.lockUntil = new Date(
            Date.now() + securityConfig.lockout.durationMinutes * 60 * 1000
          );
          await user.save();

          throw new AuthError(
            `Account locked due to too many failed attempts. Try again after ${securityConfig.lockout.durationMinutes} minutes.`,
            "ACCOUNT_LOCKED"
          );
        }

        await user.save();
        throw new AuthError("Invalid email or password", "INVALID_CREDENTIALS");
      }

      // Reset login attempts on successful login
      user.security.loginAttempts = 0;
      if (user.security.lockUntil) {
        user.security.lockUntil = null;
      }
      await user.save();

      // Process device information - delegate to device service
      let deviceSecurityContext = {};
      if (deviceInfo) {
        // Record device info for security tracking
        const deviceRecord = await deviceService.recordDeviceInfo(
          user._id,
          deviceInfo
        );

        // Assess device security
        deviceSecurityContext = await deviceService.assessDeviceSecurity(
          user._id,
          deviceInfo
        );

        // Add device info to the security context
        deviceInfo.deviceId = deviceRecord.deviceId;
        deviceInfo.securityContext = deviceSecurityContext;
      }

      // Generate tokens with security context
      const tokens = await tokenService.generateAuthTokens(user, {
        rememberMe,
        deviceInfo,
        securityContext: {
          device: deviceInfo,
          ...deviceSecurityContext,
        },
      });

      // Create session
      const session = await sessionService.createSession({
        userId: user._id,
        userAgent: deviceInfo.userAgent || "unknown",
        ipAddress: deviceInfo.ip || "unknown",
        deviceInfo: deviceInfo,
        rememberMe,
      });

      // Set HTTP-only cookies with tokens
      if (res) {
        this.setAuthCookies(
          res,
          {
            ...tokens,
            sessionId: session.id,
          },
          { rememberMe }
        );
      }

      // Return user data and session info
      return {
        user: this.sanitizeUser(user),
        session: {
          id: session.id,
          expiresAt: session.expiresAt,
        },
      };
    } catch (error) {
      logger.error("Login error:", error);
      throw error;
    }
  }

  /**
   * Validate session
   * @param {String} sessionId - Session ID
   * @param {String} userId - User ID
   * @param {Object} deviceInfo - Current device information
   * @returns {Promise<Object>} Session validation result
   */
  async validateSession(sessionId, userId, deviceInfo = {}) {
    try {
      if (!sessionId || !userId) {
        throw new AuthError("Invalid session parameters", "INVALID_SESSION");
      }

      // Get session
      const session = await sessionService.getSessionById(sessionId);

      if (!session) {
        throw new AuthError("Session not found", "SESSION_NOT_FOUND");
      }

      // Verify session belongs to user
      if (session.userId.toString() !== userId.toString()) {
        throw new AuthError("Session user mismatch", "SESSION_USER_MISMATCH");
      }

      // Check if session is expired
      if (sessionService.isSessionExpired(session)) {
        await sessionService.endSession(sessionId, "session_expired");
        throw new AuthError("Session expired", "SESSION_EXPIRED");
      }

      // Verify device fingerprint if available
      if (
        deviceInfo.fingerprint &&
        session.deviceInfo &&
        session.deviceInfo.fingerprint
      ) {
        if (deviceInfo.fingerprint !== session.deviceInfo.fingerprint) {
          logger.warn(`Device fingerprint mismatch for session ${sessionId}`);
          // Update security risk level but don't invalidate yet
          await sessionService.updateSessionSecurityStatus(sessionId, {
            riskLevel: "medium",
            riskFactors: ["device_fingerprint_changed"],
          });
        }
      }

      // Get user
      const user = await User.findById(userId);

      if (!user) {
        throw new AuthError("User not found", "USER_NOT_FOUND");
      }

      // Update session activity
      await sessionService.updateSessionActivity(sessionId, deviceInfo);

      return {
        isValid: true,
        user: this.sanitizeUser(user),
        session: {
          id: session._id,
          expiresAt: session.expiresAt,
          lastActivity: session.lastActivity,
          deviceId: session.deviceId,
          securityStatus: session.securityStatus || { riskLevel: "low" },
        },
      };
    } catch (error) {
      logger.error("Session validation error:", error);
      return {
        isValid: false,
        error: error.code || "VALIDATION_ERROR",
      };
    }
  }

  /**
   * Refresh tokens
   * @param {String} refreshToken - Refresh token (from cookie or request)
   * @param {String} sessionId - Session ID
   * @param {Object} deviceInfo - Current device information
   * @param {Object} res - Express response object for setting cookies
   * @returns {Promise<Object>} New tokens
   */
  async refreshToken(refreshToken, sessionId, deviceInfo = {}, res) {
    try {
      // Verify refresh token
      const decoded = tokenService.verifyRefreshToken(refreshToken);

      // Get user
      const user = await User.findById(decoded.sub);

      if (!user) {
        throw new AuthError("User not found", "USER_NOT_FOUND");
      }

      // Verify token version
      if (user.security.tokenVersion !== decoded.tokenVersion) {
        throw new AuthError("Token revoked", "TOKEN_REVOKED");
      }

      // Verify session
      if (sessionId) {
        const session = await sessionService.getSessionById(sessionId);

        if (!session) {
          throw new AuthError("Session not found", "SESSION_NOT_FOUND");
        }

        if (sessionService.isSessionExpired(session)) {
          await sessionService.endSession(sessionId, "session_expired");
          throw new AuthError("Session expired", "SESSION_EXPIRED");
        }

        // Verify device fingerprint if available
        if (
          deviceInfo.fingerprint &&
          session.deviceInfo &&
          session.deviceInfo.fingerprint
        ) {
          if (deviceInfo.fingerprint !== session.deviceInfo.fingerprint) {
            logger.warn(
              `Device fingerprint mismatch during token refresh for session ${sessionId}`
            );
            // Update security risk level
            await sessionService.updateSessionSecurityStatus(sessionId, {
              riskLevel: "high",
              riskFactors: ["device_fingerprint_changed_during_refresh"],
            });
          }
        }

        // Update session activity
        await sessionService.updateSessionActivity(sessionId, deviceInfo);
      }

      // Rotate refresh token
      const tokens = await tokenService.rotateRefreshToken(refreshToken, user);

      // Set HTTP-only cookies with new tokens
      if (res) {
        this.setAuthCookies(
          res,
          {
            ...tokens,
            sessionId: sessionId,
          },
          { rememberMe: true }
        );
      }

      // Notify other sessions about the token refresh if WebSocket is enabled
      if (sessionId && securityConfig.notifyTokenRefresh) {
        await sessionService.notifyUserSessions(
          user._id,
          sessionId,
          "token_refreshed",
          {
            timestamp: new Date(),
            deviceInfo: sessionService.sanitizeDeviceInfo(deviceInfo),
          }
        );
      }

      return {
        // Only include tokens in response if no response object was provided
        ...(res ? { csrfToken: tokens.csrfToken } : { tokens }),
        user: this.sanitizeUser(user),
        sessionUpdated: !!sessionId,
        tokenRefreshedAt: new Date(),
      };
    } catch (error) {
      logger.error("Refresh tokens error:", error);
      throw error;
    }
  }

  /**
   * Logout a user
   * @param {String} sessionId - Session ID
   * @param {Object} options - Logout options
   * @param {Object} res - Express response object for clearing cookies
   * @returns {Promise<Boolean>} Success status
   */
  async logout(sessionId, options = {}, res) {
    try {
      if (!sessionId) {
        return false;
      }

      // Get session to verify it exists
      const session = await sessionService.getSessionById(sessionId);

      if (!session) {
        logger.warn(`Logout attempted for non-existent session: ${sessionId}`);
        return false;
      }

      // End session
      await sessionService.endSession(
        sessionId,
        options.reason || "user_logout"
      );

      // Clear auth cookies if response object is provided
      if (res) {
        this.clearAuthCookies(res);
      }

      // Notify other sessions if requested
      if (options.notifyOtherSessions) {
        await sessionService.notifyUserSessions(
          session.userId,
          sessionId,
          "logout",
          {
            initiatedBy: sessionId,
            timestamp: new Date(),
            reason: options.reason || "user_logout",
          }
        );
      }

      // Invalidate refresh token if provided
      if (options.refreshToken) {
        await tokenService.revokeRefreshToken(options.refreshToken);
      }

      return true;
    } catch (error) {
      logger.error("Logout error:", error);
      return false;
    }
  }

  /**
   * Logout from all devices
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} - Success status
   */
  async logoutAllDevices(userId) {
    try {
      if (!userId) {
        throw new Error("User ID is required");
      }

      // Get all active sessions for the user
      const sessions = await sessionService.getUserSessions(userId);
      logger.info(
        `Logging out user ${userId} from ${sessions.length} sessions`
      );

      // Terminate all sessions
      for (const session of sessions) {
        await sessionService.terminateSession(
          session._id || session.id,
          userId,
          "logout_all_devices",
          { initiatedBy: "user", timestamp: new Date() }
        );
      }

      // Increment token version to invalidate all tokens
      await User.findByIdAndUpdate(userId, {
        $inc: { "security.tokenVersion": 1 },
      });

      // Record security event
      await sessionService.recordSecurityEvent(
        userId,
        null,
        "security:logout_all_devices",
        "medium",
        { timestamp: new Date() }
      );

      return true;
    } catch (error) {
      logger.error("Logout all devices error:", error);
      return false;
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
        throw new AuthError("User not found", "USER_NOT_FOUND");
      }

      return this.sanitizeUser(user);
    } catch (error) {
      logger.error("Get user by ID error:", error);
      throw error;
    }
  }

  /**
   * Change password
   * @param {String} userId - User ID
   * @param {String} currentPassword - Current password
   * @param {String} newPassword - New password
   * @param {Object} options - Additional options
   * @param {Object} res - Express response object for clearing cookies
   * @returns {Promise<Boolean>} Success status
   */
  async changePassword(
    userId,
    currentPassword,
    newPassword,
    options = {},
    res
  ) {
    try {
      const user = await User.findById(userId).select("+security.password");

      if (!user) {
        throw new AuthError("User not found", "USER_NOT_FOUND");
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.security.password
      );

      if (!isPasswordValid) {
        throw new AuthError(
          "Current password is incorrect",
          "INVALID_PASSWORD"
        );
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password and increment token version to invalidate existing tokens
      user.security.password = hashedPassword;
      user.security.tokenVersion = (user.security.tokenVersion || 0) + 1;
      user.security.passwordChangedAt = new Date();

      await user.save();

      // Invalidate all tokens and sessions except current one if keepCurrentSession is true
      await tokenService.deleteAllUserTokens(userId);

      if (options.keepCurrentSession && options.currentSessionId) {
        await sessionService.endAllUserSessions(
          userId,
          options.currentSessionId,
          "password_changed"
        );
      } else {
        await sessionService.endAllUserSessions(
          userId,
          null,
          "password_changed"
        );

        // Clear auth cookies if response object is provided
        if (res) {
          this.clearAuthCookies(res);
        }
      }

      // Notify all user's devices about password change
      await securityService.handlePasswordChanged(
        userId,
        options.keepCurrentSession ? options.currentSessionId : null
      );

      return true;
    } catch (error) {
      logger.error("Change password error:", error);
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
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpiry =
        Date.now() + securityConfig.resetToken.expiryMinutes * 60 * 1000;

      // Hash token for storage
      const hashedResetToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      // Update user with reset token
      user.security = {
        ...user.security,
        resetToken: hashedResetToken,
        resetTokenExpiry: new Date(resetTokenExpiry),
      };

      await user.save();

      // Log security event
      await securityService.logSecurityEvent(
        user._id,
        "password_reset_requested",
        {
          timestamp: new Date(),
          email: user.email,
        }
      );

      return {
        success: true,
        resetToken,
        userId: user._id,
        expiresAt: new Date(resetTokenExpiry),
      };
    } catch (error) {
      logger.error("Request password reset error:", error);
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
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      // Find user with valid token
      const user = await User.findOne({
        "security.resetToken": hashedResetToken,
        "security.resetTokenExpiry": { $gt: Date.now() },
      });

      if (!user) {
        throw new AuthError(
          "Invalid or expired reset token",
          "INVALID_RESET_TOKEN"
        );
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update user
      user.security.password = hashedPassword;
      user.security.resetToken = undefined;
      user.security.resetTokenExpiry = undefined;
      user.security.tokenVersion = (user.security.tokenVersion || 0) + 1;
      user.security.passwordChangedAt = new Date();

      await user.save();

      // Invalidate all tokens and sessions
      await tokenService.deleteAllUserTokens(user._id);
      await sessionService.endAllUserSessions(user._id, null, "password_reset");

      // Notify all user's devices about password reset
      await securityService.broadcastSecurityEvent(
        user._id,
        "password_reset_completed",
        { timestamp: new Date() }
      );

      return true;
    } catch (error) {
      logger.error("Reset password error:", error);
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
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    };

    // Add additional fields if they exist
    if (user.profileImage) sanitized.profileImage = user.profileImage;
    if (user.preferences) sanitized.preferences = user.preferences;

    return sanitized;
  }

  /**
   * Extract authentication data from request
   * @param {Object} req - Express request object
   * @returns {Object} Authentication data
   */
  extractAuthFromRequest(req) {
    // Extract tokens from cookies
    const accessToken = req.cookies[this.cookieConfig.tokenCookieName];
    const refreshToken = req.cookies[this.cookieConfig.refreshCookieName];
    const csrfToken =
      req.cookies[this.cookieConfig.csrfCookieName] ||
      req.headers["x-csrf-token"];
    const sessionId =
      req.cookies[this.cookieConfig.sessionCookieName] ||
      req.headers["x-session-id"];

    return {
      tokens: { accessToken, refreshToken },
      csrfToken,
      sessionId,
    };
  }

  /**
   * Validate request authentication
   * @param {Object} req - Express request object
   * @returns {Promise<Object>} Validation result
   */
  async validateRequestAuth(req) {
    try {
      const { tokens, sessionId } = this.extractAuthFromRequest(req);

      if (!tokens || !tokens.accessToken) {
        return { isValid: false, error: "NO_ACCESS_TOKEN" };
      }

      // Verify access token
      const decoded = await tokenService.verifyAccessToken(tokens.accessToken);

      if (!decoded) {
        // Try to refresh using refresh token if available
        if (tokens.refreshToken) {
          return {
            isValid: false,
            error: "ACCESS_TOKEN_EXPIRED",
            canRefresh: true,
          };
        }

        return { isValid: false, error: "INVALID_ACCESS_TOKEN" };
      }

      // Validate session if session ID is available
      if (sessionId) {
        const deviceInfo = {
          userAgent: req.headers["user-agent"],
          ip: req.ip,
          fingerprint: req.headers["x-device-fingerprint"],
        };

        const sessionValidation = await this.validateSession(
          sessionId,
          decoded.sub,
          deviceInfo
        );

        if (!sessionValidation.isValid) {
          return {
            isValid: false,
            error: sessionValidation.error || "INVALID_SESSION",
          };
        }

        return {
          isValid: true,
          user: sessionValidation.user,
          session: sessionValidation.session,
          tokenData: decoded,
        };
      }

      // If no session ID, just return the token data
      const user = await this.getUserById(decoded.sub);

      return {
        isValid: true,
        user,
        tokenData: decoded,
      };
    } catch (error) {
      logger.error("Validate request auth error:", error);
      return { isValid: false, error: "AUTH_VALIDATION_ERROR" };
    }
  }
}

module.exports = new AuthService();
