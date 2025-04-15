/**
 * User Controller
 * Handles HTTP requests for user management
 */

const userService = require("../services/user.service");
const { ApiError } = require("../../../utils/errors");
const logger = require("../../../utils/logger");
const { asyncHandler } = require("../../../utils/errorHandlers");

/**
 * Get all users with filtering
 * @route GET /api/users
 * @access Private - Admin only
 */
exports.getAllUsers = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      role,
      status,
      sortBy,
      sortOrder,
    } = req.query;
    const userId = req.user._id;
    const organizationId = req.user.organizationId;

    // Check if user is admin
    const isAdmin = req.user.role === "admin";
    if (!isAdmin) {
      throw new ApiError(403, "Access denied. Admin privileges required.");
    }

    const result = await userService.getAllUsers(
      {
        search,
        role,
        status,
        organizationId,
        excludeCustomers: true, // Exclude customers from user management
      },
      parseInt(page),
      parseInt(limit),
      sortBy,
      sortOrder
    );

    res.status(200).json({
      success: true,
      data: result.users,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error(`Error getting all users: ${error.message}`, error);
    throw error;
  }
});

/**
 * Get user by ID
 * @route GET /api/users/:id
 * @access Private - Admin only
 */
exports.getUserById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === "admin";

    if (!isAdmin) {
      throw new ApiError(403, "Access denied. Admin privileges required.");
    }

    const user = await userService.getUserById(id);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error(`Error getting user by ID: ${error.message}`, error);
    throw error;
  }
});

/**
 * Create a new user
 * @route POST /api/users
 * @access Private - Admin only
 */
exports.createUser = asyncHandler(async (req, res) => {
  try {
    const { email, password, firstName, lastName, role, status } = req.body;

    // Prepare profile data
    const profile = {
      firstName: firstName || "",
      lastName: lastName || "",
    };
    const isAdmin = req.user.role === "admin";

    if (!isAdmin) {
      throw new ApiError(403, "Access denied. Admin privileges required.");
    }

    const user = await userService.createUser({
      email,
      password,
      profile,
      role,
      status,
      organizationId: req.user.organizationId,
    });

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error(`Error creating user: ${error.message}`, error);
    throw error;
  }
});

/**
 * Update user
 * @route PUT /api/users/:id
 * @access Private - Admin only
 */
exports.updateUser = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { email, firstName, lastName, status } = req.body;

    // Prepare update data
    const updateData = {};

    if (email) updateData.email = email;

    // Handle profile fields
    if (firstName || lastName) {
      updateData.profile = {};
      if (firstName) updateData.profile.firstName = firstName;
      if (lastName) updateData.profile.lastName = lastName;
    }

    if (status) updateData.status = status;

    // Note: role is intentionally not included to prevent role changes
    const isAdmin = req.user.role === "admin";

    if (!isAdmin) {
      throw new ApiError(403, "Access denied. Admin privileges required.");
    }

    const user = await userService.updateUser(id, updateData);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error(`Error updating user: ${error.message}`, error);
    throw error;
  }
});

/**
 * Delete user
 * @route DELETE /api/users/:id
 * @access Private - Admin only
 */
exports.deleteUser = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === "admin";

    if (!isAdmin) {
      throw new ApiError(403, "Access denied. Admin privileges required.");
    }

    await userService.deleteUser(id);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    logger.error(`Error deleting user: ${error.message}`, error);
    throw error;
  }
});

/**
 * Get users by IDs
 * @route POST /api/users/by-ids
 * @access Private - Admin only
 */
exports.getUsersByIds = asyncHandler(async (req, res) => {
  try {
    const { userIds } = req.body;
    const isAdmin = req.user.role === "admin";

    if (!isAdmin) {
      throw new ApiError(403, "Access denied. Admin privileges required.");
    }

    const users = await userService.getUsersByIds(userIds);

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    logger.error(`Error getting users by IDs: ${error.message}`, error);
    throw error;
  }
});

/**
 * Change user status
 * @route PATCH /api/users/:id/status
 * @access Private - Admin only
 */
exports.changeUserStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const isAdmin = req.user.role === "admin";

    if (!isAdmin) {
      throw new ApiError(403, "Access denied. Admin privileges required.");
    }

    const user = await userService.changeUserStatus(id, status);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error(`Error changing user status: ${error.message}`, error);
    throw error;
  }
});

/**
 * Reset user password
 * @route POST /api/users/:id/reset-password
 * @access Private - Admin only
 */
exports.resetUserPassword = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const isAdmin = req.user.role === "admin";

    if (!isAdmin) {
      throw new ApiError(403, "Access denied. Admin privileges required.");
    }

    await userService.resetUserPassword(id, newPassword);

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    logger.error(`Error resetting user password: ${error.message}`, error);
    throw error;
  }
});
