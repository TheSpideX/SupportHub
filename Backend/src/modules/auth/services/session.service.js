const { redisClient } = require("../../../config/redis");
const logger = require("../../../utils/logger");
const Session = require("../models/session.model");
const sessionConfig = require("../config/session.config");
const cookie = require("cookie");
const cookieConfig = require("../config/cookie.config");
const crypto = require("crypto");

// Store cleanup intervals for proper shutdown
const cleanupIntervals = [];

// Move connectionThrottling to module scope
const connectionThrottling = new Map();
const THROTTLE_WINDOW_MS = 60000; // 1 minute
const MAX_CONNECTIONS_PER_IP = 10;

const tokenService = require("./token.service");

// Room type constants
const ROOM_TYPES = {
  USER: "user",
  DEVICE: "device",
  SESSION: "session",
  TAB: "tab",
};

// Add helper function for room management
const createRoomName = (type, id) => `${type}:${id}`;

// Add this function to manage room hierarchy
const manageSocketRooms = async (socket, userData) => {
  try {
    const { userId, deviceId, sessionId, tabId } = userData;

    // Create room names
    const userRoom = createRoomName(ROOM_TYPES.USER, userId);
    const deviceRoom = createRoomName(ROOM_TYPES.DEVICE, deviceId);
    const sessionRoom = createRoomName(ROOM_TYPES.SESSION, sessionId);
    const tabRoom = tabId ? createRoomName(ROOM_TYPES.TAB, tabId) : null;

    // Join rooms in hierarchical order
    await socket.join(userRoom);
    await socket.join(deviceRoom);
    await socket.join(sessionRoom);
    if (tabRoom) await socket.join(tabRoom);

    // Store room info in socket for cleanup
    socket.userData = {
      userId,
      deviceId,
      sessionId,
      tabId,
      rooms: {
        userRoom,
        deviceRoom,
        sessionRoom,
        tabRoom,
      },
    };

    logger.debug("Socket joined rooms", {
      socketId: socket.id,
      rooms: socket.userData.rooms,
    });

    return socket.userData.rooms;
  } catch (error) {
    logger.error("Error managing socket rooms:", error);
    throw error;
  }
};

// Add function to cleanup empty rooms
const cleanupEmptyRooms = async (io, namespace) => {
  try {
    const rooms = await io.of(namespace).adapter.allRooms();

    for (const room of rooms) {
      const sockets = await io.of(namespace).adapter.sockets(new Set([room]));
      if (sockets.size === 0) {
        logger.debug(`Cleaning up empty room: ${room}`);
        await io.of(namespace).adapter.del(room);
      }
    }
  } catch (error) {
    logger.error("Error cleaning up empty rooms:", error);
  }
};

/**
 * Create a new session
 * @param {Object} options
 * @param {string} options.userId
 * @param {string} options.userAgent
 * @param {string} options.ipAddress
 * @param {Object} options.deviceInfo
 * @returns {Object} session
 */
exports.createSession = async ({
  userId,
  userAgent,
  ipAddress,
  deviceInfo,
  sessionData = {},
}) => {
  try {
    // Create a session document
    const session = await Session.create({
      userId: userId.toString(),
      isActive: true,
      expiresAt: new Date(Date.now() + sessionConfig.store.ttl * 1000),
      ipAddress,
      deviceInfo: {
        userAgent,
        ...deviceInfo,
      },
      lastActivity: new Date(),
      ...sessionData,
    });

    // Store session in Redis for faster access
    const sessionKey = `session:${session._id}`;
    const sessionValue = JSON.stringify({
      userId: session.userId,
      isActive: session.isActive,
      expiresAt: session.expiresAt,
      lastActivity: session.lastActivity,
    });

    // Use the redisClient wrapper which handles fallback
    const ttlSeconds = calculateTTLSeconds(session.expiresAt, Date.now(), Math.floor(sessionConfig.store.ttl));
    await setWithExpiry(sessionKey, sessionValue, ttlSeconds);

    return session;
  } catch (error) {
    logger.error("Failed to create session", error);
    throw new Error("Session creation failed");
  }
};

/**
 * Get session by ID
 * @param {string} sessionId
 * @returns {Object} session
 */
exports.getSessionById = async (sessionId) => {
  const sessionData = await redisClient.get(`session:${sessionId}`);

  if (!sessionData) {
    throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
  }

  const session = JSON.parse(sessionData);

  // Check if session is expired
  if (session.expiresAt < Date.now()) {
    throw new AppError("Session expired", 401, "SESSION_EXPIRED");
  }

  return session;
};

/**
 * Update session activity
 * @param {string} sessionId
 * @returns {Object} updated session
 */
exports.updateSessionActivity = async (sessionId) => {
  const session = await exports.getSessionById(sessionId);

  // Update last active time
  session.lastActiveAt = Date.now();

  // Update expiry time
  session.expiresAt = Date.now() + sessionConfig.maxAge;

  // Store updated session
  await setWithExpiry(
    `session:${sessionId}`,
    JSON.stringify(session),
    Math.ceil(sessionConfig.maxAge / 1000)
  );

  return session;
};

/**
 * End session
 * @param {string} sessionId
 * @param {string} reason - Reason for ending session
 * @returns {boolean}
 */
exports.endSession = async (sessionId, reason = "user_logout") => {
  try {
    const session = await exports.getSessionById(sessionId);

    // Update session status
    session.status = "ended";
    session.endedAt = Date.now();
    session.endReason = reason;

    // Store updated session with shorter TTL for audit purposes
    await setWithExpiry(
      `session:${sessionId}`,
      JSON.stringify(session),
      sessionConfig.endedSessionTtl || 86400 // Default 24 hours
    );

    // Remove from user's active sessions
    await redisClient.sRem(`user:${session.userId}:sessions`, sessionId);

    return true;
  } catch (error) {
    logger.error("Failed to end session", { sessionId, error: error.message });
    return false;
  }
};

/**
 * Mark session for cleanup
 * @param {string} sessionId
 * @returns {boolean}
 */
exports.markSessionForCleanup = async (sessionId) => {
  try {
    const session = await exports.getSessionById(sessionId);

    // Mark session for cleanup
    session.markedForCleanup = true;
    session.markedAt = Date.now();

    // Store updated session
    // Ensure we have a valid expiration time (default to 1 hour if maxAge is invalid)
    const expirySeconds = Number.isFinite(sessionConfig.maxAge)
      ? Math.ceil(sessionConfig.maxAge / 1000)
      : 3600; // 1 hour default

    await setWithExpiry(
      `session:${sessionId}`,
      JSON.stringify(session),
      expirySeconds
    );

    return true;
  } catch (error) {
    logger.error("Failed to mark session for cleanup", {
      sessionId,
      error: error.message,
    });
    return false;
  }
};

/**
 * Get all sessions for a user
 * @param {string} userId
 * @returns {Array} sessions
 */
exports.getUserSessions = async (userId) => {
  const sessionIds = await redisClient.sMembers(`user:${userId}:sessions`);

  if (!sessionIds || sessionIds.length === 0) {
    return [];
  }

  const sessions = [];

  for (const sessionId of sessionIds) {
    try {
      const session = await exports.getSessionById(sessionId);
      sessions.push(session);
    } catch (error) {
      // Skip sessions that can't be retrieved
      logger.warn("Failed to retrieve session", {
        sessionId,
        error: error.message,
      });
    }
  }

  return sessions;
};

/**
 * End all sessions for a user except the current one
 * @param {string} userId
 * @param {string} currentSessionId - Session ID to keep active
 * @returns {number} Number of sessions ended
 */
exports.endAllUserSessionsExceptCurrent = async (userId, currentSessionId) => {
  const sessions = await exports.getUserSessions(userId);

  let endedCount = 0;

  for (const session of sessions) {
    if (session.id !== currentSessionId) {
      const ended = await exports.endSession(
        session.id,
        "user_logged_out_elsewhere"
      );
      if (ended) {
        endedCount++;
      }
    }
  }

  return endedCount;
};

/**
 * Get session information for client
 * @param {string} sessionId
 * @param {Object} options
 * @returns {Promise<Object>}
 */
exports.getSessionInfo = async (sessionId, options = {}) => {
  try {
    const session = await exports.getSessionById(sessionId);
    
    if (!session) {
      return null;
    }
    
    // Calculate remaining time
    const now = Date.now();
    const expiresAt = session.expiresAt || now;
    const remainingTime = Math.max(0, expiresAt - now);
    
    // Filter sensitive information
    return {
      sessionId,
      userId: session.userId,
      deviceId: session.deviceId,
      activeTabs: session.activeTabs || [],
      lastActiveAt: session.lastActiveAt || session.createdAt,
      expiresAt: session.expiresAt,
      remainingTime,
      createdAt: session.createdAt,
      warnings: session.warnings || []
    };
  } catch (error) {
    logger.error("Failed to get session info", {
      sessionId,
      error: error.message,
    });
    return null;
  }
};

/**
 * Update tab activity in a session
 * @param {string} sessionId - Session ID
 * @param {string} tabId - Tab ID
 * @param {Object} data - Tab data
 * @returns {boolean} - Success status
 */
exports.updateTabActivity = async (sessionId, tabId, data = {}) => {
  try {
    // Get session
    const sessionKey = `session:${sessionId}`;
    const sessionData = await redisClient.get(sessionKey);

    if (!sessionData) {
      return false;
    }

    const session = JSON.parse(sessionData);

    // Initialize activeTabs array if it doesn't exist
    if (!session.activeTabs) {
      session.activeTabs = [];
    }

    // Find existing tab
    const existingTabIndex = session.activeTabs.findIndex(
      (tab) => tab.tabId === tabId
    );

    // Update or add tab
    const now = Date.now();
    const tabData = {
      tabId,
      lastActivity: now,
      ...data,
    };

    if (existingTabIndex >= 0) {
      session.activeTabs[existingTabIndex] = {
        ...session.activeTabs[existingTabIndex],
        ...tabData,
      };
    } else {
      session.activeTabs.push(tabData);
    }

    // Update session lastActiveAt
    session.lastActiveAt = now;

    // Clean up inactive tabs (older than 5 minutes)
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    session.activeTabs = session.activeTabs.filter(
      (tab) => tab.lastActivity > fiveMinutesAgo || tab.tabId === tabId
    );

    // Update session
    await setWithExpiry(
      sessionKey,
      JSON.stringify(session),
      Math.ceil((session.expiresAt - now) / 1000)
    );

    return true;
  } catch (error) {
    console.error("Failed to update tab activity", {
      sessionId,
      tabId,
      error: error.message,
    });
    return false;
  }
};

/**
 * Mark tab as inactive
 * @param {string} sessionId
 * @param {string} tabId
 * @returns {Promise<boolean>}
 */
exports.markTabInactive = async (sessionId, tabId) => {
  try {
    const sessionKey = `session:${sessionId}`;
    const session = await exports.getSessionById(sessionId);
    
    if (!session) {
      logger.warn(`Cannot mark tab inactive: Session ${sessionId} not found`);
      return false;
    }
    
    // Initialize activeTabs array if it doesn't exist
    if (!session.activeTabs) {
      session.activeTabs = [];
      return true; // No tabs to mark inactive
    }
    
    // Remove the tab from active tabs
    session.activeTabs = session.activeTabs.filter(
      (tab) => tab.tabId !== tabId
    );
    
    // Update session
    const now = Date.now();
    await setWithExpiry(
      sessionKey,
      JSON.stringify(session),
      Math.ceil((session.expiresAt - now) / 1000)
    );
    
    return true;
  } catch (error) {
    logger.error("Failed to mark tab as inactive", {
      sessionId,
      tabId,
      error: error.message,
    });
    return false;
  }
};

/**
 * Mark tab as active
 * @param {string} sessionId
 * @param {string} tabId
 * @param {Object} data - Additional tab data
 * @returns {Promise<boolean>}
 */
exports.markTabActive = async (sessionId, tabId, data = {}) => {
  try {
    const sessionKey = `session:${sessionId}`;
    const session = await exports.getSessionById(sessionId);
    
    if (!session) {
      logger.warn(`Cannot mark tab active: Session ${sessionId} not found`);
      return false;
    }
    
    // Initialize activeTabs array if it doesn't exist
    if (!session.activeTabs) {
      session.activeTabs = [];
    }
    
    // Check if tab already exists
    const existingTabIndex = session.activeTabs.findIndex(
      (tab) => tab.tabId === tabId
    );
    
    // Update or add tab
    const now = Date.now();
    const tabData = {
      tabId,
      lastActivity: now,
      ...data,
    };

    if (existingTabIndex >= 0) {
      session.activeTabs[existingTabIndex] = {
        ...session.activeTabs[existingTabIndex],
        ...tabData,
      };
    } else {
      session.activeTabs.push(tabData);
    }

    // Update session lastActiveAt
    session.lastActiveAt = now;

    // Clean up inactive tabs (older than 5 minutes)
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    session.activeTabs = session.activeTabs.filter(
      (tab) => tab.lastActivity > fiveMinutesAgo || tab.tabId === tabId
    );

    // Update session
    await setWithExpiry(
      sessionKey,
      JSON.stringify(session),
      Math.ceil((session.expiresAt - now) / 1000)
    );
    
    return true;
  } catch (error) {
    logger.error("Failed to mark tab as active", {
      sessionId,
      tabId,
      error: error.message,
    });
    return false;
  }
};

/**
 * Update tab activity
 * @param {string} sessionId
 * @param {string} tabId
 * @param {Object} clientInfo - Additional client information
 * @returns {Promise<boolean>}
 */
exports.updateTabActivity = async (sessionId, tabId, clientInfo = {}) => {
  try {
    return await exports.markTabActive(sessionId, tabId, clientInfo);
  } catch (error) {
    logger.error("Failed to update tab activity", {
      sessionId,
      tabId,
      error: error.message,
    });
    return false;
  }
};

/**
 * Update session activity timestamp
 * @param {string} sessionId
 * @param {number} timestamp
 * @returns {Promise<boolean>}
 */
exports.updateSessionActivity = async (sessionId, timestamp = Date.now()) => {
  try {
    const sessionKey = `session:${sessionId}`;
    const session = await exports.getSessionById(sessionId);
    
    if (!session) {
      logger.warn(`Cannot update activity: Session ${sessionId} not found`);
      return false;
    }
    
    // Update last activity timestamp
    session.lastActiveAt = timestamp;
    
    // Calculate expiration time in seconds, with validation
    const expiresAt = session.expiresAt instanceof Date ? session.expiresAt.getTime() : 
                      typeof session.expiresAt === 'string' ? new Date(session.expiresAt).getTime() : 
                      typeof session.expiresAt === 'number' ? session.expiresAt : null;
    
    if (!expiresAt) {
      logger.warn(`Invalid expiresAt value for session ${sessionId}: ${session.expiresAt}`);
      // Use default expiration as fallback
      const ttlSeconds = Math.ceil(sessionConfig.maxAge / 1000);
      await setWithExpiry(sessionKey, JSON.stringify(session), ttlSeconds);
    } else {
      const ttlSeconds = Math.max(1, Math.ceil((expiresAt - timestamp) / 1000));
      await setWithExpiry(sessionKey, JSON.stringify(session), ttlSeconds);
    }
    
    return true;
  } catch (error) {
    logger.error("Failed to update session activity", {
      sessionId,
      error: error.message,
    });
    return false;
  }
};

// Add initialization flag
let isInitialized = false;

/**
 * Initialize the session service
 * @param {Object} options - Configuration options
 */
exports.initialize = function (options = {}) {
  // Prevent duplicate initialization
  if (exports.isInitialized) {
    logger.debug('Session service already initialized, skipping');
    return;
  }

  logger.info("Initializing session service");

  // Apply configuration options
  if (options.store) {
    sessionConfig.store = options.store;
  }

  if (options.timeouts) {
    sessionConfig.timeouts = {
      ...sessionConfig.timeouts,
      ...options.timeouts,
    };
  }

  if (options.tracking) {
    sessionConfig.tracking = {
      ...sessionConfig.tracking,
      ...options.tracking,
    };
  }

  // Set up scheduled cleanup of expired sessions
  setupSessionCleanup();

  exports.isInitialized = true;
  logger.info("Session service initialized");

  // Periodically clean up connection throttling map
  setInterval(() => {
    try {
      const now = Date.now();
      const THROTTLE_WINDOW_MS = 60000; // 1 minute

      for (const [ip, timestamps] of connectionThrottling.entries()) {
        const validTimestamps = timestamps.filter(
          (timestamp) => now - timestamp < THROTTLE_WINDOW_MS
        );

        if (validTimestamps.length === 0) {
          connectionThrottling.delete(ip);
        } else {
          connectionThrottling.set(ip, validTimestamps);
        }
      }
    } catch (error) {
      logger.error("Error cleaning up connection throttling data:", error);
    }
  }, 5 * 60 * 1000); // Run every 5 minutes
};

/**
 * Set up scheduled cleanup of expired sessions with improved efficiency
 */
function setupSessionCleanup() {
  logger.info("Setting up session cleanup schedule");

  // Set up interval to clean up expired sessions
  const cleanupInterval = setInterval(async () => {
    try {
      logger.debug("Starting regular session cleanup");
      const now = Date.now();

      // Use SCAN instead of KEYS for production environments
      let sessionKeys = [];
      let cursor = "0";
      let scanCount = 0;
      let processedCount = 0;
      let cleanedCount = 0;
      let activeCount = 0;

      do {
        scanCount++;
        // Use scan instead of keys
        const [nextCursor, keys] = await redisClient.scan(
          cursor,
          "MATCH",
          "session:*",
          "COUNT",
          100
        );

        cursor = nextCursor;
        sessionKeys = sessionKeys.concat(keys);
        processedCount += keys.length;

        // Limit the number of scan operations per cleanup run
        if (scanCount >= 10) break;

        // Process in batches to avoid memory issues
        if (sessionKeys.length >= 200) {
          await processBatchCleanup(sessionKeys, now);
          const results = await processBatchCleanup(sessionKeys, now);
          cleanedCount += results.cleaned;
          activeCount += results.active;
          sessionKeys = []; // Reset batch
        }
      } while (cursor !== "0");

      // Process any remaining keys
      if (sessionKeys.length > 0) {
        const results = await processBatchCleanup(sessionKeys, now);
        cleanedCount += results.cleaned;
        activeCount += results.active;
      }

      logger.debug(
        `Session cleanup complete: ${cleanedCount} expired sessions removed, ${activeCount} active sessions`
      );

      if (activeCount > 10000) {
        logger.warn(
          `High number of active sessions (${activeCount}), consider reviewing session management`
        );
      }
    } catch (error) {
      logger.error("Error during session cleanup:", error);
    }
  }, 60 * 60 * 1000); // Run every hour

  // Run more frequent lightweight cleanup
  const lightCleanupInterval = setInterval(async () => {
    try {
      logger.debug("Starting light session cleanup");
      const now = Date.now();

      // Sample a small number of keys to check
      let sessionKeys = [];
      let cursor = "0";

      const [nextCursor, keys] = await redisClient.scan(
        cursor,
        "MATCH",
        "session:*",
        "COUNT",
        50
      );

      // Process this small batch for quick cleanup
      if (keys.length > 0) {
        const results = await processBatchCleanup(keys, now);
        if (results.cleaned > 0) {
          logger.debug(
            `Light cleanup: removed ${results.cleaned} expired sessions`
          );
        }
      }
    } catch (error) {
      logger.error("Error during light session cleanup:", error);
    }
  }, 5 * 60 * 1000); // Run every 5 minutes

  // Store intervals for cleanup during shutdown
  cleanupIntervals.push(cleanupInterval);
  cleanupIntervals.push(lightCleanupInterval);
}

/**
 * Process a batch of session keys for cleanup
 * @param {Array} sessionKeys - Array of session keys to check
 * @param {number} now - Current timestamp
 * @returns {Object} - Count of cleaned and active sessions
 */
async function processBatchCleanup(sessionKeys, now) {
  let cleanedCount = 0;
  let activeCount = 0;

  for (const key of sessionKeys) {
    try {
      const sessionData = await redisClient.get(key);
      if (!sessionData) {
        // Clean up keys with no data
        await redisClient.del(key);
        cleanedCount++;
        continue;
      }

      // Parse session data
      const session = JSON.parse(sessionData);

      // Check if session is expired
      if (session.expiresAt < now) {
        // Clean up expired session
        await redisClient.del(key);
        cleanedCount++;

        // Clean up related data (tabs, etc.)
        if (session.id) {
          await redisClient.del(`session:${session.id}:tabs`);
        }
      } else {
        activeCount++;

        // Update TTL based on expiration if using Redis
        const ttlSeconds = calculateTTLSeconds(session.expiresAt, now, 3600);
        if (ttlSeconds > 0) {
          await redisClient.expire(key, ttlSeconds);
        }
      }
    } catch (error) {
      logger.error(`Error processing session key ${key}:`, error);
      // Consider this a cleaned key since we tried to process it
      cleanedCount++;
    }
  }

  return { cleaned: cleanedCount, active: activeCount };
}

/**
 * Clean up resources used by the session service
 * Called during application shutdown
 */
exports.cleanup = async function () {
  logger.info("Cleaning up session service resources");

  // Clear all cleanup intervals
  cleanupIntervals.forEach((interval) => {
    clearInterval(interval);
  });

  // Clean up any other resources
  try {
    // Close any open connections or release resources

    logger.info("Session service resources cleaned up successfully");
  } catch (error) {
    logger.error("Error cleaning up session service resources:", error);
  }
};


/**
 * Set up WebSocket handlers for session namespace
 */
exports.setupSessionWebSockets = function (io) {
  if (!io) {
    logger.warn("Cannot set up session WebSockets: io instance not provided");
    return null;
  }

  // Initialize connection counter
  let connectionCount = 0;

  // Create session namespace
  const sessionNamespace = io.of("/session");

  // Throttling middleware
  sessionNamespace.use((socket, next) => {
    try {
      // Get client IP
      const clientIp =
        socket.handshake.headers["x-forwarded-for"] || socket.handshake.address;

      // Get current timestamp
      const now = Date.now();

      // Get connection history for this IP
      let ipHistory = connectionThrottling.get(clientIp) || [];

      // Remove connections outside of the throttle window
      ipHistory = ipHistory.filter((time) => time > now - THROTTLE_WINDOW_MS);

      // Check if connection limit is exceeded
      if (ipHistory.length >= MAX_CONNECTIONS_PER_IP) {
        logger.warn(`Connection throttled for IP: ${clientIp}`);
        return next(
          new Error("Connection rate limited, please try again later")
        );
      }

      // Update connection history
      ipHistory.push(now);
      connectionThrottling.set(clientIp, ipHistory);

      // Continue with authentication
      next();
    } catch (error) {
      logger.error("Error in session WebSocket middleware:", error);
      next(new Error("Internal server error"));
    }
  });

  // Socket authentication middleware with improved error handling
  sessionNamespace.use(async (socket, next) => {
    try {
      logger.debug("Socket authentication attempt", {
        socketId: socket.id,
        hasAuthCookies: !!socket.request.headers.cookie,
      });

      // Extract cookies from socket request
      const cookies = socket.request.headers.cookie;
      if (!cookies) {
        logger.warn("Socket connection rejected: No cookies found");
        return next(new Error("Authentication required"));
      }

      // Parse cookies
      const parsedCookies = cookie.parse(cookies);
      const accessToken = parsedCookies.access_token;
      const refreshToken = parsedCookies.refresh_token;

      if (!accessToken) {
        logger.warn("Socket connection rejected: No access token found");
        return next(new Error("Authentication required"));
      }

      // Verify access token
      try {
        const decoded = await tokenService.verifyAccessToken(accessToken);

        // Get session info
        const sessionId = decoded.sessionId;
        const session = await exports.getSessionById(sessionId);

        if (!session) {
          logger.warn(
            `Socket connection rejected: Session ${sessionId} not found`
          );
          return next(new Error("Session not found"));
        }

        // Store session info in socket for future use
        socket.data = {
          userId: decoded.userId || decoded.sub,
          sessionId: sessionId,
          deviceId: session.deviceId || socket.handshake.query.deviceId,
          tabId: socket.handshake.query.tabId,
        };

        logger.debug(
          `Socket authenticated: ${socket.id} for session ${sessionId}`
        );
        next();
      } catch (error) {
        if (error.name === "TokenExpiredError" && refreshToken) {
          try {
            // Try to refresh the token if access token is expired
            const refreshResult = await tokenService.refreshAuthTokens(
              refreshToken
            );

            if (refreshResult && refreshResult.accessToken) {
              const decoded = await tokenService.verifyAccessToken(
                refreshResult.accessToken
              );

              // Get session info
              const sessionId = decoded.sessionId;
              const session = await exports.getSessionById(sessionId);
              
              if (!session) {
                logger.warn(
                  `Socket connection rejected after refresh: Session ${sessionId} not found`
                );
                return next(new Error("Session not found"));
              }

              // Store session info in socket
              socket.data = {
                userId: decoded.userId || decoded.sub,
                sessionId: sessionId,
                deviceId: session.deviceId || socket.handshake.query.deviceId,
                tabId: socket.handshake.query.tabId,
              };

              logger.debug(
                `Socket authenticated after token refresh: ${socket.id}`
              );
              return next();
            } else {
              logger.warn("Token refresh returned invalid result");
              return next(new Error("Authentication failed"));
            }
          } catch (refreshError) {
            logger.error(
              "Token refresh failed during socket auth:",
              refreshError
            );
            return next(new Error("Authentication failed"));
          }
        }

        logger.warn(`Socket auth failed: ${error.message}`);
        next(new Error("Authentication failed"));
      }
    } catch (error) {
      logger.error("Error in socket authentication middleware:", error);
      next(new Error("Authentication error"));
    }
  });

  // Handle connections with room management and heartbeat
  sessionNamespace.on("connection", async (socket) => {
    try {
      // Increment connection counter
      connectionCount++;

      // Set isAlive property for heartbeat
      socket.isAlive = true;

      // Handle pong messages
      socket.on("pong", () => {
        socket.isAlive = true;
      });

      // Add socket to rooms based on session data
      const rooms = {
        userRoom: createRoomName(ROOM_TYPES.USER, socket.data.userId),
        deviceRoom: createRoomName(ROOM_TYPES.DEVICE, socket.data.deviceId),
        sessionRoom: createRoomName(ROOM_TYPES.SESSION, socket.data.sessionId),
        tabRoom: socket.data.tabId
          ? createRoomName(ROOM_TYPES.TAB, socket.data.tabId)
          : null,
      };

      // Join appropriate rooms
      Object.values(rooms).forEach((room) => {
        if (room) socket.join(room);
      });

      logger.info("Client connected to session WebSocket", {
        socketId: socket.id,
        userId: socket.data.userId,
        sessionId: socket.data.sessionId,
        deviceId: socket.data.deviceId,
        tabId: socket.data.tabId,
        rooms: Object.values(rooms).filter(Boolean),
      });

      // Record tab as active if tabId is provided
      if (socket.data.tabId) {
        await exports.markTabActive(
          socket.data.sessionId,
          socket.data.tabId,
          socket.handshake.query
        );
      }

      // Update session activity
      await exports.updateSessionActivity(socket.data.sessionId);

      // Emit connected event to client with session info
      const sessionInfo = await exports.getSessionInfo(socket.data.sessionId);
      socket.emit("connected", {
        socketId: socket.id,
        sessionId: socket.data.sessionId,
        timestamp: Date.now(),
        sessionInfo,
      });

      // Broadcast connection to other tabs on same device
      socket.to(rooms.deviceRoom).emit("tab:connect", {
        sessionId: socket.data.sessionId,
        tabId: socket.data.tabId,
        timestamp: Date.now(),
      });

      // Handle session sync requests
      socket.on("sync", async (data) => {
        try {
          if (!socket.data.sessionId) {
            return socket.emit("error", { message: "Not authenticated" });
          }

          const session = await exports.getSessionById(socket.data.sessionId);
          if (!session) {
            return socket.emit("error", { message: "Session not found" });
          }

          // Update tab activity
          if (data.tabId) {
            await exports.updateTabActivity(
              socket.data.sessionId,
              data.tabId,
              data.clientInfo || {}
            );
          }

          // Send session data back to client
          const sessionData = await exports.getSessionInfo(
            socket.data.sessionId,
            {
              tabId: data.tabId,
              clientInfo: data.clientInfo,
            }
          );

          // Broadcast updates to appropriate rooms based on scope
          if (data.scope === "device") {
            socket.to(rooms.deviceRoom).emit("session-update", sessionData);
          } else if (data.scope === "user") {
            socket.to(rooms.userRoom).emit("session-update", sessionData);
          } else {
            // Default to tab scope
            socket.emit("session-update", sessionData);
          }
        } catch (error) {
          logger.error("Error handling sync request:", error);
          socket.emit("error", { message: "Failed to sync session" });
        }
      });

      // Handle heartbeat responses with activity tracking
      socket.on("heartbeat:response", async (data) => {
        try {
          if (!socket.data.sessionId) {
            return socket.emit("error", { message: "Not authenticated" });
          }

          // Update session activity
          await exports.updateSessionActivity(
            socket.data.sessionId,
            data.timestamp || Date.now()
          );

          // Mark socket as alive
          socket.isAlive = true;
        } catch (error) {
          logger.error("Error handling heartbeat response:", error);
        }
      });

      // Handle disconnect
      socket.on("disconnect", async () => {
        try {
          // Decrement connection counter
          connectionCount = Math.max(0, connectionCount - 1);

          if (socket.data.sessionId && socket.data.tabId) {
            logger.info("Client disconnected from session WebSocket", {
              socketId: socket.id,
              userId: socket.data.userId,
              sessionId: socket.data.sessionId,
              tabId: socket.data.tabId,
            });

            // Mark tab as inactive
            await exports.markTabInactive(
              socket.data.sessionId,
              socket.data.tabId
            );
          }

          // Broadcast disconnect to device room
          socket.to(rooms.deviceRoom).emit("tab:disconnect", {
            sessionId: socket.data.sessionId,
            tabId: socket.data.tabId,
            timestamp: Date.now(),
          });

          // Clean up empty rooms after a delay
          setTimeout(() => {
            cleanupEmptyRooms(io, "/session");
          }, 5000); // 5 second delay to handle rapid reconnects
        } catch (error) {
          logger.error("Error handling socket disconnect:", error);
        }
      });
    } catch (error) {
      logger.error("Error setting up socket connection:", error);
      socket.disconnect(true);
    }
  });

  return sessionNamespace;
};

/**
 * Initialize WebSocket for session synchronization
 */
function initializeSessionWebSocket(io) {
  const sessionNamespace = io.of("/session");

  sessionNamespace.on("connection", (socket) => {
    logger.info("Client connected to session WebSocket");

    // Authenticate the socket connection
    socket.use(async (packet, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error("Authentication required"));
        }

        const decoded = await tokenService.verifyToken(token);
        socket.userId = decoded.userId;
        socket.sessionId = decoded.sessionId;
        next();
      } catch (error) {
        next(new Error("Invalid authentication"));
      }
    });

    // Handle session sync
    socket.on("sync", async (data) => {
      try {
        if (!socket.sessionId) {
          return socket.emit("error", { message: "Not authenticated" });
        }

        const session = await exports.getSessionById(socket.sessionId);
        if (!session) {
          return socket.emit("error", { message: "Session not found" });
        }

        // Update tab activity
        if (data.tabId) {
          await exports.updateTabActivity(socket.sessionId, data.tabId);
        }

        // Send session data back to client
        const sessionData = await exports.getSessionInfo(socket.sessionId, {
          tabId: data.tabId,
          clientInfo: data.clientInfo,
        });

        socket.emit("session-update", sessionData);
      } catch (error) {
        logger.error("Error in session sync:", error);
        socket.emit("error", { message: "Failed to sync session" });
      }
    });

    // Handle disconnect
    socket.on("disconnect", async () => {
      try {
        if (socket.sessionId && socket.userId) {
          logger.info("Client disconnected from session WebSocket");
          // Mark tab as inactive
          if (socket.handshake.query.tabId) {
            await exports.markTabInactive(
              socket.sessionId,
              socket.handshake.query.tabId
            );
          }
        }
      } catch (error) {
        logger.error("Error handling socket disconnect:", error);
      }
    });
  });

  return sessionNamespace;
}

/**
 * Clean up resources used by the session service
 * Called during application shutdown
 */
exports.cleanup = async function () {
  logger.info("Cleaning up session service resources");

  try {
    // Clear all intervals
    cleanupIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    cleanupIntervals.length = 0;

    logger.info("Session service cleanup completed");
    return true;
  } catch (error) {
    logger.error("Error during session service cleanup:", error);
    return false;
  }
};

// Export initialization status
exports.isInitialized = isInitialized;

// Export the module
module.exports = exports;

/**
 * Helper function to safely calculate TTL in seconds for Redis
 * @param {Date|string|number} expiresAt - Expiration timestamp
 * @param {number} now - Current timestamp
 * @param {number} defaultTTL - Default TTL in seconds if calculation fails
 * @returns {number} - TTL in seconds (always >= 1)
 */
const calculateTTLSeconds = (expiresAt, now = Date.now(), defaultTTL = 3600) => {
  try {
    // Convert expiresAt to milliseconds timestamp
    const expiryTime = expiresAt instanceof Date ? expiresAt.getTime() : 
                      typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : 
                      typeof expiresAt === 'number' ? expiresAt : null;
    
    // If conversion failed or result is invalid, use default
    if (!expiryTime || isNaN(expiryTime)) {
      return defaultTTL;
    }
    
    // Calculate TTL in seconds, with minimum of 1 second
    return Math.max(1, Math.ceil((expiryTime - now) / 1000));
  } catch (error) {
    logger.warn(`TTL calculation error: ${error.message}. Using default: ${defaultTTL}s`);
    return defaultTTL;
  }
};

/**
 * Helper function to set Redis key with expiration
 * @param {string} key - Redis key
 * @param {string} value - Value to store
 * @param {number} ttlSeconds - TTL in seconds
 */ 
const setWithExpiry = async (key, value, ttlSeconds) => {
  // Ensure ttlSeconds is valid
  const validTtl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 
    ? ttlSeconds 
    : Math.ceil(sessionConfig.store.ttl);
    
  await redisClient.set(key, value, "EX", validTtl);
};
