/**
 * Query Controller
 * Handles HTTP requests for customer query operations
 */

const queryService = require("../services/query.service");
const { ApiError } = require("../../../utils/errors");
const logger = require("../../../utils/logger");

/**
 * Create a new customer query
 * @route POST /api/queries
 */
exports.createQuery = async (req, res, next) => {
  try {
    const customerId = req.user._id;
    const organizationId = req.user.organizationId;
    
    // Add organization ID to query data
    const queryData = {
      ...req.body,
      organizationId,
    };
    
    const query = await queryService.createQuery(queryData, customerId);
    
    return res.status(201).json({
      success: true,
      data: query,
    });
  } catch (error) {
    logger.error("Error creating query:", error);
    return next(error);
  }
};

/**
 * Get query by ID
 * @route GET /api/queries/:id
 */
exports.getQueryById = async (req, res, next) => {
  try {
    const queryId = req.params.id;
    const organizationId = req.user.organizationId;
    
    const query = await queryService.getQueryById(queryId, organizationId);
    
    return res.status(200).json({
      success: true,
      data: query,
    });
  } catch (error) {
    logger.error("Error getting query:", error);
    return next(error);
  }
};

/**
 * Get queries with filters
 * @route GET /api/queries
 */
exports.getQueries = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const { page = 1, limit = 20 } = req.query;
    
    // Extract filters from query params
    const filters = {
      status: req.query.status,
      category: req.query.category,
      customerId: req.query.customerId,
      assignedTo: req.query.assignedTo,
      search: req.query.search,
    };
    
    const result = await queryService.getQueries(
      filters,
      organizationId,
      page,
      limit
    );
    
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error("Error getting queries:", error);
    return next(error);
  }
};

/**
 * Update query
 * @route PUT /api/queries/:id
 */
exports.updateQuery = async (req, res, next) => {
  try {
    const queryId = req.params.id;
    const userId = req.user._id;
    const organizationId = req.user.organizationId;
    
    const query = await queryService.updateQuery(
      queryId,
      req.body,
      userId,
      organizationId
    );
    
    return res.status(200).json({
      success: true,
      data: query,
    });
  } catch (error) {
    logger.error("Error updating query:", error);
    return next(error);
  }
};

/**
 * Add comment to query
 * @route POST /api/queries/:id/comments
 */
exports.addComment = async (req, res, next) => {
  try {
    const queryId = req.params.id;
    const userId = req.user._id;
    const organizationId = req.user.organizationId;
    
    const query = await queryService.addComment(
      queryId,
      req.body,
      userId,
      organizationId
    );
    
    return res.status(200).json({
      success: true,
      data: query,
    });
  } catch (error) {
    logger.error("Error adding comment:", error);
    return next(error);
  }
};

/**
 * Assign query to support team member
 * @route POST /api/queries/:id/assign
 */
exports.assignQuery = async (req, res, next) => {
  try {
    const queryId = req.params.id;
    const { assigneeId } = req.body;
    const userId = req.user._id;
    const organizationId = req.user.organizationId;
    
    if (!assigneeId) {
      return next(new ApiError(400, "Assignee ID is required"));
    }
    
    const query = await queryService.assignQuery(
      queryId,
      assigneeId,
      userId,
      organizationId
    );
    
    return res.status(200).json({
      success: true,
      data: query,
    });
  } catch (error) {
    logger.error("Error assigning query:", error);
    return next(error);
  }
};

/**
 * Convert query to ticket
 * @route POST /api/queries/:id/convert
 */
exports.convertToTicket = async (req, res, next) => {
  try {
    const queryId = req.params.id;
    const userId = req.user._id;
    const organizationId = req.user.organizationId;
    
    // Add organization ID to ticket data
    const ticketData = {
      ...req.body,
      organizationId,
    };
    
    const result = await queryService.convertToTicket(
      queryId,
      ticketData,
      userId,
      organizationId
    );
    
    return res.status(200).json({
      success: true,
      data: {
        ticket: result.ticket,
        query: result.query,
      },
    });
  } catch (error) {
    logger.error("Error converting query to ticket:", error);
    return next(error);
  }
};

/**
 * Get customer's own queries
 * @route GET /api/queries/my-queries
 */
exports.getMyQueries = async (req, res, next) => {
  try {
    const customerId = req.user._id;
    const organizationId = req.user.organizationId;
    const { page = 1, limit = 20 } = req.query;
    
    const result = await queryService.getCustomerQueries(
      customerId,
      organizationId,
      page,
      limit
    );
    
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error("Error getting customer queries:", error);
    return next(error);
  }
};
