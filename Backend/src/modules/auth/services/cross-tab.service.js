/**
 * Token and Tab Synchronization Service
 * Handles synchronization of tokens across devices and tabs
 * and coordinates multiple tabs of the same user
 */
const logger = require("../../../utils/logger");
const socketConfig = require("../config/websocket.config");
const { EVENT_NAMES } = require("../constants/event-names.constant");
const socketService = require("./socket.service");

class TokenSyncService {
  constructor(io = null, tokenService = null) {
    this.io = io;
    this.tokenService = tokenService;
    this.leaderRegistry = new Map(); // userId -> {leaderId, deviceId, version}
    this.sharedStateRegistry = new Map(); // userId -> {stateData, version}
    // No heartbeat interval in event-based system
    this.isInitialized = false;

    // Cache for frequently accessed data
    this.cache = {
      userSockets: new Map(), // userId -> Set of socket IDs
      deviceSockets: new Map(), // deviceId -> Set of socket IDs
      lastCacheUpdate: Date.now(),
      cacheTTL: 10000, // 10 seconds
    };

    // Token sync configuration
    this.syncConfig = {
      enableCrossTabs: true,
      enableCrossDevices: true,
      syncInterval: 5 * 60 * 1000, // 5 minutes
      notifyOnRefresh: true,
    };

    // Cross-tab coordination configuration
    this.crossTabConfig = socketConfig.crossTab || {
      leaderElection: {
        // Event-based system doesn't use heartbeats
        candidateDelay: 2000, // Delay before becoming leader if no response
        leaderPriority: {
          visible: 100,
          hidden: 50,
        },
      },
    };

    // Data validation schemas
    this.schemas = {
      tabRegistration: {
        required: ["tabId"],
        properties: {
          tabId: { type: "string", minLength: 3 },
          deviceId: { type: "string", minLength: 3 },
          visibilityState: { type: "string", enum: ["visible", "hidden"] },
          forceElection: { type: "boolean" },
        },
      },
      tabClosing: {
        required: ["tabId"],
        properties: {
          tabId: { type: "string", minLength: 3 },
          deviceId: { type: "string", minLength: 3 },
          isLeader: { type: "boolean" },
        },
      },
      visibilityChange: {
        required: ["state"],
        properties: {
          state: { type: "string", enum: ["visible", "hidden"] },
          timestamp: { type: "number" },
        },
      },
      leaderElection: {
        required: ["candidateId", "priority"],
        properties: {
          candidateId: { type: "string", minLength: 3 },
          priority: { type: "number", minimum: 0 },
          vectorClock: { type: "object" },
          timestamp: { type: "number" },
        },
      },
      leaderTransfer: {
        required: ["newLeaderId"],
        properties: {
          newLeaderId: { type: "string", minLength: 3 },
          version: { type: "number", minimum: 0 },
          state: { type: "object" },
          vectorClock: { type: "object" },
        },
      },
    };

    logger.info("Token sync and cross-tab coordination service initialized");
  }

  /**
   * Initialize the service
   * @param {Object} options - Initialization options
   * @param {Object} options.io - Socket.IO instance
   * @param {Object} options.tokenService - Token service instance
   */
  initialize(options = {}) {
    // Initialize the event-based cross-tab coordination system
    logger.info("Initializing event-based cross-tab coordination system");

    // Set up event handlers for the event-based system
    this.setupEventHandlers();

    // Set io and tokenService if provided
    if (options.io) {
      this.io = options.io;
    }

    if (options.tokenService) {
      this.tokenService = options.tokenService;
    }

    // Set up cache refresh interval
    this.cacheRefreshInterval = setInterval(() => {
      this.refreshCache();
    }, this.cache.cacheTTL / 2); // Refresh cache at half the TTL

    // Mark as initialized
    this.isInitialized = true;
  }

  /**
   * Clean up resources when the service is stopped
   */
  cleanup() {
    logger.info("Cleaning up cross-tab coordination service");

    // Clear cache refresh interval
    if (this.cacheRefreshInterval) {
      clearInterval(this.cacheRefreshInterval);
      this.cacheRefreshInterval = null;
    }

    // Clear caches
    this.cache.userSockets.clear();
    this.cache.deviceSockets.clear();

    // Mark as not initialized
    this.isInitialized = false;
  }

  /**
   * Set up event handlers for the event-based system
   */
  setupEventHandlers() {
    // No need for heartbeat checks in an event-based system
    logger.debug(
      "Setting up event handlers for event-based cross-tab coordination"
    );
  }

  /**
   * Refresh the cache of connected sockets
   * This is called periodically to ensure the cache is up to date
   */
  refreshCache() {
    if (!this.io) {
      return;
    }

    // Clear existing cache
    this.cache.userSockets.clear();
    this.cache.deviceSockets.clear();

    // Rebuild cache
    this.io.forEach((client) => {
      if (client.authData && client.authData.userId) {
        const userId = client.authData.userId;

        // Add to user sockets cache
        if (!this.cache.userSockets.has(userId)) {
          this.cache.userSockets.set(userId, new Set());
        }
        this.cache.userSockets.get(userId).add(client.id);

        // Add to device sockets cache if deviceId is available
        if (client.data && client.data.deviceId) {
          const deviceId = client.data.deviceId;

          if (!this.cache.deviceSockets.has(deviceId)) {
            this.cache.deviceSockets.set(deviceId, new Set());
          }
          this.cache.deviceSockets.get(deviceId).add(client.id);
        }
      }
    });

    // Update last cache update timestamp
    this.cache.lastCacheUpdate = Date.now();

    logger.debug(
      `Cache refreshed: ${this.cache.userSockets.size} users, ${this.cache.deviceSockets.size} devices`
    );
  }

  /**
   * Get all sockets for a user
   * Uses cache if available, otherwise falls back to iterating through all sockets
   * @param {string} userId - User ID
   * @returns {Array} - Array of socket objects
   */
  getUserSockets(userId) {
    if (!this.io || !userId) {
      return [];
    }

    // Check if cache is stale
    const now = Date.now();
    if (now - this.cache.lastCacheUpdate > this.cache.cacheTTL) {
      this.refreshCache();
    }

    // Get socket IDs from cache
    const socketIds = this.cache.userSockets.get(userId) || new Set();

    // Get socket objects
    const sockets = [];
    socketIds.forEach((socketId) => {
      const socket = this.io.connections ? this.io.connections[socketId] : null;
      if (socket) {
        sockets.push(socket);
      }
    });

    return sockets;
  }

  /**
   * Get all sockets for a device
   * Uses cache if available, otherwise falls back to iterating through all sockets
   * @param {string} deviceId - Device ID
   * @returns {Array} - Array of socket objects
   */
  getDeviceSockets(deviceId) {
    if (!this.io || !deviceId) {
      return [];
    }

    // Check if cache is stale
    const now = Date.now();
    if (now - this.cache.lastCacheUpdate > this.cache.cacheTTL) {
      this.refreshCache();
    }

    // Get socket IDs from cache
    const socketIds = this.cache.deviceSockets.get(deviceId) || new Set();

    // Get socket objects
    const sockets = [];
    socketIds.forEach((socketId) => {
      const socket = this.io.connections ? this.io.connections[socketId] : null;
      if (socket) {
        sockets.push(socket);
      }
    });

    return sockets;
  }

  /**
   * Emit an event to all sockets for a user
   * @param {string} userId - User ID
   * @param {string} event - Event name
   * @param {Object} data - Event data
   * @param {string} [excludeSocketId] - Socket ID to exclude
   */
  emitToUser(userId, event, data, excludeSocketId = null) {
    if (!this.io || !userId || !event) {
      return;
    }

    const sockets = this.getUserSockets(userId);

    for (const socket of sockets) {
      if (excludeSocketId && socket.id === excludeSocketId) {
        continue;
      }

      socket.emit(event, data);
    }

    logger.debug(
      `Emitted ${event} to ${sockets.length} sockets for user ${userId}`
    );
  }

  /**
   * Emit an event to all sockets for a device
   * @param {string} deviceId - Device ID
   * @param {string} event - Event name
   * @param {Object} data - Event data
   * @param {string} [excludeSocketId] - Socket ID to exclude
   */
  emitToDevice(deviceId, event, data, excludeSocketId = null) {
    if (!this.io || !deviceId || !event) {
      return;
    }

    const sockets = this.getDeviceSockets(deviceId);

    for (const socket of sockets) {
      if (excludeSocketId && socket.id === excludeSocketId) {
        continue;
      }

      socket.emit(event, data);
    }

    logger.debug(
      `Emitted ${event} to ${sockets.length} sockets for device ${deviceId}`
    );
  }

  /**
   * Register a socket for cross-tab coordination
   * @param {Object} socket - Primus spark
   * @returns {boolean} - Whether the socket was successfully registered
   */
  registerSocket(socket) {
    if (!socket || !socket.data || !socket.data.userId || !socket.data.tabId) {
      logger.warn("Cannot register socket without proper data");
      return false;
    }

    const { userId, tabId, deviceId } = socket.data;
    const forceElection = socket.data.forceElection === true;

    logger.debug(`Registering socket for tab ${tabId} (user ${userId})`, {
      tabId,
      deviceId,
      forceElection,
      socketId: socket.id,
    });

    // In Primus, we don't need to explicitly join rooms as we're using the
    // room functionality from the primus.service.js which handles this for us
    // We'll just store the room names for reference
    const userRoom = `user:${userId}`;
    const tabRoom = `tab:${tabId}`;
    const deviceRoom = deviceId ? `device:${deviceId}` : null;

    // Store room information in socket data for reference
    socket.data.rooms = {
      userRoom,
      tabRoom,
      deviceRoom,
    };

    // Set up leader election handlers
    // No heartbeat in event-based system
    socket.on(EVENT_NAMES.LEADER_ELECTION, (data) =>
      this.handleElection(socket, data)
    );
    socket.on(EVENT_NAMES.LEADER_TRANSFER, (data) =>
      this.handleLeaderTransfer(socket, data)
    );

    // If this is a forced election, clear any existing leader
    if (forceElection) {
      this.clearLeader(userId, deviceId);
    }

    // Check if there's already a leader
    const leaderInfo = this.leaderRegistry.get(userId);

    if (leaderInfo) {
      // There's already a leader, notify this tab
      socket.emit(EVENT_NAMES.LEADER_ELECTED, {
        leaderId: leaderInfo.leaderId,
        version: leaderInfo.version,
        timestamp: Date.now(),
      });

      logger.debug(
        `Notified tab ${tabId} about existing leader ${leaderInfo.leaderId}`
      );

      // If this tab is the leader, update the socket ID
      if (leaderInfo.leaderId === tabId) {
        // Update the socket ID in the registry
        leaderInfo.socketId = socket.id;
        this.leaderRegistry.set(userId, leaderInfo);

        // Mark this socket as leader
        socket.data.isLeader = true;

        logger.debug(`Updated socket ID for leader ${tabId} (user ${userId})`);
      }
    } else {
      // No leader exists, initiate leader election
      this.initiateLeaderElection(socket);
    }

    return true;
  }

  /**
   * Initialize token synchronization for a socket
   * @param {Object} socket - Socket.IO socket
   */
  initializeTokenSync(socket) {
    // Set up token sync event handlers
    socket.on(EVENT_NAMES.TOKEN_REFRESH, (data) =>
      this.handleTokenRefresh(socket, data)
    );
    socket.on(EVENT_NAMES.TOKEN_INVALIDATE, (data) =>
      this.handleTokenInvalidate(socket, data)
    );
    socket.on(EVENT_NAMES.TOKEN_SYNC_REQUEST, () =>
      this.handleTokenSyncRequest(socket)
    );

    logger.debug(`Token sync initialized for socket ${socket.id}`);
  }

  /**
   * Initialize socket for cross-tab coordination
   * @param {Object} socket - Socket.IO socket
   */
  initializeTabCoordination(socket) {
    if (!socket.data || !socket.data.userId) return;

    // Register for leader election
    this.registerSocket(socket);

    // Initialize connection sharing if enabled
    if (this.crossTabConfig.connectionSharing.enabled) {
      this.initializeConnectionSharing(socket);
    }

    // Initialize state synchronization
    this.initializeStateSync(socket);

    logger.debug(`Tab coordination initialized for socket ${socket.id}`);
  }

  // The registerSocket method has been merged with the one above

  /**
   * Handle token refresh event
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Refresh data
   */
  async handleTokenRefresh(socket, data) {
    try {
      const { refreshToken } = data;
      const { userId, deviceId, tabId } = socket.data;

      if (!refreshToken) {
        socket.emit(EVENT_NAMES.TOKEN_ERROR, {
          message: "No refresh token provided",
          code: "MISSING_REFRESH_TOKEN",
        });
        return;
      }

      // Refresh token
      const result = await this.tokenService.refreshAccessToken(refreshToken);

      if (!result) {
        socket.emit(EVENT_NAMES.TOKEN_ERROR, {
          message: "Token refresh failed",
          code: "REFRESH_FAILED",
        });
        return;
      }

      const { token, refreshToken: newRefreshToken } = result;

      // Send new tokens to client
      socket.emit(EVENT_NAMES.TOKEN_UPDATED, {
        token,
        refreshToken: newRefreshToken,
        updatedAt: Date.now(),
      });

      // Notify other tabs on same device
      if (this.syncConfig.enableCrossTabs && deviceId && this.io) {
        this.io.forEach((client) => {
          // Skip the current client
          if (client.id === socket.id) return;

          // Only send to clients on the same device
          if (client.data && client.data.deviceId === deviceId) {
            client.emit(EVENT_NAMES.TOKEN_UPDATED, {
              token,
              refreshToken: newRefreshToken,
              updatedAt: Date.now(),
              source: tabId || socket.id,
            });
          }
        });
      }

      // Notify other devices if cross-device sync is enabled
      if (this.syncConfig.enableCrossDevices) {
        const userRoom = socketService.createRoomName("user", userId);
        const deviceRoom = socketService.createRoomName("device", deviceId);

        // Send notification to other devices (without tokens)
        this.io
          .to(userRoom)
          .except(deviceRoom)
          .emit(EVENT_NAMES.TOKEN_REFRESH_NOTIFICATION, {
            deviceId: deviceId,
            updatedAt: Date.now(),
            source: tabId || socket.id,
          });
      }

      logger.debug(`Token refreshed for user ${userId}`);
    } catch (error) {
      logger.error(`Error handling token refresh:`, error);
      socket.emit(EVENT_NAMES.TOKEN_ERROR, {
        message: "Error refreshing token",
        code: "REFRESH_ERROR",
      });
    }
  }

  /**
   * Handle token invalidation event
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Invalidation data
   */
  async handleTokenInvalidate(socket, data) {
    try {
      const { reason = "user_request", allDevices = false } = data;
      const { userId, deviceId } = socket.data;

      if (!userId) {
        socket.emit(EVENT_NAMES.TOKEN_ERROR, {
          message: "Unauthorized",
          code: "UNAUTHORIZED",
        });
        return;
      }

      // Invalidate tokens
      if (allDevices) {
        await this.tokenService.invalidateAllUserTokens(userId);
      } else if (deviceId) {
        await this.tokenService.invalidateDeviceTokens(userId, deviceId);
      }

      // Notify other clients
      if (allDevices && this.syncConfig.enableCrossDevices) {
        // Invalidate tokens across all devices
        this.emitToUser(
          userId,
          EVENT_NAMES.TOKEN_INVALIDATED,
          {
            reason,
            timestamp: Date.now(),
            source: socket.id,
          },
          socket.id
        ); // Exclude the current socket
      } else if (deviceId && this.syncConfig.enableCrossTabs) {
        // Invalidate tokens on current device only
        this.emitToDevice(
          deviceId,
          EVENT_NAMES.TOKEN_INVALIDATED,
          {
            reason,
            timestamp: Date.now(),
            source: socket.id,
          },
          socket.id
        ); // Exclude the current socket
      }

      logger.debug(`Tokens invalidated for user ${userId}, reason: ${reason}`);
    } catch (error) {
      logger.error(`Error handling token invalidation:`, error);
      socket.emit(EVENT_NAMES.TOKEN_ERROR, {
        message: "Error invalidating tokens",
        code: "INVALIDATION_ERROR",
      });
    }
  }

  /**
   * Handle token sync request
   * @param {Object} socket - Socket.IO socket
   */
  async handleTokenSyncRequest(socket) {
    try {
      const { userId, deviceId } = socket.data;

      if (!userId || !deviceId) {
        socket.emit(EVENT_NAMES.TOKEN_ERROR, {
          message: "Unauthorized",
          code: "UNAUTHORIZED",
        });
        return;
      }

      // Get current tokens
      const tokens = await this.tokenService.getCurrentTokens(userId, deviceId);

      if (tokens) {
        socket.emit(EVENT_NAMES.TOKEN_UPDATED, {
          ...tokens,
          updatedAt: Date.now(),
        });
      }
    } catch (error) {
      logger.error(`Error handling token sync request:`, error);
      socket.emit(EVENT_NAMES.TOKEN_ERROR, {
        message: "Error syncing tokens",
        code: "SYNC_ERROR",
      });
    }
  }

  /**
   * Enhance leader election with vector clocks for better consensus
   * @param {Object} socket - Socket.IO socket
   */
  initiateLeaderElection(socket) {
    const { userId, tabId } = socket.data;
    const priority = this.getTabPriority(socket);
    const forceElection = socket.data.forceElection === true;

    // Initialize vector clock for this tab
    socket.data.vectorClock = {
      [tabId]: Date.now(),
      timestamp: Date.now(),
    };

    // Check if a leader exists and is active
    const leaderInfo = this.leaderRegistry.get(userId);

    // Check if this is the only tab for this user
    this.isOnlyTab(userId, tabId)
      .then((isOnlyTab) => {
        // If force election is requested, no active leader exists, or this is the only tab, become leader immediately
        if (forceElection || !leaderInfo || isOnlyTab) {
          // Log the reason for election
          if (forceElection) {
            logger.info(
              `Forced leader election for tab ${tabId} (user ${userId})`
            );
          } else if (isOnlyTab) {
            logger.info(
              `Tab ${tabId} is the only tab for user ${userId}, electing as leader`
            );
          } else if (!leaderInfo) {
            logger.debug(
              `No leader exists for user ${userId}, electing tab ${tabId}`
            );
          } else {
            logger.debug(
              `Leader ${leaderInfo.leaderId} for user ${userId} is inactive, electing tab ${tabId}`
            );
          }

          // Become leader
          const electionSuccessful = this.electAsLeader(socket, priority);

          if (electionSuccessful === false) {
            logger.debug(`Leader election failed for tab ${tabId}`, {
              userId,
              tabId,
              reason: "higher_priority_leader_exists",
            });
          }
        } else {
          // Leader exists, send election request with vector clock
          if (this.io) {
            this.io.forEach((client) => {
              // Skip the current client
              if (client.id === socket.id) return;

              // Only send to clients for this user
              if (client.authData && client.authData.userId === userId) {
                client.emit(EVENT_NAMES.LEADER_ELECTION, {
                  candidateId: tabId,
                  priority,
                  vectorClock: socket.data.vectorClock,
                  timestamp: Date.now(),
                });
              }
            });
          }

          // Set timeout to become leader if no response
          setTimeout(() => {
            // Check again if this is the only tab
            this.isOnlyTab(userId, tabId)
              .then((isOnlyTabNow) => {
                const currentLeaderInfo = this.leaderRegistry.get(userId);
                // Only become leader if no leader exists, this is the only tab, or if the leader hasn't changed
                if (
                  !currentLeaderInfo ||
                  isOnlyTabNow ||
                  (leaderInfo &&
                    currentLeaderInfo.leaderId === leaderInfo.leaderId)
                ) {
                  if (isOnlyTabNow) {
                    logger.info(
                      `Tab ${tabId} is now the only tab for user ${userId}, electing as leader`
                    );
                  }
                  const electionSuccessful = this.electAsLeader(
                    socket,
                    priority
                  );

                  if (electionSuccessful === false) {
                    logger.debug(
                      `Leader election failed for tab ${tabId} after checking if only tab`,
                      {
                        userId,
                        tabId,
                        reason: "higher_priority_leader_exists",
                      }
                    );
                  }
                }
              })
              .catch((error) => {
                logger.error(
                  `Error checking if tab is the only one: ${error.message}`
                );
                // Fall back to normal behavior
                const currentLeaderInfo = this.leaderRegistry.get(userId);
                if (
                  !currentLeaderInfo ||
                  (leaderInfo &&
                    currentLeaderInfo.leaderId === leaderInfo.leaderId &&
                    Date.now() - currentLeaderInfo.lastHeartbeat >
                      this.crossTabConfig.leaderElection.heartbeatInterval *
                        this.crossTabConfig.leaderElection
                          .missedHeartbeatsThreshold)
                ) {
                  const electionSuccessful = this.electAsLeader(
                    socket,
                    priority
                  );

                  if (electionSuccessful === false) {
                    logger.debug(
                      `Leader election failed for tab ${tabId} after error fallback`,
                      {
                        userId,
                        tabId,
                        reason: "higher_priority_leader_exists",
                      }
                    );
                  }
                }
              });
          }, this.crossTabConfig.leaderElection.candidateDelay);
        }
      })
      .catch((error) => {
        logger.error(`Error checking if tab is the only one: ${error.message}`);
        // Fall back to normal behavior
        if (forceElection || !leaderInfo) {
          const electionSuccessful = this.electAsLeader(socket, priority);

          if (electionSuccessful === false) {
            logger.debug(
              `Leader election failed for tab ${tabId} after error in isOnlyTab`,
              {
                userId,
                tabId,
                reason: "higher_priority_leader_exists",
              }
            );
          }
        } else {
          // Leader exists, send election request with vector clock
          if (this.io) {
            this.io.forEach((client) => {
              // Skip the current client
              if (client.id === socket.id) return;

              // Only send to clients for this user
              if (client.authData && client.authData.userId === userId) {
                client.emit(EVENT_NAMES.LEADER_ELECTION, {
                  candidateId: tabId,
                  priority,
                  vectorClock: socket.data.vectorClock,
                  timestamp: Date.now(),
                });
              }
            });
          }

          // Set timeout to become leader if no response
          setTimeout(() => {
            const currentLeaderInfo = this.leaderRegistry.get(userId);
            if (
              !currentLeaderInfo ||
              (leaderInfo && currentLeaderInfo.leaderId === leaderInfo.leaderId)
            ) {
              this.electAsLeader(socket, priority);
            }
          }, this.crossTabConfig.leaderElection.candidateDelay);
        }
      });
  }

  /**
   * Elect socket as leader with enhanced consensus
   * @param {Object} socket - Primus spark
   * @param {number} priority - Tab priority
   * @returns {boolean} - Whether the election was successful
   */
  electAsLeader(socket, priority) {
    const { userId, tabId } = socket.data;

    // Double-check if there's already a leader with higher priority
    // This helps prevent race conditions where multiple tabs try to become leader simultaneously
    const existingLeader = this.leaderRegistry.get(userId);
    if (
      existingLeader &&
      existingLeader.leaderId !== tabId &&
      existingLeader.priority > priority
    ) {
      logger.debug(
        `Not electing tab ${tabId} as leader because tab ${existingLeader.leaderId} has higher priority`,
        {
          tabId,
          existingLeaderId: existingLeader.leaderId,
          tabPriority: priority,
          existingPriority: existingLeader.priority,
        }
      );
      return false;
    }

    // Use a timestamp to detect and resolve conflicts
    const electionTimestamp = Date.now();

    // Update vector clock
    if (!socket.data.vectorClock) {
      socket.data.vectorClock = {
        [tabId]: electionTimestamp,
        timestamp: electionTimestamp,
      };
    } else {
      socket.data.vectorClock[tabId] = electionTimestamp;
    }

    // Register as leader in registry with version number for conflict resolution
    const newVersion = (this.leaderRegistry.get(userId)?.version || 0) + 1;

    this.leaderRegistry.set(userId, {
      leaderId: tabId,
      socketId: socket.id,
      deviceId: socket.data.deviceId,
      lastHeartbeat: electionTimestamp,
      priority,
      vectorClock: socket.data.vectorClock,
      version: newVersion,
      electedAt: electionTimestamp,
    });

    // Mark socket as leader
    socket.data.isLeader = true;
    socket.data.leaderSince = electionTimestamp;
    socket.data.leaderVersion = newVersion;

    // Notify all tabs about new leader with vector clock
    this.emitToUser(
      userId,
      EVENT_NAMES.LEADER_ELECTED,
      {
        leaderId: tabId,
        version: this.leaderRegistry.get(userId).version,
        vectorClock: socket.data.vectorClock,
        timestamp: Date.now(),
      },
      socket.id
    ); // Exclude the current socket

    // In the event-based system, we don't need heartbeats
    // Instead, we'll rely on socket disconnect events and explicit tab closing events

    // Notify the client that it's now the leader
    socket.emit(EVENT_NAMES.LEADER_ELECTED, {
      leaderId: tabId,
      version: this.leaderRegistry.get(userId).version,
      vectorClock: socket.data.vectorClock,
      timestamp: Date.now(),
      isYou: true,
    });

    // Initialize leader state
    if (!this.sharedStateRegistry.has(userId)) {
      this.sharedStateRegistry.set(userId, {
        stateData: {},
        version: 1,
        vectorClock: socket.data.vectorClock,
        updatedBy: tabId,
        updatedAt: Date.now(),
      });
    }

    logger.debug(
      `Tab ${tabId} elected as leader for user ${userId} with version ${
        this.leaderRegistry.get(userId).version
      }`
    );
  }

  /**
   * Handle socket reconnection
   * This is called when a socket reconnects after a network interruption
   * @param {Object} socket - Primus spark
   */
  handleReconnection(socket) {
    if (!socket || !socket.data) {
      logger.warn(
        "Cannot handle reconnection: socket or socket.data is undefined"
      );
      return;
    }

    const { userId, tabId, deviceId } = socket.data;

    if (!userId || !tabId) {
      logger.warn("Cannot handle reconnection: missing userId or tabId", {
        socketId: socket.id,
      });
      return;
    }

    logger.info(`Tab ${tabId} reconnected`, {
      userId,
      tabId,
      deviceId,
      timestamp: Date.now(),
    });

    // Check if this tab was previously a leader
    const wasLeader = socket.data.isLeader === true;
    const leaderInfo = this.leaderRegistry.get(userId);
    const isStillLeader = leaderInfo && leaderInfo.leaderId === tabId;

    // Update socket data with current state
    socket.data.isLeader = isStillLeader;

    if (wasLeader && !isStillLeader) {
      // This tab was a leader but is no longer
      // Notify the tab that it's no longer a leader
      socket.emit(EVENT_NAMES.LEADER_CHANGED, {
        isLeader: false,
        previousLeaderId: tabId,
        newLeaderId: leaderInfo?.leaderId,
        reason: "reconnection",
        timestamp: Date.now(),
      });

      logger.info(
        `Tab ${tabId} was leader but lost leadership during disconnection`,
        {
          userId,
          tabId,
          deviceId,
          newLeaderId: leaderInfo?.leaderId,
        }
      );
    } else if (isStillLeader) {
      // This tab is still the leader
      // Update the socket ID in the registry
      leaderInfo.socketId = socket.id;
      this.leaderRegistry.set(userId, leaderInfo);

      // Notify the tab that it's still the leader
      socket.emit(EVENT_NAMES.LEADER_ELECTED, {
        leaderId: tabId,
        version: leaderInfo.version,
        timestamp: Date.now(),
        isYou: true,
      });

      logger.info(`Tab ${tabId} reconnected and is still the leader`, {
        userId,
        tabId,
        deviceId,
      });
    } else if (leaderInfo) {
      // There's a leader, notify this tab
      socket.emit(EVENT_NAMES.LEADER_ELECTED, {
        leaderId: leaderInfo.leaderId,
        version: leaderInfo.version,
        timestamp: Date.now(),
      });

      logger.debug(
        `Notified reconnected tab ${tabId} about existing leader ${leaderInfo.leaderId}`,
        {
          userId,
          tabId,
          deviceId,
        }
      );
    } else {
      // No leader exists, initiate leader election
      const priority = this.getTabPriority(socket);
      this.initiateLeaderElection(socket);

      logger.debug(
        `No leader exists, initiating election for reconnected tab ${tabId}`,
        {
          userId,
          tabId,
          deviceId,
        }
      );
    }

    // Sync shared state if available
    const stateInfo = this.sharedStateRegistry.get(userId);
    if (stateInfo) {
      socket.emit(EVENT_NAMES.STATE_SYNC, {
        state: stateInfo.stateData,
        version: stateInfo.version,
        timestamp: Date.now(),
      });

      logger.debug(`Synced state to reconnected tab ${tabId}`, {
        userId,
        tabId,
        deviceId,
        stateVersion: stateInfo.version,
      });
    }
  }

  /**
   * Validate data against a schema
   * @param {Object} data - Data to validate
   * @param {Object} schema - Schema to validate against
   * @returns {Object} - Validation result with isValid and errors properties
   */
  validateData(data, schema) {
    if (!data) {
      return { isValid: false, errors: ["Data is required"] };
    }

    if (!schema || typeof schema !== "object") {
      return { isValid: true, errors: [] }; // No schema, assume valid
    }

    const errors = [];
    const validatedData = {};

    // Check required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (data[field] === undefined) {
          errors.push(`Field '${field}' is required`);
        }
      }
    }

    // Validate fields against schema
    if (schema.properties && typeof schema.properties === "object") {
      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        if (data[field] !== undefined) {
          // Type validation
          if (fieldSchema.type) {
            const actualType = Array.isArray(data[field])
              ? "array"
              : typeof data[field];
            if (actualType !== fieldSchema.type) {
              errors.push(
                `Field '${field}' should be of type ${fieldSchema.type}, got ${actualType}`
              );
              continue;
            }
          }

          // Format validation
          if (fieldSchema.format) {
            let isValid = true;
            switch (fieldSchema.format) {
              case "uuid":
                isValid =
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                    data[field]
                  );
                break;
              case "email":
                isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data[field]);
                break;
              case "date-time":
                isValid = !isNaN(Date.parse(data[field]));
                break;
              case "date":
                isValid = /^\d{4}-\d{2}-\d{2}$/.test(data[field]);
                break;
              case "time":
                isValid = /^\d{2}:\d{2}(:\d{2})?$/.test(data[field]);
                break;
              case "uri":
                try {
                  new URL(data[field]);
                  isValid = true;
                } catch (e) {
                  isValid = false;
                }
                break;
            }

            if (!isValid) {
              errors.push(
                `Field '${field}' does not match format ${fieldSchema.format}`
              );
              continue;
            }
          }

          // Pattern validation
          if (fieldSchema.pattern && typeof data[field] === "string") {
            const regex = new RegExp(fieldSchema.pattern);
            if (!regex.test(data[field])) {
              errors.push(
                `Field '${field}' does not match pattern ${fieldSchema.pattern}`
              );
              continue;
            }
          }

          // Enum validation
          if (fieldSchema.enum && Array.isArray(fieldSchema.enum)) {
            if (!fieldSchema.enum.includes(data[field])) {
              errors.push(
                `Field '${field}' should be one of [${fieldSchema.enum.join(
                  ", "
                )}]`
              );
              continue;
            }
          }

          // Min/max validation for numbers
          if (typeof data[field] === "number") {
            if (
              fieldSchema.minimum !== undefined &&
              data[field] < fieldSchema.minimum
            ) {
              errors.push(
                `Field '${field}' should be >= ${fieldSchema.minimum}`
              );
            }
            if (
              fieldSchema.maximum !== undefined &&
              data[field] > fieldSchema.maximum
            ) {
              errors.push(
                `Field '${field}' should be <= ${fieldSchema.maximum}`
              );
            }
          }

          // Min/max length validation for strings
          if (typeof data[field] === "string") {
            if (
              fieldSchema.minLength !== undefined &&
              data[field].length < fieldSchema.minLength
            ) {
              errors.push(
                `Field '${field}' should have length >= ${fieldSchema.minLength}`
              );
            }
            if (
              fieldSchema.maxLength !== undefined &&
              data[field].length > fieldSchema.maxLength
            ) {
              errors.push(
                `Field '${field}' should have length <= ${fieldSchema.maxLength}`
              );
            }
          }

          // Min/max items validation for arrays
          if (Array.isArray(data[field])) {
            if (
              fieldSchema.minItems !== undefined &&
              data[field].length < fieldSchema.minItems
            ) {
              errors.push(
                `Field '${field}' should have at least ${fieldSchema.minItems} items`
              );
            }
            if (
              fieldSchema.maxItems !== undefined &&
              data[field].length > fieldSchema.maxItems
            ) {
              errors.push(
                `Field '${field}' should have at most ${fieldSchema.maxItems} items`
              );
            }

            // Validate array items
            if (fieldSchema.items && data[field].length > 0) {
              for (let i = 0; i < data[field].length; i++) {
                const itemValidation = this.validateData(
                  data[field][i],
                  fieldSchema.items
                );
                if (!itemValidation.isValid) {
                  errors.push(
                    `Item ${i} in field '${field}' is invalid: ${itemValidation.errors.join(
                      ", "
                    )}`
                  );
                }
              }
            }
          }

          // Add to validated data
          validatedData[field] = data[field];
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: validatedData,
    };
  }

  // No heartbeat sending or handling in event-based system

  /**
   * Handle leader election request with enhanced consensus
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Election data
   */
  handleElection(socket, data) {
    if (!socket || !socket.data) {
      logger.warn("Cannot handle election: socket or socket.data is undefined");
      return;
    }

    // Validate data against schema
    const validation = this.validateData(data, this.schemas.leaderElection);
    if (!validation.isValid) {
      logger.warn(`Invalid election data: ${validation.errors.join(", ")}`, {
        socketId: socket?.id,
        data,
      });
      return;
    }

    const { userId, tabId } = socket.data;

    if (!userId || !tabId) {
      logger.warn("Cannot handle election: missing userId or tabId", {
        socketId: socket.id,
      });
      return;
    }

    const priority = this.getTabPriority(socket);
    const { candidateId, candidatePriority, vectorClock, timestamp } =
      validation.data;

    // Update local vector clock with candidate's information
    if (vectorClock && socket.data.vectorClock) {
      socket.data.vectorClock = this.mergeVectorClocks(
        socket.data.vectorClock,
        vectorClock
      );
      socket.data.vectorClock[tabId] = Date.now();
    }

    // If this socket is the leader, respond with current status
    if (socket.data.isLeader) {
      const leaderInfo = this.leaderRegistry.get(userId);

      if (this.io) {
        this.io.forEach((client) => {
          // Only send to the candidate tab
          if (client.data && client.data.tabId === candidateId) {
            client.emit(EVENT_NAMES.LEADER_ELECTED, {
              leaderId: tabId,
              version: leaderInfo.version,
              vectorClock: socket.data.vectorClock || leaderInfo.vectorClock,
              timestamp: Date.now(),
            });
          }
        });
      }

      // Update leader's vector clock
      if (leaderInfo) {
        leaderInfo.vectorClock = socket.data.vectorClock;
        leaderInfo.lastHeartbeat = Date.now();
        this.leaderRegistry.set(userId, leaderInfo);
      }
    }
    // If this socket has higher priority, contest the election
    else if (priority > candidatePriority) {
      if (this.io) {
        this.io.forEach((client) => {
          // Skip the current client
          if (client.id === socket.id) return;

          // Only send to clients for this user
          if (client.authData && client.authData.userId === userId) {
            client.emit(EVENT_NAMES.LEADER_ELECTION, {
              candidateId: tabId,
              priority,
              vectorClock: socket.data.vectorClock,
              timestamp: Date.now(),
            });
          }
        });
      }
    }
    // If same priority, use tab ID as tiebreaker
    else if (priority === candidatePriority && tabId > candidateId) {
      if (this.io) {
        this.io.forEach((client) => {
          // Skip the current client
          if (client.id === socket.id) return;

          // Only send to clients for this user
          if (client.authData && client.authData.userId === userId) {
            client.emit(EVENT_NAMES.LEADER_ELECTION, {
              candidateId: tabId,
              priority,
              vectorClock: socket.data.vectorClock,
              timestamp: Date.now(),
            });
          }
        });
      }
    }
  }

  /**
   * Handle graceful leader transfer with state preservation
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Transfer data
   */
  handleLeaderTransfer(socket, data) {
    if (!socket || !socket.data) {
      logger.warn(
        "Cannot handle leader transfer: socket or socket.data is undefined"
      );
      return;
    }

    // Validate data against schema
    const validation = this.validateData(data, this.schemas.leaderTransfer);
    if (!validation.isValid) {
      logger.warn(
        `Invalid leader transfer data: ${validation.errors.join(", ")}`,
        {
          socketId: socket?.id,
          data,
        }
      );
      return;
    }

    const { userId, tabId } = socket.data;

    if (!userId || !tabId) {
      logger.warn("Cannot handle leader transfer: missing userId or tabId", {
        socketId: socket.id,
      });
      return;
    }

    const { newLeaderId, version, state, vectorClock } = validation.data;

    // Verify current leader is requesting transfer
    const leaderInfo = this.leaderRegistry.get(userId);
    if (!leaderInfo || leaderInfo.leaderId !== tabId) {
      return;
    }

    // Update leader registry with new leader
    this.leaderRegistry.set(userId, {
      leaderId: newLeaderId,
      lastHeartbeat: Date.now(),
      version: version + 1,
      vectorClock: vectorClock || leaderInfo.vectorClock,
    });

    // Update shared state if provided
    if (state) {
      const stateInfo = this.sharedStateRegistry.get(userId) || { version: 0 };
      this.sharedStateRegistry.set(userId, {
        stateData: state,
        version: stateInfo.version + 1,
        vectorClock: vectorClock || stateInfo.vectorClock,
        updatedBy: tabId,
        updatedAt: Date.now(),
        transferredTo: newLeaderId,
      });
    }

    // Clear leader status
    clearInterval(socket.data.heartbeatInterval);
    socket.data.isLeader = false;

    // Notify all tabs about new leader
    if (this.io) {
      this.io.forEach((client) => {
        // Skip the current client
        if (client.id === socket.id) return;

        // Only send to clients for this user
        if (client.authData && client.authData.userId === userId) {
          client.emit(EVENT_NAMES.LEADER_TRANSFERRED, {
            previousLeaderId: tabId,
            newLeaderId,
            version: version + 1,
            state,
            vectorClock: vectorClock || leaderInfo.vectorClock,
            timestamp: Date.now(),
          });
        }
      });
    }

    logger.debug(
      `Leader transferred from ${tabId} to ${newLeaderId} for user ${userId}`
    );
  }

  /**
   * Safety check for leaders - event-based version
   * This is now a no-op as we're using a fully event-based approach
   * We'll keep the method for compatibility but it doesn't do anything
   */
  safetyCheckLeaders() {
    // No-op - we're using a fully event-based approach now
    // Leader status is checked when tabs connect/disconnect or send events
    logger.debug("Safety check skipped - using event-based approach");
  }

  /**
   * Handle leader failure
   * @param {string} userId - User ID
   * @param {string} leaderId - Leader tab ID
   * @param {string} reason - Reason for failure
   * @param {string} deviceId - Device ID (optional)
   */
  handleLeaderFailure(userId, leaderId, reason = "unknown", deviceId = null) {
    // Get the leader info before removing it
    const leaderInfo = this.leaderRegistry.get(userId);

    // If the leader info doesn't exist or doesn't match the leaderId, ignore
    if (!leaderInfo || leaderInfo.leaderId !== leaderId) {
      logger.debug(
        `Leader ${leaderId} for user ${userId} already replaced, ignoring failure`
      );
      return;
    }

    // Get the deviceId from the leader info if not provided
    if (!deviceId && leaderInfo.deviceId) {
      deviceId = leaderInfo.deviceId;
    }

    // Remove inactive leader
    this.leaderRegistry.delete(userId);

    // If deviceId is provided, only notify tabs on that device
    if (deviceId) {
      // Notify all tabs on the device about leader failure
      this.emitToDevice(deviceId, EVENT_NAMES.LEADER_FAILED, {
        previousLeaderId: leaderId,
        deviceId,
        reason,
        timestamp: Date.now(),
      });

      logger.debug(
        `Leader ${leaderId} for user ${userId} on device ${deviceId} failed (${reason}), triggering device-specific re-election`
      );
    } else {
      // Notify all tabs about leader failure
      this.emitToUser(userId, EVENT_NAMES.LEADER_FAILED, {
        previousLeaderId: leaderId,
        reason,
        timestamp: Date.now(),
      });

      logger.debug(
        `Leader ${leaderId} for user ${userId} failed (${reason}), triggering re-election`
      );
    }
  }

  /**
   * Clear leader for a user
   * This is used when a forced election is requested
   * @param {string} userId - User ID
   * @param {string} deviceId - Device ID (optional)
   * @returns {boolean} - Whether a leader was cleared
   */
  clearLeader(userId, deviceId = null) {
    // Check if there's a leader to clear
    const leaderInfo = this.leaderRegistry.get(userId);
    if (!leaderInfo) {
      logger.debug(`No leader to clear for user ${userId}`);
      return false;
    }

    const leaderId = leaderInfo.leaderId;
    const leaderDeviceId = leaderInfo.deviceId;

    // If deviceId is specified, only clear if it matches
    if (deviceId && leaderDeviceId && deviceId !== leaderDeviceId) {
      logger.debug(
        `Leader ${leaderId} is on a different device (${leaderDeviceId}), not clearing`
      );
      return false;
    }

    // Remove from registry
    this.leaderRegistry.delete(userId);

    // If deviceId is specified, only notify tabs on that device
    if (deviceId) {
      // Notify all tabs on the device about leader being cleared
      this.emitToDevice(deviceId, EVENT_NAMES.LEADER_FAILED, {
        previousLeaderId: leaderId,
        deviceId,
        reason: "forced_election",
        timestamp: Date.now(),
      });

      logger.info(
        `Leader ${leaderId} cleared for user ${userId} on device ${deviceId}`
      );
    } else {
      // Notify all tabs about leader being cleared
      this.emitToUser(userId, EVENT_NAMES.LEADER_FAILED, {
        previousLeaderId: leaderId,
        reason: "forced_election",
        timestamp: Date.now(),
      });

      logger.info(`Leader ${leaderId} cleared for user ${userId}`);
    }

    return true;
  }

  /**
   * Check if this is the only tab for this user
   * @param {string} userId - User ID
   * @param {string} tabId - Tab ID
   * @returns {Promise<boolean>} True if this is the only tab
   */
  async isOnlyTab(userId, tabId) {
    try {
      if (!this.io) {
        logger.warn("No Primus instance available, assuming not the only tab");
        return false;
      }

      // Get all sockets for this user using the cache
      const userSockets = this.getUserSockets(userId);

      // If there's only one socket, this is the only tab
      if (userSockets.length === 1) {
        logger.debug(`Tab ${tabId} is the only tab for user ${userId}`);
        return true;
      }

      // If there are multiple sockets, check if they're all for this tab
      // (multiple connections from same tab are possible)
      const uniqueTabIds = new Set();
      for (const socket of userSockets) {
        if (socket.data && socket.data.tabId) {
          uniqueTabIds.add(socket.data.tabId);
        }
      }

      // If there's only one unique tab ID, this is the only tab
      if (uniqueTabIds.size === 1 && uniqueTabIds.has(tabId)) {
        logger.debug(`Tab ${tabId} is the only unique tab for user ${userId}`);
        return true;
      }

      // Otherwise, there are multiple tabs
      logger.debug(
        `Tab ${tabId} is NOT the only tab for user ${userId}, found ${uniqueTabIds.size} tabs`
      );
      return false;
    } catch (error) {
      logger.error(`Error checking if tab is the only one: ${error.message}`);
      // Default to false in case of error
      return false;
    }
  }

  /**
   * Get tab priority based on visibility state
   * @param {Object} socket - Socket.IO socket
   * @returns {number} Priority value
   */
  getTabPriority(socket) {
    if (!socket || !socket.data) {
      return this.crossTabConfig.leaderElection.leaderPriority.hidden;
    }

    const { visibilityState = "hidden" } = socket.data;
    const priorities = this.crossTabConfig.leaderElection.leaderPriority;

    return priorities[visibilityState] || priorities.hidden;
  }

  /**
   * Transfer leadership to another tab
   * @param {Object} socket - Socket.IO socket
   * @param {string} newLeaderId - New leader tab ID
   * @param {Object} state - State to transfer
   */
  transferLeadership(socket, newLeaderId, state = {}) {
    const { userId, tabId } = socket.data;

    // Verify socket is current leader
    const leaderInfo = this.leaderRegistry.get(userId);
    if (!leaderInfo || leaderInfo.leaderId !== tabId) {
      return false;
    }

    // Send transfer request
    socket.to(`tab:${newLeaderId}`).emit(EVENT_NAMES.LEADER_TRANSFER, {
      currentLeaderId: tabId,
      version: leaderInfo.version,
      state,
      timestamp: Date.now(),
    });

    return true;
  }

  /**
   * Clean up when socket disconnects
   * @param {Object} socket - Socket.IO socket
   */
  handleDisconnect(socket) {
    if (!socket || !socket.data) {
      logger.warn(
        "Cannot handle disconnect: socket or socket.data is undefined"
      );
      return;
    }

    const { userId, tabId, isLeader } = socket.data;
    const deviceId = socket.data.deviceId;

    if (!userId || !tabId) {
      logger.warn("Cannot handle disconnect: missing userId or tabId", {
        socketId: socket.id,
      });
      return;
    }

    if (isLeader) {
      // No heartbeat intervals in event-based system

      // Handle leader failure with specific reason and device ID
      this.handleLeaderFailure(userId, tabId, "disconnect", deviceId);

      if (deviceId) {
        logger.debug(
          `Leader ${tabId} for user ${userId} on device ${deviceId} disconnected, triggering device-specific re-election`
        );
      } else {
        logger.debug(
          `Leader ${tabId} for user ${userId} disconnected, triggering re-election`
        );
      }
    } else {
      // Even if not a leader, log the disconnection for debugging
      if (deviceId) {
        logger.debug(
          `Tab ${tabId} for user ${userId} on device ${deviceId} disconnected (not a leader)`
        );
      } else {
        logger.debug(
          `Tab ${tabId} for user ${userId} disconnected (not a leader)`
        );
      }
    }
  }

  /**
   * Handle tab closing notification
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Tab closing data
   */
  handleTabClosing(socket, data) {
    if (!socket || !socket.data) {
      logger.warn(
        "Cannot handle tab closing: socket or socket.data is undefined"
      );
      return;
    }

    // Validate data against schema
    const validation = this.validateData(data, this.schemas.tabClosing);
    if (!validation.isValid) {
      logger.warn(`Invalid tab closing data: ${validation.errors.join(", ")}`, {
        socketId: socket?.id,
        data,
      });
      return;
    }

    const { userId, tabId, isLeader } = socket.data;
    const deviceId = socket.data.deviceId || validation.data.deviceId;

    if (!userId || !tabId) {
      logger.warn("Cannot handle tab closing: missing userId or tabId", {
        socketId: socket.id,
      });
      return;
    }

    logger.info(`Tab ${tabId} closing notification received`, {
      userId,
      tabId,
      deviceId,
      isLeader,
      timestamp: Date.now(),
    });

    if (isLeader) {
      // Try to find a new leader before this tab fully closes
      this.prepareForOffline(socket);

      // Set a short timeout to allow for graceful transfer
      // If the transfer doesn't complete, we'll handle it as a failure
      setTimeout(() => {
        // Check if this tab is still the leader
        const leaderInfo = this.leaderRegistry.get(userId);
        if (leaderInfo && leaderInfo.leaderId === tabId) {
          // Transfer didn't complete, handle as failure
          this.handleLeaderFailure(userId, tabId, "closing", deviceId);
        }
      }, 500); // Short timeout to allow for transfer
    }
  }

  /**
   * Initialize connection sharing for a socket
   * @param {Object} socket - Socket.IO socket
   */
  initializeConnectionSharing(socket) {
    const { userId, tabId } = socket.data;
    if (!userId || !tabId) return;

    // Set up connection sharing handlers
    socket.on(EVENT_NAMES.CONNECTION_SHARE_REQUEST, (data) =>
      this.handleConnectionShareRequest(socket, data)
    );
    socket.on(EVENT_NAMES.CONNECTION_SHARE_RESPONSE, (data) =>
      this.handleConnectionShareResponse(socket, data)
    );

    // If this is a leader, it can accept connection sharing requests
    if (socket.data.isLeader) {
      socket.data.sharedConnections = [];
      socket.data.maxSharedConnections =
        this.crossTabConfig.connectionSharing.maxSharedConnections;
    }

    logger.debug(
      `Connection sharing initialized for tab ${tabId} of user ${userId}`
    );
  }

  /**
   * Handle connection share request
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Request data
   */
  handleConnectionShareRequest(socket, data) {
    const { userId, tabId } = socket.data;
    const { requesterId, resources } = data;

    // Only leaders can accept connection sharing requests
    if (!socket.data.isLeader) {
      socket
        .to(`tab:${requesterId}`)
        .emit(EVENT_NAMES.CONNECTION_SHARE_RESPONSE, {
          accepted: false,
          reason: "Not a leader tab",
        });
      return;
    }

    // Check if max shared connections reached
    if (
      socket.data.sharedConnections.length >= socket.data.maxSharedConnections
    ) {
      socket
        .to(`tab:${requesterId}`)
        .emit(EVENT_NAMES.CONNECTION_SHARE_RESPONSE, {
          accepted: false,
          reason: "Max shared connections reached",
        });
      return;
    }

    // Accept the request
    socket.data.sharedConnections.push({
      tabId: requesterId,
      resources,
      since: Date.now(),
    });

    socket
      .to(`tab:${requesterId}`)
      .emit(EVENT_NAMES.CONNECTION_SHARE_RESPONSE, {
        accepted: true,
        leaderId: tabId,
        timestamp: Date.now(),
      });

    logger.debug(
      `Connection sharing accepted for tab ${requesterId} by leader ${tabId}`
    );
  }

  /**
   * Handle connection share response
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Response data
   */
  handleConnectionShareResponse(socket, data) {
    const { accepted, leaderId, reason } = data;

    if (accepted) {
      // Mark this tab as using a shared connection
      socket.data.usingSharedConnection = true;
      socket.data.sharedConnectionLeader = leaderId;

      logger.debug(`Using shared connection from leader ${leaderId}`);
    } else {
      logger.debug(`Connection sharing request rejected: ${reason}`);
    }
  }

  /**
   * Initialize state synchronization for a socket
   * @param {Object} socket - Socket.IO socket
   */
  initializeStateSync(socket) {
    const { userId, tabId } = socket.data;
    if (!userId || !tabId) return;

    // Set up state sync handlers
    socket.on(EVENT_NAMES.STATE_SYNC, (data) =>
      this.handleStateSync(socket, data)
    );
    socket.on(EVENT_NAMES.STATE_UPDATE, (data) =>
      this.handleStateUpdate(socket, data)
    );

    // If auto sync is enabled, set up interval
    if (this.crossTabConfig.stateSync.autoSync && socket.data.isLeader) {
      socket.data.stateSyncInterval = setInterval(() => {
        this.broadcastState(socket);
      }, this.crossTabConfig.stateSync.syncInterval);
    }

    logger.debug(`State sync initialized for tab ${tabId} of user ${userId}`);
  }

  /**
   * Handle state sync request
   * @param {Object} socket - Socket.IO socket
   */
  handleStateSync(socket) {
    const { userId } = socket.data;

    // Get current shared state
    const stateInfo = this.sharedStateRegistry.get(userId);

    if (stateInfo) {
      socket.emit(EVENT_NAMES.STATE_SYNC, {
        state: stateInfo.stateData,
        version: stateInfo.version,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Enhanced state synchronization with conflict resolution
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Update data
   */
  handleStateUpdate(socket, data) {
    const { userId, deviceId, tabId, isLeader } = socket.data;
    const { state, version, vectorClock, syncAcrossDevices } = data;

    // Only leader can update state unless force flag is set
    if (!isLeader && !data.force) {
      return;
    }

    // Get current state info
    const stateInfo = this.sharedStateRegistry.get(userId) || {
      version: 0,
      vectorClock: {},
      stateData: {},
    };

    // Check if update is newer using vector clocks
    const isNewer = this.isVectorClockNewer(vectorClock, stateInfo.vectorClock);

    // Handle conflict resolution if needed
    if (isNewer === null) {
      // Conflict detected, merge states
      const mergedState = this.mergeStates(stateInfo.stateData, state);
      const mergedVectorClock = this.mergeVectorClocks(
        stateInfo.vectorClock,
        vectorClock
      );

      this.sharedStateRegistry.set(userId, {
        stateData: mergedState,
        version: stateInfo.version + 1,
        vectorClock: mergedVectorClock,
        updatedBy: tabId,
        updatedAt: Date.now(),
        conflictResolved: true,
      });

      // Broadcast merged state to all tabs on same device
      socket
        .to(`user:${userId}:device:${deviceId}`)
        .emit(EVENT_NAMES.STATE_UPDATE, {
          state: mergedState,
          version: stateInfo.version + 1,
          vectorClock: mergedVectorClock,
          updatedBy: tabId,
          conflictResolved: true,
          timestamp: Date.now(),
        });

      // Broadcast to other devices if requested
      if (syncAcrossDevices && this.syncConfig.enableCrossDevices) {
        const userRoom = socketService.createRoomName("user", userId);
        const deviceRoom = socketService.createRoomName("device", deviceId);

        this.io
          .to(userRoom)
          .except(deviceRoom)
          .emit(EVENT_NAMES.STATE_UPDATE, {
            state: mergedState,
            version: stateInfo.version + 1,
            vectorClock: mergedVectorClock,
            updatedBy: tabId,
            sourceDevice: deviceId,
            conflictResolved: true,
            timestamp: Date.now(),
          });
      }

      logger.debug(
        `State conflict resolved for user ${userId}, new version ${
          stateInfo.version + 1
        }`
      );
    }
    // Only update if version is newer
    else if (isNewer || version > stateInfo.version) {
      this.sharedStateRegistry.set(userId, {
        stateData: state,
        version: Math.max(version, stateInfo.version + 1),
        vectorClock: vectorClock || stateInfo.vectorClock,
        updatedBy: tabId,
        updatedAt: Date.now(),
      });

      // Broadcast to all tabs on same device except sender
      socket
        .to(`user:${userId}:device:${deviceId}`)
        .emit(EVENT_NAMES.STATE_UPDATE, {
          state,
          version: Math.max(version, stateInfo.version + 1),
          vectorClock: vectorClock || stateInfo.vectorClock,
          updatedBy: tabId,
          timestamp: Date.now(),
        });

      // Broadcast to other devices if requested
      if (syncAcrossDevices && this.syncConfig.enableCrossDevices) {
        const userRoom = socketService.createRoomName("user", userId);
        const deviceRoom = socketService.createRoomName("device", deviceId);

        this.io
          .to(userRoom)
          .except(deviceRoom)
          .emit(EVENT_NAMES.STATE_UPDATE, {
            state,
            version: Math.max(version, stateInfo.version + 1),
            vectorClock: vectorClock || stateInfo.vectorClock,
            updatedBy: tabId,
            sourceDevice: deviceId,
            timestamp: Date.now(),
          });
      }

      logger.debug(
        `State updated for user ${userId} by tab ${tabId}, version ${Math.max(
          version,
          stateInfo.version + 1
        )}`
      );
    }
  }

  /**
   * Broadcast current state to all tabs
   * @param {Object} socket - Socket.IO socket
   */
  broadcastState(socket) {
    const { userId, tabId } = socket.data;

    // Get current state
    const stateInfo = this.sharedStateRegistry.get(userId);

    if (stateInfo) {
      // Broadcast to all tabs including sender
      if (this.io) {
        this.io.forEach((client) => {
          // Only send to clients for this user
          if (client.authData && client.authData.userId === userId) {
            client.emit(EVENT_NAMES.STATE_SYNC, {
              state: stateInfo.stateData,
              version: stateInfo.version,
              timestamp: Date.now(),
            });
          }
        });
      }

      logger.debug(`State broadcast for user ${userId} by leader ${tabId}`);
    }
  }

  /**
   * Compare vector clocks to determine if one is newer
   * @param {Object} clock1 - First vector clock
   * @param {Object} clock2 - Second vector clock
   * @returns {boolean|null} true if clock1 is newer, false if clock2 is newer, null if concurrent
   */
  isVectorClockNewer(clock1, clock2) {
    if (!clock1 || Object.keys(clock1).length === 0) return false;
    if (!clock2 || Object.keys(clock2).length === 0) return true;

    let clock1Newer = false;
    let clock2Newer = false;

    // Compare each component
    const allKeys = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);

    for (const key of allKeys) {
      if (key === "timestamp") continue;

      const time1 = clock1[key] || 0;
      const time2 = clock2[key] || 0;

      if (time1 > time2) {
        clock1Newer = true;
      } else if (time2 > time1) {
        clock2Newer = true;
      }
    }

    // If both have newer components, they are concurrent
    if (clock1Newer && clock2Newer) {
      return null; // Concurrent updates
    }

    return clock1Newer;
  }

  /**
   * Merge two vector clocks
   * @param {Object} clock1 - First vector clock
   * @param {Object} clock2 - Second vector clock
   * @returns {Object} Merged vector clock
   */
  mergeVectorClocks(clock1, clock2) {
    const result = { ...clock1 };

    // Take the max value for each component
    for (const [key, value] of Object.entries(clock2)) {
      if (key === "timestamp") {
        result.timestamp = Date.now();
        continue;
      }

      result[key] = Math.max(value, result[key] || 0);
    }

    return result;
  }

  /**
   * Merge two state objects with simple conflict resolution
   * @param {Object} state1 - First state
   * @param {Object} state2 - Second state
   * @returns {Object} Merged state
   */
  mergeStates(state1, state2) {
    // Deep clone to avoid mutations
    const result = JSON.parse(JSON.stringify(state1));

    // Recursively merge objects
    const merge = (target, source) => {
      for (const key of Object.keys(source)) {
        if (
          source[key] instanceof Object &&
          key in target &&
          target[key] instanceof Object
        ) {
          merge(target[key], source[key]);
        } else {
          // For arrays, concatenate and remove duplicates
          if (Array.isArray(source[key]) && Array.isArray(target[key])) {
            target[key] = [...new Set([...target[key], ...source[key]])];
          } else {
            // For primitive values, prefer the newer one (source)
            target[key] = source[key];
          }
        }
      }
    };

    merge(result, state2);
    return result;
  }

  /**
   * Implement offline leadership delegation
   * @param {Object} socket - Socket.IO socket
   */
  prepareForOffline(socket) {
    if (!socket || !socket.data) {
      logger.warn(
        "Cannot prepare for offline: socket or socket.data is undefined"
      );
      return;
    }

    const { userId, tabId, isLeader } = socket.data;

    if (!userId || !tabId || !isLeader) {
      logger.debug("Not preparing for offline: not a leader or missing data", {
        userId,
        tabId,
        isLeader,
      });
      return;
    }

    // Find best candidate for leadership transfer
    this.findLeadershipCandidate(userId, tabId).then((candidate) => {
      if (candidate) {
        // Get current state
        const stateInfo = this.sharedStateRegistry.get(userId);
        const leaderInfo = this.leaderRegistry.get(userId);

        // Transfer leadership
        this.transferLeadership(
          socket,
          candidate.tabId,
          stateInfo?.stateData || {}
        );

        logger.debug(
          `Prepared offline leadership transfer from ${tabId} to ${candidate.tabId}`
        );
      }
    });
  }

  /**
   * Find the best candidate for leadership transfer
   * @param {string} userId - User ID
   * @param {string} currentLeaderId - Current leader tab ID
   * @returns {Promise<Object>} Best candidate socket data
   */
  async findLeadershipCandidate(userId, currentLeaderId) {
    try {
      // Get all sockets for this user using the cache
      const sockets = this.getUserSockets(userId);

      // Filter out current leader and sort by priority
      const candidates = sockets
        .filter(
          (s) => s && s.data && s.data.tabId && s.data.tabId !== currentLeaderId
        )
        .map((s) => ({
          tabId: s.data.tabId,
          socketId: s.id,
          priority: this.getTabPriority(s),
        }))
        .sort((a, b) => b.priority - a.priority);

      return candidates.length > 0 ? candidates[0] : null;
    } catch (error) {
      logger.error(`Error finding leadership candidate:`, error);
      return null;
    }
  }

  /**
   * Handle tab visibility change
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Visibility data
   */
  handleVisibilityChange(socket, data) {
    if (!socket || !socket.data) {
      logger.warn(
        "Cannot handle visibility change: socket or socket.data is undefined"
      );
      return;
    }

    // Validate data against schema
    const validation = this.validateData(data, this.schemas.visibilityChange);
    if (!validation.isValid) {
      logger.warn(
        `Invalid visibility change data: ${validation.errors.join(", ")}`,
        {
          socketId: socket?.id,
          data,
        }
      );
      return;
    }

    const { userId, tabId } = socket.data;

    if (!userId || !tabId) {
      logger.warn("Cannot handle visibility change: missing userId or tabId", {
        socketId: socket.id,
      });
      return;
    }

    const { state } = validation.data;

    // Update socket data
    socket.data.visibilityState = state;

    // Update priority
    const newPriority = this.getTabPriority(socket);

    // If this is the leader and visibility changed to hidden, consider transferring leadership
    if (socket.data.isLeader && state === "hidden") {
      this.considerLeadershipTransfer(socket);
    }

    // Notify other tabs about visibility change
    if (this.io) {
      this.io.forEach((client) => {
        // Skip the current client
        if (client.id === socket.id) return;

        // Only send to clients for this user
        if (client.authData && client.authData.userId === userId) {
          client.emit(EVENT_NAMES.TAB_VISIBILITY_CHANGED, {
            tabId,
            state,
            priority: newPriority,
            timestamp: Date.now(),
          });
        }
      });
    }

    logger.debug(`Tab ${tabId} visibility changed to ${state}`);
  }

  /**
   * Consider transferring leadership based on visibility
   * @param {Object} socket - Socket.IO socket
   */
  async considerLeadershipTransfer(socket) {
    const { userId, tabId } = socket.data;

    // Find a visible tab with high priority
    const candidate = await this.findVisibleTabCandidate(userId, tabId);

    if (candidate) {
      // Get current state
      const stateInfo = this.sharedStateRegistry.get(userId);

      // Transfer leadership
      this.transferLeadership(
        socket,
        candidate.tabId,
        stateInfo?.stateData || {}
      );

      logger.debug(
        `Leadership transferred from hidden tab ${tabId} to visible tab ${candidate.tabId}`
      );
    }
  }

  /**
   * Find a visible tab candidate for leadership
   * @param {string} userId - User ID
   * @param {string} currentLeaderId - Current leader tab ID
   * @returns {Promise<Object>} Best candidate socket data
   */
  async findVisibleTabCandidate(userId, currentLeaderId) {
    try {
      // Get all sockets for this user using the cache
      const sockets = this.getUserSockets(userId);

      // Filter for visible tabs and sort by priority
      const candidates = sockets
        .filter(
          (s) =>
            s &&
            s.data &&
            s.data.tabId &&
            s.data.tabId !== currentLeaderId &&
            s.data.visibilityState === "visible"
        )
        .map((s) => ({
          tabId: s.data.tabId,
          socketId: s.id,
          priority: this.getTabPriority(s),
        }))
        .sort((a, b) => b.priority - a.priority);

      return candidates.length > 0 ? candidates[0] : null;
    } catch (error) {
      logger.error(`Error finding visible tab candidate:`, error);
      return null;
    }
  }

  /**
   * Enhanced heartbeat monitoring with consensus verification
   */
  monitorLeaderHeartbeats() {
    const now = Date.now();

    for (const [userId, leaderInfo] of this.leaderRegistry.entries()) {
      const { lastHeartbeat, leaderId } = leaderInfo;

      // Check if leader is inactive
      if (
        now - lastHeartbeat >
        this.crossTabConfig.leaderElection.heartbeatInterval *
          this.crossTabConfig.leaderElection.missedHeartbeatsThreshold
      ) {
        // Remove inactive leader
        this.leaderRegistry.delete(userId);

        // Notify all tabs about leader failure
        if (this.io) {
          this.io.forEach((client) => {
            // Only send to clients for this user
            if (client.authData && client.authData.userId === userId) {
              client.emit(EVENT_NAMES.LEADER_FAILED, {
                previousLeaderId: leaderId,
                timestamp: now,
              });
            }
          });
        }

        logger.debug(
          `Leader ${leaderId} for user ${userId} failed, triggering re-election`
        );
      }
    }
  }

  /**
   * Initialize cross-device state synchronization
   * @param {Object} socket - Socket.IO socket
   */
  initializeCrossDeviceSync(socket) {
    const { userId, deviceId } = socket.data;
    if (!userId || !deviceId) return;

    // Set up cross-device sync handlers
    socket.on(EVENT_NAMES.DEVICE_STATE_SYNC_REQUEST, (data) =>
      this.handleDeviceStateSyncRequest(socket, data)
    );
    socket.on(EVENT_NAMES.DEVICE_STATE_UPDATE, (data) =>
      this.handleDeviceStateUpdate(socket, data)
    );

    // In Primus, we don't need to explicitly join rooms
    // We'll just store the room name for reference
    const deviceRoom = socketService.createRoomName("device", deviceId);
    socket.data.deviceRoom = deviceRoom;

    logger.debug(
      `Cross-device sync initialized for device ${deviceId} of user ${userId}`
    );
  }

  /**
   * Handle device state sync request
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Request data
   */
  async handleDeviceStateSyncRequest(socket, data) {
    const { userId, deviceId } = socket.data;
    const {
      targetDeviceId,
      stateTypes = ["auth", "preferences", "notifications"],
    } = data;

    if (!userId) {
      socket.emit(EVENT_NAMES.SYNC_ERROR, {
        message: "Unauthorized",
        code: "UNAUTHORIZED",
      });
      return;
    }

    try {
      // Get current device state from database
      const deviceStates = await this.deviceStateRepository.getDeviceStates(
        userId,
        targetDeviceId || deviceId,
        stateTypes
      );

      // Send state to requesting device
      socket.emit(EVENT_NAMES.DEVICE_STATE_SYNC, {
        states: deviceStates,
        timestamp: Date.now(),
      });

      logger.debug(
        `Device state synced for user ${userId}, device ${deviceId}`
      );
    } catch (error) {
      logger.error(`Error handling device state sync:`, error);
      socket.emit(EVENT_NAMES.SYNC_ERROR, {
        message: "Error syncing device state",
        code: "SYNC_ERROR",
      });
    }
  }

  /**
   * Handle device state update
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Update data
   */
  async handleDeviceStateUpdate(socket, data) {
    const { userId, deviceId } = socket.data;
    const { stateType, state, version, broadcast = false } = data;

    if (!userId) {
      socket.emit(EVENT_NAMES.SYNC_ERROR, {
        message: "Unauthorized",
        code: "UNAUTHORIZED",
      });
      return;
    }

    try {
      // Update device state in database
      await this.deviceStateRepository.updateDeviceState(
        userId,
        deviceId,
        stateType,
        state,
        version
      );

      // Broadcast to other devices if requested
      if (broadcast && this.syncConfig.enableCrossDevices) {
        const userRoom = socketService.createRoomName("user", userId);
        const deviceRoom = socketService.createRoomName("device", deviceId);

        // Send to all devices except the current one
        this.io
          .to(userRoom)
          .except(deviceRoom)
          .emit(EVENT_NAMES.DEVICE_STATE_UPDATED, {
            sourceDeviceId: deviceId,
            stateType,
            state,
            version,
            timestamp: Date.now(),
          });

        logger.debug(
          `Device state broadcast from device ${deviceId} to all devices of user ${userId}`
        );
      }
    } catch (error) {
      logger.error(`Error handling device state update:`, error);
      socket.emit(EVENT_NAMES.SYNC_ERROR, {
        message: "Error updating device state",
        code: "UPDATE_ERROR",
      });
    }
  }
}

// Create and export a singleton instance
const crossTabService = new TokenSyncService();
module.exports = crossTabService;
