/**
 * Query Service
 * Handles business logic for customer query operations
 */

const Query = require("../models/query.model");
const User = require("../../auth/models/user.model");
const { ApiError } = require("../../../utils/errors");
const logger = require("../../../utils/logger");
const mongoose = require("mongoose");
const notificationService = require("../../notification/services/notification.service");
const websocket = require("../../../websocket");
const ticketWs = require("../websocket/ticket.ws");

/**
 * Create a new customer query
 * @param {Object} queryData - Query data
 * @param {string} customerId - Customer ID
 * @returns {Promise<Query>} Created query
 */
exports.createQuery = async (queryData, customerId) => {
  try {
    // Validate customer exists
    const customer = await User.findById(customerId);
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }

    // Create query
    const query = new Query({
      ...queryData,
      customerId,
    });

    // Save query
    await query.save();

    // Send notifications to support team
    await sendQueryNotifications(query, "created");

    // Send WebSocket notification
    const primus = websocket.getPrimus();
    if (primus) {
      // Send to organization room
      ticketWs.sendOrganizationUpdate(
        primus,
        query.organizationId.toString(),
        "query:created",
        {
          queryId: query._id,
          query: {
            _id: query._id,
            queryNumber: query.queryNumber,
            subject: query.subject,
            status: query.status,
            category: query.category,
            createdAt: query.createdAt,
            customerId: query.customerId,
          },
        }
      );
    }

    return query;
  } catch (error) {
    logger.error("Error creating query:", error);
    throw error;
  }
};

/**
 * Get query by ID
 * @param {string} queryId - Query ID
 * @param {string} organizationId - Organization ID for security check
 * @returns {Promise<Query>} Query
 */
exports.getQueryById = async (queryId, organizationId) => {
  try {
    const query = await Query.findOne({
      _id: queryId,
      organizationId,
    })
      .populate("customerId", "profile.firstName profile.lastName email")
      .populate("assignedTo", "profile.firstName profile.lastName email")
      .populate("comments.author", "profile.firstName profile.lastName email")
      .populate("convertedToTicket")
      .populate("convertedBy", "profile.firstName profile.lastName email");

    if (!query) {
      throw new ApiError(404, "Query not found");
    }

    return query;
  } catch (error) {
    logger.error("Error getting query:", error);
    throw error;
  }
};

/**
 * Get queries with filters
 * @param {Object} filters - Filter criteria
 * @param {string} organizationId - Organization ID
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Queries and pagination info
 */
exports.getQueries = async (filters, organizationId, page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;

    // Build query
    const query = { organizationId };

    // Apply filters
    if (filters.status && filters.status !== "all") {
      query.status = filters.status;
    }

    if (filters.category && filters.category !== "all") {
      query.category = filters.category;
    }

    if (filters.customerId) {
      query.customerId = filters.customerId;
    }

    if (filters.assignedTo) {
      query.assignedTo = filters.assignedTo;
    }

    if (filters.search) {
      query.$or = [
        { queryNumber: { $regex: filters.search, $options: "i" } },
        { subject: { $regex: filters.search, $options: "i" } },
        { description: { $regex: filters.search, $options: "i" } },
      ];
    }

    // Execute query
    const queries = await Query.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customerId", "profile.firstName profile.lastName email")
      .populate("assignedTo", "profile.firstName profile.lastName email")
      .populate("convertedToTicket", "ticketNumber status");

    // Get total count
    const total = await Query.countDocuments(query);

    return {
      data: queries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error("Error getting queries:", error);
    throw error;
  }
};

/**
 * Update query
 * @param {string} queryId - Query ID
 * @param {Object} updateData - Data to update
 * @param {string} userId - User ID making the update
 * @param {string} organizationId - Organization ID for security check
 * @returns {Promise<Query>} Updated query
 */
exports.updateQuery = async (queryId, updateData, userId, organizationId) => {
  try {
    const query = await Query.findOne({
      _id: queryId,
      organizationId,
    });

    if (!query) {
      throw new ApiError(404, "Query not found");
    }

    // Update allowed fields
    const allowedFields = [
      "subject",
      "description",
      "category",
      "status",
      "assignedTo",
    ];

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        query[field] = updateData[field];
      }
    });

    // Save query
    await query.save();

    // Send notifications
    await sendQueryNotifications(query, "updated");

    return query;
  } catch (error) {
    logger.error("Error updating query:", error);
    throw error;
  }
};

/**
 * Add comment to query
 * @param {string} queryId - Query ID
 * @param {Object} commentData - Comment data
 * @param {string} userId - User ID adding the comment
 * @param {string} organizationId - Organization ID for security check
 * @returns {Promise<Query>} Updated query
 */
exports.addComment = async (queryId, commentData, userId, organizationId) => {
  try {
    const query = await Query.findOne({
      _id: queryId,
      organizationId,
    });

    if (!query) {
      throw new ApiError(404, "Query not found");
    }

    // Add comment
    const comment = {
      author: userId,
      text: commentData.text,
      isInternal: commentData.isInternal || false,
      createdAt: new Date(),
    };

    await query.addComment(comment);

    // Send notifications
    const commentType = comment.isInternal ? "internal_comment" : "comment";
    await sendQueryNotifications(query, commentType, {
      commentText:
        comment.text.substring(0, 100) +
        (comment.text.length > 100 ? "..." : ""),
    });

    // Send WebSocket notification
    const primus = websocket.getPrimus();
    if (primus) {
      const newComment = query.comments[query.comments.length - 1];

      // Send to query room
      ticketWs.sendQueryUpdate(
        primus,
        query._id.toString(),
        "query:comment_added",
        {
          queryId: query._id,
          comment: {
            _id: newComment._id,
            author: newComment.author,
            text: newComment.text,
            createdAt: newComment.createdAt,
            isInternal: newComment.isInternal,
          },
        }
      );
    }

    return query;
  } catch (error) {
    logger.error("Error adding comment:", error);
    throw error;
  }
};

/**
 * Assign query to support team member
 * @param {string} queryId - Query ID
 * @param {string} assigneeId - User ID to assign to
 * @param {string} userId - User ID making the assignment
 * @param {string} organizationId - Organization ID for security check
 * @returns {Promise<Query>} Updated query
 */
exports.assignQuery = async (queryId, assigneeId, userId, organizationId) => {
  try {
    const query = await Query.findOne({
      _id: queryId,
      organizationId,
    });

    if (!query) {
      throw new ApiError(404, "Query not found");
    }

    // Validate assignee exists
    const assignee = await User.findById(assigneeId);
    if (!assignee) {
      throw new ApiError(404, "Assignee not found");
    }

    // Assign query
    await query.assignTo(assigneeId);

    // Send notification to assignee
    await notificationService.createNotification({
      recipient: assigneeId,
      organizationId,
      type: "query",
      severity: "info",
      title: "Query Assigned",
      message: `Query #${query.queryNumber} has been assigned to you`,
      relatedTo: {
        model: "Query",
        id: query._id,
      },
      displayType: "corner",
      actions: [
        {
          label: "View Query",
          url: `/queries/${query._id}`,
        },
      ],
    });

    return query;
  } catch (error) {
    logger.error("Error assigning query:", error);
    throw error;
  }
};

/**
 * Convert query to ticket
 * @param {string} queryId - Query ID
 * @param {Object} ticketData - Ticket data
 * @param {string} userId - User ID making the conversion
 * @param {string} organizationId - Organization ID for security check
 * @returns {Promise<Object>} Converted ticket and updated query
 */
exports.convertToTicket = async (
  queryId,
  ticketData,
  userId,
  organizationId
) => {
  try {
    const query = await Query.findOne({
      _id: queryId,
      organizationId,
    });

    if (!query) {
      throw new ApiError(404, "Query not found");
    }

    // Check if already converted
    if (query.convertedToTicket) {
      throw new ApiError(400, "Query already converted to ticket");
    }

    // Convert to ticket
    const ticket = await query.convertToTicket(ticketData, userId);

    // Send notifications
    await sendQueryNotifications(query, "converted", {
      ticketId: ticket._id,
      ticketNumber: ticket.ticketNumber,
    });

    // Send WebSocket notification
    const primus = websocket.getPrimus();
    if (primus) {
      // Send to query room
      ticketWs.sendQueryUpdate(
        primus,
        query._id.toString(),
        "query:converted",
        {
          queryId: query._id,
          ticket: {
            _id: ticket._id,
            ticketNumber: ticket.ticketNumber,
            title: ticket.title,
            status: ticket.status,
            priority: ticket.priority,
          },
        }
      );

      // Send to organization room
      ticketWs.sendOrganizationUpdate(
        primus,
        query.organizationId.toString(),
        "query:converted",
        {
          queryId: query._id,
          queryNumber: query.queryNumber,
          ticket: {
            _id: ticket._id,
            ticketNumber: ticket.ticketNumber,
          },
        }
      );

      // Also send ticket created notification
      ticketWs.sendOrganizationUpdate(
        primus,
        ticket.organizationId.toString(),
        "ticket:created",
        {
          ticketId: ticket._id,
          ticket: {
            _id: ticket._id,
            ticketNumber: ticket.ticketNumber,
            title: ticket.title,
            status: ticket.status,
            priority: ticket.priority,
            createdAt: ticket.createdAt,
          },
        }
      );
    }

    return {
      ticket,
      query,
    };
  } catch (error) {
    logger.error("Error converting query to ticket:", error);
    throw error;
  }
};

/**
 * Get customer queries
 * @param {string} customerId - Customer ID
 * @param {string} organizationId - Organization ID
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Queries and pagination info
 */
exports.getCustomerQueries = async (
  customerId,
  organizationId,
  page = 1,
  limit = 20
) => {
  try {
    const skip = (page - 1) * limit;

    // Build query
    const query = {
      customerId,
      organizationId,
    };

    // Execute query
    const queries = await Query.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("assignedTo", "profile.firstName profile.lastName email")
      .populate("convertedToTicket", "ticketNumber status");

    // Get total count
    const total = await Query.countDocuments(query);

    return {
      data: queries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error("Error getting customer queries:", error);
    throw error;
  }
};

/**
 * Send notifications for query events
 * @param {Query} query - Query object
 * @param {string} eventType - Event type
 * @param {Object} additionalData - Additional data for notification
 * @returns {Promise<void>}
 */
const sendQueryNotifications = async (
  query,
  eventType,
  additionalData = {}
) => {
  try {
    const recipients = new Set();
    const organizationId = query.organizationId;

    // Add customer
    recipients.add(query.customerId.toString());

    // Add assignee if exists
    if (query.assignedTo) {
      recipients.add(query.assignedTo.toString());
    }

    // Add support team members
    const supportTeamMembers = await User.find({
      organizationId,
      "teams.teamType": "support",
    });

    supportTeamMembers.forEach((member) => {
      recipients.add(member._id.toString());
    });

    // Determine notification details based on event type
    let title, message, severity;

    switch (eventType) {
      case "created":
        title = "New Customer Query";
        message = `Query #${query.queryNumber}: ${query.subject}`;
        severity = "info";
        break;

      case "updated":
        title = "Query Updated";
        message = `Query #${query.queryNumber} has been updated`;
        severity = "info";
        break;

      case "comment":
        title = "New Comment on Query";
        message = `New comment on query #${query.queryNumber}: ${
          additionalData.commentText || ""
        }`;
        severity = "info";
        break;

      case "internal_comment":
        title = "New Internal Comment on Query";
        message = `New internal comment on query #${query.queryNumber}: ${
          additionalData.commentText || ""
        }`;
        severity = "info";
        break;

      case "converted":
        title = "Query Converted to Ticket";
        message = `Query #${query.queryNumber} has been converted to ticket #${
          additionalData.ticketNumber || ""
        }`;
        severity = "success";
        break;

      default:
        title = "Query Notification";
        message = `Notification for query #${query.queryNumber}`;
        severity = "info";
    }

    // Send notifications to all recipients
    for (const recipientId of recipients) {
      // Skip internal comments for customer
      if (
        eventType === "internal_comment" &&
        recipientId === query.customerId.toString()
      ) {
        continue;
      }

      await notificationService.createNotification({
        recipient: recipientId,
        organizationId,
        type: "query",
        severity,
        title,
        message,
        relatedTo: {
          model: "Query",
          id: query._id,
        },
        displayType: "corner",
        actions: [
          {
            label: eventType === "converted" ? "View Ticket" : "View Query",
            url:
              eventType === "converted"
                ? `/tickets/${additionalData.ticketId}`
                : `/queries/${query._id}`,
          },
        ],
      });
    }
  } catch (error) {
    logger.error("Error sending query notifications:", error);
    // Don't throw, just log the error
  }
};
