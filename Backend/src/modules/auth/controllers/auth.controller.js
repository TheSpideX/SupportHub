const { asyncHandler } = require("../../../utils/errorHandlers");
const { AuthError } = require("../errors");
const logger = require("../../../utils/logger");
const authService = require("../services/auth.service");
const tokenService = require('../services/token.service');
const SessionService = require("../services/session.service");
const DeviceService = require("../services/device.service");
const SecurityService = require("../services/security.service");
const User = require('../models/user.model');

const COMPONENT = "AuthController";

/**
 * Process user login request
 * @route POST /api/auth/login
 */
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password, deviceInfo, rememberMe } = req.body;
  const requestStartTime = Date.now();

  // Validate device info
  if (!deviceInfo?.fingerprint) {
    logger.warn("Login attempt without device fingerprint", {
      component: COMPONENT,
      email,
    });
    return next(
      new AuthError(
        "Device fingerprint is required",
        "DEVICE_INFO_MISSING",
        400
      )
    );
  }

  try {
    // Initialize security service
    const securityService = new SecurityService();

    // Log login attempt
    logger.info("Login attempt", {
      component: COMPONENT,
      email,
      deviceInfo: {
        fingerprint: deviceInfo.fingerprint,
        userAgent: deviceInfo.userAgent,
      },
    });

    // Add IP to deviceInfo if not present
    if (!deviceInfo.ip) {
      deviceInfo.ip = req.ip;
    }

    // Check rate limits before processing
    await securityService.checkRateLimit(email, deviceInfo);

    // Add random delay to prevent timing attacks
    const randomDelay = Math.floor(Math.random() * 200) + 100; // 100-300ms
    await new Promise((resolve) => setTimeout(resolve, randomDelay));

    // Debugging: Log password details
    console.log("DEBUG - Login request password details:", {
      passwordProvided: password ? "Yes" : "No",
      passwordLength: password?.length || 0,
      passwordFirstChar: password ? password.charCodeAt(0) : "N/A",
      passwordLastChar: password
        ? password.charCodeAt(password.length - 1)
        : "N/A",
    });

    // Check for invisible characters or encoding issues
    const passwordBytes = Buffer.from(password);
    console.log("DEBUG - Password bytes:", Array.from(passwordBytes));

    // Authenticate user
    const authResult = await authService.authenticateUser({
      email,
      password,
      deviceInfo,
      rememberMe: !!rememberMe,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Handle 2FA if required
    if (authResult.requiresTwoFactor) {
      logger.info("2FA required for login", {
        component: COMPONENT,
        userId: authResult.user.id,
      });

      return res.status(200).json({
        success: true,
        requiresTwoFactor: true,
        twoFactorToken: authResult.twoFactorToken,
        user: {
          id: authResult.user.id,
          email: authResult.user.email,
          name: authResult.user.name,
        },
      });
    }

    // Set refresh token in HTTP-only cookie
    res.cookie("refreshToken", authResult.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: authResult.rememberMe
        ? 30 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000,
    });

    // Set access token in HTTP-only cookie
    res.cookie("accessToken", authResult.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes in milliseconds
    });

    // Log successful login
    logger.info("Login successful", {
      component: COMPONENT,
      userId: authResult.user.id,
      responseTime: Date.now() - requestStartTime,
    });

    // Log successful login - cookies set
    logger.info('Login successful - cookies set', {
      component: COMPONENT,
      userId: authResult.user.id,
      cookiesSet: true,
      accessTokenSet: !!res.getHeader('Set-Cookie')?.some(c => c.includes('accessToken')),
      refreshTokenSet: !!res.getHeader('Set-Cookie')?.some(c => c.includes('refreshToken'))
    });

    // Return success response
    return res.status(200).json({
      success: true,
      user: authResult.user,
      tokens: {
        accessTokenExpiry: Date.now() + 900 * 1000, // 15 minutes in milliseconds
        refreshTokenExpiry:
          Date.now() +
          (authResult.rememberMe
            ? 30 * 24 * 60 * 60 * 1000
            : 24 * 60 * 60 * 1000),
      },
      expiresAt: authResult.expiresAt,
    });
  } catch (error) {
    // Add random delay to prevent timing attacks even on failure
    const randomDelay = Math.floor(Math.random() * 200) + 100; // 100-300ms
    await new Promise((resolve) => setTimeout(resolve, randomDelay));

    logger.error("Login failed", {
      component: COMPONENT,
      email,
      error: error.message,
      code: error.code || "UNKNOWN_ERROR",
      responseTime: Date.now() - requestStartTime,
    });

    // Set appropriate status code based on error type
    if (error instanceof AuthError) {
      error.statusCode = error.statusCode || 401; // Default to 401 for auth errors
    }

    // Return appropriate error
    return next(error);
  }
});

/**
 * Verify two-factor authentication
 * @route POST /api/auth/verify-2fa
 */
exports.verifyTwoFactor = asyncHandler(async (req, res, next) => {
  const { twoFactorToken, code, trustDevice } = req.body;
  const deviceInfo = req.body.deviceInfo || {};

  try {
    // Initialize services
    const authService = new AuthService();
    const twoFactorService = new TwoFactorService();

    // Verify the 2FA token first
    const tokenPayload = await twoFactorService.verifyTwoFactorToken(
      twoFactorToken
    );
    if (!tokenPayload || !tokenPayload.userId) {
      return next(
        new AuthError("Invalid verification session", "INVALID_2FA_SESSION")
      );
    }

    // Find the user
    const user = await User.findById(tokenPayload.userId);
    if (!user) {
      return next(new AuthError("User not found", "USER_NOT_FOUND"));
    }

    // Verify the 2FA code
    const isValid = await twoFactorService.verify2FACode(
      code,
      user.security.twoFactorSecret
    );
    if (!isValid) {
      return next(
        new AuthError("Invalid verification code", "INVALID_MFA_CODE", {
          remainingAttempts: 3, // You might want to track this in the user model
        })
      );
    }

    // Complete authentication
    const authResult = await authService.completeAuthentication(
      user,
      deviceInfo
    );

    // Mark device as trusted if requested
    if (trustDevice) {
      const deviceService = new DeviceService();
      await deviceService.trustDevice(user.id, deviceInfo.fingerprint);
    }

    // Set refresh token in HTTP-only cookie
    res.cookie("refreshToken", authResult.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: authResult.rememberMe
        ? 30 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000,
    });

    // Return auth response
    return res.status(200).json({
      success: true,
      user: authResult.user,
      tokens: {
        accessTokenExpiry: Date.now() + 900 * 1000, // 15 minutes in milliseconds
        refreshTokenExpiry:
          Date.now() +
          (authResult.rememberMe
            ? 30 * 24 * 60 * 60 * 1000
            : 24 * 60 * 60 * 1000),
      },
      securityContext: authResult.securityContext,
    });
  } catch (error) {
    logger.error("2FA verification failed", {
      component: COMPONENT,
      error: error.message,
      code: error.code,
    });
    return next(error);
  }
});

/**
 * Refresh authentication tokens
 * @route POST /api/auth/refresh
 */
exports.refreshToken = asyncHandler(async (req, res, next) => {
  // Get refresh token from cookie or request body
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!refreshToken) {
    return next(
      new AuthError("Refresh token is required", "REFRESH_TOKEN_MISSING")
    );
  }

  try {
    // Initialize services
    const tokenService = new TokenService();
    const sessionService = new SessionService();

    // Verify the refresh token
    const decoded = await tokenService.verifyToken(refreshToken, "refresh");
    if (!decoded || !decoded.userId) {
      throw new AuthError("Invalid refresh token", "INVALID_REFRESH_TOKEN");
    }

    // Find the user
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new AuthError("User not found", "USER_NOT_FOUND");
    }

    // Verify token version (for token rotation)
    if (decoded.version !== user.security.tokenVersion) {
      throw new AuthError("Token has been revoked", "TOKEN_REVOKED");
    }

    // Find the session
    const session = await sessionService.findSessionByRefreshToken(
      refreshToken
    );
    if (!session) {
      throw new AuthError("Session not found", "SESSION_NOT_FOUND");
    }

    // Check if session is active
    if (!session.isActive) {
      throw new AuthError("Session has been terminated", "SESSION_TERMINATED");
    }

    // Generate new token pair
    const tokens = await tokenService.generateTokenPair(user, {
      deviceFingerprint: session.deviceInfo.fingerprint,
      rememberMe: session.metadata?.rememberMe,
    });

    // Update session with new refresh token
    await sessionService.updateSessionToken(session._id, tokens.refreshToken);

    // Update session activity
    await sessionService.updateSessionActivity(session._id);

    // Set new refresh token in cookie
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: session.metadata?.rememberMe
        ? 30 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000,
    });

    // Return new access token
    return res.status(200).json({
      success: true,
      tokens: {
        accessTokenExpiry: Date.now() + (tokens.expiresIn || 900) * 1000, // Convert seconds to milliseconds
        refreshTokenExpiry:
          Date.now() +
          (session.metadata?.rememberMe
            ? 30 * 24 * 60 * 60 * 1000
            : 24 * 60 * 60 * 1000),
      },
    });
  } catch (error) {
    // Clear the invalid refresh token
    res.clearCookie("refreshToken");

    logger.error("Token refresh failed", {
      component: COMPONENT,
      error: error.message,
      code: error.code,
    });

    return next(
      new AuthError("Invalid refresh token", "INVALID_REFRESH_TOKEN")
    );
  }
});

/**
 * Process user logout
 * @route POST /api/auth/logout
 */
exports.logout = asyncHandler(async (req, res, next) => {
  // Get refresh token from cookie or request body
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

  try {
    // Initialize services
    const tokenService = new TokenService();
    const sessionService = new SessionService();

    if (refreshToken) {
      // Try to decode the token to get user ID
      try {
        const decoded = await tokenService.verifyToken(refreshToken, "refresh");
        if (decoded && decoded.userId) {
          // Find and terminate the session
          await sessionService.terminateSessionByRefreshToken(refreshToken);

          // Blacklist the refresh token
          await tokenService.blacklistToken(refreshToken);

          logger.info("User logged out", {
            component: COMPONENT,
            userId: decoded.userId,
          });
        }
      } catch (error) {
        // Token might be invalid, but we still want to clear cookies
        logger.debug("Invalid token during logout", {
          component: COMPONENT,
          error: error.message,
        });
      }
    }

    // Clear cookies regardless of token validity
    res.clearCookie("refreshToken");

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    logger.error("Logout failed", {
      component: COMPONENT,
      error: error.message,
    });

    // Still clear cookies even if there was an error
    res.clearCookie("refreshToken");

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  }
});

/**
 * Validate user session
 * @route GET /api/auth/validate-session
 */
exports.validateSession = asyncHandler(async (req, res) => {
  try {
    // Initialize token service
    const tokenService = new TokenService();
    
    // Log database connection status
    console.log('Database connection state:', mongoose.connection.readyState);
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    
    // Extract token from cookies or authorization header
    const token = req.cookies.accessToken || 
                 (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    
    // Debug token presence and value
    logger.debug('Validate session request details', {
      component: 'ValidateSession',
      hasCookies: !!req.cookies,
      hasAccessTokenCookie: !!req.cookies?.accessToken,
      hasAuthHeader: !!req.headers.authorization,
      tokenPresent: !!token,
      tokenFirstChars: token ? token.substring(0, 10) + '...' : 'none'
    });
    
    if (!token) {
      logger.warn('No token provided for session validation', { component: 'ValidateSession' });
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Debug token before validation
    console.log('Token before validation:', token.substring(0, 15) + '...');
    
    // Verify the token
    const result = await tokenService.validateToken(token, {
      expectedType: 'access'
    });
    
    // Log the entire result object
    console.log('Token validation result:', JSON.stringify(result, null, 2));
    
    if (!result.valid) {
      logger.warn('Token validation failed', { 
        component: 'ValidateSession',
        reason: result.reason,
        details: JSON.stringify(result)
      });
      return res.status(401).json({ message: 'Invalid authentication' });
    }
    
    // Extract user ID from token and log it
    const userId = result.payload?.sub;
    console.log('Extracted userId:', userId);
    
    if (!userId) {
      logger.warn('No user ID in token payload', {
        component: 'ValidateSession',
        payload: JSON.stringify(result.payload)
      });
      return res.status(401).json({ message: 'Invalid token format' });
    }

    // Check if userId is a valid MongoDB ObjectId
    const isValidObjectId = mongoose.Types.ObjectId.isValid(userId);
    console.log('Is valid ObjectId:', isValidObjectId);
    
    if (!isValidObjectId) {
      logger.warn('Invalid ObjectId format in token', {
        component: 'ValidateSession',
        userId
      });
      return res.status(401).json({ message: 'Invalid user identifier' });
    }

    // Add more detailed logging
    logger.debug('Attempting to find user', { 
      component: 'ValidateSession',
      userId,
      tokenPayload: JSON.stringify(result.payload)
    });

    // Ensure User model is properly imported
    const User = require('../../user/models/user.model');
    console.log('User model imported:', !!User);

    // Find the user
    const user = await User.findById(userId);
    console.log('User lookup result:', user ? 'Found' : 'Not found');

    if (!user) {
      // Try to count total users in the database
      const userCount = await User.countDocuments({});
      console.log('Total users in database:', userCount);
      
      logger.warn('User not found for token', { 
        component: 'ValidateSession',
        userId,
        tokenIssueTime: result.payload.iat ? new Date(result.payload.iat * 1000).toISOString() : 'unknown',
        tokenExpiry: result.payload.exp ? new Date(result.payload.exp * 1000).toISOString() : 'unknown'
      });
      return res.status(401).json({ message: 'Invalid authentication' });
    }

    // Return user data
    return res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      sessionValid: true
    });
  } catch (error) {
    // Log the full error
    console.error('Session validation error:', error);
    logger.error('Session validation error', { 
      component: 'ValidateSession',
      error: error.message || error.toString(),
      stack: error.stack
    });
    return res.status(401).json({ message: 'Session validation failed' });
  }
});

/**
 * Generate and return a CSRF token
 * @route GET /api/auth/csrf-token
 */
exports.getCsrfToken = asyncHandler(async (req, res, next) => {
  try {
    // Initialize services
    const csrfService = new CsrfService();

    // Generate a new CSRF token
    const token = await csrfService.generateToken();

    // Return the token
    return res.status(200).json({
      success: true,
      csrfToken: token,
    });
  } catch (error) {
    logger.error("CSRF token generation failed", {
      component: COMPONENT,
      error: error.message,
    });

    return next(error);
  }
});

/**
 * Terminate all sessions except current
 * @route POST /api/auth/terminate-sessions
 */
exports.terminateOtherSessions = asyncHandler(async (req, res, next) => {
  try {
    // User should be attached by auth middleware
    if (!req.user) {
      return next(new AuthError("Authentication required", "AUTH_REQUIRED"));
    }

    // Initialize services
    const sessionService = new SessionService();

    // Get current session ID
    const currentSessionId = req.user.sessionId;

    // Terminate all other sessions
    const result = await sessionService.terminateOtherSessions(
      req.user.id,
      currentSessionId
    );

    logger.info("Terminated other sessions", {
      component: COMPONENT,
      userId: req.user.id,
      terminatedCount: result.terminatedCount,
    });

    return res.status(200).json({
      success: true,
      terminatedCount: result.terminatedCount,
    });
  } catch (error) {
    logger.error("Failed to terminate sessions", {
      component: COMPONENT,
      error: error.message,
      userId: req.user?.id,
    });

    return next(error);
  }
});

/**
 * Get current user information
 * @route GET /api/auth/me
 */
exports.getCurrentUser = asyncHandler(async (req, res) => {
  // The user is already available in req.user thanks to the auth middleware
  const user = req.user;

  // Return user data (excluding sensitive information)
  return res.status(200).json({
    success: true,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      preferences: user.preferences || {},
    },
  });
});
