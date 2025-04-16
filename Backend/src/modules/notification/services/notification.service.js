/**
 * Notification Service
 * Handles creation and delivery of notifications
 */

const logger = require("../../../utils/logger");
const { ApiError } = require("../../../utils/errors");
const Notification = require("../models/notification.model");
const { emitToUser } = require("../../../services/socket.service");
exports.createNotification = async (notificationData) => {
  try {
    logger.info("Creating notification:", notificationData);

    // Validate required fields
    if (!notificationData.recipient) {
      throw new ApiError(400, "Recipient is required");
    }

    if (!notificationData.organizationId) {
      throw new ApiError(400, "Organization ID is required");
    }

    if (!notificationData.title) {
      throw new ApiError(400, "Title is required");
    }

    // Create and save the notification
    const notification = new Notification(notificationData);
    await notification.save();

    // Emit a WebSocket event to the recipient
    try {
      emitToUser(notificationData.recipient, "notification:new", {
        notification: notification.toObject(),
      });
    } catch (socketError) {
      logger.error("Error emitting notification via WebSocket:", socketError);
      // Continue even if WebSocket emission fails
    }

    logger.info(
      `Notification created for user ${notificationData.recipient}: ${notificationData.title}`
    );

    return notification;
  } catch (error) {
    logger.error("Error creating notification:", error);
    throw error;
  }
};

exports.markAsRead = async (notificationId, userId) => {
  try {
    logger.info(
      `Marking notification ${notificationId} as read for user ${userId}`
    );

    // Find and update the notification
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      throw new ApiError(404, "Notification not found or not authorized");
    }

    // Emit a WebSocket event to the user
    try {
      emitToUser(userId, "notification:updated", {
        notificationId,
        isRead: true,
      });
    } catch (socketError) {
      logger.error(
        "Error emitting notification update via WebSocket:",
        socketError
      );
    }

    return notification;
  } catch (error) {
    logger.error("Error marking notification as read:", error);
    throw error;
  }
};

exports.markAllAsRead = async (userId, organizationId) => {
  try {
    logger.info(`Marking all notifications as read for user ${userId}`);

    // Update all unread notifications for the user
    const result = await Notification.updateMany(
      { recipient: userId, organizationId, isRead: false },
      { isRead: true }
    );

    // Emit a WebSocket event to the user
    try {
      emitToUser(userId, "notification:all-read", {
        organizationId,
      });
    } catch (socketError) {
      logger.error(
        "Error emitting notification update via WebSocket:",
        socketError
      );
    }

    return { modifiedCount: result.modifiedCount };
  } catch (error) {
    logger.error("Error marking all notifications as read:", error);
    throw error;
  }
};

exports.getNotifications = async (userId, organizationId, options = {}) => {
  try {
    logger.info(`Getting notifications for user ${userId}`);

    // Parse pagination options
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    // Build query
    const query = { recipient: userId, organizationId };

    // Filter by unread if requested
    if (options.unreadOnly) {
      query.isRead = false;
    }

    // Get total count for pagination
    const total = await Notification.countDocuments(query);

    // Get notifications with pagination
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error("Error getting notifications:", error);
    throw error;
  }
};

exports.deleteNotification = async (notificationId, userId) => {
  try {
    logger.info(`Deleting notification ${notificationId} for user ${userId}`);

    // Find and delete the notification
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      recipient: userId,
    });

    if (!notification) {
      throw new ApiError(404, "Notification not found or not authorized");
    }

    // Emit a WebSocket event to the user
    try {
      emitToUser(userId, "notification:deleted", {
        notificationId,
      });
    } catch (socketError) {
      logger.error(
        "Error emitting notification deletion via WebSocket:",
        socketError
      );
    }

    return { success: true };
  } catch (error) {
    logger.error("Error deleting notification:", error);
    throw error;
  }
};

exports.clearAllNotifications = async (userId, organizationId) => {
  try {
    logger.info(`Clearing all notifications for user ${userId}`);

    // Delete all notifications for the user in this organization
    const result = await Notification.deleteMany({
      recipient: userId,
      organizationId,
    });

    // Emit a WebSocket event to the user
    try {
      emitToUser(userId, "notification:cleared", {
        organizationId,
      });
    } catch (socketError) {
      logger.error(
        "Error emitting notification clear via WebSocket:",
        socketError
      );
    }

    return { deletedCount: result.deletedCount };
  } catch (error) {
    logger.error("Error clearing notifications:", error);
    throw error;
  }
};
