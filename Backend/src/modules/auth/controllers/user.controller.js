const User = require('../models/user.model');
const logger = require('../../../utils/logger');
const { ApiError } = require('../../../utils/errors');

/**
 * Get the current user's profile
 */
const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password -refreshTokens');
    
    if (!user) {
      return next(new ApiError('User not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error in getUserProfile:', error);
    next(error);
  }
};

/**
 * Update the current user's profile
 */
const updateUserProfile = async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;
    
    // Check if email is already taken
    if (email) {
      const existingUser = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (existingUser) {
        return next(new ApiError('Email is already in use', 400));
      }
    }
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { 
        $set: { 
          name: name || undefined,
          email: email || undefined,
          phone: phone || undefined,
          updatedAt: Date.now()
        } 
      },
      { new: true, runValidators: true }
    ).select('-password -refreshTokens');
    
    if (!updatedUser) {
      return next(new ApiError('User not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    logger.error('Error in updateUserProfile:', error);
    next(error);
  }
};

/**
 * Change the current user's password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return next(new ApiError('User not found', 404));
    }
    
    // Verify current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return next(new ApiError('Current password is incorrect', 401));
    }
    
    // Update password
    user.password = newPassword;
    user.updatedAt = Date.now();
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Error in changePassword:', error);
    next(error);
  }
};

/**
 * Get the current user's preferences
 */
const getUserPreferences = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('preferences');
    
    if (!user) {
      return next(new ApiError('User not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: user.preferences || {}
    });
  } catch (error) {
    logger.error('Error in getUserPreferences:', error);
    next(error);
  }
};

/**
 * Update the current user's preferences
 */
const updateUserPreferences = async (req, res, next) => {
  try {
    const { preferences } = req.body;
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { 
        $set: { 
          preferences,
          updatedAt: Date.now()
        } 
      },
      { new: true, runValidators: true }
    ).select('preferences');
    
    if (!updatedUser) {
      return next(new ApiError('User not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: updatedUser.preferences,
      message: 'Preferences updated successfully'
    });
  } catch (error) {
    logger.error('Error in updateUserPreferences:', error);
    next(error);
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  changePassword,
  getUserPreferences,
  updateUserPreferences
};