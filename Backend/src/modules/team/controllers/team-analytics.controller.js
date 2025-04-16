/**
 * Team Analytics Controller
 * Handles team analytics functionality
 */

const Team = require("../models/team.model");
const Ticket = require("../../ticket/models/ticket.model");
const logger = require("../../../utils/logger");
const { ApiError } = require("../../../utils/errors");

/**
 * Get team performance metrics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getTeamPerformance = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const { teamId, startDate, endDate } = req.query;

    // Parse dates
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days
    const end = endDate ? new Date(endDate) : new Date();

    // Build query
    const query = {
      organizationId,
      createdAt: { $gte: start, $lte: end },
    };

    // Add team filter if provided
    if (teamId) {
      query["primaryTeam.teamId"] = teamId;
    }

    // Get tickets
    const tickets = await Ticket.find(query).lean();

    // Calculate metrics
    const totalTickets = tickets.length;
    const resolvedTickets = tickets.filter(
      (t) => t.status === "resolved" || t.status === "closed"
    ).length;
    const averageResolutionTime = calculateAverageResolutionTime(tickets);

    // Calculate by priority
    const priorityMetrics = {
      low: { total: 0, resolved: 0, averageResolutionTime: 0 },
      medium: { total: 0, resolved: 0, averageResolutionTime: 0 },
      high: { total: 0, resolved: 0, averageResolutionTime: 0 },
      critical: { total: 0, resolved: 0, averageResolutionTime: 0 },
    };

    tickets.forEach((ticket) => {
      const priority = ticket.priority || "medium";
      priorityMetrics[priority].total++;

      if (ticket.status === "resolved" || ticket.status === "closed") {
        priorityMetrics[priority].resolved++;
        
        if (ticket.resolvedAt) {
          const resolutionTime = new Date(ticket.resolvedAt) - new Date(ticket.createdAt);
          priorityMetrics[priority].averageResolutionTime += resolutionTime;
        }
      }
    });

    // Calculate average resolution time by priority
    Object.keys(priorityMetrics).forEach((priority) => {
      const metrics = priorityMetrics[priority];
      if (metrics.resolved > 0) {
        metrics.averageResolutionTime = metrics.averageResolutionTime / metrics.resolved;
      }
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
          resolvedTickets,
          resolutionRate: totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0,
          averageResolutionTime,
        },
        byPriority: priorityMetrics,
      },
    });
  } catch (error) {
    logger.error("Error getting team performance metrics:", error);
    next(error);
  }
};

/**
 * Get team workload metrics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getTeamWorkload = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const { teamId } = req.query;

    // Build query
    const query = {
      organizationId,
      status: { $nin: ["resolved", "closed"] },
    };

    // Add team filter if provided
    if (teamId) {
      query["primaryTeam.teamId"] = teamId;
    }

    // Get active tickets
    const activeTickets = await Ticket.find(query).lean();

    // Group by team
    const teamWorkload = {};
    
    for (const ticket of activeTickets) {
      if (ticket.primaryTeam && ticket.primaryTeam.teamId) {
        const teamIdStr = ticket.primaryTeam.teamId.toString();
        
        if (!teamWorkload[teamIdStr]) {
          teamWorkload[teamIdStr] = {
            teamId: teamIdStr,
            teamName: "",
            activeTickets: 0,
            byPriority: {
              low: 0,
              medium: 0,
              high: 0,
              critical: 0,
            },
            byStatus: {
              new: 0,
              assigned: 0,
              in_progress: 0,
              on_hold: 0,
              pending: 0,
            },
          };
        }
        
        // Get team name
        if (!teamWorkload[teamIdStr].teamName) {
          const team = await Team.findById(teamIdStr).select("name").lean();
          if (team) {
            teamWorkload[teamIdStr].teamName = team.name;
          }
        }
        
        teamWorkload[teamIdStr].activeTickets++;
        teamWorkload[teamIdStr].byPriority[ticket.priority || "medium"]++;
        teamWorkload[teamIdStr].byStatus[ticket.status || "new"]++;
      }
    }

    res.json({
      success: true,
      data: {
        teams: Object.values(teamWorkload),
        totalActiveTickets: activeTickets.length,
      },
    });
  } catch (error) {
    logger.error("Error getting team workload metrics:", error);
    next(error);
  }
};

/**
 * Calculate average resolution time for tickets
 * @param {Array} tickets - Array of ticket objects
 * @returns {Number} - Average resolution time in milliseconds
 */
function calculateAverageResolutionTime(tickets) {
  const resolvedTickets = tickets.filter(
    (t) => (t.status === "resolved" || t.status === "closed") && t.resolvedAt
  );
  
  if (resolvedTickets.length === 0) {
    return 0;
  }
  
  const totalResolutionTime = resolvedTickets.reduce((total, ticket) => {
    const resolutionTime = new Date(ticket.resolvedAt) - new Date(ticket.createdAt);
    return total + resolutionTime;
  }, 0);
  
  return totalResolutionTime / resolvedTickets.length;
}
