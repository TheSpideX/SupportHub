/**
 * Ticket Controller
 * Handles HTTP requests for ticket operations
 */

const ticketService = require("../services/ticket.service");
const { ApiError } = require("../../../utils/errors");
const logger = require("../../../utils/logger");

/**
 * Create a new ticket
 * @route POST /api/tickets
 */
exports.createTicket = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const organizationId = req.user.organizationId;
    
    // Add organization ID to ticket data
    const ticketData = {
      ...req.body,
      organizationId,
    };
    
    const ticket = await ticketService.createTicket(ticketData, userId);
    
    return res.status(201).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    logger.error("Error creating ticket:", error);
    return next(error);
  }
};

/**
 * Get ticket by ID
 * @route GET /api/tickets/:id
 */
exports.getTicketById = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const organizationId = req.user.organizationId;
    
    const ticket = await ticketService.getTicketById(ticketId, organizationId);
    
    return res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    logger.error("Error getting ticket:", error);
    return next(error);
  }
};

/**
 * Get tickets with filters
 * @route GET /api/tickets
 */
exports.getTickets = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const { page = 1, limit = 20 } = req.query;
    
    // Extract filters from query params
    const filters = {
      status: req.query.status,
      priority: req.query.priority,
      category: req.query.category,
      assignedTo: req.query.assignedTo,
      primaryTeam: req.query.primaryTeam,
      supportingTeam: req.query.supportingTeam,
      customer: req.query.customer,
      search: req.query.search,
    };
    
    const result = await ticketService.getTickets(
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
    logger.error("Error getting tickets:", error);
    return next(error);
  }
};

/**
 * Update ticket
 * @route PUT /api/tickets/:id
 */
exports.updateTicket = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user._id;
    const organizationId = req.user.organizationId;
    
    const ticket = await ticketService.updateTicket(
      ticketId,
      req.body,
      userId,
      organizationId
    );
    
    return res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    logger.error("Error updating ticket:", error);
    return next(error);
  }
};

/**
 * Add comment to ticket
 * @route POST /api/tickets/:id/comments
 */
exports.addComment = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user._id;
    const organizationId = req.user.organizationId;
    
    const ticket = await ticketService.addComment(
      ticketId,
      req.body,
      userId,
      organizationId
    );
    
    return res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    logger.error("Error adding comment:", error);
    return next(error);
  }
};

/**
 * Assign ticket to user
 * @route POST /api/tickets/:id/assign
 */
exports.assignTicket = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { assigneeId } = req.body;
    const userId = req.user._id;
    const organizationId = req.user.organizationId;
    
    if (!assigneeId) {
      return next(new ApiError(400, "Assignee ID is required"));
    }
    
    const ticket = await ticketService.assignTicket(
      ticketId,
      assigneeId,
      userId,
      organizationId
    );
    
    return res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    logger.error("Error assigning ticket:", error);
    return next(error);
  }
};

/**
 * Assign ticket to team
 * @route POST /api/tickets/:id/assign-team
 */
exports.assignTicketToTeam = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { teamId, isPrimary = true } = req.body;
    const userId = req.user._id;
    const organizationId = req.user.organizationId;
    
    if (!teamId) {
      return next(new ApiError(400, "Team ID is required"));
    }
    
    const ticket = await ticketService.assignTicketToTeam(
      ticketId,
      teamId,
      isPrimary,
      userId,
      organizationId
    );
    
    return res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    logger.error("Error assigning ticket to team:", error);
    return next(error);
  }
};

/**
 * Get ticket statistics
 * @route GET /api/tickets/statistics
 */
exports.getTicketStatistics = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    
    const statistics = await ticketService.getTicketStatistics(organizationId);
    
    return res.status(200).json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    logger.error("Error getting ticket statistics:", error);
    return next(error);
  }
};
