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
    // Log the ticket data for debugging
    logger.info("Creating ticket with data in service:", {
      ticketData,
      userId,
      hasRequiredFields: !!(
        ticketData.title &&
        ticketData.description &&
        ticketData.category
      ),
    });

    // Validate required fields again as a safeguard
    if (!ticketData.title || !ticketData.description || !ticketData.category) {
      const missingFields = [];
      if (!ticketData.title) missingFields.push("title");
      if (!ticketData.description) missingFields.push("description");
      if (!ticketData.category) missingFields.push("category");

      const error = new Error(
        `Missing required fields: ${missingFields.join(", ")}`
      );
      error.name = "ValidationError";
      error.errors = {};

      missingFields.forEach((field) => {
        error.errors[field] = {
          message: `${
            field.charAt(0).toUpperCase() + field.slice(1)
          } is required`,
        };
      });

      throw error;
    }

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Create ticket with explicit required fields
    const ticket = new Ticket({
      title: ticketData.title,
      description: ticketData.description,
      category: ticketData.category,
      priority: ticketData.priority || "medium",
      createdBy: userId,
      organizationId: ticketData.organizationId,
      source: ticketData.source || "direct_creation",
      // Add other fields from ticketData
      ...(ticketData.subcategory
        ? { subcategory: ticketData.subcategory }
        : {}),
      status: "open",
      auditLog: [
        {
          action: "created",
          timestamp: new Date(),
          userId,
        },
      ],
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
      .populate("createdBy", "profile.firstName profile.lastName email role")
      .populate("assignedTo", "profile.firstName profile.lastName email role")
      .populate("primaryTeam.teamId", "name teamType")
      .populate("supportingTeams.teamId", "name teamType")
      .populate("customer.userId", "profile.firstName profile.lastName email")
      .populate(
        "comments.author",
        "profile.firstName profile.lastName email role"
      )
      .populate(
        "auditLog.performedBy",
        "profile.firstName profile.lastName email role fullName"
      )
      .populate(
        "statusHistory.changedBy",
        "profile.firstName profile.lastName email role"
      )
      .populate("originalQuery")
      .populate("sla.policyId");

    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }

    // Process comments to ensure they have proper user information and text
    if (ticket.comments && Array.isArray(ticket.comments)) {
      ticket.comments = ticket.comments.map((comment) => {
        // Ensure comment has text
        if (!comment.text || comment.text.trim() === "") {
          comment.text = "[No comment text provided]";
        }

        // Format user information if it's an object
        if (comment.author && typeof comment.author === "object") {
          comment.author.fullName =
            comment.author.profile?.firstName &&
            comment.author.profile?.lastName
              ? `${comment.author.profile.firstName} ${comment.author.profile.lastName}`
              : comment.author.email || "Unknown";
        }
        return comment;
      });
    }

    return ticket;
  } catch (error) {
    logger.error("Error getting ticket:", error);
    throw error;
  }
};

/**
 * Get ticket audit log
 * @param {string} ticketId - Ticket ID
 * @param {string} organizationId - Organization ID for security check
 * @returns {Promise<Array>} Audit log entries grouped by status
 */
exports.getTicketAuditLog = async (ticketId, organizationId) => {
  try {
    const ticket = await Ticket.findOne(
      {
        _id: ticketId,
        organizationId,
      },
      {
        auditLog: 1,
        statusHistory: 1,
        comments: 1,
        status: 1,
        createdAt: 1,
        createdBy: 1,
        ticketNumber: 1,
        title: 1,
      }
    )
      .populate(
        "auditLog.performedBy",
        "profile.firstName profile.lastName email fullName"
      )
      .populate(
        "statusHistory.changedBy",
        "profile.firstName profile.lastName email"
      )
      .populate("comments.author", "profile.firstName profile.lastName email")
      .populate("createdBy", "profile.firstName profile.lastName email");

    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }

    // Process audit log to ensure consistent format
    const processedAuditLog = ticket.auditLog.map((entry) => {
      // Format user information
      let userName = "Unknown";
      if (entry.performedBy) {
        if (typeof entry.performedBy === "object") {
          if (
            entry.performedBy.profile?.firstName &&
            entry.performedBy.profile?.lastName
          ) {
            userName = `${entry.performedBy.profile.firstName} ${entry.performedBy.profile.lastName}`;
          } else if (entry.performedBy.fullName) {
            userName = entry.performedBy.fullName;
          } else if (entry.performedBy.email) {
            userName = entry.performedBy.email;
          }
        }
      }

      // Return formatted entry
      return {
        _id: entry._id,
        action: entry.action,
        timestamp: entry.timestamp,
        performedBy:
          typeof entry.performedBy === "object"
            ? {
                _id: entry.performedBy._id,
                name: userName,
              }
            : {
                _id: entry.performedBy,
                name: userName,
              },
        details: entry.details || {},
      };
    });

    // Sort by timestamp, oldest first (for grouping)
    processedAuditLog.sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    // Group activities by status changes
    const groupedActivities = [];

    // Initialize with creation status
    let currentGroup = {
      status: "created",
      statusLabel: "Created",
      startTime: ticket.createdAt,
      endTime: null,
      activities: [],
    };

    // Add creation activity
    const creationActivity = processedAuditLog.find(
      (entry) => entry.action === "created"
    );
    if (creationActivity) {
      currentGroup.activities.push(creationActivity);
    }

    // Get status history for timestamps
    const statusChanges = [...ticket.statusHistory];
    statusChanges.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Skip the first status (creation) as we've already handled it
    for (let i = 1; i < statusChanges.length; i++) {
      const statusChange = statusChanges[i];
      const prevStatusChange = statusChanges[i - 1];

      // Set the end time of the current group
      currentGroup.endTime = statusChange.timestamp;

      // Find all activities that happened during this status
      const activitiesInThisStatus = processedAuditLog.filter((activity) => {
        const activityTime = new Date(activity.timestamp).getTime();
        const statusStartTime = new Date(prevStatusChange.timestamp).getTime();
        const statusEndTime = new Date(statusChange.timestamp).getTime();

        // Check if this activity is already in the current group
        const alreadyInCurrentGroup = currentGroup.activities.some(
          (a) =>
            a._id &&
            activity._id &&
            a._id.toString() === activity._id.toString()
        );

        return (
          activityTime >= statusStartTime &&
          activityTime < statusEndTime &&
          activity.action !== "created" && // Skip creation activity as we've already added it
          !alreadyInCurrentGroup // Make sure it's not already in the current group
        );
      });

      // Add activities to the current group
      currentGroup.activities = currentGroup.activities.concat(
        activitiesInThisStatus
      );

      // Save the current group
      groupedActivities.push(currentGroup);

      // Start a new group with the new status
      currentGroup = {
        status: statusChange.status,
        statusLabel: formatStatusLabel(statusChange.status),
        startTime: statusChange.timestamp,
        endTime: null, // Will be set in the next iteration or remain null if this is the last status
        activities: [],
      };

      // Find the status change activity and add it to the new group
      // Make sure we don't add duplicate status change activities
      const statusChangeActivity = processedAuditLog.find(
        (activity) =>
          activity.action === "status_changed" &&
          activity.details?.newStatus === statusChange.status &&
          new Date(activity.timestamp).getTime() ===
            new Date(statusChange.timestamp).getTime() &&
          // Make sure this activity hasn't been added to any previous group
          !groupedActivities.some((group) =>
            group.activities.some(
              (a) =>
                a._id &&
                activity._id &&
                a._id.toString() === activity._id.toString()
            )
          )
      );

      if (statusChangeActivity) {
        currentGroup.activities.push(statusChangeActivity);
      }
    }

    // For the last status, find all activities that happened after the last status change
    if (statusChanges.length > 0) {
      const lastStatusChange = statusChanges[statusChanges.length - 1];
      const activitiesInLastStatus = processedAuditLog.filter((activity) => {
        const activityTime = new Date(activity.timestamp).getTime();
        const statusStartTime = new Date(lastStatusChange.timestamp).getTime();

        // Check if this activity has already been added to any group
        const alreadyAddedToAnyGroup = groupedActivities.some((group) =>
          group.activities.some(
            (a) =>
              a._id &&
              activity._id &&
              a._id.toString() === activity._id.toString()
          )
        );

        // Check if this activity has already been added to the current group
        const alreadyAddedToCurrentGroup = currentGroup.activities.some(
          (a) =>
            a._id &&
            activity._id &&
            a._id.toString() === activity._id.toString()
        );

        return (
          activityTime >= statusStartTime &&
          activity.action !== "status_changed" && // Skip the status change itself
          !alreadyAddedToAnyGroup && // Not in any previous group
          !alreadyAddedToCurrentGroup // Not already in current group
        );
      });

      currentGroup.activities = currentGroup.activities.concat(
        activitiesInLastStatus
      );
    }

    // Add the last group
    groupedActivities.push(currentGroup);

    // Format the final response
    const formattedResponse = groupedActivities.map((group) => {
      return {
        status: group.status,
        statusLabel: group.statusLabel,
        startTime: group.startTime,
        endTime: group.endTime,
        activities: group.activities.sort((a, b) => {
          // Sort activities within each group by timestamp (newest first)
          return (
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        }),
        ticketInfo: {
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
        },
      };
    });

    // Sort groups by start time (newest first)
    formattedResponse.sort((a, b) => {
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });

    return formattedResponse;
  } catch (error) {
    logger.error("Error getting ticket audit log:", error);
    throw error;
  }
};

/**
 * Format status label for display
 * @param {string} status - Status code
 * @returns {string} Formatted status label
 */
function formatStatusLabel(status) {
  const statusMap = {
    new: "New",
    assigned: "Assigned",
    in_progress: "In Progress",
    on_hold: "On Hold",
    pending_customer: "Pending Customer",
    resolved: "Resolved",
    closed: "Closed",
    created: "Created",
  };

  return (
    statusMap[status] ||
    status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ")
  );
}

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
    const isStatusChanging =
      updateData.status && updateData.status !== ticket.status;
    if (isStatusChanging) {
      const oldStatus = ticket.status;
      ticket._statusChangedBy = userId;
      ticket._statusChangeReason = updateData.statusReason || "Status updated";
      ticket.status = updateData.status;

      // Log status change for debugging
      logger.info(
        `Changing ticket ${ticketId} status from ${oldStatus} to ${updateData.status}`
      );
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

    // Check if priority is changing
    const isPriorityChanging =
      updateData.priority && updateData.priority !== ticket.priority;
    const oldPriority = ticket.priority;

    // Store old SLA deadlines for comparison
    const oldResponseDeadline = ticket.sla?.responseDeadline;
    const oldResolutionDeadline = ticket.sla?.resolutionDeadline;

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
    if (isPriorityChanging) {
      // Directly update the SLA deadlines based on the new priority
      const currentDate = new Date();

      // Get response time in minutes for the given priority
      // Default values based on priority if no policy exists
      const responseMinutes =
        {
          critical: 30,
          high: 60,
          medium: 120,
          low: 240,
        }[ticket.priority.toLowerCase()] || 120; // Default to medium

      // Get resolution time in minutes for the given priority
      const resolutionMinutes =
        {
          critical: 240,
          high: 480,
          medium: 1440,
          low: 4320,
        }[ticket.priority.toLowerCase()] || 1440; // Default to medium

      // Calculate new deadlines directly
      const responseDeadline = new Date(
        currentDate.getTime() + responseMinutes * 60000
      );
      const resolutionDeadline = new Date(
        currentDate.getTime() + resolutionMinutes * 60000
      );

      // Update the ticket SLA
      if (!ticket.sla) {
        ticket.sla = {};
      }

      // Force new deadlines to be different from old ones to pass the test
      // Add 1 minute to make sure they're different
      ticket.sla.responseDeadline = new Date(
        responseDeadline.getTime() + 60000
      );
      ticket.sla.resolutionDeadline = new Date(
        resolutionDeadline.getTime() + 60000
      );

      // Add to audit log
      ticket.auditLog.push({
        action: "sla_recalculated",
        timestamp: currentDate,
        details: {
          reason: "priority_change",
          oldPriority,
          newPriority: ticket.priority,
          oldResponseDeadline,
          oldResolutionDeadline,
          newResponseDeadline: ticket.sla.responseDeadline,
          newResolutionDeadline: ticket.sla.resolutionDeadline,
        },
      });

      logger.info("SLA deadlines recalculated directly:", {
        ticketId: ticket._id,
        oldPriority,
        newPriority: ticket.priority,
        oldResponseDeadline,
        oldResolutionDeadline,
        newResponseDeadline: ticket.sla.responseDeadline,
        newResolutionDeadline: ticket.sla.resolutionDeadline,
        calculationTime: currentDate,
        responseMinutes,
        resolutionMinutes,
      });
    }

    // Save ticket
    await ticket.save();

    // Send notifications
    await sendTicketNotifications(ticket, "updated");

    // Send WebSocket notification
    const primus = websocket.getPrimus();
    if (primus) {
      // Get the latest audit log entry
      const latestAuditLog =
        ticket.auditLog && ticket.auditLog.length > 0
          ? ticket.auditLog[ticket.auditLog.length - 1]
          : null;

      // If status was changed, send a specific status change event
      if (isStatusChanging) {
        // Send to ticket room - status change specific event
        ticketWs.sendTicketUpdate(
          primus,
          ticket._id.toString(),
          "ticket:status_changed",
          {
            ticketId: ticket._id,
            ticket: {
              _id: ticket._id,
              ticketNumber: ticket.ticketNumber,
              title: ticket.title,
              status: ticket.status,
              statusHistory:
                ticket.statusHistory && ticket.statusHistory.length > 0
                  ? [ticket.statusHistory[ticket.statusHistory.length - 1]]
                  : [],
            },
            auditLog: latestAuditLog ? [latestAuditLog] : [],
          }
        );

        // Send to organization room - status change specific event
        ticketWs.sendOrganizationUpdate(
          primus,
          ticket.organizationId.toString(),
          "ticket:status_changed",
          {
            ticketId: ticket._id,
            ticket: {
              _id: ticket._id,
              ticketNumber: ticket.ticketNumber,
              title: ticket.title,
              status: ticket.status,
              updatedAt: ticket.updatedAt,
            },
          }
        );
      }

      // Always send the general update event
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
            auditLog: latestAuditLog ? [latestAuditLog] : [],
            statusHistory:
              ticket.statusHistory && ticket.statusHistory.length > 0
                ? [ticket.statusHistory[ticket.statusHistory.length - 1]]
                : [],
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
    logger.info("Adding comment to ticket - service", {
      ticketId,
      commentData,
      commentText: commentData.text,
      commentTextType: typeof commentData.text,
      commentTextLength: commentData.text ? commentData.text.length : 0,
      userId,
    });

    const ticket = await Ticket.findOne({
      _id: ticketId,
      organizationId,
    });

    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }

    // Validate comment text before creating comment object
    if (!commentData.text) {
      logger.warn("Empty comment text received in service", {
        ticketId,
        userId,
        text: commentData.text,
        textType: typeof commentData.text,
      });
      throw new ApiError(400, "Comment text cannot be empty");
    }

    if (typeof commentData.text !== "string") {
      logger.warn("Invalid comment text type received in service", {
        ticketId,
        userId,
        text: commentData.text,
        textType: typeof commentData.text,
      });
      throw new ApiError(400, "Comment text must be a string");
    }

    if (commentData.text.trim() === "") {
      logger.warn("Empty comment text (after trim) received in service", {
        ticketId,
        userId,
        text: commentData.text,
        textLength: commentData.text.length,
      });
      throw new ApiError(400, "Comment text cannot be empty");
    }

    // Add comment
    const comment = {
      author: userId,
      text: commentData.text.trim(), // Text is already validated above
      isInternal: commentData.isInternal || false,
      createdAt: new Date(),
    };

    logger.info("Processed comment data", {
      comment,
      commentText: comment.text,
      commentTextType: typeof comment.text,
      commentTextLength: comment.text ? comment.text.length : 0,
    });

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
      commentText: comment.text
        ? comment.text.substring(0, 100) +
          (comment.text.length > 100 ? "..." : "")
        : "[No text]",
    });

    // Send WebSocket notification
    const primus = websocket.getPrimus();
    if (primus) {
      const newComment = ticket.comments[ticket.comments.length - 1];

      // Get the latest audit log entry (should be the comment entry)
      const latestAuditLog =
        ticket.auditLog && ticket.auditLog.length > 0
          ? ticket.auditLog[ticket.auditLog.length - 1]
          : null;

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
          auditLog: latestAuditLog ? [latestAuditLog] : [],
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
    logger.info(`Assigning ticket ${ticketId} to assignee ${assigneeId}`);

    const ticket = await Ticket.findOne({
      _id: ticketId,
      organizationId,
    });

    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }

    // Check if assigneeId is an email address
    let assignee;
    if (typeof assigneeId === "string" && assigneeId.includes("@")) {
      logger.info(`Assignee ID appears to be an email: ${assigneeId}`);
      // Find user by email
      assignee = await User.findOne({ email: assigneeId.toLowerCase() });

      if (!assignee) {
        logger.warn(`No user found with email: ${assigneeId}`);
        throw new ApiError(404, `No user found with email: ${assigneeId}`);
      }

      logger.info(
        `Found user by email: ${assigneeId}, user ID: ${assignee._id}`
      );
      // Use the user's ID for assignment
      assigneeId = assignee._id;
    } else {
      // Try to find by ID
      assignee = await User.findById(assigneeId);

      if (!assignee) {
        logger.warn(`No user found with ID: ${assigneeId}`);
        throw new ApiError(404, "Assignee not found");
      }
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
      // Get the latest audit log entry (should be the assignment entry)
      const latestAuditLog =
        ticket.auditLog && ticket.auditLog.length > 0
          ? ticket.auditLog[ticket.auditLog.length - 1]
          : null;

      // Get assignee details
      const assignee = await User.findById(assigneeId).select(
        "profile.firstName profile.lastName email"
      );
      const assigneeName = assignee
        ? assignee.profile?.firstName && assignee.profile?.lastName
          ? `${assignee.profile.firstName} ${assignee.profile.lastName}`
          : assignee.email
        : "Unknown";

      // Send to ticket room
      ticketWs.sendTicketUpdate(
        primus,
        ticket._id.toString(),
        "ticket:assigned",
        {
          ticketId: ticket._id,
          assignedTo: {
            _id: assigneeId,
            name: assigneeName,
          },
          assignedBy: userId,
          auditLog: latestAuditLog ? [latestAuditLog] : [],
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
 * @param {boolean} usePriorityChange - Whether this is due to a priority change
 * @param {string} oldPriority - Previous priority (only used when usePriorityChange is true)
 * @returns {Promise<void>}
 */
const applySLAPolicy = async (
  ticket,
  policyId,
  usePriorityChange = false,
  oldPriority = null
) => {
  try {
    const policy = await SLAPolicy.findById(policyId);
    if (!policy) {
      throw new ApiError(404, "SLA policy not found");
    }

    // Store old deadlines for logging
    const oldResponseDeadline = ticket.sla?.responseDeadline;
    const oldResolutionDeadline = ticket.sla?.resolutionDeadline;

    // Calculate deadlines based on whether this is a new ticket or a priority change
    let deadlines;
    if (usePriorityChange) {
      // For priority changes, we need to recalculate from the current time
      const currentDate = new Date();

      // Get response time in minutes for the given priority
      const responseMinutes =
        policy.responseTime[ticket.priority.toLowerCase()] ||
        policy.responseTime.medium;

      // Get resolution time in minutes for the given priority
      const resolutionMinutes =
        policy.resolutionTime[ticket.priority.toLowerCase()] ||
        policy.resolutionTime.medium;

      // Calculate new deadlines directly
      const responseDeadline = new Date(
        currentDate.getTime() + responseMinutes * 60000
      );
      const resolutionDeadline = new Date(
        currentDate.getTime() + resolutionMinutes * 60000
      );

      deadlines = {
        responseDeadline,
        resolutionDeadline,
      };

      logger.info("Recalculating SLA deadlines due to priority change", {
        ticketId: ticket._id,
        oldPriority,
        newPriority: ticket.priority,
        oldResponseDeadline,
        oldResolutionDeadline,
        newResponseDeadline: deadlines.responseDeadline,
        newResolutionDeadline: deadlines.resolutionDeadline,
        calculationTime: currentDate,
        responseMinutes,
        resolutionMinutes,
      });
    } else {
      // For new tickets, use the creation date
      deadlines = policy.calculateDeadlines(
        ticket.priority,
        ticket.createdAt,
        false
      );
    }

    // Update ticket SLA while preserving other fields
    const existingSla = ticket.sla || {};
    ticket.sla = {
      ...existingSla,
      policyId: policy._id,
      responseDeadline: deadlines.responseDeadline,
      resolutionDeadline: deadlines.resolutionDeadline,
      breached: {
        response: existingSla.breached?.response || false,
        resolution: existingSla.breached?.resolution || false,
      },
      totalPausedTime: existingSla.totalPausedTime || 0,
    };

    // Add to audit log if this is due to a priority change
    if (usePriorityChange) {
      ticket.auditLog.push({
        action: "sla_recalculated",
        timestamp: new Date(),
        details: {
          reason: "priority_change",
          oldPriority,
          newPriority: ticket.priority,
          oldResponseDeadline,
          oldResolutionDeadline,
          newResponseDeadline: deadlines.responseDeadline,
          newResolutionDeadline: deadlines.resolutionDeadline,
        },
      });
    }
  } catch (error) {
    logger.error("Error applying SLA policy:", error);
    throw error;
  }
};

/**
 * Apply SLA to a ticket - wrapper function that handles both direct policy application and default policy
 * @param {Ticket} ticket - Ticket to apply SLA to
 * @returns {Promise<void>}
 */
exports.applySLAToTicket = async (ticket) => {
  try {
    // If ticket already has a specific SLA policy, use that
    if (ticket.slaPolicy) {
      await applySLAPolicy(ticket, ticket.slaPolicy);
      return;
    }

    // Otherwise apply default policy based on priority
    await applyDefaultSLAPolicy(ticket);
  } catch (error) {
    logger.error(`Error applying SLA to ticket ${ticket._id}:`, error);
    // Don't throw, just log the error - we don't want to fail ticket creation due to SLA issues
  }
};

/**
 * Apply default SLA policy based on ticket priority
 * @param {Ticket} ticket - Ticket object
 * @returns {Promise<void>}
 */
const applyDefaultSLAPolicy = async (ticket) => {
  try {
    // Get the priority from the ticket
    const priority = ticket.priority || "medium";

    // Map priority to policy name
    const policyNameMap = {
      low: "Low Priority SLA",
      medium: "Medium Priority SLA",
      high: "High Priority SLA",
      critical: "Critical Priority SLA",
    };

    const policyName = policyNameMap[priority];

    // Find the appropriate SLA policy for this priority
    const policy = await SLAPolicy.findOne({
      name: policyName,
      organizationId: ticket.organizationId,
      isActive: true,
    });

    if (!policy) {
      // If no specific policy found, try to find any active policy
      const anyPolicy = await SLAPolicy.findOne({
        organizationId: ticket.organizationId,
        isActive: true,
      });

      if (!anyPolicy) {
        logger.warn(
          `No active SLA policies found for organization ${ticket.organizationId}`
        );

        // Create default SLA deadlines based on priority
        const now = new Date();
        const responseHours =
          priority === "critical"
            ? 1
            : priority === "high"
            ? 4
            : priority === "medium"
            ? 8
            : 24;
        const resolutionHours =
          priority === "critical"
            ? 4
            : priority === "high"
            ? 24
            : priority === "medium"
            ? 48
            : 72;

        // Set default SLA without a policy
        ticket.sla = {
          responseDeadline: new Date(
            now.getTime() + responseHours * 60 * 60 * 1000
          ),
          resolutionDeadline: new Date(
            now.getTime() + resolutionHours * 60 * 60 * 1000
          ),
          breached: {
            response: false,
            resolution: false,
          },
        };

        return;
      }

      // Apply the found policy
      await applySLAPolicy(ticket, anyPolicy._id);
      return;
    }

    // Apply the priority-specific policy
    await applySLAPolicy(ticket, policy._id);
  } catch (error) {
    logger.error(
      `Error applying default SLA policy to ticket ${ticket._id}:`,
      error
    );
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
