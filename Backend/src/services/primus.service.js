/**
 * Primus WebSocket Service
 * Replaces Socket.IO with Primus for bidirectional communication
 */

const Primus = require("primus");
const PrimusEmit = require("primus-emit");
const http = require("http");
const logger = require("../utils/logger");
const config = require("../config");

// Store the Primus instance
let primusInstance = null;

// Store connected sparks (clients)
const connectedSparks = new Map();

// Store room memberships
const rooms = new Map();

// Import cross-tab service
const crossTabService = require("../modules/auth/services/cross-tab.service");

/**
 * Initialize Primus server
 * @param {http.Server} server - HTTP server instance
 * @param {Object} options - Configuration options
 * @param {Object} services - Services to use (e.g., crossTabService)
 * @returns {Primus} Primus instance
 */
function initializePrimus(server, options = {}, services = {}) {
  if (primusInstance) {
    logger.warn("Primus already initialized");
    return primusInstance;
  }

  const defaultOptions = {
    transformer: "websockets",
    pathname: "/primus",
    parser: "json",
    compression: true,
    pingInterval: 30000, // 30 seconds
    maxLength: 500000, // Max message size
    cors: {
      origin: config.cors.origin || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  };

  const mergedOptions = { ...defaultOptions, ...options };

  logger.info("Initializing Primus with options:", mergedOptions);

  // Create Primus instance
  primusInstance = new Primus(server, mergedOptions);

  // Add emit plugin
  primusInstance.plugin("emit", PrimusEmit);

  // Initialize cross-tab service if it's not already initialized
  if (crossTabService && !crossTabService.isInitialized) {
    crossTabService.initialize({
      io: primusInstance,
      tokenService: services.tokenService,
    });
    logger.info("Cross-tab service initialized with Primus");
  }

  // Setup connection handling
  primusInstance.on("connection", handleConnection);

  // Setup error handling
  primusInstance.on("error", (err) => {
    logger.error("Primus server error:", err);
  });

  logger.info("Primus initialized successfully");
  return primusInstance;
}

/**
 * Handle new connection
 * @param {Spark} spark - Primus spark (client connection)
 */
function handleConnection(spark) {
  logger.debug(`New connection: ${spark.id}`);

  // Store the spark
  connectedSparks.set(spark.id, spark);

  // Set up data handler
  spark.on("data", (data) => handleData(spark, data));

  // Set up close handler
  spark.on("end", () => handleDisconnect(spark));

  // Set up error handler
  spark.on("error", (err) => {
    logger.error(`Spark error (${spark.id}):`, err);
  });

  // Emit connection event
  spark.emit("connected", { id: spark.id, timestamp: Date.now() });
}

/**
 * Handle incoming data
 * @param {Spark} spark - Primus spark (client connection)
 * @param {Object} data - Received data
 */
function handleData(spark, data) {
  if (!data || typeof data !== "object") {
    logger.warn(`Invalid data received from ${spark.id}`);
    return;
  }

  logger.debug(`Data received from ${spark.id}:`, data);

  // Handle different event types
  if (data.event && typeof data.event === "string") {
    logger.debug(`Processing event ${data.event} from ${spark.id}`);

    switch (data.event) {
      case "join":
        joinRoom(spark, data.room);
        break;
      case "leave":
        leaveRoom(spark, data.room);
        break;
      case "auth":
        handleAuth(spark, data.payload);
        break;
      case "activity":
        handleActivity(spark, data.payload);
        break;
      case "auth:register_tab":
        handleTabRegistration(spark, data);
        break;
      case "auth:leader_ready":
        handleLeaderReady(spark, data);
        break;
      case "auth:tab_visibility":
        handleTabVisibility(spark, data);
        break;
      case "auth:tab_closing":
        handleTabClosing(spark, data);
        break;
      case "leader:ping":
        handleLeaderPing(spark, data);
        break;
      default:
        // Forward the event to any listeners
        logger.debug(
          `Forwarding unhandled event ${data.event} from ${spark.id}`
        );
        spark.emit(data.event, data.payload || data);
    }
  }
}

/**
 * Handle client disconnect
 * @param {Spark} spark - Primus spark (client connection)
 */
function handleDisconnect(spark) {
  logger.debug(`Connection closed: ${spark.id}`);

  // If this was a tab with auth data, notify about tab disconnection
  if (spark.authData && spark.authData.userId && spark.tabId) {
    logger.info(`Tab ${spark.tabId} disconnected`, {
      userId: spark.authData.userId,
      socketId: spark.id,
      tabId: spark.tabId,
      deviceId: spark.deviceId,
    });

    // If cross-tab service is available, notify it about tab disconnection
    if (crossTabService && spark.data) {
      try {
        // Notify cross-tab service
        if (typeof crossTabService.handleDisconnect === "function") {
          crossTabService.handleDisconnect(spark);
        }
      } catch (error) {
        logger.error(
          `Error handling tab disconnection: ${error.message}`,
          error
        );
      }
    }
  }

  // Remove from connected sparks
  connectedSparks.delete(spark.id);

  // Remove from all rooms
  for (const [roomName, members] of rooms.entries()) {
    if (members.has(spark.id)) {
      members.delete(spark.id);

      // If room is empty, delete it
      if (members.size === 0) {
        rooms.delete(roomName);
      }
    }
  }
}

/**
 * Join a room
 * @param {Spark} spark - Primus spark (client connection)
 * @param {string} roomName - Room name
 */
function joinRoom(spark, roomName) {
  if (!roomName || typeof roomName !== "string") {
    logger.warn(`Invalid room name from ${spark.id}`);
    return;
  }

  // Get or create room
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }

  // Add spark to room
  rooms.get(roomName).add(spark.id);

  logger.debug(`Spark ${spark.id} joined room ${roomName}`);

  // Notify client
  spark.emit("room:joined", { room: roomName });
}

/**
 * Leave a room
 * @param {Spark} spark - Primus spark (client connection)
 * @param {string} roomName - Room name
 */
function leaveRoom(spark, roomName) {
  if (!roomName || !rooms.has(roomName)) {
    return;
  }

  // Remove spark from room
  const room = rooms.get(roomName);
  room.delete(spark.id);

  // If room is empty, delete it
  if (room.size === 0) {
    rooms.delete(roomName);
  }

  logger.debug(`Spark ${spark.id} left room ${roomName}`);

  // Notify client
  spark.emit("room:left", { room: roomName });
}

/**
 * Handle authentication
 * @param {Spark} spark - Primus spark (client connection)
 * @param {Object} authData - Authentication data
 */
function handleAuth(spark, authData) {
  if (!authData) {
    logger.warn(`Invalid auth data from ${spark.id}`);
    return;
  }

  // Store auth data on spark
  spark.authData = authData;

  // Also store auth data in spark.auth for compatibility
  if (!spark.auth) {
    spark.auth = {
      id: authData.userId || spark.id,
      sessionId: authData.sessionId,
      timestamp: Date.now(),
    };
  }

  // Join user-specific room if userId is provided
  if (authData.userId) {
    joinRoom(spark, `user:${authData.userId}`);
  }

  // Join device-specific room if deviceId is provided
  if (authData.deviceId) {
    joinRoom(spark, `device:${authData.deviceId}`);
  }

  // Join tab-specific room if tabId is provided
  if (authData.tabId) {
    joinRoom(spark, `tab:${authData.tabId}`);
  }

  logger.debug(`Spark ${spark.id} authenticated:`, authData);

  // Notify client
  spark.emit("auth:success", {
    id: spark.id,
    timestamp: Date.now(),
  });

  // Process any pending tab registration
  if (spark.pendingRegistration) {
    logger.info(
      `Processing pending tab registration for ${spark.id} after authentication`
    );

    // Process the pending registration
    handleTabRegistration(spark, spark.pendingRegistration);

    // Clear the pending registration
    spark.pendingRegistration = null;
  }
}

/**
 * Handle activity update
 * @param {Spark} spark - Primus spark (client connection)
 * @param {Object} activityData - Activity data
 */
function handleActivity(spark, activityData) {
  if (!activityData) {
    return;
  }

  // Update last activity timestamp
  spark.lastActivity = Date.now();

  // If this is a leader tab, broadcast to other tabs of the same user
  if (activityData.isLeader && spark.authData && spark.authData.userId) {
    broadcastToUser(
      spark.authData.userId,
      "activity:update",
      activityData,
      spark.id
    );
  }
}

/**
 * Handle tab registration for leader election
 * @param {Spark} spark - Primus spark (client connection)
 * @param {Object} data - Registration data
 */
function handleTabRegistration(spark, data) {
  if (!data || !data.tabId || !data.deviceId) {
    logger.warn(`Invalid tab registration data from ${spark.id}`);
    return;
  }

  // Make sure spark has auth data
  if (!spark.authData || !spark.authData.userId) {
    logger.warn(
      `Tab registration attempted without authentication: ${spark.id}`
    );

    // Check if the socket is authenticated but the authData is not set properly
    // This can happen if the socket was authenticated but the authData wasn't stored
    if (spark.auth && spark.auth.id) {
      logger.info(`Socket ${spark.id} has auth but no authData, fixing...`);

      // Try to get user ID from the request
      let userId = null;

      // Check if we have a user ID in the request
      if (spark.request && spark.request.user && spark.request.user.id) {
        userId = spark.request.user.id;
        logger.info(
          `Found user ID ${userId} in request for socket ${spark.id}`
        );
      }

      // If we still don't have a user ID, try to get it from cookies
      if (
        !userId &&
        spark.request &&
        spark.request.headers &&
        spark.request.headers.cookie
      ) {
        try {
          // Try to extract user ID from JWT if present
          const cookies = spark.request.headers.cookie;
          const tokenMatch = cookies.match(/access_token=([^;]+)/i);

          if (tokenMatch && tokenMatch[1]) {
            const token = tokenMatch[1];
            // This is a simplified JWT parsing - in production you'd verify the token
            const payload = JSON.parse(
              Buffer.from(token.split(".")[1], "base64").toString()
            );
            if (payload && payload.sub) {
              userId = payload.sub;
              logger.info(
                `Extracted user ID ${userId} from token for socket ${spark.id}`
              );
            }
          }
        } catch (error) {
          logger.error(
            `Error extracting user ID from cookies: ${error.message}`
          );
        }
      }

      // If we found a user ID, set the authData
      if (userId) {
        spark.authData = {
          userId,
          authenticated: true,
          timestamp: Date.now(),
        };

        logger.info(`Fixed authData for socket ${spark.id}, user ${userId}`);
      }
    }

    // If we still don't have authData, handle as before
    if (!spark.authData || !spark.authData.userId) {
      // Instead of immediately rejecting, store the registration data
      // and process it when authentication completes
      if (!spark.pendingRegistration) {
        spark.pendingRegistration = data;
        logger.info(
          `Storing pending tab registration for ${spark.id} until authentication completes`
        );
      }

      // Notify client to retry after authentication
      spark.emit("auth:retry_registration", {
        message:
          "Authentication required for tab registration, will retry after auth",
        timestamp: Date.now(),
      });

      // If this is a forced election, we should try to authenticate the client first
      if (data.forceElection === true) {
        logger.info(
          `Forced election requested but not authenticated, attempting to authenticate: ${spark.id}`
        );

        // Try to authenticate the client if we have cookies
        if (
          spark.request &&
          spark.request.headers &&
          spark.request.headers.cookie
        ) {
          try {
            // Extract session ID from cookies if possible
            const cookies = spark.request.headers.cookie;
            const sessionMatch = cookies.match(/app_session_exists=([^;]+)/i);

            if (sessionMatch && sessionMatch[1] === "true") {
              logger.info(
                `Session cookie found for ${spark.id}, attempting to authenticate`
              );

              // Emit an event to trigger authentication
              spark.emit("auth:authenticate_required", {
                message: "Authentication required for tab registration",
                timestamp: Date.now(),
              });
            }
          } catch (error) {
            logger.error(
              `Error extracting cookies for authentication: ${error.message}`
            );
          }
        }
      }
    }

    return;
  }

  // Store tab and device info on spark
  spark.tabId = data.tabId;
  spark.deviceId = data.deviceId;
  spark.isVisible = data.isVisible || false;
  spark.tabInfo = data.info || {};

  // Check if this is a forced election request
  const forceElection = data.forceElection === true;

  // Join tab-specific room if not already joined
  joinRoom(spark, `tab:${data.tabId}`);

  // Join device-specific room if not already joined
  joinRoom(spark, `device:${data.deviceId}`);

  logger.info(
    `Tab registered for leader election: ${data.tabId} (device: ${
      data.deviceId
    })${forceElection ? " - FORCED ELECTION" : ""}`,
    {
      userId: spark.authData.userId,
      socketId: spark.id,
      tabId: data.tabId,
      deviceId: data.deviceId,
      isVisible: data.isVisible,
      forceElection: forceElection,
    }
  );

  // If cross-tab service is available, register with it
  if (crossTabService) {
    try {
      // Prepare socket data for cross-tab service
      if (!spark.data) {
        spark.data = {};
      }

      spark.data.userId = spark.authData.userId;
      spark.data.tabId = data.tabId;
      spark.data.deviceId = data.deviceId;
      spark.data.isVisible = data.isVisible;
      spark.data.forceElection = forceElection;

      // If this is a forced election, clear any existing leader first
      if (forceElection && typeof crossTabService.clearLeader === "function") {
        crossTabService.clearLeader(spark.authData.userId);
        logger.info(
          `Forced election: cleared existing leader for user ${spark.authData.userId}`
        );
      }

      // Check if registerSocket method exists
      if (typeof crossTabService.registerSocket === "function") {
        // Register with cross-tab service
        crossTabService.registerSocket(spark);
        logger.debug(`Tab ${data.tabId} registered with cross-tab service`);
      } else {
        logger.warn(
          `registerSocket method not found on cross-tab service, using fallback`
        );

        // Use initiateLeaderElection directly if available
        if (typeof crossTabService.initiateLeaderElection === "function") {
          crossTabService.initiateLeaderElection(spark);
          logger.debug(`Tab ${data.tabId} initiated leader election directly`);
        } else {
          // Fallback to making this tab the leader
          logger.warn(
            `No leader election methods available, using client-side fallback`
          );

          // Emit event to client
          spark.emit("leader:elected", {
            leaderId: data.tabId, // Make this tab the leader as fallback
            timestamp: Date.now(),
            reason: "fallback_no_service_method",
          });
        }
      }
    } catch (error) {
      logger.error(
        `Error registering tab with cross-tab service: ${error.message}`,
        error
      );

      // Fallback to making this tab the leader
      spark.emit("leader:elected", {
        leaderId: data.tabId, // Make this tab the leader as fallback
        timestamp: Date.now(),
        reason: "fallback_service_error",
      });
    }
  } else {
    logger.warn(
      "Cross-tab service not available, leader election will not work"
    );

    // Emit event to client
    spark.emit("leader:elected", {
      leaderId: data.tabId, // Make this tab the leader as fallback
      timestamp: Date.now(),
      reason: "fallback_no_service",
    });
  }

  // Acknowledge registration
  spark.emit("auth:tab_registered", {
    tabId: data.tabId,
    deviceId: data.deviceId,
    timestamp: Date.now(),
    forceElection: forceElection,
  });
}

/**
 * Handle leader ready notification
 * @param {Spark} spark - Primus spark (client connection)
 * @param {Object} data - Leader ready data
 */
function handleLeaderReady(spark, data) {
  if (!data || !data.tabId || !data.deviceId) {
    logger.warn(`Invalid leader ready data from ${spark.id}`);
    return;
  }

  // Make sure spark has auth data
  if (!spark.authData || !spark.authData.userId) {
    logger.warn(
      `Leader ready notification without authentication: ${spark.id}`
    );
    return;
  }

  logger.info(`Tab ${data.tabId} ready to be leader`, {
    userId: spark.authData.userId,
    socketId: spark.id,
    tabId: data.tabId,
    deviceId: data.deviceId,
  });

  // If cross-tab service is available, notify it
  if (crossTabService) {
    try {
      // Prepare event data for cross-tab service
      const eventData = {
        tabId: data.tabId,
        timestamp: Date.now(),
      };

      // Forward to cross-tab service if it has the method
      if (typeof crossTabService.handleLeaderReady === "function") {
        crossTabService.handleLeaderReady(spark, eventData);
      }
    } catch (error) {
      logger.error(
        `Error handling leader ready notification: ${error.message}`,
        error
      );
    }
  }
}

/**
 * Handle tab visibility change
 * @param {Spark} spark - Primus spark (client connection)
 * @param {Object} data - Visibility data
 */
function handleTabVisibility(spark, data) {
  if (!data || !data.tabId) {
    logger.warn(`Invalid tab visibility data from ${spark.id}`);
    return;
  }

  // Update visibility status
  spark.isVisible = data.isVisible || false;

  logger.debug(
    `Tab ${data.tabId} visibility changed: ${
      spark.isVisible ? "visible" : "hidden"
    }`,
    {
      userId: spark.authData?.userId,
      socketId: spark.id,
      tabId: data.tabId,
      deviceId: data.deviceId,
    }
  );

  // If cross-tab service is available, notify it about visibility change
  if (crossTabService && spark.data) {
    try {
      // Update visibility in spark data
      spark.data.isVisible = spark.isVisible;

      // Notify cross-tab service if it has the method
      if (typeof crossTabService.handleTabVisibilityChange === "function") {
        crossTabService.handleTabVisibilityChange(spark, data);
      }
    } catch (error) {
      logger.error(
        `Error handling tab visibility change: ${error.message}`,
        error
      );
    }
  }
}

/**
 * Handle tab closing notification
 * @param {Spark} spark - Primus spark (client connection)
 * @param {Object} data - Tab closing data
 */
function handleTabClosing(spark, data) {
  if (!data || !data.tabId) {
    logger.warn(`Invalid tab closing data from ${spark.id}`);
    return;
  }

  logger.info(`Tab ${data.tabId} closing notification received`, {
    userId: spark.authData?.userId,
    socketId: spark.id,
    tabId: data.tabId,
    deviceId: data.deviceId,
    isLeader: data.isLeader || false,
  });

  // If this was a leader tab, we need to notify other tabs
  if (data.isLeader && spark.authData?.userId) {
    const userId = spark.authData.userId;
    const deviceId = data.deviceId;

    // Notify all tabs for this user that the leader has left
    const userRoom = `user:${userId}`;

    // If we have a deviceId, only notify tabs on the same device
    if (deviceId) {
      // Use primusInstance to broadcast to room instead of spark.room
      if (primusInstance) {
        // Broadcast to all clients in the device room except this one
        primusInstance.forEach(function (client) {
          // Skip the current client
          if (client.id === spark.id) return;

          // Check if client is in the device room
          if (client.data && client.data.deviceId === deviceId) {
            client.emit("leader:failed", {
              previousLeaderId: data.tabId,
              deviceId: deviceId,
              reason: "tab_closed",
              timestamp: Date.now(),
            });
          }
        });

        logger.info(
          `Leader tab ${data.tabId} closed on device ${deviceId}, notified other tabs on same device`,
          {
            userId,
            tabId: data.tabId,
            deviceId: deviceId,
          }
        );
      }
    } else {
      // No deviceId, notify all tabs for this user
      if (primusInstance) {
        // Broadcast to all clients for this user except this one
        primusInstance.forEach(function (client) {
          // Skip the current client
          if (client.id === spark.id) return;

          // Check if client is for this user
          if (client.authData && client.authData.userId === userId) {
            client.emit("leader:failed", {
              previousLeaderId: data.tabId,
              reason: "tab_closed",
              timestamp: Date.now(),
            });
          }
        });

        logger.info(`Leader tab ${data.tabId} closed, notified all tabs`, {
          userId,
          tabId: data.tabId,
        });
      }
    }

    // Find another tab to make leader (device-specific if deviceId is provided)
    findNewLeader(userId, data.tabId, deviceId);
  }

  // If cross-tab service is available, notify it about tab closing
  if (crossTabService && spark.data) {
    try {
      // Notify cross-tab service if it has the method
      if (typeof crossTabService.handleTabClosing === "function") {
        crossTabService.handleTabClosing(spark, data);
      }
    } catch (error) {
      logger.error(
        `Error handling tab closing notification: ${error.message}`,
        error
      );
    }
  }
}

/**
 * Handle leader ping
 * This function is now a no-op in the pure event-based system
 * @param {Spark} spark - Primus spark (client connection)
 * @param {Object} data - Ping data
 */
function handleLeaderPing(spark, data) {
  // No-op in the pure event-based system
  // We don't need leader pings anymore
  logger.debug("Leader pings disabled in pure event-based system", {
    socketId: spark.id,
    tabId: data?.tabId,
    userId: spark.authData?.userId,
  });
}

/**
 * Broadcast to all clients in a room
 * @param {string} roomName - Room name
 * @param {string} event - Event name
 * @param {Object} data - Event data
 * @param {string} [excludeId] - Spark ID to exclude
 */
function broadcastToRoom(roomName, event, data, excludeId = null) {
  if (!rooms.has(roomName)) {
    return;
  }

  const room = rooms.get(roomName);

  for (const sparkId of room) {
    if (sparkId !== excludeId && connectedSparks.has(sparkId)) {
      const spark = connectedSparks.get(sparkId);
      spark.emit(event, data);
    }
  }
}

/**
 * Broadcast to all clients of a user
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 * @param {string} [excludeId] - Spark ID to exclude
 */
function broadcastToUser(userId, event, data, excludeId = null) {
  broadcastToRoom(`user:${userId}`, event, data, excludeId);
}

/**
 * Broadcast to all clients of a device
 * @param {string} deviceId - Device ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 * @param {string} [excludeId] - Spark ID to exclude
 */
function broadcastToDevice(deviceId, event, data, excludeId = null) {
  broadcastToRoom(`device:${deviceId}`, event, data, excludeId);
}

/**
 * Get Primus instance
 * @returns {Primus|null} Primus instance
 */
function getPrimus() {
  return primusInstance;
}

/**
 * Get client script
 * @returns {string} Client script
 */
function getClientLibrary() {
  if (!primusInstance) {
    throw new Error("Primus not initialized");
  }

  return primusInstance.library();
}

/**
 * Get connected client count
 * @returns {number} Connected client count
 */
function getConnectedCount() {
  return connectedSparks.size;
}

/**
 * Get room member count
 * @param {string} roomName - Room name
 * @returns {number} Room member count
 */
function getRoomCount(roomName) {
  if (!rooms.has(roomName)) {
    return 0;
  }

  return rooms.get(roomName).size;
}

/**
 * Find a new leader for a user after the previous leader tab closed
 * @param {string} userId - User ID
 * @param {string} previousLeaderId - Previous leader tab ID
 * @param {string} deviceId - Device ID (optional)
 */
function findNewLeader(userId, previousLeaderId, deviceId) {
  // Find all connected sockets for this user
  const userRoom = `user:${userId}`;

  // Get all sockets for this user
  const sockets = [];

  // Collect all sockets for this user
  if (primusInstance) {
    primusInstance.forEach(function (client) {
      if (client.authData && client.authData.userId === userId) {
        sockets.push(client.id);
      }
    });
  }

  if (!sockets || sockets.length === 0) {
    logger.info(
      `No active tabs found for user ${userId} after leader ${previousLeaderId} closed`
    );
    return;
  }

  // Find the first socket that's not the previous leader and matches the device if specified
  let newLeaderSocket = null;
  let newLeaderTabId = null;

  for (const socketId of sockets) {
    const socket = primusInstance.spark(socketId);
    if (socket && socket.data && socket.data.tabId !== previousLeaderId) {
      // If deviceId is specified, only consider sockets from the same device
      if (!deviceId || socket.data.deviceId === deviceId) {
        newLeaderSocket = socket;
        newLeaderTabId = socket.data.tabId;
        break;
      }
    }
  }

  if (newLeaderSocket && newLeaderTabId) {
    // Elect this tab as the new leader
    logger.info(
      `Electing tab ${newLeaderTabId} as new leader for user ${userId}${
        deviceId ? ` on device ${deviceId}` : ""
      }`
    );

    // Notify the new leader
    newLeaderSocket.emit("leader:elected", {
      leaderId: newLeaderTabId,
      previousLeaderId: previousLeaderId,
      deviceId: newLeaderSocket.data.deviceId,
      reason: "previous_leader_closed",
      timestamp: Date.now(),
    });

    // If deviceId is specified, only notify tabs on the same device
    if (deviceId) {
      // Notify all other tabs on the same device
      if (primusInstance) {
        primusInstance.forEach(function (client) {
          // Skip the new leader
          if (client.id === newLeaderSocket.id) return;

          // Check if client is in the device room
          if (client.data && client.data.deviceId === deviceId) {
            client.emit("leader:elected", {
              leaderId: newLeaderTabId,
              previousLeaderId: previousLeaderId,
              deviceId: deviceId,
              reason: "previous_leader_closed",
              timestamp: Date.now(),
            });
          }
        });

        logger.debug(
          `Notified other tabs on device ${deviceId} about new leader ${newLeaderTabId}`
        );
      }
    } else {
      // Notify all other tabs for this user
      if (primusInstance) {
        primusInstance.forEach(function (client) {
          // Skip the new leader
          if (client.id === newLeaderSocket.id) return;

          // Check if client is for this user
          if (client.authData && client.authData.userId === userId) {
            client.emit("leader:elected", {
              leaderId: newLeaderTabId,
              previousLeaderId: previousLeaderId,
              deviceId: newLeaderSocket.data.deviceId,
              reason: "previous_leader_closed",
              timestamp: Date.now(),
            });
          }
        });

        logger.debug(
          `Notified all tabs for user ${userId} about new leader ${newLeaderTabId}`
        );
      }
    }
  } else {
    logger.warn(
      `Could not find a suitable new leader for user ${userId}${
        deviceId ? ` on device ${deviceId}` : ""
      } after leader ${previousLeaderId} closed`
    );
  }
}

module.exports = {
  initializePrimus,
  getPrimus,
  getClientLibrary,
  getConnectedCount,
  getRoomCount,
  broadcastToRoom,
  broadcastToUser,
  broadcastToDevice,
  // Expose handlers for testing and direct access
  handleTabRegistration,
  handleLeaderReady,
  handleTabVisibility,
  handleTabClosing,
  handleLeaderPing,
  joinRoom,
  leaveRoom,
  findNewLeader,
};
