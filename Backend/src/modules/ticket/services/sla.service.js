/**
 * SLA Service
 * Handles SLA policy management and enforcement
 */

const SLAPolicy = require("../models/sla-policy.model");
const Ticket = require("../models/ticket.model");
const { ApiError } = require("../../../utils/errors");
const logger = require("../../../utils/logger");
const mongoose = require("mongoose");
const notificationController = require("../../notification/controllers/notification.controller");

/**
 * Create a new SLA policy
 * @param {Object} policyData - SLA policy data
 * @param {string} userId - User ID of creator
 * @returns {Promise<SLAPolicy>} Created policy
 */
exports.createSLAPolicy = async (policyData, userId) => {
  try {
    // Create policy
    const policy = new SLAPolicy({
      ...policyData,
      createdBy: userId,
    });

    // Save policy
    await policy.save();

    return policy;
  } catch (error) {
    logger.error("Error creating SLA policy:", error);
    throw error;
  }
};

/**
 * Get SLA policy by ID
 * @param {string} policyId - Policy ID
 * @param {string} organizationId - Organization ID for security check
 * @returns {Promise<SLAPolicy>} SLA policy
 */
exports.getSLAPolicyById = async (policyId, organizationId) => {
  try {
    const policy = await SLAPolicy.findOne({
      _id: policyId,
      organizationId,
    }).populate("createdBy", "profile.firstName profile.lastName email");

    if (!policy) {
      throw new ApiError(404, "SLA policy not found");
    }

    return policy;
  } catch (error) {
    logger.error("Error getting SLA policy:", error);
    throw error;
  }
};

/**
 * Get SLA policies for organization
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Array>} SLA policies
 */
exports.getSLAPolicies = async (organizationId) => {
  try {
    const policies = await SLAPolicy.find({
      organizationId,
    })
      .sort({ name: 1 })
      .populate("createdBy", "profile.firstName profile.lastName email");

    return policies;
  } catch (error) {
    logger.error("Error getting SLA policies:", error);
    throw error;
  }
};

/**
 * Update SLA policy
 * @param {string} policyId - Policy ID
 * @param {Object} updateData - Data to update
 * @param {string} organizationId - Organization ID for security check
 * @returns {Promise<SLAPolicy>} Updated policy
 */
exports.updateSLAPolicy = async (policyId, updateData, organizationId) => {
  try {
    const policy = await SLAPolicy.findOne({
      _id: policyId,
      organizationId,
    });

    if (!policy) {
      throw new ApiError(404, "SLA policy not found");
    }

    // Update allowed fields
    const allowedFields = [
      "name",
      "description",
      "responseTime",
      "resolutionTime",
      "businessHours",
      "holidays",
      "escalationRules",
      "isActive",
    ];

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        policy[field] = updateData[field];
      }
    });

    // Save policy
    await policy.save();

    return policy;
  } catch (error) {
    logger.error("Error updating SLA policy:", error);
    throw error;
  }
};

/**
 * Delete SLA policy
 * @param {string} policyId - Policy ID
 * @param {string} organizationId - Organization ID for security check
 * @returns {Promise<boolean>} Success status
 */
exports.deleteSLAPolicy = async (policyId, organizationId) => {
  try {
    // Check if policy is in use
    const ticketsUsingPolicy = await Ticket.countDocuments({
      organizationId,
      "sla.policyId": policyId,
    });

    if (ticketsUsingPolicy > 0) {
      throw new ApiError(400, "Cannot delete policy that is in use by tickets");
    }

    const result = await SLAPolicy.deleteOne({
      _id: policyId,
      organizationId,
    });

    if (result.deletedCount === 0) {
      throw new ApiError(404, "SLA policy not found");
    }

    return true;
  } catch (error) {
    logger.error("Error deleting SLA policy:", error);
    throw error;
  }
};

/**
 * Apply SLA policy to ticket
 * @param {string} ticketId - Ticket ID
 * @param {string} policyId - SLA policy ID
 * @param {string} organizationId - Organization ID for security check
 * @returns {Promise<Ticket>} Updated ticket
 */
exports.applyPolicyToTicket = async (ticketId, policyId, organizationId) => {
  try {
    const ticket = await Ticket.findOne({
      _id: ticketId,
      organizationId,
    });

    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }

    const policy = await SLAPolicy.findOne({
      _id: policyId,
      organizationId,
    });

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

    // Save ticket
    await ticket.save();

    return ticket;
  } catch (error) {
    logger.error("Error applying SLA policy to ticket:", error);
    throw error;
  }
};

/**
 * Check SLA breaches for all active tickets
 * This should be run by a scheduled job
 * @param {string} organizationId - Organization ID (optional, checks all orgs if not provided)
 * @returns {Promise<Object>} Results of the check
 */
exports.checkSLABreaches = async (organizationId = null) => {
  try {
    const query = {
      status: { $nin: ["resolved", "closed"] },
    };

    if (organizationId) {
      query.organizationId = organizationId;
    }

    // Get all active tickets with SLA
    const tickets = await Ticket.find({
      ...query,
      "sla.policyId": { $exists: true },
    });

    const results = {
      checked: tickets.length,
      breached: {
        response: 0,
        resolution: 0,
      },
      approaching: {
        response: 0,
        resolution: 0,
      },
    };

    const now = new Date();

    for (const ticket of tickets) {
      // Skip tickets with paused SLA
      if (ticket.sla.pausedAt) {
        continue;
      }

      // Check response SLA
      if (
        ticket.sla.responseDeadline &&
        !ticket.sla.breached.response &&
        now > ticket.sla.responseDeadline
      ) {
        ticket.sla.breached.response = true;
        results.breached.response++;

        // Add to audit log
        ticket.auditLog.push({
          action: "sla_breached",
          timestamp: now,
          details: {
            type: "response",
            deadline: ticket.sla.responseDeadline,
          },
        });

        // Send notification
        await sendSLANotification(ticket, "response_breached");

        // Apply escalation rules
        await applyEscalationRules(ticket, "response_breached");
      }

      // Check resolution SLA
      if (
        ticket.sla.resolutionDeadline &&
        !ticket.sla.breached.resolution &&
        now > ticket.sla.resolutionDeadline
      ) {
        ticket.sla.breached.resolution = true;
        results.breached.resolution++;

        // Add to audit log
        ticket.auditLog.push({
          action: "sla_breached",
          timestamp: now,
          details: {
            type: "resolution",
            deadline: ticket.sla.resolutionDeadline,
          },
        });

        // Send notification
        await sendSLANotification(ticket, "resolution_breached");

        // Apply escalation rules
        await applyEscalationRules(ticket, "resolution_breached");
      }

      // Check approaching deadlines (80% of time elapsed)
      if (
        ticket.sla.responseDeadline &&
        !ticket.sla.breached.response &&
        !ticket.auditLog.some(
          (log) =>
            log.action === "sla_approaching" && log.details.type === "response"
        )
      ) {
        const timeElapsed = now - ticket.createdAt;
        const totalTime = ticket.sla.responseDeadline - ticket.createdAt;
        const percentElapsed = (timeElapsed / totalTime) * 100;

        if (percentElapsed >= 80) {
          results.approaching.response++;

          // Add to audit log
          ticket.auditLog.push({
            action: "sla_approaching",
            timestamp: now,
            details: {
              type: "response",
              deadline: ticket.sla.responseDeadline,
              percentElapsed,
            },
          });

          // Send notification
          await sendSLANotification(ticket, "response_approaching");

          // Apply escalation rules
          await applyEscalationRules(ticket, "response_approaching");
        }
      }

      // Check approaching resolution deadlines
      if (
        ticket.sla.resolutionDeadline &&
        !ticket.sla.breached.resolution &&
        !ticket.auditLog.some(
          (log) =>
            log.action === "sla_approaching" &&
            log.details.type === "resolution"
        )
      ) {
        const timeElapsed = now - ticket.createdAt;
        const totalTime = ticket.sla.resolutionDeadline - ticket.createdAt;
        const percentElapsed = (timeElapsed / totalTime) * 100;

        if (percentElapsed >= 80) {
          results.approaching.resolution++;

          // Add to audit log
          ticket.auditLog.push({
            action: "sla_approaching",
            timestamp: now,
            details: {
              type: "resolution",
              deadline: ticket.sla.resolutionDeadline,
              percentElapsed,
            },
          });

          // Send notification
          await sendSLANotification(ticket, "resolution_approaching");

          // Apply escalation rules
          await applyEscalationRules(ticket, "resolution_approaching");
        }
      }

      // Save ticket if modified
      if (ticket.isModified()) {
        await ticket.save();
      }
    }

    return results;
  } catch (error) {
    logger.error("Error checking SLA breaches:", error);
    throw error;
  }
};

/**
 * Pause SLA for a ticket
 * @param {string} ticketId - Ticket ID
 * @param {string} reason - Reason for pausing
 * @param {string} organizationId - Organization ID for security check
 * @returns {Promise<Ticket>} Updated ticket
 */
exports.pauseSLA = async (ticketId, reason, organizationId) => {
  try {
    const ticket = await Ticket.findOne({
      _id: ticketId,
      organizationId,
    });

    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }

    if (!ticket.sla || !ticket.sla.policyId) {
      throw new ApiError(400, "Ticket does not have an SLA policy");
    }

    if (ticket.sla.pausedAt) {
      throw new ApiError(400, "SLA is already paused");
    }

    // Pause SLA
    ticket.sla.pausedAt = new Date();
    ticket.sla.pauseReason = reason;

    // Add to audit log
    ticket.auditLog.push({
      action: "sla_paused",
      timestamp: new Date(),
      details: {
        reason,
      },
    });

    // Save ticket
    await ticket.save();

    return ticket;
  } catch (error) {
    logger.error("Error pausing SLA:", error);
    throw error;
  }
};

/**
 * Resume SLA for a ticket
 * @param {string} ticketId - Ticket ID
 * @param {string} organizationId - Organization ID for security check
 * @returns {Promise<Ticket>} Updated ticket
 */
exports.resumeSLA = async (ticketId, organizationId) => {
  try {
    const ticket = await Ticket.findOne({
      _id: ticketId,
      organizationId,
    });

    if (!ticket) {
      throw new ApiError(404, "Ticket not found");
    }

    if (!ticket.sla || !ticket.sla.policyId) {
      throw new ApiError(400, "Ticket does not have an SLA policy");
    }

    if (!ticket.sla.pausedAt) {
      throw new ApiError(400, "SLA is not paused");
    }

    // Calculate paused time
    const now = new Date();
    const pausedTime = Math.floor((now - ticket.sla.pausedAt) / 60000); // in minutes
    ticket.sla.totalPausedTime = (ticket.sla.totalPausedTime || 0) + pausedTime;

    // Extend deadlines by the paused time
    if (ticket.sla.responseDeadline && !ticket.sla.breached.response) {
      ticket.sla.responseDeadline = new Date(
        ticket.sla.responseDeadline.getTime() + pausedTime * 60000
      );
    }

    if (ticket.sla.resolutionDeadline && !ticket.sla.breached.resolution) {
      ticket.sla.resolutionDeadline = new Date(
        ticket.sla.resolutionDeadline.getTime() + pausedTime * 60000
      );
    }

    // Clear pause
    ticket.sla.pausedAt = undefined;
    ticket.sla.pauseReason = undefined;

    // Add to audit log
    ticket.auditLog.push({
      action: "sla_resumed",
      timestamp: now,
      details: {
        pausedTime,
        totalPausedTime: ticket.sla.totalPausedTime,
      },
    });

    // Save ticket
    await ticket.save();

    return ticket;
  } catch (error) {
    logger.error("Error resuming SLA:", error);
    throw error;
  }
};

/**
 * Apply SLA escalation rules based on the event type
 * @param {Ticket} ticket - Ticket object
 * @param {string} eventType - SLA event type
 * @returns {Promise<void>}
 */
const applyEscalationRules = async (ticket, eventType) => {
  try {
    // Get the SLA policy
    const slaPolicy = await SLAPolicy.findById(ticket.sla.policyId);
    if (
      !slaPolicy ||
      !slaPolicy.escalationRules ||
      slaPolicy.escalationRules.length === 0
    ) {
      return; // No escalation rules defined
    }

    // Find applicable escalation rules
    const applicableRules = slaPolicy.escalationRules.filter((rule) => {
      return rule.condition === eventType;
    });

    if (applicableRules.length === 0) {
      return; // No applicable rules
    }

    // Apply each rule
    for (const rule of applicableRules) {
      // Apply actions
      for (const action of rule.actions) {
        switch (action) {
          case "notify_assignee":
            // Already handled by sendSLANotification
            break;

          case "notify_team_lead":
            // Already handled by sendSLANotification
            break;

          case "notify_manager":
            // Notify organization admin - this is handled by the notification controller
            // We'll pass the entire rule to the controller so it can determine who to notify
            await notificationController.createEscalationNotification(
              ticket,
              rule
            );
            break;

          case "increase_priority":
            // Increase ticket priority if not already at highest
            const priorityLevels = ["low", "medium", "high", "critical"];
            const currentPriorityIndex = priorityLevels.indexOf(
              ticket.priority
            );

            if (currentPriorityIndex < priorityLevels.length - 1) {
              const newPriority = priorityLevels[currentPriorityIndex + 1];
              ticket.priority = newPriority;

              // Add to audit log
              ticket.auditLog.push({
                action: "priority_escalated",
                timestamp: new Date(),
                details: {
                  oldPriority: priorityLevels[currentPriorityIndex],
                  newPriority,
                  reason: `Automatic escalation due to ${eventType}`,
                },
              });

              // Recalculate SLA deadlines based on new priority
              if (slaPolicy) {
                const deadlines = slaPolicy.calculateDeadlines(
                  newPriority,
                  ticket.createdAt
                );
                ticket.sla.responseDeadline = deadlines.responseDeadline;
                ticket.sla.resolutionDeadline = deadlines.resolutionDeadline;

                // Add to audit log
                ticket.auditLog.push({
                  action: "sla_recalculated",
                  timestamp: new Date(),
                  details: {
                    reason: "Priority escalation",
                    oldResponseDeadline: ticket.sla.responseDeadline,
                    newResponseDeadline: deadlines.responseDeadline,
                    oldResolutionDeadline: ticket.sla.resolutionDeadline,
                    newResolutionDeadline: deadlines.resolutionDeadline,
                  },
                });
              }
            }
            break;

          case "reassign_ticket":
            // This would require additional logic to determine who to reassign to
            // For now, we'll just log that this action was triggered
            logger.info(
              `SLA escalation action 'reassign_ticket' triggered for ticket ${ticket._id}`
            );
            break;

          default:
            logger.warn(`Unknown SLA escalation action: ${action}`);
        }
      }
    }

    // Save the ticket if modified
    if (ticket.isModified()) {
      await ticket.save();
    }
  } catch (error) {
    logger.error("Error applying SLA escalation rules:", error);
    // Don't throw, just log the error
  }
};

/**
 * Send SLA notifications
 * @param {Ticket} ticket - Ticket object
 * @param {string} eventType - SLA event type
 * @returns {Promise<void>}
 */
const sendSLANotification = async (ticket, eventType) => {
  try {
    // Determine the type of notification and call the appropriate controller method
    if (
      eventType === "response_approaching" ||
      eventType === "resolution_approaching"
    ) {
      const type =
        eventType === "response_approaching" ? "response" : "resolution";
      const threshold = 80; // Default threshold for approaching notifications
      await notificationController.createSLAApproachingNotification(
        ticket,
        type,
        threshold
      );
    } else if (
      eventType === "response_breached" ||
      eventType === "resolution_breached"
    ) {
      const type =
        eventType === "response_breached" ? "response" : "resolution";
      await notificationController.createSLABreachedNotification(ticket, type);
    } else {
      logger.warn(`Unknown SLA event type: ${eventType}`);
    }
  } catch (error) {
    logger.error("Error sending SLA notification:", error);
    // Don't throw, just log the error
  }
};
