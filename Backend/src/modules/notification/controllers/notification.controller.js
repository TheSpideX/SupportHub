/**
 * Notification Controller
 * Handles notification creation and management
 */

const notificationService = require("../services/notification.service");
const logger = require("../../../utils/logger");

/**
 * Create an SLA approaching notification
 * @param {Object} ticket - The ticket object
 * @param {String} type - The type of deadline (response or resolution)
 * @param {Number} threshold - The threshold percentage
 */
exports.createSLAApproachingNotification = async (ticket, type, threshold) => {
  try {
    // Determine who should be notified
    const recipients = [];
    
    // Always notify the assignee if there is one
    if (ticket.assignedTo) {
      recipients.push(ticket.assignedTo.toString());
    }
    
    // If there's a primary team, notify the team lead
    if (ticket.primaryTeam && ticket.primaryTeam.teamId) {
      // In a real implementation, we would look up the team lead
      // For now, we'll assume the team lead is stored in the ticket
      if (ticket.primaryTeam.leadId) {
        recipients.push(ticket.primaryTeam.leadId.toString());
      }
    }
    
    // If no recipients, log and return
    if (recipients.length === 0) {
      logger.warn(`No recipients found for SLA approaching notification for ticket ${ticket._id}`);
      return;
    }
    
    // Create a notification for each recipient
    const deadlineType = type === 'response' ? 'Response' : 'Resolution';
    const deadlineTime = type === 'response' 
      ? ticket.sla.responseDeadline 
      : ticket.sla.resolutionDeadline;
    
    for (const recipient of recipients) {
      await notificationService.createNotification({
        recipient,
        organizationId: ticket.organizationId,
        type: 'sla',
        severity: 'warning',
        title: `SLA ${deadlineType} Deadline Approaching`,
        message: `${deadlineType} deadline for ticket #${ticket.ticketNumber} is approaching (${threshold}% of time elapsed)`,
        relatedTo: {
          model: 'Ticket',
          id: ticket._id,
        },
        displayType: 'corner',
        actions: [
          {
            label: 'View Ticket',
            url: `/tickets/${ticket._id}`,
          },
        ],
      });
    }
    
    logger.info(`Created SLA approaching notification for ticket ${ticket._id}, type: ${type}, threshold: ${threshold}%`);
  } catch (error) {
    logger.error(`Error creating SLA approaching notification for ticket ${ticket._id}:`, error);
  }
};

/**
 * Create an SLA breached notification
 * @param {Object} ticket - The ticket object
 * @param {String} type - The type of deadline (response or resolution)
 */
exports.createSLABreachedNotification = async (ticket, type) => {
  try {
    // Determine who should be notified
    const recipients = [];
    
    // Always notify the assignee if there is one
    if (ticket.assignedTo) {
      recipients.push(ticket.assignedTo.toString());
    }
    
    // If there's a primary team, notify the team lead
    if (ticket.primaryTeam && ticket.primaryTeam.teamId) {
      // In a real implementation, we would look up the team lead
      // For now, we'll assume the team lead is stored in the ticket
      if (ticket.primaryTeam.leadId) {
        recipients.push(ticket.primaryTeam.leadId.toString());
      }
    }
    
    // For breaches, also notify managers/admins
    // In a real implementation, we would look up admins for the organization
    // For now, we'll skip this step
    
    // If no recipients, log and return
    if (recipients.length === 0) {
      logger.warn(`No recipients found for SLA breached notification for ticket ${ticket._id}`);
      return;
    }
    
    // Create a notification for each recipient
    const deadlineType = type === 'response' ? 'Response' : 'Resolution';
    
    for (const recipient of recipients) {
      await notificationService.createNotification({
        recipient,
        organizationId: ticket.organizationId,
        type: 'sla',
        severity: 'error',
        title: `SLA ${deadlineType} Deadline Breached`,
        message: `${deadlineType} deadline for ticket #${ticket.ticketNumber} has been breached`,
        relatedTo: {
          model: 'Ticket',
          id: ticket._id,
        },
        displayType: 'modal',
        actions: [
          {
            label: 'View Ticket',
            url: `/tickets/${ticket._id}`,
          },
        ],
      });
    }
    
    logger.info(`Created SLA breached notification for ticket ${ticket._id}, type: ${type}`);
  } catch (error) {
    logger.error(`Error creating SLA breached notification for ticket ${ticket._id}:`, error);
  }
};

/**
 * Create a ticket escalation notification
 * @param {Object} ticket - The ticket object
 * @param {Object} escalationRule - The escalation rule that triggered
 */
exports.createEscalationNotification = async (ticket, escalationRule) => {
  try {
    // Determine who should be notified based on the escalation rule actions
    const recipients = [];
    
    // Process each action in the escalation rule
    for (const action of escalationRule.actions) {
      switch (action) {
        case 'notify_assignee':
          if (ticket.assignedTo) {
            recipients.push(ticket.assignedTo.toString());
          }
          break;
          
        case 'notify_team_lead':
          if (ticket.primaryTeam && ticket.primaryTeam.leadId) {
            recipients.push(ticket.primaryTeam.leadId.toString());
          }
          break;
          
        case 'notify_manager':
          // In a real implementation, we would look up managers for the organization
          // For now, we'll skip this step
          break;
          
        // Other actions like increase_priority don't involve notifications
        default:
          break;
      }
    }
    
    // If no recipients, log and return
    if (recipients.length === 0) {
      logger.warn(`No recipients found for escalation notification for ticket ${ticket._id}`);
      return;
    }
    
    // Create a notification for each recipient
    const conditionText = escalationRule.condition.replace('_', ' ');
    
    for (const recipient of recipients) {
      await notificationService.createNotification({
        recipient,
        organizationId: ticket.organizationId,
        type: 'sla',
        severity: 'error',
        title: `Ticket Escalated: ${ticket.ticketNumber}`,
        message: `Ticket has been escalated due to ${conditionText} (${escalationRule.threshold}% threshold)`,
        relatedTo: {
          model: 'Ticket',
          id: ticket._id,
        },
        displayType: 'corner',
        actions: [
          {
            label: 'View Ticket',
            url: `/tickets/${ticket._id}`,
          },
        ],
      });
    }
    
    logger.info(`Created escalation notification for ticket ${ticket._id}, condition: ${escalationRule.condition}`);
  } catch (error) {
    logger.error(`Error creating escalation notification for ticket ${ticket._id}:`, error);
  }
};
