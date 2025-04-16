/**
 * Ticket WebSocket Handler
 * Handles real-time ticket updates via WebSockets
 */

const logger = require("../../../utils/logger");

/**
 * Initialize ticket WebSocket handlers
 * @param {Object} primus - Primus instance
 */
exports.initTicketWebSocket = (primus) => {
  logger.info("Initializing ticket WebSocket handlers");

  // Listen for connections
  primus.on("connection", (spark) => {
    // Skip if no user data
    if (!spark.request.user) {
      return;
    }

    const userId = spark.request.user._id;
    const organizationId = spark.request.user.organizationId;

    logger.info(`User ${userId} connected to ticket WebSocket`);

    // Join organization room
    spark.join(`org:${organizationId}`);

    // Join user room
    spark.join(`user:${userId}`);

    // Handle ticket:subscribe event
    spark.on("ticket:subscribe", (data) => {
      if (data && data.ticketId) {
        logger.info(`User ${userId} subscribed to ticket ${data.ticketId}`);
        spark.join(`ticket:${data.ticketId}`);
        spark.write({
          event: "ticket:subscribed",
          data: {
            ticketId: data.ticketId,
          },
        });
      }
    });

    // Handle ticket:unsubscribe event
    spark.on("ticket:unsubscribe", (data) => {
      if (data && data.ticketId) {
        logger.info(`User ${userId} unsubscribed from ticket ${data.ticketId}`);
        spark.leave(`ticket:${data.ticketId}`);
        spark.write({
          event: "ticket:unsubscribed",
          data: {
            ticketId: data.ticketId,
          },
        });
      }
    });

    // Handle query:subscribe event
    spark.on("query:subscribe", (data) => {
      if (data && data.queryId) {
        logger.info(`User ${userId} subscribed to query ${data.queryId}`);
        spark.join(`query:${data.queryId}`);
        spark.write({
          event: "query:subscribed",
          data: {
            queryId: data.queryId,
          },
        });
      }
    });

    // Handle query:unsubscribe event
    spark.on("query:unsubscribe", (data) => {
      if (data && data.queryId) {
        logger.info(`User ${userId} unsubscribed from query ${data.queryId}`);
        spark.leave(`query:${data.queryId}`);
        spark.write({
          event: "query:unsubscribed",
          data: {
            queryId: data.queryId,
          },
        });
      }
    });

    // Handle disconnect
    spark.on("end", () => {
      logger.info(`User ${userId} disconnected from ticket WebSocket`);
    });
  });
};

/**
 * Send ticket update to subscribers
 * @param {Object} primus - Primus instance
 * @param {string} ticketId - Ticket ID
 * @param {string} event - Event type
 * @param {Object} data - Event data
 */
exports.sendTicketUpdate = (primus, ticketId, event, data) => {
  if (!primus) {
    logger.error("Primus instance not available");
    return;
  }

  logger.info(`Sending ${event} event for ticket ${ticketId}`);

  primus.room(`ticket:${ticketId}`).write({
    event,
    data: {
      ticketId,
      ...data,
    },
  });
};

/**
 * Send query update to subscribers
 * @param {Object} primus - Primus instance
 * @param {string} queryId - Query ID
 * @param {string} event - Event type
 * @param {Object} data - Event data
 */
exports.sendQueryUpdate = (primus, queryId, event, data) => {
  if (!primus) {
    logger.error("Primus instance not available");
    return;
  }

  logger.info(`Sending ${event} event for query ${queryId}`);

  primus.room(`query:${queryId}`).write({
    event,
    data: {
      queryId,
      ...data,
    },
  });
};

/**
 * Send notification to user
 * @param {Object} primus - Primus instance
 * @param {string} userId - User ID
 * @param {Object} notification - Notification data
 */
exports.sendNotification = (primus, userId, notification) => {
  if (!primus) {
    logger.error("Primus instance not available");
    return;
  }

  logger.info(`Sending notification to user ${userId}`);

  primus.room(`user:${userId}`).write({
    event: "notification",
    data: notification,
  });
};

/**
 * Send organization-wide update
 * @param {Object} primus - Primus instance
 * @param {string} organizationId - Organization ID
 * @param {string} event - Event type
 * @param {Object} data - Event data
 */
exports.sendOrganizationUpdate = (primus, organizationId, event, data) => {
  if (!primus) {
    logger.error("Primus instance not available");
    return;
  }

  logger.info(`Sending ${event} event to organization ${organizationId}`);

  primus.room(`org:${organizationId}`).write({
    event,
    data,
  });
};
