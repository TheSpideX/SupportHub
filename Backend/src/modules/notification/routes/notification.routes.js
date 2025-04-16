/**
 * Notification Routes
 * Handles API routes for notifications
 */

const express = require("express");
const router = express.Router();
const notificationService = require("../services/notification.service");
const {
  authenticate,
} = require("../../../modules/auth/middleware/auth.middleware");
const validate = require("../../../middleware/validate");
const { ApiError } = require("../../../utils/errors");

/**
 * @route GET /api/notifications
 * @desc Get notifications for the current user
 * @access Private
 */
router.get("/", authenticate, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const organizationId = req.user.organizationId;

    // Parse pagination options
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const unreadOnly = req.query.unreadOnly === "true";

    const options = {
      page,
      limit,
      unreadOnly,
    };

    const result = await notificationService.getNotifications(
      userId,
      organizationId,
      options
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/notifications/mark-read/:id
 * @desc Mark a notification as read
 * @access Private
 */
router.post("/mark-read/:id", authenticate, async (req, res, next) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user._id;

    await notificationService.markAsRead(notificationId, userId);

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/notifications/mark-all-read
 * @desc Mark all notifications as read
 * @access Private
 */
router.post("/mark-all-read", authenticate, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const organizationId = req.user.organizationId;

    await notificationService.markAllAsRead(userId, organizationId);

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/notifications/:id
 * @desc Delete a notification
 * @access Private
 */
router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user._id;

    await notificationService.deleteNotification(notificationId, userId);

    res.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/notifications
 * @desc Clear all notifications
 * @access Private
 */
router.delete("/", authenticate, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const organizationId = req.user.organizationId;

    await notificationService.clearAllNotifications(userId, organizationId);

    res.json({
      success: true,
      message: "All notifications cleared",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
