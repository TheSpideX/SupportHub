const { asyncHandler } = require('../../../utils/errorHandlers');
const { AppError } = require('../../../utils/errors');
const User = require('../models/user.model');

/**
 * Get current user profile
 */
exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  
  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.security.emailVerified,
        twoFactorEnabled: user.security.twoFactorEnabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    }
  });
});

/**
 * Update user profile
 */
exports.updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName } = req.body;
  
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { firstName, lastName },
    { new: true, runValidators: true }
  );
  
  res.status(200).json({
    status: 'success',
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    }
  });
});

/**
 * Request email change
 */
exports.requestEmailChange = asyncHandler(async (req, res) => {
  const { newEmail, password } = req.body;
  
  // Get user with password
  const user = await User.findById(req.user._id).select('+password');
  
  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new AppError('Password is incorrect', 401, 'INVALID_PASSWORD');
  }
  
  // Check if email already in use
  const existingUser = await User.findOne({ email: newEmail });
  if (existingUser) {
    throw new AppError('Email already in use', 409, 'EMAIL_IN_USE');
  }
  
  // Generate email change token
  const changeToken = await tokenService.generateEmailChangeToken(user._id, newEmail);
  
  // Send verification email
  await emailService.sendEmailChangeVerification(newEmail, {
    name: user.firstName,
    verificationUrl: `${authConfig.clientUrl}/auth/verify-email-change?token=${changeToken}`
  });
  
  res.status(200).json({
    status: 'success',
    message: 'Verification email sent to new address. Please verify to complete the change.'
  });
});