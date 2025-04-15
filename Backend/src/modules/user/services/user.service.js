/**
 * User Service
 * Handles business logic for user management
 */

const User = require("../../auth/models/user.model");
const { ApiError } = require("../../../utils/errors");
const logger = require("../../../utils/logger");
const bcrypt = require("bcrypt");

/**
 * Get all users with filtering
 * @param {Object} filters - Filter criteria
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - Sort order (asc/desc)
 * @returns {Promise<Object>} Users and pagination info
 */
exports.getAllUsers = async (
  filters = {},
  page = 1,
  limit = 10,
  sortBy = "createdAt",
  sortOrder = "desc"
) => {
  try {
    // Validate page and limit parameters
    const validPage = Math.max(1, parseInt(page) || 1); // Ensure page is at least 1
    const validLimit = Math.max(1, Math.min(100, parseInt(limit) || 10)); // Ensure limit is between 1 and 100

    const query = {};

    // Apply organization filter
    if (filters.organizationId) {
      query.organizationId = filters.organizationId;
    }

    // Apply role filter
    if (filters.role) {
      query.role = filters.role;
    }

    // Apply status filter
    if (filters.status) {
      query["security.status"] = filters.status;
    }

    // Exclude customers if specified
    if (filters.excludeCustomers) {
      query.role = { $ne: "customer" };
    }

    // Apply search filter
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, "i");
      query.$or = [
        { "profile.firstName": searchRegex },
        { "profile.lastName": searchRegex },
        { email: searchRegex },
      ];
    }

    // Calculate pagination
    const skip = (validPage - 1) * validLimit;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query with pagination
    const users = await User.find(query)
      .select(
        "-security.password -security.passwordResetToken -security.passwordResetExpires"
      )
      .sort(sort)
      .skip(skip)
      .limit(validLimit)
      .lean();

    // Get total count for pagination
    const total = await User.countDocuments(query);

    // Format user data for response
    const formattedUsers = users.map((user) => ({
      id: user._id,
      email: user.email,
      firstName: user.profile?.firstName || "",
      lastName: user.profile?.lastName || "",
      fullName: `${user.profile?.firstName || ""} ${
        user.profile?.lastName || ""
      }`.trim(),
      role: user.role,
      status: user.security?.status || "active",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      organizationId: user.organizationId,
    }));

    return {
      users: formattedUsers,
      pagination: {
        total,
        page: validPage,
        limit: validLimit,
        pages: Math.ceil(total / validLimit),
      },
    };
  } catch (error) {
    logger.error(`Error getting all users: ${error.message}`, error);
    throw error;
  }
};

/**
 * Get user by ID
 * @param {string} id - User ID
 * @returns {Promise<Object>} User object
 */
exports.getUserById = async (id) => {
  try {
    const user = await User.findById(id)
      .select(
        "-security.password -security.passwordResetToken -security.passwordResetExpires"
      )
      .lean();

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return {
      id: user._id,
      email: user.email,
      firstName: user.profile?.firstName || "",
      lastName: user.profile?.lastName || "",
      fullName: `${user.profile?.firstName || ""} ${
        user.profile?.lastName || ""
      }`.trim(),
      role: user.role,
      status: user.security?.status || "active",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      organizationId: user.organizationId,
    };
  } catch (error) {
    logger.error(`Error getting user by ID: ${error.message}`, error);
    throw error;
  }
};

/**
 * Create a new user
 * @param {Object} userData - User data
 * @returns {Promise<Object>} Created user
 */
exports.createUser = async (userData) => {
  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new ApiError(400, "Email already in use");
    }

    // Create new user
    const user = new User({
      email: userData.email,
      profile: userData.profile,
      role: userData.role,
      organizationId: userData.organizationId,
      security: {
        password: userData.password,
        status: userData.status || "active",
      },
    });

    await user.save();

    return {
      id: user._id,
      email: user.email,
      firstName: user.profile?.firstName || "",
      lastName: user.profile?.lastName || "",
      fullName: `${user.profile?.firstName || ""} ${
        user.profile?.lastName || ""
      }`.trim(),
      role: user.role,
      status: user.security?.status || "active",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      organizationId: user.organizationId,
    };
  } catch (error) {
    logger.error(`Error creating user: ${error.message}`, error);
    throw error;
  }
};

/**
 * Update user
 * @param {string} id - User ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated user
 */
exports.updateUser = async (id, updateData) => {
  try {
    const user = await User.findById(id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Check if email is being updated and if it's already in use
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await User.findOne({ email: updateData.email });
      if (existingUser) {
        throw new ApiError(400, "Email already in use");
      }
      user.email = updateData.email;
    }

    // Update profile
    if (updateData.profile) {
      user.profile = {
        ...user.profile,
        ...updateData.profile,
      };
    }

    // Role cannot be changed through the update function
    // This is intentional to prevent unauthorized role changes
    // Roles should only be changed through specific role management functions

    // Update status
    if (updateData.status) {
      user.security.status = updateData.status;
    }

    await user.save();

    return {
      id: user._id,
      email: user.email,
      firstName: user.profile?.firstName || "",
      lastName: user.profile?.lastName || "",
      fullName: `${user.profile?.firstName || ""} ${
        user.profile?.lastName || ""
      }`.trim(),
      role: user.role,
      status: user.security?.status || "active",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      organizationId: user.organizationId,
    };
  } catch (error) {
    logger.error(`Error updating user: ${error.message}`, error);
    throw error;
  }
};

/**
 * Delete user
 * @param {string} id - User ID
 * @returns {Promise<void>}
 */
exports.deleteUser = async (id) => {
  try {
    const user = await User.findById(id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    await User.findByIdAndDelete(id);
  } catch (error) {
    logger.error(`Error deleting user: ${error.message}`, error);
    throw error;
  }
};

/**
 * Get users by IDs
 * @param {Array<string>} ids - User IDs
 * @returns {Promise<Array<Object>>} Users
 */
exports.getUsersByIds = async (ids) => {
  try {
    const users = await User.find({ _id: { $in: ids } })
      .select(
        "-security.password -security.passwordResetToken -security.passwordResetExpires"
      )
      .lean();

    return users.map((user) => ({
      id: user._id,
      email: user.email,
      firstName: user.profile?.firstName || "",
      lastName: user.profile?.lastName || "",
      fullName: `${user.profile?.firstName || ""} ${
        user.profile?.lastName || ""
      }`.trim(),
      role: user.role,
      status: user.security?.status || "active",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      organizationId: user.organizationId,
    }));
  } catch (error) {
    logger.error(`Error getting users by IDs: ${error.message}`, error);
    throw error;
  }
};

/**
 * Change user status
 * @param {string} id - User ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Updated user
 */
exports.changeUserStatus = async (id, status) => {
  try {
    const user = await User.findById(id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    user.security.status = status;
    await user.save();

    return {
      id: user._id,
      email: user.email,
      firstName: user.profile?.firstName || "",
      lastName: user.profile?.lastName || "",
      fullName: `${user.profile?.firstName || ""} ${
        user.profile?.lastName || ""
      }`.trim(),
      role: user.role,
      status: user.security?.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      organizationId: user.organizationId,
    };
  } catch (error) {
    logger.error(`Error changing user status: ${error.message}`, error);
    throw error;
  }
};

/**
 * Reset user password
 * @param {string} id - User ID
 * @param {string} newPassword - New password
 * @returns {Promise<void>}
 */
exports.resetUserPassword = async (id, newPassword) => {
  try {
    const user = await User.findById(id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.security.password = hashedPassword;
    await user.save();
  } catch (error) {
    logger.error(`Error resetting user password: ${error.message}`, error);
    throw error;
  }
};
