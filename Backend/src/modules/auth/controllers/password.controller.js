const { asyncHandler } = require('../../../utils/errorHandlers');
const { AppError } = require('../../../utils/errors');
const User = require('../models/user.model');
const tokenService = require('../services/token.service');
const emailService = require('../services/email.service');
const authConfig = require('../config/auth.config');

/**
 * Request password reset
 */
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  // Find user
  const user = await User.findOne({ email });
  if (!user) {
    // Don't reveal if email exists for security
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
  
  res.status(200).json({
    status: 'success',
    message: 'If your email is registered, you will receive a password reset link'
  });
});

/**
 * Reset password with token
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
  
  // Invalidate all active sessions
  await Session.updateMany(
    { userId: user._id, isActive: true },
    { isActive: false }
  );
  
  res.status(200).json({
    status: 'success',
    message: 'Password reset successful. Please log in with your new password.'
  });
});

/**
 * Change password (when logged in)
 */
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  // Get user with password
  const user = await User.findById(req.user._id).select('+password');
  
  // Verify current password
  const isPasswordValid = await user.comparePassword(currentPassword);
  if (!isPasswordValid) {
    throw new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD');
  }
  
  // Update password and increment token version
  user.password = newPassword;
  user.security.tokenVersion += 1;
  await user.save();
  
  // Invalidate all other sessions
  await Session.updateMany(
    { userId: user._id, isActive: true, _id: { $ne: req.session._id } },
    { isActive: false }
  );
  
  res.status(200).json({
    status: 'success',
    message: 'Password changed successfully'
  });
});