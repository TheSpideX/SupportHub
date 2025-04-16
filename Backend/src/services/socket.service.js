/**
 * Socket Service
 * Handles WebSocket communication
 */

const logger = require("../utils/logger");

/**
 * Emit an event to a specific user
 * @param {string} userId - The user ID to emit to
 * @param {string} event - The event name
 * @param {object} data - The data to emit
 */
exports.emitToUser = (userId, event, data) => {
  try {
    // Get the Primus instance from the global scope
    const primus = global.primus;
    
    if (!primus) {
      logger.warn("Primus not initialized, cannot emit event");
      return;
    }
    
    // Get all active connections for the user
    const userSparks = [];
    primus.forEach((spark) => {
      if (spark.request && spark.request.user && spark.request.user.id === userId) {
        userSparks.push(spark);
      }
    });
    
    if (userSparks.length === 0) {
      logger.debug(`No active connections found for user ${userId}`);
      return;
    }
    
    // Emit the event to all user connections
    userSparks.forEach((spark) => {
      spark.write({
        event,
        data,
      });
    });
    
    logger.debug(`Emitted ${event} to user ${userId} (${userSparks.length} connections)`);
  } catch (error) {
    logger.error(`Error emitting to user ${userId}:`, error);
    throw error;
  }
};

/**
 * Emit an event to all users in an organization
 * @param {string} organizationId - The organization ID
 * @param {string} event - The event name
 * @param {object} data - The data to emit
 */
exports.emitToOrganization = (organizationId, event, data) => {
  try {
    // Get the Primus instance from the global scope
    const primus = global.primus;
    
    if (!primus) {
      logger.warn("Primus not initialized, cannot emit event");
      return;
    }
    
    // Get all active connections for the organization
    const orgSparks = [];
    primus.forEach((spark) => {
      if (
        spark.request && 
        spark.request.user && 
        spark.request.user.organizationId === organizationId
      ) {
        orgSparks.push(spark);
      }
    });
    
    if (orgSparks.length === 0) {
      logger.debug(`No active connections found for organization ${organizationId}`);
      return;
    }
    
    // Emit the event to all organization connections
    orgSparks.forEach((spark) => {
      spark.write({
        event,
        data,
      });
    });
    
    logger.debug(`Emitted ${event} to organization ${organizationId} (${orgSparks.length} connections)`);
  } catch (error) {
    logger.error(`Error emitting to organization ${organizationId}:`, error);
    throw error;
  }
};

/**
 * Emit an event to all users in a team
 * @param {string} teamId - The team ID
 * @param {string} event - The event name
 * @param {object} data - The data to emit
 */
exports.emitToTeam = (teamId, event, data) => {
  try {
    // Get the Primus instance from the global scope
    const primus = global.primus;
    
    if (!primus) {
      logger.warn("Primus not initialized, cannot emit event");
      return;
    }
    
    // Get all active connections for team members
    // This requires the team information to be stored in the user's session
    const teamSparks = [];
    primus.forEach((spark) => {
      if (
        spark.request && 
        spark.request.user && 
        spark.request.user.teams && 
        spark.request.user.teams.includes(teamId)
      ) {
        teamSparks.push(spark);
      }
    });
    
    if (teamSparks.length === 0) {
      logger.debug(`No active connections found for team ${teamId}`);
      return;
    }
    
    // Emit the event to all team connections
    teamSparks.forEach((spark) => {
      spark.write({
        event,
        data,
      });
    });
    
    logger.debug(`Emitted ${event} to team ${teamId} (${teamSparks.length} connections)`);
  } catch (error) {
    logger.error(`Error emitting to team ${teamId}:`, error);
    throw error;
  }
};

/**
 * Emit an event to all connected users
 * @param {string} event - The event name
 * @param {object} data - The data to emit
 */
exports.emitToAll = (event, data) => {
  try {
    // Get the Primus instance from the global scope
    const primus = global.primus;
    
    if (!primus) {
      logger.warn("Primus not initialized, cannot emit event");
      return;
    }
    
    // Emit to all connections
    primus.write({
      event,
      data,
    });
    
    logger.debug(`Emitted ${event} to all connections`);
  } catch (error) {
    logger.error(`Error emitting to all:`, error);
    throw error;
  }
};
