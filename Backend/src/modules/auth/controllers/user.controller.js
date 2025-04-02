const { asyncHandler } = require('../../../utils/errorHandlers');
const { AppError } = require('../../../utils/errors');
const socketService = require('../services/socket.service');
const userService = require('../services/user.service');
const { EVENT_NAMES } = require('../constants/event-names.constant');

/**
 * Get current user profile
 */
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.user._id);
  
  res.status(200).json({
    status: 'success',
    data: {
      user: userService.sanitizeUserProfile(user)
    }
  });
});

/**
 * Update user profile
 */
const updateUserProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone, avatar } = req.body;
  
  const user = await userService.updateUserProfile(
    req.user._id,
    { firstName, lastName, phone, avatar }
  );
  
  // Notify other devices about profile update via WebSocket
  if (req.io) {
    const userRoom = socketService.createRoomName('user', req.user._id);
    req.io.to(userRoom).emit(EVENT_NAMES.PROFILE_UPDATED, {
      userId: req.user._id,
      timestamp: Date.now(),
      sessionId: req.session?._id
    });
  }
  
  res.status(200).json({
    status: 'success',
    message: 'Profile updated successfully',
    data: {
      user: userService.sanitizeUserProfile(user)
    }
  });
});

/**
 * Upload profile avatar
 */
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }
  
  const avatarUrl = await userService.uploadAvatar(req.user._id, req.file);
  
  // Notify other devices about avatar update via WebSocket
  if (req.io) {
    const userRoom = socketService.createRoomName('user', req.user._id);
    req.io.to(userRoom).emit(EVENT_NAMES.PROFILE_UPDATED, {
      userId: req.user._id,
      timestamp: Date.now(),
      sessionId: req.session?._id,
      avatarUpdated: true
    });
  }
  
  res.status(200).json({
    status: 'success',
    message: 'Avatar uploaded successfully',
    data: {
      avatarUrl
    }
  });
});

/**
 * Delete profile avatar
 */
const deleteAvatar = asyncHandler(async (req, res) => {
  await userService.deleteAvatar(req.user._id);
  
  // Notify other devices about avatar deletion via WebSocket
  if (req.io) {
    const userRoom = socketService.createRoomName('user', req.user._id);
    req.io.to(userRoom).emit(EVENT_NAMES.PROFILE_UPDATED, {
      userId: req.user._id,
      timestamp: Date.now(),
      sessionId: req.session?._id,
      avatarDeleted: true
    });
  }
  
  res.status(200).json({
    status: 'success',
    message: 'Avatar deleted successfully'
  });
});

/**
 * Request email change
 */
const requestEmailChange = asyncHandler(async (req, res) => {
  const { newEmail, password } = req.body;
  
  await userService.requestEmailChange(req.user._id, newEmail, password);
  
  res.status(200).json({
    status: 'success',
    message: 'Verification email sent to new address. Please verify to complete the change.'
  });
});

/**
 * Change user password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  await userService.changePassword(req.user._id, currentPassword, newPassword);
  
  // Notify other devices about password change via WebSocket
  if (req.io) {
    const userRoom = socketService.createRoomName('user', req.user._id);
    req.io.to(userRoom).emit(EVENT_NAMES.PASSWORD_CHANGED, {
      userId: req.user._id,
      timestamp: Date.now(),
      sessionId: req.session?._id
    });
  }
  
  res.status(200).json({
    status: 'success',
    message: 'Password changed successfully'
  });
});

/**
 * Get user preferences
 */
const getUserPreferences = asyncHandler(async (req, res) => {
  const preferences = await userService.getUserPreferences(req.user._id);
  
  res.status(200).json({
    status: 'success',
    data: {
      preferences
    }
  });
});

/**
 * Update user preferences
 */
const updateUserPreferences = asyncHandler(async (req, res) => {
  const { preferences } = req.body;
  
  const updatedPreferences = await userService.updateUserPreferences(
    req.user._id,
    preferences
  );
  
  // Notify other devices about preferences update via WebSocket
  if (req.io) {
    const userRoom = socketService.createRoomName('user', req.user._id);
    req.io.to(userRoom).emit(EVENT_NAMES.PREFERENCES_UPDATED, {
      userId: req.user._id,
      timestamp: Date.now(),
      sessionId: req.session?._id
    });
  }
  
  res.status(200).json({
    status: 'success',
    message: 'Preferences updated successfully',
    data: {
      preferences: updatedPreferences
    }
  });
});

/**
 * Get user notification settings
 */
const getNotificationSettings = asyncHandler(async (req, res) => {
  const settings = await userService.getNotificationSettings(req.user._id);
  
  res.status(200).json({
    status: 'success',
    data: {
      settings
    }
  });
});

/**
 * Update user notification settings
 */
const updateNotificationSettings = asyncHandler(async (req, res) => {
  const { settings } = req.body;
  
  const updatedSettings = await userService.updateNotificationSettings(
    req.user._id,
    settings
  );
  
  // Notify other devices about notification settings update via WebSocket
  if (req.io) {
    const userRoom = socketService.createRoomName('user', req.user._id);
    req.io.to(userRoom).emit(EVENT_NAMES.NOTIFICATION_SETTINGS_UPDATED, {
      userId: req.user._id,
      timestamp: Date.now(),
      sessionId: req.session?._id
    });
  }
  
  res.status(200).json({
    status: 'success',
    message: 'Notification settings updated successfully',
    data: {
      settings: updatedSettings
    }
  });
});

module.exports = {
  getUserProfile,
  updateUserProfile,
  uploadAvatar,
  deleteAvatar,
  requestEmailChange,
  changePassword,
  getUserPreferences,
  updateUserPreferences,
  getNotificationSettings,
  updateNotificationSettings
};
