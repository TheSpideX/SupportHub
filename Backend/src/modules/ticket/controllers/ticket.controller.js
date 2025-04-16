/**
 * Ticket Controller
 * Handles HTTP requests for ticket operations
 */

const ticketService = require("../services/ticket.service");
const { ApiError } = require("../../../utils/errors");
const logger = require("../../../utils/logger");
const Ticket = require("../models/ticket.model");

/**
 * Create a new ticket
 * @route POST /api/tickets
 */
exports.createTicket = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const organizationId = req.user.organizationId;

    // Log the request details for debugging
    logger.info("Creating ticket with data:", {
      body: req.body,
      bodyType: typeof req.body,
      bodyKeys: Object.keys(req.body),
      headers: req.headers,
      contentType: req.headers["content-type"],
      userId,
      organizationId,
    });

    // Handle potential string parsing issues
    let ticketData = req.body;
    if (typeof req.body === "string") {
      try {
        ticketData = JSON.parse(req.body);
        logger.info("Parsed string body to JSON", { parsedData: ticketData });
      } catch (parseError) {
        logger.error("Failed to parse request body as JSON", {
          error: parseError,
        });
      }
    }

    // Direct approach - create a new ticket object with explicit fields
    const newTicket = new Ticket({
      title: ticketData.title,
      description: ticketData.description,
      category: ticketData.category,
      priority: ticketData.priority || "medium",
      organizationId,
      source: ticketData.source || "direct_creation",
      createdBy: userId,
      status: "new", // Changed from 'open' to 'new' to match valid enum values
      auditLog: [
        {
          action: "created",
          timestamp: new Date(),
          performedBy: userId,
        },
      ],
    });

    // Add optional fields if they exist
    if (ticketData.subcategory) {
      newTicket.subcategory = ticketData.subcategory;
    }

    if (ticketData.primaryTeam) {
      newTicket.primaryTeam = {
        teamId: ticketData.primaryTeam,
        assignedAt: new Date(),
        assignedBy: userId,
      };
    }

    if (ticketData.assignedTo) {
      newTicket.assignedTo = ticketData.assignedTo;

      // Update status if it's new
      if (newTicket.status === "new") {
        newTicket.status = "assigned";
      }
    }

    // Validate the ticket manually
    try {
      await newTicket.validate();
    } catch (validationError) {
      logger.error("Ticket validation failed:", validationError);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationError.errors,
      });
    }

    // Save the ticket directly
    await newTicket.save();

    // Apply SLA policy
    await ticketService.applySLAToTicket(newTicket);

    // Save again with SLA info
    await newTicket.save();

    logger.info("Ticket created successfully:", { ticketId: newTicket._id });

    // Populate necessary fields for response
    await newTicket.populate(
      "createdBy",
      "profile.firstName profile.lastName email"
    );
    if (newTicket.assignedTo) {
      await newTicket.populate(
        "assignedTo",
        "profile.firstName profile.lastName email"
      );
    }
    if (newTicket.primaryTeam && newTicket.primaryTeam.teamId) {
      await newTicket.populate("primaryTeam.teamId", "name teamType");
    }

    return res.status(201).json({
      success: true,
      data: newTicket,
    });
  } catch (error) {
    logger.error("Error creating ticket:", error);

    // Handle validation errors from Mongoose
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
        errors: error.errors,
      });
    }

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

    // Process comments to ensure they have proper user information and text
    if (ticket.comments && Array.isArray(ticket.comments)) {
      console.log(
        "Processing comments in getTicketById, count:",
        ticket.comments.length
      );
      console.log("Original comments:", JSON.stringify(ticket.comments));

      ticket.comments = ticket.comments.map((comment) => {
        console.log("Processing comment:", comment);

        // Ensure comment has text
        if (!comment.text || comment.text.trim() === "") {
          console.log("Comment has empty text, setting default");
          comment.text = "[No comment text provided]";
        }

        // Force text to be a string
        if (typeof comment.text !== "string") {
          console.log("Comment text is not a string, converting");
          comment.text = String(comment.text || "[No comment text provided]");
        }

        // Format user information if it's an object
        if (comment.author && typeof comment.author === "object") {
          comment.author.fullName =
            comment.author.profile?.firstName &&
            comment.author.profile?.lastName
              ? `${comment.author.profile.firstName} ${comment.author.profile.lastName}`
              : comment.author.email || "Unknown";
          console.log("Set author fullName:", comment.author.fullName);
        }
        return comment;
      });

      console.log("Processed comments:", JSON.stringify(ticket.comments));
    }

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
 * Get ticket audit log
 * @route GET /api/tickets/:id/audit-log
 */
exports.getTicketAuditLog = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const organizationId = req.user.organizationId;

    const auditLog = await ticketService.getTicketAuditLog(
      ticketId,
      organizationId
    );

    return res.status(200).json({
      success: true,
      data: auditLog,
    });
  } catch (error) {
    logger.error("Error getting ticket audit log:", error);
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

    logger.info("Adding comment to ticket - controller", {
      ticketId,
      userId,
      body: req.body,
      bodyText: req.body.text,
      bodyTextType: typeof req.body.text,
      bodyTextLength: req.body.text ? req.body.text.length : 0,
    });

    // Log the raw request body for debugging
    console.log("Raw request body:", req.body);
    console.log("Request headers:", req.headers);

    // Handle potential JSON parsing issues
    let commentText;
    try {
      // If req.body is a string (which might happen with some middleware configurations)
      if (typeof req.body === "string") {
        try {
          const parsedBody = JSON.parse(req.body);
          commentText = parsedBody.text;
          console.log("Parsed body from string:", parsedBody);
        } catch (parseError) {
          console.error("Error parsing request body string:", parseError);
          commentText = req.body;
        }
      } else {
        // Normal object body
        commentText = req.body.text;
      }

      console.log("Extracted comment text:", commentText);
    } catch (error) {
      console.error("Error extracting comment text:", error);
      commentText = null;
    }

    // Validate comment text exists
    if (!commentText) {
      logger.warn("Empty comment text received in controller");
      return res.status(400).json({
        success: false,
        message: "Comment text cannot be empty",
      });
    }

    // Validate comment text is a string
    if (typeof commentText !== "string") {
      logger.warn("Invalid comment text type received in controller", {
        textType: typeof commentText,
      });
      return res.status(400).json({
        success: false,
        message: "Comment text must be a string",
      });
    }

    // Validate comment text is not just whitespace
    if (commentText.trim() === "") {
      logger.warn("Whitespace-only comment text received in controller");
      return res.status(400).json({
        success: false,
        message: "Comment text cannot be empty",
      });
    }

    // Update req.body with the validated text
    req.body.text = commentText.trim();

    const ticket = await ticketService.addComment(
      ticketId,
      req.body,
      userId,
      organizationId
    );

    // Check if the comment was added successfully
    const addedComment = ticket.comments[ticket.comments.length - 1];
    logger.info("Comment added successfully", {
      addedComment,
      commentText: addedComment.text,
      commentTextType: typeof addedComment.text,
      commentTextLength: addedComment.text ? addedComment.text.length : 0,
    });

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
