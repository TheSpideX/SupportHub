/**
 * Customer Controller
 * Handles HTTP requests for customer management
 */

const customerService = require("../services/customer.service");
const { ApiError } = require("../../../utils/errors");
const logger = require("../../../utils/logger");
const { asyncHandler } = require("../../../utils/errorHandlers");

/**
 * Get all customers with filtering
 * @route GET /api/customers
 * @access Private - Admin, Team Lead, Support, Technical
 */
exports.getAllCustomers = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, sortBy, sortOrder } = req.query;
    const userId = req.user._id;
    const organizationId = req.user.organizationId;

    // Check if user has permission
    const allowedRoles = ["admin", "team_lead", "technical", "support"];
    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(403, "Access denied. Insufficient permissions.");
    }

    const result = await customerService.getAllCustomers(
      {
        search,
        status,
        organizationId
      },
      parseInt(page),
      parseInt(limit),
      sortBy,
      sortOrder
    );

    res.status(200).json({
      success: true,
      data: result.customers,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error(`Error getting all customers: ${error.message}`, error);
    throw error;
  }
});

/**
 * Get customer by ID
 * @route GET /api/customers/:id
 * @access Private - Admin, Team Lead, Support, Technical
 */
exports.getCustomerById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user has permission
    const allowedRoles = ["admin", "team_lead", "technical", "support"];
    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(403, "Access denied. Insufficient permissions.");
    }

    const customer = await customerService.getCustomerById(id);
    
    // Check if customer belongs to the same organization
    if (customer.organizationId.toString() !== req.user.organizationId.toString()) {
      throw new ApiError(403, "Access denied. Customer belongs to a different organization.");
    }
    
    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    logger.error(`Error getting customer by ID: ${error.message}`, error);
    throw error;
  }
});

/**
 * Create a new customer
 * @route POST /api/customers
 * @access Private - Admin, Team Lead
 */
exports.createCustomer = asyncHandler(async (req, res) => {
  try {
    const { email, password, firstName, lastName, company, phone } = req.body;
    
    // Check if user has permission
    const allowedRoles = ["admin", "team_lead"];
    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(403, "Access denied. Admin or Team Lead privileges required.");
    }

    const customer = await customerService.createCustomer({
      email,
      password,
      profile: {
        firstName,
        lastName,
        company,
        phone
      },
      organizationId: req.user.organizationId,
      createdBy: req.user._id
    });
    
    res.status(201).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    logger.error(`Error creating customer: ${error.message}`, error);
    throw error;
  }
});

/**
 * Update customer
 * @route PUT /api/customers/:id
 * @access Private - Admin, Team Lead
 */
exports.updateCustomer = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Check if user has permission
    const allowedRoles = ["admin", "team_lead"];
    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(403, "Access denied. Admin or Team Lead privileges required.");
    }

    const customer = await customerService.getCustomerById(id);
    
    // Check if customer belongs to the same organization
    if (customer.organizationId.toString() !== req.user.organizationId.toString()) {
      throw new ApiError(403, "Access denied. Customer belongs to a different organization.");
    }

    const updatedCustomer = await customerService.updateCustomer(id, updateData);
    
    res.status(200).json({
      success: true,
      data: updatedCustomer,
    });
  } catch (error) {
    logger.error(`Error updating customer: ${error.message}`, error);
    throw error;
  }
});

/**
 * Delete customer
 * @route DELETE /api/customers/:id
 * @access Private - Admin only
 */
exports.deleteCustomer = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is admin
    if (req.user.role !== "admin") {
      throw new ApiError(403, "Access denied. Admin privileges required.");
    }

    const customer = await customerService.getCustomerById(id);
    
    // Check if customer belongs to the same organization
    if (customer.organizationId.toString() !== req.user.organizationId.toString()) {
      throw new ApiError(403, "Access denied. Customer belongs to a different organization.");
    }

    await customerService.deleteCustomer(id);
    
    res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    logger.error(`Error deleting customer: ${error.message}`, error);
    throw error;
  }
});

/**
 * Change customer status
 * @route PATCH /api/customers/:id/status
 * @access Private - Admin, Team Lead
 */
exports.changeCustomerStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Check if user has permission
    const allowedRoles = ["admin", "team_lead"];
    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(403, "Access denied. Admin or Team Lead privileges required.");
    }

    const customer = await customerService.getCustomerById(id);
    
    // Check if customer belongs to the same organization
    if (customer.organizationId.toString() !== req.user.organizationId.toString()) {
      throw new ApiError(403, "Access denied. Customer belongs to a different organization.");
    }

    const updatedCustomer = await customerService.changeCustomerStatus(id, status);
    
    res.status(200).json({
      success: true,
      data: updatedCustomer,
    });
  } catch (error) {
    logger.error(`Error changing customer status: ${error.message}`, error);
    throw error;
  }
});
