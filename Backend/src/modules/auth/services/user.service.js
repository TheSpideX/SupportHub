/**
 * User Service
 * Handles user-related operations for the auth module
 */

const logger = require('../../../utils/logger');
const AppError = require('../../../utils/appError');
const User = require('../models/user.model');

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - User object
 */
exports.getUserById = async (userId) => {
  try {
    logger.debug(`Getting user by ID: ${userId}`);
    
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    return user;
  } catch (error) {
    logger.error(`Error getting user by ID: ${userId}`, error);
    throw error;
  }
};

/**
 * Sanitize user profile for client response
 * @param {Object} user - User object
 * @returns {Object} - Sanitized user object
 */
exports.sanitizeUserProfile = (user) => {
  if (!user) return null;
  
  return {
    id: user._id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    avatar: user.avatar,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
};

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<Object>} - Updated user object
 */
exports.updateUserProfile = async (userId, profileData) => {
  try {
    logger.debug(`Updating profile for user: ${userId}`);
    
    // Only allow specific fields to be updated
    const allowedFields = ['firstName', 'lastName', 'avatar'];
    const updateData = {};
    
    Object.keys(profileData).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = profileData[key];
      }
    });
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) {
      throw new AppError('User not found', 404);
    }
    
    return updatedUser;
  } catch (error) {
    logger.error(`Error updating user profile: ${userId}`, error);
    throw error;
  }
};

/**
 * Upload avatar for user
 * @param {string} userId - User ID
 * @param {Object} file - Uploaded file
 * @returns {Promise<string>} - Avatar URL
 */
exports.uploadAvatar = async (userId, file) => {
  try {
    logger.debug(`Uploading avatar for user: ${userId}`);
    
    // This would handle file storage and return the URL
    // For now, we'll use a placeholder URL
    const avatarUrl = `/uploads/avatars/${userId}.jpg`;
    
    // Update user with new avatar URL
    await User.findByIdAndUpdate(
      userId,
      { $set: { avatar: avatarUrl } }
    );
    
    return avatarUrl;
  } catch (error) {
    logger.error(`Error uploading avatar for user: ${userId}`, error);
    throw error;
  }
};

/**
 * Delete user avatar
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
exports.deleteAvatar = async (userId) => {
  try {
    logger.debug(`Deleting avatar for user: ${userId}`);
    
    // Remove avatar field from user
    await User.findByIdAndUpdate(
      userId,
      { $unset: { avatar: 1 } }
    );
    
    // This would also handle file deletion from storage
  } catch (error) {
    logger.error(`Error deleting avatar for user: ${userId}`, error);
    throw error;
  }
};

/**
 * Request email change
 * @param {string} userId - User ID
 * @param {string} newEmail - New email address
 * @param {string} password - Current password for verification
 * @returns {Promise<void>}
 */
exports.requestEmailChange = async (userId, newEmail, password) => {
  try {
    logger.debug(`Email change requested for user: ${userId}`);
    
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Verify password (would use bcrypt in real implementation)
    // const isPasswordValid = await bcrypt.compare(password, user.password);
    // if (!isPasswordValid) {
    //   throw new AppError('Invalid password', 401);
    // }
    
    // Generate verification token
    // const token = crypto.randomBytes(32).toString('hex');
    
    // Store token and new email in user document
    await User.findByIdAndUpdate(userId, {
      $set: {
        emailChangeRequest: {
          email: newEmail,
          token: 'verification-token', // Would use actual token in production
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      }
    });
    
    // Would send verification email here
  } catch (error) {
    logger.error(`Error requesting email change: ${userId}`, error);
    throw error;
  }
};

/**
 * Change user password
 * @param {string} userId - User ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<void>}
 */
exports.changePassword = async (userId, currentPassword, newPassword) => {
  try {
    logger.debug(`Password change for user: ${userId}`);
    
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Verify current password (would use bcrypt in real implementation)
    // const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    // if (!isPasswordValid) {
    //   throw new AppError('Invalid current password', 401);
    // }
    
    // Hash new password
    // const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    // Update password
    await User.findByIdAndUpdate(userId, {
      $set: {
        password: 'hashed-password', // Would use actual hashed password in production
        lastPasswordChange: new Date()
      }
    });
    
    // Would invalidate existing sessions here
  } catch (error) {
    logger.error(`Error changing password: ${userId}`, error);
    throw error;
  }
};

/**
 * Get user preferences
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - User preferences
 */
exports.getUserPreferences = async (userId) => {
  try {
    logger.debug(`Getting preferences for user: ${userId}`);
    
    const user = await User.findById(userId, 'preferences');
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    return user.preferences || {
      theme: 'light',
      language: 'en',
      notifications: true
    };
  } catch (error) {
    logger.error(`Error getting user preferences: ${userId}`, error);
    throw error;
  }
};

/**
 * Update user preferences
 * @param {string} userId - User ID
 * @param {Object} preferences - New preferences
 * @returns {Promise<Object>} - Updated preferences
 */
exports.updateUserPreferences = async (userId, preferences) => {
  try {
    logger.debug(`Updating preferences for user: ${userId}`);
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { preferences } },
      { new: true }
    );
    
    if (!updatedUser) {
      throw new AppError('User not found', 404);
    }
    
    return updatedUser.preferences;
  } catch (error) {
    logger.error(`Error updating user preferences: ${userId}`, error);
    throw error;
  }
};

/**
 * Get notification settings
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Notification settings
 */
exports.getNotificationSettings = async (userId) => {
  try {
    logger.debug(`Getting notification settings for user: ${userId}`);
    
    const user = await User.findById(userId, 'notificationSettings');
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    return user.notificationSettings || {
      email: true,
      push: true,
      sms: false
    };
  } catch (error) {
    logger.error(`Error getting notification settings: ${userId}`, error);
    throw error;
  }
};

/**
 * Update notification settings
 * @param {string} userId - User ID
 * @param {Object} settings - New notification settings
 * @returns {Promise<Object>} - Updated settings
 */
exports.updateNotificationSettings = async (userId, settings) => {
  try {
    logger.debug(`Updating notification settings for user: ${userId}`);
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { notificationSettings: settings } },
      { new: true }
    );
    
    if (!updatedUser) {
      throw new AppError('User not found', 404);
    }
    
    return updatedUser.notificationSettings;
  } catch (error) {
    logger.error(`Error updating notification settings: ${userId}`, error);
    throw error;
  }
};
