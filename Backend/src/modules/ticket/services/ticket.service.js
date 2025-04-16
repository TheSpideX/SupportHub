/**
 * Ticket Service
 * Handles business logic for ticket operations
 */

const Ticket = require("../models/ticket.model");
const SLAPolicy = require("../models/sla-policy.model");
const User = require("../../auth/models/user.model");
const Team = require("../../team/models/team.model");
const { ApiError } = require("../../../utils/errors");
const logger = require("../../../utils/logger");
const mongoose = require("mongoose");
const notificationService = require("../../notification/services/notification.service");
const websocket = require("../../../websocket");
const ticketWs = require("../websocket/ticket.ws");

/**
 * Create a new ticket
 * @param {Object} ticketData - Ticket data
 * @param {string} userId - User ID of creator
 * @returns {Promise<Ticket>} Created ticket
 */
exports.createTicket = async (ticketData, userId) => {
  try {
    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Create ticket
    const ticket = new Ticket({
      ...ticketData,
      createdBy: userId,
      source: ticketData.source || "direct_creation",
    });

    // If primary team is specified, set it
    if (ticketData.primaryTeam) {
      // Validate team exists
      const team = await Team.findById(ticketData.primaryTeam);
      if (!team) {
        throw new ApiError(404, "Team not found");
      }

      ticket.primaryTeam = {
        teamId: ticketData.primaryTeam,
        assignedAt: new Date(),
        assignedBy: userId,
      };
    }

    // If assignee is specified, set it
    if (ticketData.assignedTo) {
      // Validate assignee exists
      const assignee = await User.findById(ticketData.assignedTo);
      if (!assignee) {
        throw new ApiError(404, "Assignee not found");
      }

      ticket.assignedTo = ticketData.assignedTo;

      // Update status if it's new
      if (!ticketData.status || ticketData.status === "new") {
        ticket.status = "assigned";
      }
    }

    // Apply SLA if policy is specified or get default for organization
    if (ticketData.slaPolicy) {
      await applySLAPolicy(ticket, ticketData.slaPolicy);
    } else {
      await applyDefaultSLAPolicy(ticket);
    }

    // Save ticket
    await ticket.save();

    // Send notifications
    await sendTicketNotifications(ticket, "created");

    // Send WebSocket notification
    const primus = websocket.getPrimus();
    if (primus) {
      // Send to organization room
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

    return ticket;
  } catch (error) {
    logger.error("Error creating ticket:", error);
    throw error;
  }
};

/**
 * Get ticket by ID
 * @param {string} ticketId - Ticket ID
 * @param {string} organizationId - Organization ID for security check
 * @returns {Promise<Ticket>} Ticket
 */
exports.getTicketById = async (ticketId, organizationId) => {
  try {
    const ticket = await Ticket.findOne({
      _id: ticketId,
      organizationId,
    })
      .populate("createdBy", "profile.firstName profile.lastName email")
      .populate("assignedTo", "profile.firstName profile.lastName email")
      .populate("primaryTeam.teamId", "name teamType")
      .populate("supportingTeams.teamId", "name teamType")
      .populate("customer.userId", "profile.firstName profile.lastName email")
      .populate("comments.author", "profile.firstName profile.lastName email")
      .populate("originalQuery");

    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }

    return ticket;
  } catch (error) {
    logger.error("Error getting ticket:", error);
    throw error;
  }
};

/**
 * Get tickets with filters
 * @param {Object} filters - Filter criteria
 * @param {string} organizationId - Organization ID
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Tickets and pagination info
 */
exports.getTickets = async (filters, organizationId, page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;

    // Build query
    const query = { organizationId };

    // Apply filters
    if (filters.status && filters.status !== "all") {
      query.status = filters.status;
    }

    if (filters.priority && filters.priority !== "all") {
      query.priority = filters.priority;
    }

    if (filters.category && filters.category !== "all") {
      query.category = filters.category;
    }

    if (filters.assignedTo) {
      query.assignedTo = filters.assignedTo;
    }

    if (filters.primaryTeam) {
      query["primaryTeam.teamId"] = filters.primaryTeam;
    }

    if (filters.supportingTeam) {
      query["supportingTeams.teamId"] = filters.supportingTeam;
    }

    if (filters.customer) {
      query["customer.userId"] = filters.customer;
    }

    if (filters.search) {
      query.$or = [
        { ticketNumber: { $regex: filters.search, $options: "i" } },
        { title: { $regex: filters.search, $options: "i" } },
        { description: { $regex: filters.search, $options: "i" } },
      ];
    }

    // Execute query
    const tickets = await Ticket.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("createdBy", "profile.firstName profile.lastName email")
      .populate("assignedTo", "profile.firstName profile.lastName email")
      .populate("primaryTeam.teamId", "name teamType")
      .populate("customer.userId", "profile.firstName profile.lastName email");

    // Get total count
    const total = await Ticket.countDocuments(query);

    return {
      data: tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error("Error getting tickets:", error);
    throw error;
  }
};

/**
 * Update ticket
 * @param {string} ticketId - Ticket ID
 * @param {Object} updateData - Data to update
 * @param {string} userId - User ID making the update
 * @param {string} organizationId - Organization ID for security check
 * @returns {Promise<Ticket>} Updated ticket
 */
exports.updateTicket = async (ticketId, updateData, userId, organizationId) => {
  try {
    const ticket = await Ticket.findOne({
      _id: ticketId,
      organizationId,
    });

    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }

    // Handle status change
    if (updateData.status && updateData.status !== ticket.status) {
      ticket._statusChangedBy = userId;
      ticket._statusChangeReason = updateData.statusReason || "Status updated";
      ticket.status = updateData.status;
    }

    // Handle assignee change
    if (
      updateData.assignedTo &&
      updateData.assignedTo !== ticket.assignedTo?.toString()
    ) {
      const previousAssignee = ticket.assignedTo;
      ticket.assignedTo = updateData.assignedTo;

      // Add to audit log
      ticket.auditLog.push({
        action: "assigned",
        performedBy: userId,
        timestamp: new Date(),
        details: {
          previousAssignee,
          newAssignee: updateData.assignedTo,
        },
      });

      // Send notification to new assignee
      await notificationService.createNotification({
        recipient: updateData.assignedTo,
        organizationId,
        type: "ticket",
        severity: ticket.priority === "critical" ? "critical" : "info",
        title: "Ticket Assigned",
        message: `Ticket #${ticket.ticketNumber} has been assigned to you`,
        relatedTo: {
          model: "Ticket",
          id: ticket._id,
        },
        displayType: ticket.priority === "critical" ? "modal" : "corner",
        actions: [
          {
            label: "View Ticket",
            url: `/tickets/${ticket._id}`,
          },
        ],
      });
    }

    // Handle primary team change
    if (
      updateData.primaryTeam &&
      (!ticket.primaryTeam ||
        updateData.primaryTeam !== ticket.primaryTeam.teamId?.toString())
    ) {
      await ticket.assignToTeam(updateData.primaryTeam, userId, true);
    }

    // Handle supporting teams
    if (
      updateData.supportingTeams &&
      Array.isArray(updateData.supportingTeams)
    ) {
      for (const teamId of updateData.supportingTeams) {
        // Check if team is already in supporting teams
        const existingTeam = ticket.supportingTeams.find(
          (team) => team.teamId.toString() === teamId
        );

        if (!existingTeam) {
          await ticket.assignToTeam(teamId, userId, false);
        }
      }
    }

    // Update other fields
    const allowedFields = [
      "title",
      "description",
      "category",
      "subcategory",
      "priority",
      "impact",
      "tags",
      "customFields",
    ];

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        ticket[field] = updateData[field];
      }
    });

    // If priority changed, recalculate SLA
    if (updateData.priority && updateData.priority !== ticket.priority) {
      if (ticket.sla && ticket.sla.policyId) {
        await applySLAPolicy(ticket, ticket.sla.policyId);
      }
    }

    // Save ticket
    await ticket.save();

    // Send notifications
    await sendTicketNotifications(ticket, "updated");

    // Send WebSocket notification
    const primus = websocket.getPrimus();
    if (primus) {
      // Send to ticket room
      ticketWs.sendTicketUpdate(
        primus,
        ticket._id.toString(),
        "ticket:updated",
        {
          ticket: {
            _id: ticket._id,
            ticketNumber: ticket.ticketNumber,
            title: ticket.title,
            description: ticket.description,
            status: ticket.status,
            priority: ticket.priority,
            category: ticket.category,
            subcategory: ticket.subcategory,
            assignedTo: ticket.assignedTo,
            primaryTeam: ticket.primaryTeam,
            supportingTeams: ticket.supportingTeams,
            updatedAt: ticket.updatedAt,
          },
        }
      );

      // Send to organization room
      ticketWs.sendOrganizationUpdate(
        primus,
        ticket.organizationId.toString(),
        "ticket:updated",
        {
          ticketId: ticket._id,
          ticket: {
            _id: ticket._id,
            ticketNumber: ticket.ticketNumber,
            title: ticket.title,
            status: ticket.status,
            priority: ticket.priority,
            updatedAt: ticket.updatedAt,
          },
        }
      );
    }

    return ticket;
  } catch (error) {
    logger.error("Error updating ticket:", error);
    throw error;
  }
};

/**
 * Add comment to ticket
 * @param {string} ticketId - Ticket ID
 * @param {Object} commentData - Comment data
 * @param {string} userId - User ID adding the comment
 * @param {string} organizationId - Organization ID for security check
 * @returns {Promise<Ticket>} Updated ticket
 */
exports.addComment = async (ticketId, commentData, userId, organizationId) => {
  try {
    const ticket = await Ticket.findOne({
      _id: ticketId,
      organizationId,
    });

    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }

    // Add comment
    const comment = {
      author: userId,
      text: commentData.text,
      isInternal: commentData.isInternal || false,
      createdAt: new Date(),
    };

    // If specific teams should see this comment
    if (
      commentData.visibleToTeams &&
      Array.isArray(commentData.visibleToTeams)
    ) {
      comment.visibleToTeams = commentData.visibleToTeams;
    }

    // Add attachments if any
    if (commentData.attachments && Array.isArray(commentData.attachments)) {
      comment.attachments = commentData.attachments;
    }

    await ticket.addComment(comment);

    // Send notifications
    const commentType = comment.isInternal ? "internal_comment" : "comment";
    await sendTicketNotifications(ticket, commentType, {
      commentId: ticket.comments[ticket.comments.length - 1]._id,
      commentText:
        comment.text.substring(0, 100) +
        (comment.text.length > 100 ? "..." : ""),
    });

    // Send WebSocket notification
    const primus = websocket.getPrimus();
    if (primus) {
      const newComment = ticket.comments[ticket.comments.length - 1];

      // Send to ticket room
      ticketWs.sendTicketUpdate(
        primus,
        ticket._id.toString(),
        "ticket:comment_added",
        {
          ticketId: ticket._id,
          comment: {
            _id: newComment._id,
            author: newComment.author,
            text: newComment.text,
            createdAt: newComment.createdAt,
            isInternal: newComment.isInternal,
            attachments: newComment.attachments,
          },
        }
      );
    }

    return ticket;
  } catch (error) {
    logger.error("Error adding comment:", error);
    throw error;
  }
};

/**
 * Assign ticket to user
 * @param {string} ticketId - Ticket ID
 * @param {string} assigneeId - User ID to assign to
 * @param {string} userId - User ID making the assignment
 * @param {string} organizationId - Organization ID for security check
 * @returns {Promise<Ticket>} Updated ticket
 */
exports.assignTicket = async (ticketId, assigneeId, userId, organizationId) => {
  try {
    const ticket = await Ticket.findOne({
      _id: ticketId,
      organizationId,
    });

    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }

    // Validate assignee exists
    const assignee = await User.findById(assigneeId);
    if (!assignee) {
      throw new ApiError(404, "Assignee not found");
    }

    // Assign ticket
    await ticket.assignTo(assigneeId, userId);

    // Send notification to assignee
    await notificationService.createNotification({
      recipient: assigneeId,
      organizationId,
      type: "ticket",
      severity: ticket.priority === "critical" ? "critical" : "info",
      title: "Ticket Assigned",
      message: `Ticket #${ticket.ticketNumber} has been assigned to you`,
      relatedTo: {
        model: "Ticket",
        id: ticket._id,
      },
      displayType: ticket.priority === "critical" ? "modal" : "corner",
      actions: [
        {
          label: "View Ticket",
          url: `/tickets/${ticket._id}`,
        },
      ],
    });

    // Send WebSocket notification
    const primus = websocket.getPrimus();
    if (primus) {
      // Send to ticket room
      ticketWs.sendTicketUpdate(
        primus,
        ticket._id.toString(),
        "ticket:assigned",
        {
          ticketId: ticket._id,
          assignedTo: {
            _id: assigneeId,
          },
          assignedBy: userId,
        }
      );

      // Send to organization room
      ticketWs.sendOrganizationUpdate(
        primus,
        organizationId.toString(),
        "ticket:assigned",
        {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          assignedTo: {
            _id: assigneeId,
          },
        }
      );
    }

    return ticket;
  } catch (error) {
    logger.error("Error assigning ticket:", error);
    throw error;
  }
};

/**
 * Assign ticket to team
 * @param {string} ticketId - Ticket ID
 * @param {string} teamId - Team ID to assign to
 * @param {boolean} isPrimary - Whether this is the primary team
 * @param {string} userId - User ID making the assignment
 * @param {string} organizationId - Organization ID for security check
 * @returns {Promise<Ticket>} Updated ticket
 */
exports.assignTicketToTeam = async (
  ticketId,
  teamId,
  isPrimary,
  userId,
  organizationId
) => {
  try {
    const ticket = await Ticket.findOne({
      _id: ticketId,
      organizationId,
    });

    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }

    // Validate team exists
    const team = await Team.findById(teamId);
    if (!team) {
      throw new ApiError(404, "Team not found");
    }

    // Assign ticket to team
    await ticket.assignToTeam(teamId, userId, isPrimary);

    // Send notifications to team members
    const teamMembers = await User.find({
      "teams.teamId": teamId,
    });

    for (const member of teamMembers) {
      await notificationService.createNotification({
        recipient: member._id,
        organizationId,
        type: "ticket",
        severity: ticket.priority === "critical" ? "critical" : "info",
        title: isPrimary
          ? "Ticket Assigned to Your Team"
          : "Ticket Needs Support from Your Team",
        message: `Ticket #${ticket.ticketNumber} has been assigned to your team`,
        relatedTo: {
          model: "Ticket",
          id: ticket._id,
        },
        displayType: ticket.priority === "critical" ? "modal" : "corner",
        actions: [
          {
            label: "View Ticket",
            url: `/tickets/${ticket._id}`,
          },
        ],
      });
    }

    // Send WebSocket notification
    const primus = websocket.getPrimus();
    if (primus) {
      // Get team info
      const team = await Team.findById(teamId).select("name teamType");

      // Send to ticket room
      ticketWs.sendTicketUpdate(
        primus,
        ticket._id.toString(),
        "ticket:team_assigned",
        {
          ticketId: ticket._id,
          team: {
            _id: teamId,
            name: team?.name || "Unknown Team",
            teamType: team?.teamType || "unknown",
          },
          isPrimary,
          assignedBy: userId,
        }
      );

      // Send to organization room
      ticketWs.sendOrganizationUpdate(
        primus,
        organizationId.toString(),
        "ticket:team_assigned",
        {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          team: {
            _id: teamId,
            name: team?.name || "Unknown Team",
            teamType: team?.teamType || "unknown",
          },
          isPrimary,
        }
      );
    }

    return ticket;
  } catch (error) {
    logger.error("Error assigning ticket to team:", error);
    throw error;
  }
};

/**
 * Apply SLA policy to ticket
 * @param {Ticket} ticket - Ticket object
 * @param {string} policyId - SLA policy ID
 * @returns {Promise<void>}
 */
const applySLAPolicy = async (ticket, policyId) => {
  try {
    const policy = await SLAPolicy.findById(policyId);
    if (!policy) {
      throw new ApiError(404, "SLA policy not found");
    }

    // Calculate deadlines
    const deadlines = policy.calculateDeadlines(
      ticket.priority,
      ticket.createdAt
    );

    // Update ticket SLA
    ticket.sla = {
      policyId: policy._id,
      responseDeadline: deadlines.responseDeadline,
      resolutionDeadline: deadlines.resolutionDeadline,
      breached: {
        response: false,
        resolution: false,
      },
    };
  } catch (error) {
    logger.error("Error applying SLA policy:", error);
    throw error;
  }
};

/**
 * Apply default SLA policy for organization
 * @param {Ticket} ticket - Ticket object
 * @returns {Promise<void>}
 */
const applyDefaultSLAPolicy = async (ticket) => {
  try {
    // Find default policy for organization
    const defaultPolicy = await SLAPolicy.findOne({
      organizationId: ticket.organizationId,
      isActive: true,
    });

    if (defaultPolicy) {
      await applySLAPolicy(ticket, defaultPolicy._id);
    }
  } catch (error) {
    logger.error("Error applying default SLA policy:", error);
    // Don't throw, just log the error
  }
};

/**
 * Send notifications for ticket events
 * @param {Ticket} ticket - Ticket object
 * @param {string} eventType - Event type
 * @param {Object} additionalData - Additional data for notification
 * @returns {Promise<void>}
 */
const sendTicketNotifications = async (
  ticket,
  eventType,
  additionalData = {}
) => {
  try {
    const recipients = new Set();
    const organizationId = ticket.organizationId;

    // Add assignee if exists
    if (ticket.assignedTo) {
      recipients.add(ticket.assignedTo.toString());
    }

    // Add creator
    recipients.add(ticket.createdBy.toString());

    // Add customer if exists
    if (ticket.customer && ticket.customer.userId) {
      recipients.add(ticket.customer.userId.toString());
    }

    // Add team members
    if (ticket.primaryTeam && ticket.primaryTeam.teamId) {
      const teamMembers = await User.find({
        "teams.teamId": ticket.primaryTeam.teamId,
      });

      teamMembers.forEach((member) => {
        recipients.add(member._id.toString());
      });
    }

    // Add supporting team members
    for (const team of ticket.supportingTeams || []) {
      if (team.teamId) {
        const teamMembers = await User.find({
          "teams.teamId": team.teamId,
        });

        teamMembers.forEach((member) => {
          recipients.add(member._id.toString());
        });
      }
    }

    // Determine notification details based on event type
    let title, message, severity;

    switch (eventType) {
      case "created":
        title = "New Ticket Created";
        message = `Ticket #${ticket.ticketNumber}: ${ticket.title}`;
        severity = ticket.priority === "critical" ? "critical" : "info";
        break;

      case "updated":
        title = "Ticket Updated";
        message = `Ticket #${ticket.ticketNumber} has been updated`;
        severity = "info";
        break;

      case "comment":
        title = "New Comment on Ticket";
        message = `New comment on ticket #${ticket.ticketNumber}: ${
          additionalData.commentText || ""
        }`;
        severity = "info";
        break;

      case "internal_comment":
        title = "New Internal Comment on Ticket";
        message = `New internal comment on ticket #${ticket.ticketNumber}: ${
          additionalData.commentText || ""
        }`;
        severity = "info";
        break;

      case "status_changed":
        title = "Ticket Status Changed";
        message = `Ticket #${ticket.ticketNumber} status changed to ${ticket.status}`;
        severity = "info";
        break;

      case "sla_approaching":
        title = "SLA Deadline Approaching";
        message = `SLA deadline approaching for ticket #${ticket.ticketNumber}`;
        severity = "warning";
        break;

      case "sla_breached":
        title = "SLA Deadline Breached";
        message = `SLA deadline breached for ticket #${ticket.ticketNumber}`;
        severity = "error";
        break;

      default:
        title = "Ticket Notification";
        message = `Notification for ticket #${ticket.ticketNumber}`;
        severity = "info";
    }

    // Send notifications to all recipients
    for (const recipientId of recipients) {
      await notificationService.createNotification({
        recipient: recipientId,
        organizationId,
        type: "ticket",
        severity,
        title,
        message,
        relatedTo: {
          model: "Ticket",
          id: ticket._id,
        },
        displayType: severity === "critical" ? "modal" : "corner",
        actions: [
          {
            label: "View Ticket",
            url: `/tickets/${ticket._id}`,
          },
        ],
      });
    }
  } catch (error) {
    logger.error("Error sending ticket notifications:", error);
    // Don't throw, just log the error
  }
};

/**
 * Get ticket statistics
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Ticket statistics
 */
exports.getTicketStatistics = async (organizationId) => {
  try {
    // Get counts by status
    const statusCounts = await Ticket.aggregate([
      {
        $match: { organizationId: new mongoose.Types.ObjectId(organizationId) },
      },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Get counts by priority
    const priorityCounts = await Ticket.aggregate([
      {
        $match: { organizationId: new mongoose.Types.ObjectId(organizationId) },
      },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]);

    // Get counts by team
    const teamCounts = await Ticket.aggregate([
      {
        $match: { organizationId: new mongoose.Types.ObjectId(organizationId) },
      },
      { $group: { _id: "$primaryTeam.teamId", count: { $sum: 1 } } },
    ]);

    // Get SLA breach statistics
    const slaStats = await Ticket.aggregate([
      {
        $match: { organizationId: new mongoose.Types.ObjectId(organizationId) },
      },
      {
        $group: {
          _id: null,
          totalTickets: { $sum: 1 },
          responseBreached: {
            $sum: {
              $cond: [{ $eq: ["$sla.breached.response", true] }, 1, 0],
            },
          },
          resolutionBreached: {
            $sum: {
              $cond: [{ $eq: ["$sla.breached.resolution", true] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Format results
    const formattedStatusCounts = statusCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const formattedPriorityCounts = priorityCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    // Get team names
    const teamIds = teamCounts.map((item) => item._id).filter((id) => id);
    const teams = await Team.find({ _id: { $in: teamIds } }, { name: 1 });

    const formattedTeamCounts = teamCounts.reduce((acc, item) => {
      if (item._id) {
        const team = teams.find(
          (t) => t._id.toString() === item._id.toString()
        );
        acc[team ? team.name : item._id] = item.count;
      } else {
        acc["Unassigned"] = item.count;
      }
      return acc;
    }, {});

    // Calculate SLA percentages
    const slaPercentages =
      slaStats.length > 0
        ? {
            responseBreachPercentage:
              (slaStats[0].responseBreached / slaStats[0].totalTickets) * 100,
            resolutionBreachPercentage:
              (slaStats[0].resolutionBreached / slaStats[0].totalTickets) * 100,
          }
        : {
            responseBreachPercentage: 0,
            resolutionBreachPercentage: 0,
          };

    return {
      statusCounts: formattedStatusCounts,
      priorityCounts: formattedPriorityCounts,
      teamCounts: formattedTeamCounts,
      slaStats: {
        ...slaPercentages,
        totalTickets: slaStats.length > 0 ? slaStats[0].totalTickets : 0,
        responseBreached:
          slaStats.length > 0 ? slaStats[0].responseBreached : 0,
        resolutionBreached:
          slaStats.length > 0 ? slaStats[0].resolutionBreached : 0,
      },
    };
  } catch (error) {
    logger.error("Error getting ticket statistics:", error);
    throw error;
  }
};
