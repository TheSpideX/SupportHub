const { asyncHandler } = require('../../../utils/errorHandlers');
const { AppError } = require('../../../utils/errors');
const User = require('../models/user.model');
const Session = require('../models/session.model');
const TokenBlacklist = require('../models/token-blacklist.model');
const tokenService = require('../services/token.service');
const emailService = require('../services/email.service');
const securityService = require('../services/security.service');
const authService = require('../services/auth.service');
const authConfig = require('../config');
const { token: tokenConfig, cookie: cookieConfig } = authConfig;
const authUtils = require('../utils/auth.utils');
const { passwordPolicy, requireEmailVerification } = require('../config');

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
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe = false } = req.body;
  
  // Find user by email with password field included
  const user = await User.findOne({ email }).select('+security.password');
  
  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  
  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  
  if (!isPasswordValid) {
    // Increment login attempts
    if (user.security) {
      user.security.loginAttempts = (user.security.loginAttempts || 0) + 1;
      
      // Lock account if max attempts reached
      if (user.security.loginAttempts >= authConfig.maxLoginAttempts) {
        user.security.lockUntil = new Date(Date.now() + authConfig.lockoutDuration * 1000);
      }
      
      await user.save();
    }
    
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }
  
  // Check if account is locked
  const accountIsLocked = user.isLocked();
  if (accountIsLocked && !await user.checkAndUnlockAccount()) {
    throw new AppError('Account is locked', 401, 'ACCOUNT_LOCKED');
  }
  
  // Reset login attempts on successful login
  if (user.security && user.security.loginAttempts > 0) {
    user.security.loginAttempts = 0;
    await user.save();
  }
  
  // Get client info
  const clientInfo = {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
    ...req.body.deviceInfo
  };
  
  // Create session
  const session = await Session.create({
    userId: user._id,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
    deviceInfo: clientInfo,
    isActive: true,
    expiresAt: rememberMe 
      ? new Date(Date.now() + tokenConfig.REFRESH_TOKEN_EXPIRY * 1000 * 7) // 7x longer for remember me
      : new Date(Date.now() + tokenConfig.REFRESH_TOKEN_EXPIRY * 1000)
  });
  
  // Generate tokens
  const { accessToken, refreshToken, csrfToken } = await tokenService.generateTokens(
    user,
    session._id,
    rememberMe
  );

  // Set cookies
  // Access token cookie (short-lived)
  res.cookie(cookieConfig.names.ACCESS_TOKEN, accessToken, {
    ...cookieConfig.baseOptions,
    maxAge: tokenConfig.ACCESS_TOKEN_EXPIRY * 1000
  });
  
  // Refresh token cookie (longer-lived)
  res.cookie(cookieConfig.names.REFRESH_TOKEN, refreshToken, {
    ...cookieConfig.baseOptions,
    maxAge: rememberMe 
      ? tokenConfig.REFRESH_TOKEN_EXPIRY * 1000 * 7 // 7x longer for remember me
      : tokenConfig.REFRESH_TOKEN_EXPIRY * 1000
  });
  
  // CSRF token (JavaScript accessible)
  res.cookie(cookieConfig.names.CSRF_TOKEN, csrfToken, {
    ...cookieConfig.csrfOptions,
    maxAge: tokenConfig.ACCESS_TOKEN_EXPIRY * 1000
  });
  
  // Return user data
  res.status(200).json({
    status: 'success',
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.security.emailVerified
      },
      session: {
        id: session._id,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
      },
      csrfToken // Include in response body for immediate use
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
 * Refresh access token
 */
exports.refreshToken = asyncHandler(async (req, res) => {
  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies[cookieConfig.names.REFRESH_TOKEN];
    
    if (!refreshToken) {
      throw new AppError('Refresh token not found', 401, 'REFRESH_TOKEN_NOT_FOUND');
    }
    
    // Verify refresh token
    let decoded;
    try {
      decoded = await tokenService.verifyRefreshToken(refreshToken);
    } catch (error) {
      // If token verification fails, clear cookies and return error
      res.clearCookie(cookieConfig.names.ACCESS_TOKEN);
      res.clearCookie(cookieConfig.names.REFRESH_TOKEN);
      res.clearCookie(cookieConfig.names.CSRF_TOKEN);
      
      throw new AppError(
        error.message || 'Invalid refresh token', 
        401, 
        'INVALID_REFRESH_TOKEN'
      );
    }
    
    // Find user
    const user = await User.findById(decoded.sub);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken, csrfToken } = 
      await tokenService.generateTokens(user, decoded.sessionId || null);
    
    // Set cookies using the token service
    tokenService.setTokenCookies(res, { 
      accessToken, 
      refreshToken: newRefreshToken, 
      csrfToken 
    });
    
    // Return success
    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      csrfToken
    });
  } catch (error) {
    throw error;
  }
});

/**
 * Logout user
 */
exports.logout = asyncHandler(async (req, res) => {
  // Get tokens from cookies
  const accessToken = req.cookies[cookieConfig.names.ACCESS_TOKEN];
  const refreshToken = req.cookies[cookieConfig.names.REFRESH_TOKEN];
  
  // If tokens exist, blacklist them
  if (accessToken) {
    try {
      const decoded = await tokenService.verifyAccessToken(accessToken);
      
      // Blacklist the token
      await TokenBlacklist.create({
        tokenId: decoded.jti,
        expiresAt: new Date(decoded.exp * 1000)
      });
      
      // Deactivate session
      if (decoded.sessionId) {
        await Session.findByIdAndUpdate(decoded.sessionId, {
          isActive: false,
          endedAt: new Date()
        });
      }
    } catch (error) {
      // Ignore token verification errors during logout
    }
  }
  
  if (refreshToken) {
    try {
      const decoded = await tokenService.verifyRefreshToken(refreshToken);
      
      // Blacklist the token
      await TokenBlacklist.create({
        tokenId: decoded.jti,
        expiresAt: new Date(decoded.exp * 1000)
      });
      
      // Deactivate session
      if (decoded.sessionId) {
        await Session.findByIdAndUpdate(decoded.sessionId, {
          isActive: false,
          endedAt: new Date()
        });
      }
    } catch (error) {
      // Ignore token verification errors during logout
    }
  }
  
  // Clear cookies
  res.clearCookie(cookieConfig.names.ACCESS_TOKEN);
  res.clearCookie(cookieConfig.names.REFRESH_TOKEN);
  res.clearCookie(cookieConfig.names.CSRF_TOKEN);
  
  // Return success
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
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
 * Validate user session
 * @route GET /api/auth/validate-session
 */
exports.validateSession = async (req, res) => {
  try {
    // Get user and session from request (added by authenticateToken middleware)
    const { user } = req;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'SESSION_INVALID',
          message: 'Session is invalid or expired'
        }
      });
    }
    
    // Find active session for this user
    const session = await Session.findOne({ 
      userId: user._id,
      isActive: true
    });
    
    if (!session) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'No active session found'
        }
      });
    }
    
    // Return session validation result
    return res.status(200).json({
      success: true,
      data: {
        isValid: true,
        user: authService.sanitizeUser(user),
        session: {
          id: session._id,
          expiresAt: session.expiresAt,
          createdAt: session.createdAt
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'An error occurred while validating session'
      }
    });
  }
};

/**
 * Logout user from all devices
 */
exports.logoutAll = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const currentSessionId = req.session?._id;
  
  // Increment token version to invalidate all refresh tokens
  await User.findByIdAndUpdate(
    userId,
    { $inc: { 'security.tokenVersion': 1 } }
  );
  
  // Deactivate all sessions
  await Session.updateMany(
    { 
      userId: userId,
      isActive: true,
      _id: { $ne: currentSessionId } // Exclude current if needed
    },
    { 
      isActive: false, 
      endedAt: new Date(),
      endReason: 'user_logout_all'
    }
  );
  
  // Clear cookies
  res.clearCookie(cookieConfig.names.ACCESS_TOKEN);
  res.clearCookie(cookieConfig.names.REFRESH_TOKEN);
  res.clearCookie(cookieConfig.names.CSRF_TOKEN);
  
  // Return success
  res.status(200).json({
    status: 'success',
    message: 'Logged out from all devices successfully'
  });
});
