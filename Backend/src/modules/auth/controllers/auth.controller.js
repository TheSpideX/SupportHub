const { asyncHandler } = require('../../../utils/errorHandlers');
const { AppError } = require('../../../utils/errors');
const User = require('../models/user.model');
const Session = require('../models/session.model');
const tokenService = require('../services/token.service');
const sessionService = require('../services/session.service');
const emailService = require('../services/email.service');
const securityService = require('../services/security.service');
const authService = require('../services/auth.service');
const authConfig = require('../config');
const { token: tokenConfig, cookie: cookieConfig } = authConfig;
const authUtils = require('../utils/auth.utils');
const { passwordPolicy, requireEmailVerification } = require('../config');
const { getClientInfo } = require('../../../utils/request');
const logger = require('../../../utils/logger');

/**
 * Register a new user
 */
exports.register = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  
  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('Email already in use', 409, 'EMAIL_IN_USE');
  }
  
  // Create new user
  const user = await User.create({
    email,
    password, // Will be hashed in the model's pre-save hook
    firstName,
    lastName,
    role: 'user',
    security: {
      emailVerified: false,
      twoFactorEnabled: false,
      tokenVersion: 0
    }
  });
  
  // Generate verification token
  const verificationToken = await tokenService.generateEmailVerificationToken(user._id);
  
  // Send verification email
  await emailService.sendVerificationEmail(user.email, {
    name: user.firstName,
    verificationUrl: `${authConfig.clientUrl}/auth/verify-email?token=${verificationToken}`
  });
  
  // Return success without logging in the user
  res.status(201).json({
    status: 'success',
    message: 'User registered successfully. Please verify your email.',
    data: {
      userId: user._id,
      email: user.email,
      emailVerified: false
    }
  });
});

/**
 * Login user
 * @route POST /api/auth/login
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe = false } = req.body;
  
  // Authenticate user - Fix: use login method instead of authenticateUser
  const result = await authService.login(email, password, {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
    ...authUtils.getClientInfo(req)
  });
  
  // Get client info
  const clientInfo = authUtils.getClientInfo(req);
  
  // Create session through session service
  const session = result.session || await sessionService.createSession({
    userId: result.user._id,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
    deviceInfo: clientInfo,
    rememberMe
  });
  
  // Generate tokens through token service
  const tokens = result.tokens || await tokenService.generateAuthTokens(
    result.user._id,
    result.user.security?.tokenVersion || 0,
    session._id,
    rememberMe
  );
  
  // Set tokens in HTTP-only cookies
  tokenService.setTokenCookies(res, tokens);
  
  // Return session metadata for frontend
  return res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: authService.sanitizeUser(result.user), // Fix: use result.user instead of user
      session: {
        id: session._id,
        expiresAt: session.expiresAt,
        lastActivity: session.lastActiveAt
      }
    }
  });
});

/**
 * Verify two-factor authentication
 */
exports.verifyTwoFactor = asyncHandler(async (req, res) => {
  const { tempToken, twoFactorCode, rememberMe = false } = req.body;
  
  // Verify temp token
  const decoded = await tokenService.verifyTwoFactorToken(tempToken);
  if (!decoded) {
    throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
  }
  
  // Find user
  const user = await User.findById(decoded.sub);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }
  
  // Verify 2FA code
  const isCodeValid = await securityService.verifyTwoFactorCode(
    user.security.twoFactorSecret,
    twoFactorCode
  );
  
  if (!isCodeValid) {
    throw new AppError('Invalid two-factor code', 401, 'INVALID_2FA_CODE');
  }
  
  // Get client info
  const clientInfo = getClientInfo(req);
  
  // Create session
  const session = await Session.create({
    userId: user._id,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
    deviceInfo: clientInfo,
    isActive: true,
    expiresAt: rememberMe 
      ? new Date(Date.now() + tokenConfig.REFRESH_TOKEN_EXPIRY * 1000) 
      : new Date(Date.now() + tokenConfig.REFRESH_TOKEN_EXPIRY * 1000)
  });
  
  // Generate tokens
  const { accessToken, refreshToken } = await tokenService.generateAuthTokens(
    user._id,
    user.security.tokenVersion,
    session._id,
    rememberMe
  );
  
  // Set cookies
  res.cookie(
    cookieConfig.names.ACCESS_TOKEN, 
    accessToken, 
    cookieConfig.accessTokenOptions
  );
  
  res.cookie(
    cookieConfig.names.REFRESH_TOKEN, 
    refreshToken, 
    rememberMe 
      ? { ...cookieConfig.refreshTokenOptions, maxAge: tokenConfig.REFRESH_TOKEN_EXPIRY * 1000 } 
      : cookieConfig.refreshTokenOptions
  );
  
  // Generate CSRF token
  const csrfToken = securityService.generateCsrfToken(res);
  res.cookie(
    cookieConfig.names.CSRF_TOKEN, 
    csrfToken, 
    cookieConfig.csrfOptions
  );
  
  // Return user data
  res.status(200).json({
    status: 'success',
    message: 'Two-factor authentication successful',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.security.emailVerified,
        twoFactorEnabled: user.security.twoFactorEnabled
      },
      session: {
        id: session._id,
        createdAt: session.createdAt,
        deviceInfo: clientInfo
      },
      csrfToken
    }
  });
});

/**
 * Refresh tokens
 * @route POST /api/auth/token/refresh
 */
exports.refreshToken = async (req, res) => {
  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies.auth_refresh_token || 
                         req.cookies.refresh_token || 
                         req.cookies[cookieConfig.names.REFRESH_TOKEN];
    
    if (!refreshToken) {
      logger.warn('No refresh token found in cookies');
      return res.status(401).json({
        status: 'error',
        message: 'No refresh token provided'
      });
    }
    
    // Refresh tokens using the token service
    // This will verify the token and generate new tokens
    const { accessToken, refreshToken: newRefreshToken, session } = 
      await tokenService.refreshTokens(refreshToken);
    
    // Set cookies - Fix the cookieConfig issue
    // Option 1: Use the token service to set cookies
    // tokenService.setTokenCookies(res, { accessToken, refreshToken: newRefreshToken });
    
    // Option 2: Or fix the cookieConfig structure if you prefer direct usage
    
    res.cookie(cookieConfig.names.ACCESS_TOKEN, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: cookieConfig.maxAge?.access || 15 * 60 * 1000 // 15 minutes default
    });
    res.cookie(cookieConfig.names.REFRESH_TOKEN, newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: cookieConfig.maxAge?.refresh || 7 * 24 * 60 * 60 * 1000 // 7 days default
    });
    
    
    return res.status(200).json({
      status: 'success',
      data: {
        session: {
          id: session.id,
          expiresAt: session.expiresAt
        }
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    
    // Clear cookies on error
    res.clearCookie(cookieConfig.names.ACCESS_TOKEN);
    res.clearCookie(cookieConfig.names.REFRESH_TOKEN);
    
    return res.status(401).json({
      status: 'error',
      message: error.message || 'Token refresh failed'
    });
  }
};

/**
 * Logout user
 * @route POST /api/auth/logout
 */
exports.logout = asyncHandler(async (req, res) => {
  // Get session ID from request
  const sessionId = req.session?._id || req.user.sessionId;
  
  if (sessionId) {
    // Terminate session
    await sessionService.terminateSession(sessionId, req.user._id, 'user_logout');
  }
  
  // Revoke tokens
  const accessToken = req.cookies[cookieConfig.names.ACCESS_TOKEN];
  const refreshToken = req.cookies[cookieConfig.names.REFRESH_TOKEN];
  
  if (accessToken) {
    await tokenService.revokeToken(accessToken, 'access');
  }
  
  if (refreshToken) {
    await tokenService.revokeToken(refreshToken, 'refresh');
  }
  
  // Clear cookies
  res.clearCookie(cookieConfig.names.ACCESS_TOKEN);
  res.clearCookie(cookieConfig.names.REFRESH_TOKEN);
  res.clearCookie(cookieConfig.names.CSRF_TOKEN);
  
  return res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
});

/**
 * Validate user authentication
 */
exports.validateUser = (req, res) => {
  try {
    // If middleware passed, user is authenticated
    res.status(200).json({
      success: true,
      data: {
        isValid: true,
        user: authService.sanitizeUser(req.user)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user
 */
exports.getCurrentUser = (req, res) => {
  try {
    // Return user data
    res.status(200).json({
      success: true,
      data: authService.sanitizeUser(req.user)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify email
 */
exports.verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;
  
  // Verify token
  const decoded = await tokenService.verifyEmailVerificationToken(token);
  if (!decoded) {
    throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
  }
  
  // Find and update user
  const user = await User.findByIdAndUpdate(
    decoded.sub,
    { 'security.emailVerified': true },
    { new: true }
  );
  
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }
  
  // Return success
  res.status(200).json({
    status: 'success',
    message: 'Email verified successfully',
    data: {
      emailVerified: true
    }
  });
});

/**
 * Request password reset
 */
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  // Find user
  const user = await User.findOne({ email });
  
  // Don't reveal if user exists or not
  if (!user) {
    return res.status(200).json({
      status: 'success',
      message: 'If your email is registered, you will receive a password reset link'
    });
  }
  
  // Generate reset token
  const resetToken = await tokenService.generatePasswordResetToken(user._id);
  
  // Send reset email
  await emailService.sendPasswordResetEmail(user.email, {
    name: user.firstName,
    resetUrl: `${authConfig.clientUrl}/auth/reset-password?token=${resetToken}`
  });
  
  // Return success
  res.status(200).json({
    status: 'success',
    message: 'If your email is registered, you will receive a password reset link'
  });
});

/**
 * Reset password
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  
  // Verify token
  const decoded = await tokenService.verifyPasswordResetToken(token);
  if (!decoded) {
    throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
  }
  
  // Find user
  const user = await User.findById(decoded.sub);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }
  
  // Update password and increment token version
  user.password = password;
  user.security.tokenVersion += 1;
  await user.save();
  
  // Invalidate all sessions
  await Session.updateMany(
    { userId: user._id, isActive: true },
    { isActive: false, endedAt: new Date() }
  );
  
  // Return success
  res.status(200).json({
    status: 'success',
    message: 'Password reset successfully'
  });
});

/**
 * Change password
 */
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  // This middleware should be used after authenticate middleware
  const user = await User.findById(req.user._id).select('+password');
  
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }
  
  // Verify current password
  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD');
  }
  
  // Update password and increment token version
  user.password = newPassword;
  user.security.tokenVersion += 1;
  await user.save();
  
  // Keep current session active, invalidate others
  await Session.updateMany(
    { userId: user._id, isActive: true, _id: { $ne: req.session._id } },
    { isActive: false, endedAt: new Date() }
  );
  
  // Return success
  res.status(200).json({
    status: 'success',
    message: 'Password changed successfully'
  });
});

/**
 * Setup two-factor authentication
 */
exports.setupTwoFactor = asyncHandler(async (req, res) => {
  // This middleware should be used after authenticate middleware
  const user = req.user;
  
  // Generate 2FA secret
  const { secret, qrCodeUrl } = await securityService.generateTwoFactorSecret(user.email);
  
  // Store secret temporarily (not activated yet)
  user.security.tempTwoFactorSecret = secret;
  await user.save();
  
  // Return setup data
  res.status(200).json({
    status: 'success',
    data: {
      qrCodeUrl,
      secret
    }
  });
});

/**
 * Verify and activate two-factor authentication
 */
exports.verifyAndActivateTwoFactor = asyncHandler(async (req, res) => {
  const { twoFactorCode } = req.body;
  
  // This middleware should be used after authenticate middleware
  const user = req.user;
  
  // Check if temp secret exists
  if (!user.security.tempTwoFactorSecret) {
    throw new AppError('Two-factor setup not initiated', 400, 'SETUP_NOT_INITIATED');
  }
  
  // Verify code
  const isCodeValid = await securityService.verifyTwoFactorCode(
    user.security.tempTwoFactorSecret,
    twoFactorCode
  );
  
  if (!isCodeValid) {
    throw new AppError('Invalid verification code', 401, 'INVALID_CODE');
  }
  
  // Activate 2FA
  user.security.twoFactorEnabled = true;
  user.security.twoFactorSecret = user.security.tempTwoFactorSecret;
  user.security.tempTwoFactorSecret = undefined;
  await user.save();
  
  // Generate backup codes
  const backupCodes = await securityService.generateBackupCodes(user._id);
  
  // Return success
  res.status(200).json({
    status: 'success',
    message: 'Two-factor authentication enabled successfully',
    data: {
      twoFactorEnabled: true,
      backupCodes
    }
  });
});

/**
 * Disable two-factor authentication
 */
exports.disableTwoFactor = asyncHandler(async (req, res) => {
  const { password } = req.body;
  
  // This middleware should be used after authenticate middleware
  const user = await User.findById(req.user._id).select('+password');
  
  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new AppError('Password is incorrect', 401, 'INVALID_PASSWORD');
  }
  
  // Disable 2FA
  user.security.twoFactorEnabled = false;
  user.security.twoFactorSecret = undefined;
  user.security.backupCodes = [];
  await user.save();
  
  // Return success
  res.status(200).json({
    status: 'success',
    message: 'Two-factor authentication disabled successfully',
    data: {
      twoFactorEnabled: false
    }
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
    status: 'success',
    data: {
      csrfToken
    }
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
        message: 'No authentication token found'
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
        message: 'Session not found or inactive'
      });
    }
    
    // Return successful validation
    return res.status(200).json({
      success: true,
      valid: true,
      userId: decoded.userId || decoded.sub,
      sessionId: decoded.sessionId
    });
  } catch (error) {
    // Return invalid but with 200 status for client handling
    return res.status(200).json({ 
      success: false,
      valid: false,
      message: 'Invalid or expired token'
    });
  }
});

/**
 * Get authentication status
 * @route GET /api/auth/status
 */
exports.getAuthStatus = async (req, res) => {
  // If user is authenticated (req.user exists from optionalAuth middleware)
  if (req.user) {
    return res.status(200).json({
      status: 'success',
      data: {
        isAuthenticated: true,
        user: {
          id: req.user._id,
          email: req.user.email,
          role: req.user.role
        },
        sessionId: req.session?.id
      }
    });
  }
  
  // If not authenticated
  return res.status(200).json({
    status: 'success',
    data: {
      isAuthenticated: false
    }
  });
};
