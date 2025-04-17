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

    // Log request body for debugging
    logger.debug("Query creation request body:", req.body);

    // Add organization ID to query data
    const queryData = {
      ...req.body,
      organizationId,
    };

    // If customer info is provided in the request body, use it for reference
    // but still use the authenticated user's ID as the actual customer
    if (req.body.customer) {
      logger.debug("Customer info provided in request:", req.body.customer);
    }

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
    const userId = req.user._id;
    const userRole = req.user.role;
    const organizationId = req.user.organizationId;

    const query = await queryService.getQueryById(
      queryId,
      organizationId,
      userId,
      userRole
    );

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
    const userId = req.user._id;
    const userRole = req.user.role;
    const organizationId = req.user.organizationId;
    const { page = 1, limit = 20 } = req.query;

    // Extract filters from query params
    const filters = {
      status: req.query.status,
      category: req.query.category,
      assignedTo: req.query.assignedTo,
      search: req.query.search,
    };

    // If user is a customer, only show their own queries
    if (userRole === "customer") {
      logger.info(`Customer ${userId} accessing their queries`);
      filters.customerId = userId;
    } else {
      // For non-customers, allow filtering by customerId if provided
      filters.customerId = req.query.customerId;
    }

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

    // Log the request for debugging
    logger.info("Add comment to query request:", {
      queryId,
      body: req.body,
      contentType: req.headers["content-type"],
    });

    // Check if the query ID is valid
    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(queryId)) {
      logger.warn(`Invalid query ID format: ${queryId}`);
      return res.status(400).json({
        success: false,
        error: "Invalid query ID format",
      });
    }

    // Check if this is a ticket ID that was mistakenly passed as a query ID
    const Ticket = require("../models/ticket.model");
    const ticket = await Ticket.findOne({
      _id: queryId,
      organizationId,
    });

    if (ticket) {
      logger.warn(
        `Attempted to add comment to query but ID ${queryId} belongs to a ticket`
      );

      // Instead of returning an error, add the comment to the ticket directly
      logger.info(`Adding comment to ticket ${queryId} instead`);

      try {
        // Get the ticket service
        const ticketService = require("../services/ticket.service");

        // Add the comment to the ticket
        const updatedTicket = await ticketService.addComment(
          queryId,
          req.body,
          userId,
          organizationId
        );

        return res.status(200).json({
          success: true,
          data: updatedTicket,
          message: "Comment added to ticket instead of query",
        });
      } catch (ticketError) {
        logger.error(`Error adding comment to ticket ${queryId}:`, ticketError);
        return res.status(400).json({
          success: false,
          error:
            "The provided ID belongs to a ticket, not a query. Attempted to add comment to ticket but failed.",
        });
      }
    }

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

    // Handle specific error cases
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        error: "Query not found",
      });
    }

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

/**
 * Get queries assigned to the logged-in support team member
 * @route GET /api/queries/assigned-to-me
 */
exports.getAssignedQueries = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const organizationId = req.user.organizationId;
    const { page = 1, limit = 20 } = req.query;

    // Use the existing getQueries service with a filter for assignedTo
    const filters = {
      assignedTo: userId,
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
    logger.error("Error getting assigned queries:", error);
    return next(error);
  }
};

/**
 * Get queries for the team lead's team
 * @route GET /api/queries/team
 */
exports.getTeamQueries = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const organizationId = req.user.organizationId;
    const { page = 1, limit = 20 } = req.query;

    // Get the team ID for the team lead
    const teamService = require("../../team/services/team.service");
    const userTeams = await teamService.getUserTeams(userId);

    // Filter for support teams where the user is a lead
    const supportTeams = userTeams.filter(
      (team) =>
        team.teamType === "support" &&
        team.members.some(
          (member) =>
            member.userId.toString() === userId.toString() &&
            member.role === "lead"
        )
    );

    if (supportTeams.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: 0,
        },
      });
    }

    // Get team members IDs
    const teamMemberIds = [];
    supportTeams.forEach((team) => {
      team.members.forEach((member) => {
        const memberId =
          typeof member.userId === "object"
            ? member.userId.toString()
            : member.userId;
        teamMemberIds.push(memberId);
      });
    });

    // Use the existing getQueries service with a filter for team members
    const filters = {
      assignedTo: { $in: teamMemberIds },
    };

    // Add any additional filters from the request
    if (req.query.status) filters.status = req.query.status;
    if (req.query.category) filters.category = req.query.category;
    if (req.query.search) filters.search = req.query.search;

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
    logger.error("Error getting team queries:", error);
    return next(error);
  }
};
