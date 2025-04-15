/**
 * Customer Service
 * Handles business logic for customer management
 */

const User = require("../../auth/models/user.model");
const { ApiError } = require("../../../utils/errors");
const logger = require("../../../utils/logger");
const bcrypt = require("bcrypt");

/**
 * Get all customers with filtering
 * @param {Object} filters - Filter criteria
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - Sort order (asc/desc)
 * @returns {Promise<Object>} Customers and pagination info
 */
exports.getAllCustomers = async (
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

    const query = { role: "customer" };

    // Apply organization filter
    if (filters.organizationId) {
      query.organizationId = filters.organizationId;
    }

    // Apply status filter
    if (filters.status) {
      query["security.status"] = filters.status;
    }

    // Apply search filter
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, "i");
      query.$or = [
        { "profile.firstName": searchRegex },
        { "profile.lastName": searchRegex },
        { email: searchRegex },
        { "profile.company": searchRegex },
      ];
    }

    // Calculate pagination
    const skip = (validPage - 1) * validLimit;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query with pagination
    const customers = await User.find(query)
      .select(
        "-security.password -security.passwordResetToken -security.passwordResetExpires"
      )
      .sort(sort)
      .skip(skip)
      .limit(validLimit)
      .lean();

    // Get total count for pagination
    const total = await User.countDocuments(query);

    // Format customer data for response
    const formattedCustomers = customers.map((customer) => ({
      id: customer._id,
      email: customer.email,
      firstName: customer.profile?.firstName || "",
      lastName: customer.profile?.lastName || "",
      fullName: `${customer.profile?.firstName || ""} ${
        customer.profile?.lastName || ""
      }`.trim(),
      company: customer.profile?.company || "",
      phone: customer.profile?.phone || "",
      status: customer.security?.status || "active",
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      organizationId: customer.organizationId,
    }));

    return {
      customers: formattedCustomers,
      pagination: {
        total,
        page: validPage,
        limit: validLimit,
        pages: Math.ceil(total / validLimit),
      },
    };
  } catch (error) {
    logger.error(`Error getting all customers: ${error.message}`, error);
    throw error;
  }
};

/**
 * Get customer by ID
 * @param {string} id - Customer ID
 * @returns {Promise<Object>} Customer object
 */
exports.getCustomerById = async (id) => {
  try {
    const customer = await User.findOne({ _id: id, role: "customer" })
      .select(
        "-security.password -security.passwordResetToken -security.passwordResetExpires"
      )
      .lean();

    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }

    return {
      id: customer._id,
      email: customer.email,
      firstName: customer.profile?.firstName || "",
      lastName: customer.profile?.lastName || "",
      fullName: `${customer.profile?.firstName || ""} ${
        customer.profile?.lastName || ""
      }`.trim(),
      company: customer.profile?.company || "",
      phone: customer.profile?.phone || "",
      status: customer.security?.status || "active",
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      organizationId: customer.organizationId,
    };
  } catch (error) {
    logger.error(`Error getting customer by ID: ${error.message}`, error);
    throw error;
  }
};

/**
 * Create a new customer
 * @param {Object} customerData - Customer data
 * @returns {Promise<Object>} Created customer
 */
exports.createCustomer = async (customerData) => {
  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email: customerData.email });
    if (existingUser) {
      throw new ApiError(400, "Email already in use");
    }

    // Create new customer
    const customer = new User({
      email: customerData.email,
      profile: customerData.profile,
      role: "customer",
      organizationId: customerData.organizationId,
      createdBy: customerData.createdBy,
      security: {
        password: customerData.password,
        status: customerData.status || "active",
      },
    });

    await customer.save();

    return {
      id: customer._id,
      email: customer.email,
      firstName: customer.profile?.firstName || "",
      lastName: customer.profile?.lastName || "",
      fullName: `${customer.profile?.firstName || ""} ${
        customer.profile?.lastName || ""
      }`.trim(),
      company: customer.profile?.company || "",
      phone: customer.profile?.phone || "",
      status: customer.security?.status || "active",
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      organizationId: customer.organizationId,
    };
  } catch (error) {
    logger.error(`Error creating customer: ${error.message}`, error);
    throw error;
  }
};

/**
 * Update customer
 * @param {string} id - Customer ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated customer
 */
exports.updateCustomer = async (id, updateData) => {
  try {
    const customer = await User.findOne({ _id: id, role: "customer" });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }

    // Check if email is being updated and if it's already in use
    if (updateData.email && updateData.email !== customer.email) {
      const existingUser = await User.findOne({ email: updateData.email });
      if (existingUser) {
        throw new ApiError(400, "Email already in use");
      }
      customer.email = updateData.email;
    }

    // Update profile
    if (updateData.profile) {
      customer.profile = {
        ...customer.profile,
        ...updateData.profile,
      };
    } else {
      // Handle individual profile fields
      if (
        updateData.firstName ||
        updateData.lastName ||
        updateData.company ||
        updateData.phone
      ) {
        customer.profile = customer.profile || {};

        if (updateData.firstName)
          customer.profile.firstName = updateData.firstName;
        if (updateData.lastName)
          customer.profile.lastName = updateData.lastName;
        if (updateData.company) customer.profile.company = updateData.company;
        if (updateData.phone) customer.profile.phone = updateData.phone;
      }
    }

    // Update status
    if (updateData.status) {
      customer.security.status = updateData.status;
    }

    await customer.save();

    return {
      id: customer._id,
      email: customer.email,
      firstName: customer.profile?.firstName || "",
      lastName: customer.profile?.lastName || "",
      fullName: `${customer.profile?.firstName || ""} ${
        customer.profile?.lastName || ""
      }`.trim(),
      company: customer.profile?.company || "",
      phone: customer.profile?.phone || "",
      status: customer.security?.status || "active",
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      organizationId: customer.organizationId,
    };
  } catch (error) {
    logger.error(`Error updating customer: ${error.message}`, error);
    throw error;
  }
};

/**
 * Delete customer
 * @param {string} id - Customer ID
 * @returns {Promise<void>}
 */
exports.deleteCustomer = async (id) => {
  try {
    const customer = await User.findOne({ _id: id, role: "customer" });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }

    await User.findByIdAndDelete(id);
  } catch (error) {
    logger.error(`Error deleting customer: ${error.message}`, error);
    throw error;
  }
};

/**
 * Change customer status
 * @param {string} id - Customer ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Updated customer
 */
exports.changeCustomerStatus = async (id, status) => {
  try {
    const customer = await User.findOne({ _id: id, role: "customer" });
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }

    customer.security.status = status;
    await customer.save();

    return {
      id: customer._id,
      email: customer.email,
      firstName: customer.profile?.firstName || "",
      lastName: customer.profile?.lastName || "",
      fullName: `${customer.profile?.firstName || ""} ${
        customer.profile?.lastName || ""
      }`.trim(),
      company: customer.profile?.company || "",
      phone: customer.profile?.phone || "",
      status: customer.security?.status,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      organizationId: customer.organizationId,
    };
  } catch (error) {
    logger.error(`Error changing customer status: ${error.message}`, error);
    throw error;
  }
};
