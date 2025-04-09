const { asyncHandler } = require("../../../utils/errorHandlers");
const { AppError } = require("../../../utils/errors");
const User = require("../models/user.model");
const Session = require("../models/session.model");
const tokenService = require("../services/token.service");
const sessionService = require("../services/session.service");
const emailService = require("../services/email.service");
const securityService = require("../services/security.service");
const authService = require("../services/auth.service");
const deviceService = require("../services/device.service");
const socketService = require("../services/socket.service");
const authConfig = require("../config");
const { token: tokenConfig, cookie: cookieConfig } = authConfig;
const authUtils = require("../utils/auth.utils");
const { passwordPolicy } = require("../config");
const { requireEmailVerification } = authConfig;
const logger = require("../../../utils/logger");
const { EVENT_NAMES } = require("../constants/event-names.constant");
const eventPropagationService = require("../services/event-propagation.service");

/**
 * Register a new user
 */
exports.register = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  // Use auth service to handle registration
  const { user, verificationToken } = await authService.registerUser({
    email,
    password,
    firstName,
    lastName,
  });

  // Send verification email if required
  if (requireEmailVerification) {
    await emailService.sendVerificationEmail(user.email, {
      name: user.firstName,
      verificationUrl: `${authConfig.clientUrl}/auth/verify-email?token=${verificationToken}`,
    });
  }

  // Return success without logging in the user
  res.status(201).json({
    status: "success",
    message: requireEmailVerification
      ? "User registered successfully. Please verify your email."
      : "User registered successfully.",
    data: {
      userId: user._id,
      email: user.email,
      emailVerified: user.security.emailVerified,
    },
  });
});

/**
 * Login user
 * @route POST /api/auth/login
 */
exports.login = asyncHandler(async (req, res) => {
  const {
    email,
    password,
    rememberMe = false,
    deviceInfo: clientDeviceInfo,
    deviceId,
    tabId, // Extract tabId from request body
  } = req.body;

  // Log the deviceId for debugging
  logger.debug(`Login attempt with deviceId: ${deviceId}`, {
    deviceId,
    hasDeviceInfo: !!clientDeviceInfo,
    clientDeviceId: clientDeviceInfo?.deviceId || "none",
  });

  // Combine client-provided device info with server-detected info
  const deviceInfo = {
    // Server-detected info as fallback
    userAgent: req.headers["user-agent"],
    ipAddress: req.ip,
    isMobile: /mobile|android|iphone|ipad|ipod/i.test(
      req.headers["user-agent"] || ""
    ),
    isTablet: /tablet|ipad/i.test(req.headers["user-agent"] || ""),
    isDesktop: !/mobile|android|iphone|ipad|ipod|tablet/i.test(
      req.headers["user-agent"] || ""
    ),
    // Override with client-provided info if available
    ...(clientDeviceInfo || {}),
    // Ensure deviceId is set in deviceInfo
    deviceId: deviceId,
    // Add tabId to deviceInfo
    tabId: tabId,
  };

  // Log the tabId for debugging
  logger.debug(`Login attempt with tabId: ${tabId}`, {
    tabId,
    deviceId,
  });

  // Authenticate user through auth service
  // Pass the response object to the login function so it can set cookies directly
  const result = await authService.login(
    email,
    password,
    deviceInfo,
    rememberMe,
    res,
    deviceId,
    tabId // Pass tabId to the login function
  );

  // Set tokens in HTTP-only cookies if not already set by the auth service
  if (result.tokens && !res.headersSent) {
    // Use the improved setTokenCookies method that also sets app_session_exists
    tokenService.setTokenCookies(res, result.tokens, {
      sessionExpiry: result.session.expiresAt,
      rememberMe: result.session.rememberMe || false,
    });

    logger.info("Set auth cookies during login", {
      userId: result.user._id,
      sessionId: result.session._id,
      expiresAt: result.session.expiresAt,
      rememberMe: result.session.rememberMe || false,
    });
  }

  // Register device if it's new
  if (result.session.deviceId && !result.isKnownDevice) {
    // Notify user about new device login via WebSocket to other devices
    const userRoom = socketService.createRoomName("user", result.user._id);
    if (req.app.primus) {
      // Use Primus to send the notification
      req.app.primus.forEach(function (spark) {
        if (spark.rooms && spark.rooms.has(userRoom)) {
          spark.write({
            event: EVENT_NAMES.NEW_DEVICE_LOGIN,
            deviceId: result.session.deviceId,
            deviceInfo,
            timestamp: Date.now(),
          });
        }
      });
    }
  }

  // Schedule token expiration check for the access token
  if (req.app.primus && result.tokens && result.tokens.accessToken) {
    // Log that we're scheduling a token expiration check
    logger.info(
      `Scheduling token expiration check for user ${result.user._id}`,
      {
        userId: result.user._id,
        sessionId: result.session._id,
        deviceId: result.session.deviceId,
      }
    );

    // Schedule the token expiration check with a shorter warning threshold (60 seconds)
    tokenService.scheduleTokenExpirationCheck(
      req.app.primus,
      result.user._id,
      result.tokens.accessToken,
      result.session._id,
      60 // 1 minute warning
    );
  }

  // Return session metadata for frontend
  return res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: authService.sanitizeUser(result.user),
      session: {
        id: result.session._id,
        expiresAt: result.session.expiresAt,
        lastActivity: result.session.lastActiveAt,
        deviceId: result.session.deviceId,
      },
      requiresTwoFactor: result.requiresTwoFactor,
      requiresNewDeviceVerification: result.requiresDeviceVerification,
    },
  });
});

/**
 * Verify two-factor authentication
 */
exports.verifyTwoFactor = asyncHandler(async (req, res) => {
  const {
    tempToken,
    twoFactorCode,
    rememberMe = false,
    deviceInfo: clientDeviceInfo,
    deviceId,
  } = req.body;

  // Combine client-provided device info with server-detected info
  const deviceInfo = {
    // Server-detected info as fallback
    userAgent: req.headers["user-agent"],
    ipAddress: req.ip,
    isMobile: /mobile|android|iphone|ipad|ipod/i.test(
      req.headers["user-agent"] || ""
    ),
    isTablet: /tablet|ipad/i.test(req.headers["user-agent"] || ""),
    isDesktop: !/mobile|android|iphone|ipad|ipod|tablet/i.test(
      req.headers["user-agent"] || ""
    ),
    rememberMe,
    // Override with client-provided info if available
    ...(clientDeviceInfo || {}),
  };

  // Verify 2FA through auth service
  const result = await authService.verifyTwoFactor(
    tempToken,
    twoFactorCode,
    deviceInfo,
    deviceId
  );

  // Set tokens in HTTP-only cookies
  tokenService.setTokenCookies(res, result.tokens);

  // Return user data
  res.status(200).json({
    status: "success",
    message: "Two-factor authentication successful",
    data: {
      user: authService.sanitizeUser(result.user),
      session: {
        id: result.session._id,
        expiresAt: result.session.expiresAt,
        lastActivity: result.session.lastActiveAt,
        deviceId: result.session.deviceId,
      },
    },
  });
});

/**
 * Refresh tokens
 * @route POST /api/auth/token/refresh
 */
exports.refreshToken = async (req, res) => {
  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies[cookieConfig.names.REFRESH_TOKEN];
    const { deviceId } = req.body;

    if (!refreshToken) {
      logger.warn("No refresh token found in cookies");
      return res.status(401).json({
        status: "error",
        message: "No refresh token provided",
      });
    }

    // Refresh tokens using the token service
    const {
      accessToken,
      refreshToken: newRefreshToken,
      session,
    } = await tokenService.refreshToken(refreshToken, deviceId);

    // Set cookies using the token service
    tokenService.setTokenCookies(res, {
      accessToken,
      refreshToken: newRefreshToken,
    });

    // Notify other tabs about token refresh via WebSocket
    if (req.io && session.userId) {
      const sessionRoom = socketService.createRoomName("session", session.id);
      req.io.to(sessionRoom).emit(EVENT_NAMES.TOKEN_REFRESHED, {
        sessionId: session.id,
        timestamp: Date.now(),
      });
    }

    return res.status(200).json({
      status: "success",
      data: {
        session: {
          id: session.id,
          expiresAt: session.expiresAt,
        },
      },
    });
  } catch (error) {
    logger.error("Token refresh error:", error);

    // Clear cookies on error
    tokenService.clearTokenCookies(res);

    return res.status(401).json({
      status: "error",
      message: error.message || "Token refresh failed",
    });
  }
};

/**
 * Check if user is authenticated
 * @route GET /api/auth/check
 * @access Private - Requires authentication
 */
exports.checkAuth = asyncHandler(async (req, res) => {
  // If middleware passes, user is authenticated
  res.status(200).json({
    success: true,
    authenticated: true,
    message: "User is authenticated",
    data: {
      user: authService.sanitizeUser(req.user),
    },
  });
});

/**
 * Logout user
 * @route POST /api/auth/logout
 */
exports.logout = asyncHandler(async (req, res) => {
  // Get session ID from request
  const sessionId = req.session?._id || req.user?.sessionId;
  const userId = req.user?._id;

  if (sessionId && userId) {
    // Use session service to handle logout
    await sessionService.terminateSession(sessionId, userId, "user_logout");

    // If WebSocket is available, notify other tabs/devices
    if (req.io && req.user) {
      const userRoom = socketService.createRoomName("user", userId);
      req.io.to(userRoom).emit(EVENT_NAMES.USER_LOGOUT, {
        sessionId,
        timestamp: Date.now(),
      });
    }
  }

  // Clear cookies through token service
  tokenService.clearTokenCookies(res);

  return res.status(200).json({
    success: true,
    message: "Logout successful",
  });
});

/**
 * Validate user authentication
 */
exports.validateUser = asyncHandler(async (req, res) => {
  // If middleware passed, user is authenticated
  res.status(200).json({
    success: true,
    data: {
      isValid: true,
      user: authService.sanitizeUser(req.user),
    },
  });
});

/**
 * Get current user
 */
exports.getCurrentUser = asyncHandler(async (req, res) => {
  // Return user data
  res.status(200).json({
    success: true,
    data: authService.sanitizeUser(req.user),
  });
});

/**
 * Verify email
 */
exports.verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;

  // Use auth service to verify email
  const result = await authService.verifyEmail(token);

  // Return success
  res.status(200).json({
    status: "success",
    message: "Email verified successfully",
    data: {
      emailVerified: true,
      userId: result.userId,
    },
  });
});

/**
 * Request password reset
 */
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Use auth service to handle password reset request
  await authService.requestPasswordReset(email);

  // Always return success to prevent email enumeration
  res.status(200).json({
    status: "success",
    message:
      "If your email is registered, you will receive a password reset link",
  });
});

/**
 * Reset password with token
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  // Use auth service to reset password
  await authService.resetPassword(token, password);

  // Return success
  res.status(200).json({
    status: "success",
    message:
      "Password reset successfully. Please log in with your new password.",
  });
});

/**
 * Change password (when logged in)
 */
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user._id;
  const sessionId = req.session._id;
  const deviceId = req.device._id;

  // Use auth service to change password
  await authService.changePassword(userId, currentPassword, newPassword, {
    keepCurrentSession: true,
    currentSessionId: sessionId,
  });

  // If WebSocket is available, notify about password change using proper propagation
  if (req.io) {
    eventPropagationService.emitWithPropagation(req.io, {
      eventName: EVENT_NAMES.SECURITY_PASSWORD_CHANGED,
      sourceRoom: {
        type: "user",
        id: userId,
      },
      data: {
        userId,
        timestamp: Date.now(),
        sessionId,
        deviceId,
        source: "api",
      },
      direction: "down",
      targetRooms: ["device", "session", "tab"],
    });
  }

  // Return success
  res.status(200).json({
    status: "success",
    message: "Password changed successfully",
  });
});

/**
 * Check password status (age, expiry)
 */
exports.checkPasswordStatus = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Use security service to check password status
  const passwordStatus = await securityService.getPasswordStatus(userId);

  res.status(200).json({
    status: "success",
    data: {
      passwordStatus,
    },
  });
});

/**
 * Validate password strength
 */
exports.validatePasswordStrength = asyncHandler(async (req, res) => {
  const { password } = req.body;

  // Use security service to validate password strength
  const result = await securityService.validatePasswordStrength(password);

  res.status(200).json({
    status: "success",
    data: result,
  });
});

/**
 * Setup two-factor authentication
 */
exports.setupTwoFactor = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Use security service to generate 2FA setup
  const setupData = await securityService.generateTwoFactorSetup(userId);

  // Return setup data
  res.status(200).json({
    status: "success",
    data: setupData,
  });
});

/**
 * Verify and activate two-factor authentication
 */
exports.verifyAndActivateTwoFactor = asyncHandler(async (req, res) => {
  const { twoFactorCode } = req.body;
  const userId = req.user._id;

  // Use security service to verify and activate 2FA
  const result = await securityService.verifyAndActivateTwoFactor(
    userId,
    twoFactorCode
  );

  // If WebSocket is available, notify other devices about 2FA activation
  if (req.io) {
    const userRoom = socketService.createRoomName("user", userId);
    eventPropagationService.emitWithPropagation(req.io, {
      eventName: EVENT_NAMES.TWO_FACTOR_ENABLED,
      sourceRoom: {
        type: "user",
        id: userId,
      },
      data: {
        userId,
        timestamp: Date.now(),
      },
      direction: "down",
      targetRooms: ["device", "session", "tab"],
    });
  }

  // Return success
  res.status(200).json({
    status: "success",
    message: "Two-factor authentication enabled successfully",
    data: {
      twoFactorEnabled: true,
      backupCodes: result.backupCodes,
    },
  });
});

/**
 * Disable two-factor authentication
 */
exports.disableTwoFactor = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const userId = req.user._id;

  // Use security service to disable 2FA
  await securityService.disableTwoFactor(userId, password);

  // If WebSocket is available, notify other devices about 2FA deactivation
  if (req.io) {
    const userRoom = socketService.createRoomName("user", userId);
    eventPropagationService.emitWithPropagation(req.io, {
      eventName: EVENT_NAMES.TWO_FACTOR_DISABLED,
      sourceRoom: {
        type: "user",
        id: userId,
      },
      data: {
        userId,
        timestamp: Date.now(),
      },
      direction: "down",
      targetRooms: ["device", "session", "tab"],
    });
  }

  // Return success
  res.status(200).json({
    status: "success",
    message: "Two-factor authentication disabled successfully",
    data: {
      twoFactorEnabled: false,
    },
  });
});

/**
 * Get CSRF token
 */
exports.getCsrfToken = asyncHandler(async (req, res) => {
  // Generate CSRF token
  const csrfToken = securityService.generateCsrfToken();

  // Set cookie
  res.cookie(
    cookieConfig.names.CSRF_TOKEN,
    csrfToken,
    cookieConfig.csrfOptions
  );

  // Return token
  res.status(200).json({
    status: "success",
    data: {
      csrfToken,
    },
  });
});

/**
 * Validate session
 * @route GET /api/auth/validate-session
 */
exports.validateSession = asyncHandler(async (req, res) => {
  try {
    // Check for token in cookies
    const token = req.cookies[cookieConfig.names.ACCESS_TOKEN];

    if (!token) {
      return res.status(200).json({
        success: false,
        valid: false,
        message: "No authentication token found",
      });
    }

    // Verify the token
    const decoded = await tokenService.verifyAccessToken(token);

    // Check if session exists and is active
    const isValidSession = await sessionService.validateSession(
      decoded.sessionId,
      decoded.userId || decoded.sub
    );

    if (!isValidSession) {
      return res.status(200).json({
        success: false,
        valid: false,
        message: "Session not found or inactive",
      });
    }

    // If session is valid, refresh the tokens and cookies
    if (isValidSession) {
      // Generate new tokens
      const { accessToken, refreshToken } =
        await tokenService.generateAuthTokens(
          decoded.userId || decoded.sub,
          decoded.tokenVersion,
          decoded.sessionId,
          decoded.rememberMe
        );

      // Set cookies using the standardized method
      tokenService.setTokenCookies(res, { accessToken, refreshToken });

      // Return success response
      return res.status(200).json({
        success: true,
        valid: true,
        userId: decoded.userId || decoded.sub,
        sessionId: decoded.sessionId,
      });
    }
  } catch (error) {
    // Return invalid but with 200 status for client handling
    return res.status(200).json({
      success: false,
      valid: false,
      message: "Invalid or expired token",
    });
  }
});

/**
 * Get authentication status
 * @route GET /api/auth/status
 */
exports.getAuthStatus = asyncHandler(async (req, res) => {
  // If user is authenticated (req.user exists from optionalAuth middleware)
  if (req.user) {
    return res.status(200).json({
      status: "success",
      data: {
        isAuthenticated: true,
        user: authService.sanitizeUser(req.user),
        sessionId: req.session?.id,
      },
    });
  }

  // If not authenticated
  return res.status(200).json({
    status: "success",
    data: {
      isAuthenticated: false,
    },
  });
});

/**
 * Verify new device
 */
exports.verifyNewDevice = asyncHandler(async (req, res) => {
  const { verificationCode } = req.body;
  const userId = req.user._id;
  const sessionId = req.session._id;

  // Use device service to verify the device
  const result = await deviceService.verifyDeviceWithCode(
    userId,
    sessionId,
    verificationCode
  );

  // Return success
  res.status(200).json({
    status: "success",
    message: "Device verified successfully",
    data: {
      deviceId: result.deviceId,
      verified: true,
    },
  });
});

/**
 * Request new verification code for device
 */
exports.requestNewDeviceVerification = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const sessionId = req.session._id;

  // Use device service to generate new verification code
  await deviceService.generateNewVerificationCode(userId, sessionId);

  // Return success
  res.status(200).json({
    status: "success",
    message: "New verification code sent",
  });
});

/**
 * Report suspicious activity
 */
exports.reportSuspiciousActivity = asyncHandler(async (req, res) => {
  const { activityType, details } = req.body;
  const userId = req.user._id;
  const sessionId = req.session._id;
  const deviceId = req.device._id;

  // Log suspicious activity
  await securityService.logSuspiciousActivity(userId, {
    activityType,
    details,
    sessionId,
    deviceId,
  });

  // Notify all user devices about suspicious activity
  if (req.io) {
    eventPropagationService.emitWithPropagation(req.io, {
      eventName: EVENT_NAMES.SECURITY_SUSPICIOUS_ACTIVITY,
      sourceRoom: {
        type: "user",
        id: userId,
      },
      data: {
        userId,
        activityType,
        timestamp: Date.now(),
        sessionId,
        deviceId,
        source: "api",
      },
      direction: "down",
      targetRooms: ["device", "session", "tab"],
    });
  }

  res.status(200).json({
    status: "success",
    message: "Suspicious activity reported and logged",
  });
});

/**
 * Verify device
 */
exports.verifyDevice = asyncHandler(async (req, res) => {
  const { verificationCode } = req.body;
  const userId = req.user._id;
  const deviceId = req.device._id;

  // Verify device
  await deviceService.verifyDevice(userId, deviceId, verificationCode);

  // Notify about device verification
  if (req.io) {
    eventPropagationService.emitWithPropagation(req.io, {
      eventName: EVENT_NAMES.SECURITY_DEVICE_VERIFIED,
      sourceRoom: {
        type: "device",
        id: deviceId,
      },
      data: {
        userId,
        deviceId,
        timestamp: Date.now(),
        source: "api",
      },
      direction: "up", // Notify parent rooms (user)
      targetRooms: ["user"],
    });
  }

  res.status(200).json({
    status: "success",
    message: "Device verified successfully",
  });
});
