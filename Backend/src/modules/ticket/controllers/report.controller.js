/**
 * Report Controller
 * Handles report generation for tickets and SLA
 */

const Ticket = require("../models/ticket.model");
const SLAPolicy = require("../models/sla-policy.model");
const logger = require("../../../utils/logger");
const { ApiError } = require("../../../utils/errors");

/**
 * Get SLA performance metrics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getSLAPerformanceReport = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const { startDate, endDate, teamId } = req.query;

    // Parse dates
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days
    const end = endDate ? new Date(endDate) : new Date();

    // Build query
    const query = {
      organizationId,
      createdAt: { $gte: start, $lte: end },
      "sla.policyId": { $exists: true },
    };

    // Add team filter if provided
    if (teamId) {
      query["primaryTeam.teamId"] = teamId;
    }

    // Get tickets
    const tickets = await Ticket.find(query).lean();

    // Calculate metrics
    const totalTickets = tickets.length;
    const responseBreached = tickets.filter(
      (t) => t.sla && t.sla.breached && t.sla.breached.response
    ).length;
    const resolutionBreached = tickets.filter(
      (t) => t.sla && t.sla.breached && t.sla.breached.resolution
    ).length;

    // Calculate percentages
    const responseComplianceRate =
      totalTickets > 0
        ? ((totalTickets - responseBreached) / totalTickets) * 100
        : 100;
    const resolutionComplianceRate =
      totalTickets > 0
        ? ((totalTickets - resolutionBreached) / totalTickets) * 100
        : 100;

    // Calculate by priority
    const priorityMetrics = {
      low: { total: 0, responseBreached: 0, resolutionBreached: 0 },
      medium: { total: 0, responseBreached: 0, resolutionBreached: 0 },
      high: { total: 0, responseBreached: 0, resolutionBreached: 0 },
      critical: { total: 0, responseBreached: 0, resolutionBreached: 0 },
    };

    tickets.forEach((ticket) => {
      const priority = ticket.priority || "medium";

      priorityMetrics[priority].total++;

      if (ticket.sla && ticket.sla.breached) {
        if (ticket.sla.breached.response) {
          priorityMetrics[priority].responseBreached++;
        }

        if (ticket.sla.breached.resolution) {
          priorityMetrics[priority].resolutionBreached++;
        }
      }
    });

    // Calculate compliance rates by priority
    Object.keys(priorityMetrics).forEach((priority) => {
      const metrics = priorityMetrics[priority];
      metrics.responseComplianceRate =
        metrics.total > 0
          ? ((metrics.total - metrics.responseBreached) / metrics.total) * 100
          : 100;
      metrics.resolutionComplianceRate =
        metrics.total > 0
          ? ((metrics.total - metrics.resolutionBreached) / metrics.total) *
            100
          : 100;
    });

    res.json({
      success: true,
      data: {
        period: {
          startDate: start,
          endDate: end,
        },
        overall: {
          totalTickets,
          responseBreached,
          resolutionBreached,
          responseComplianceRate,
          resolutionComplianceRate,
        },
        byPriority: priorityMetrics,
      },
    });
  } catch (error) {
    logger.error("Error getting SLA performance report:", error);
    next(error);
  }
};

/**
 * Get SLA breach report
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getSLABreachReport = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const { startDate, endDate, teamId } = req.query;

    // Parse dates
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days
    const end = endDate ? new Date(endDate) : new Date();

    // Build query
    const query = {
      organizationId,
      createdAt: { $gte: start, $lte: end },
      "sla.policyId": { $exists: true },
      $or: [
        { "sla.breached.response": true },
        { "sla.breached.resolution": true },
      ],
    };

    // Add team filter if provided
    if (teamId) {
      query["primaryTeam.teamId"] = teamId;
    }

    // Get breached tickets
    const breachedTickets = await Ticket.find(query)
      .populate("createdBy", "profile.firstName profile.lastName email")
      .populate("primaryTeam.teamId", "name")
      .lean();

    // Format response
    const formattedTickets = breachedTickets.map((ticket) => ({
      _id: ticket._id,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      priority: ticket.priority,
      status: ticket.status,
      createdAt: ticket.createdAt,
      createdBy: ticket.createdBy,
      team: ticket.primaryTeam ? ticket.primaryTeam.teamId : null,
      sla: {
        responseBreached: ticket.sla.breached.response,
        resolutionBreached: ticket.sla.breached.resolution,
        responseDeadline: ticket.sla.responseDeadline,
        resolutionDeadline: ticket.sla.resolutionDeadline,
      },
    }));

    res.json({
      success: true,
      data: {
        period: {
          startDate: start,
          endDate: end,
        },
        breachedTickets: formattedTickets,
        totalBreaches: formattedTickets.length,
        responseBreaches: formattedTickets.filter(
          (t) => t.sla.responseBreached
        ).length,
        resolutionBreaches: formattedTickets.filter(
          (t) => t.sla.resolutionBreached
        ).length,
      },
    });
  } catch (error) {
    logger.error("Error getting SLA breach report:", error);
    next(error);
  }
};
