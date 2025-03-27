const { Redis } = require("ioredis");
const logger = require("../utils/logger");

// Define room types
const ROOM_TYPES = {
  ORGANIZATION: "organization",
  TEAM: "team",
  USER: "user",
  DEVICE: "device",
  SESSION: "session",
  TAB: "tab",
};

// Define access control permission levels
const ACCESS_LEVELS = {
  ADMIN: "admin", // Can manage the room
  WRITE: "write", // Can send messages to the room
  READ: "read", // Can receive messages from the room
  NONE: "none", // No access
};

class RoomManager {
  constructor(redis, namespace) {
    this.redis = redis;
    this.namespace = namespace;

    this.roomCleanupInterval = setInterval(() => {
      this.cleanupStaleRooms().catch((error) => {
        logger.error("Room cleanup error:", error);
      });
    }, 5 * 60 * 1000);
  }

  getRoomKey(roomId) {
    return `${this.namespace}:room:${roomId}`;
  }

  getAccessKey(roomId) {
    return `${this.namespace}:access:${roomId}`;
  }

  getRoomEventKey(roomId, event) {
    return `${this.namespace}:events:${roomId}:${event}`;
  }

  /**
   * Create hierarchical room structure
   * @param {Object} data - Data for room hierarchy
   * @returns {Object} - Object containing room IDs
   */
  async createRoomHierarchy(data) {
    const rooms = {
      // Add organization and team if provided
      organization: data.organizationId
        ? `organization:${data.organizationId}`
        : undefined,
      team: data.teamId ? `team:${data.teamId}` : undefined,
      user: `user:${data.userId}`,
      device: `device:${data.deviceId}`,
      session: `session:${data.sessionId}`,
      tab: data.tabId ? `tab:${data.tabId}` : undefined,
    };

    try {
      // Create organization room if provided
      if (rooms.organization) {
        await this.createRoom(rooms.organization, {
          type: ROOM_TYPES.ORGANIZATION,
          id: data.organizationId,
          children: new Set(rooms.team ? [rooms.team] : []),
          accessControl: true,
        });
      }

      // Create team room if provided
      if (rooms.team) {
        await this.createRoom(rooms.team, {
          type: ROOM_TYPES.TEAM,
          id: data.teamId,
          parent: rooms.organization,
          children: new Set([rooms.user]),
          accessControl: true,
        });
      }

      // Create user room if doesn't exist
      await this.createRoom(rooms.user, {
        type: ROOM_TYPES.USER,
        id: data.userId,
        parent: rooms.team,
        children: new Set([rooms.device]),
        accessControl: data.accessControl !== false,
      });

      // Create device room
      await this.createRoom(rooms.device, {
        type: ROOM_TYPES.DEVICE,
        id: data.deviceId,
        parent: rooms.user,
        children: new Set([rooms.session]),
        capabilities: data.capabilities,
        accessControl: false, // Device rooms automatically inherit user access
      });

      // Create session room
      const sessionChildren = new Set();
      if (rooms.tab) {
        sessionChildren.add(rooms.tab);
      }

      await this.createRoom(rooms.session, {
        type: ROOM_TYPES.SESSION,
        id: data.sessionId,
        parent: rooms.device,
        children: sessionChildren,
        accessControl: false, // Session rooms automatically inherit device access
      });

      // Create tab room if needed
      if (rooms.tab) {
        await this.createRoom(rooms.tab, {
          type: ROOM_TYPES.TAB,
          id: data.tabId,
          parent: rooms.session,
          children: new Set(),
          accessControl: false, // Tab rooms automatically inherit session access
        });
      }

      return rooms;
    } catch (error) {
      logger.error("Error creating room hierarchy:", error);
      throw error;
    }
  }

  /**
   * Create a room with metadata
   * @param {string} roomId - Room ID
   * @param {Object} metadata - Room metadata
   */
  async createRoom(roomId, metadata) {
    const key = this.getRoomKey(roomId);
    const now = Date.now();

    const roomData = {
      ...metadata,
      children: Array.from(metadata.children || []).join(","),
      createdAt: now,
      updatedAt: now,
      lastActivity: now,
    };

    try {
      // Check if redis client has multi function
      if (typeof this.redis.multi === "function") {
        await this.redis
          .multi()
          .hset(key, roomData)
          .expire(key, 86400) // 24 hours TTL
          .exec();
      } else {
        // Fallback to individual commands
        for (const [field, value] of Object.entries(roomData)) {
          await this.redis.hset(key, field, value);
        }
        await this.redis.expire(key, 86400); // 24 hours TTL
      }

      // Initialize access control if needed
      if (metadata.accessControl) {
        await this.initializeAccessControl(roomId, {
          owner: metadata.id,
          default: ACCESS_LEVELS.NONE,
        });
      }
    } catch (error) {
      logger.error(`Error creating room ${roomId}:`, error);
      throw error;
    }
  }

  /**
   * Initialize access control for a room
   * @param {string} roomId - Room ID
   * @param {Object} options - Access control options
   */
  async initializeAccessControl(roomId, options = {}) {
    const accessKey = this.getAccessKey(roomId);

    // Set default access control
    const accessData = {
      owner: options.owner,
      default: options.default || ACCESS_LEVELS.NONE,
    };

    // Store access control data
    await this.redis
      .multi()
      .hset(accessKey, accessData)
      .expire(accessKey, 86400) // 24 hours TTL
      .exec();
  }

  /**
   * Get room metadata
   * @param {string} roomId - Room ID
   * @returns {Object|null} - Room metadata or null if not found
   */
  async getRoomMetadata(roomId) {
    const key = this.getRoomKey(roomId);
    const data = await this.redis.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      ...data,
      children: new Set(data.children?.split(",").filter(Boolean)),
      lastActivity: parseInt(data.lastActivity),
      createdAt: parseInt(data.createdAt),
      updatedAt: parseInt(data.updatedAt),
    };
  }

  /**
   * Check if a user has access to a room
   * @param {string} roomId - Room ID
   * @param {string} userId - User ID
   * @param {string} minLevel - Minimum access level required
   * @returns {Promise<boolean>} - True if user has access
   */
  async checkAccess(roomId, userId, minLevel = ACCESS_LEVELS.READ) {
    try {
      // Get room data
      const room = await this.getRoomMetadata(roomId);
      if (!room) return false;

      // If no access control, grant access
      if (room.accessControl === "false") return true;

      // Check explicit access
      const accessKey = this.getAccessKey(roomId);
      const access = await this.redis.hget(accessKey, userId);

      // If explicit access exists and meets minimum level
      if (access) {
        const levelIndex = Object.values(ACCESS_LEVELS).indexOf(access);
        const minLevelIndex = Object.values(ACCESS_LEVELS).indexOf(minLevel);
        return levelIndex >= minLevelIndex;
      }

      // If owner, grant access
      if (room.owner === userId) return true;

      // Check parent room access (inheritance)
      if (room.parent) {
        return this.checkAccess(room.parent, userId, minLevel);
      }

      // No access
      return false;
    } catch (error) {
      logger.error("Error checking room access:", error);
      return false;
    }
  }

  /**
   * Set access level for a user in a room
   * @param {string} roomId - Room ID
   * @param {string} userId - User ID
   * @param {string} level - Access level
   * @returns {Promise<boolean>} - True if access was set
   */
  async setAccess(roomId, userId, level) {
    try {
      const accessKey = this.getAccessKey(roomId);

      // Check if room exists
      const room = await this.getRoomMetadata(roomId);
      if (!room) throw new Error("Room not found");

      // Set the access level
      await this.redis.hset(accessKey, userId, level);
      return true;
    } catch (error) {
      logger.error("Error setting room access:", error);
      return false;
    }
  }

  /**
   * Propagate event up the room hierarchy
   * @param {string} roomId - Starting room ID
   * @param {string} event - Event name
   * @param {Object} data - Event data
   * @param {Object} options - Propagation options
   * @returns {Promise<string[]>} - Room IDs that received the event
   */
  async propagateEventUp(roomId, event, data, options = {}) {
    const notifiedRooms = [];
    let currentRoomId = roomId;

    try {
      while (currentRoomId) {
        notifiedRooms.push(currentRoomId);

        // Record event in Redis for persistence if configured
        if (options.persist) {
          const eventKey = this.getRoomEventKey(currentRoomId, event);
          await this.redis.rpush(
            eventKey,
            JSON.stringify({
              timestamp: Date.now(),
              data,
              source: roomId,
            })
          );
          await this.redis.expire(eventKey, 86400); // 24 hour TTL
        }

        // Get parent room to continue propagation
        const room = await this.getRoomMetadata(currentRoomId);
        if (!room || !room.parent) break;

        currentRoomId = room.parent;
      }

      return notifiedRooms;
    } catch (error) {
      logger.error("Error propagating event up:", error);
      return notifiedRooms;
    }
  }

  /**
   * Propagate event down the room hierarchy
   * @param {string} roomId - Starting room ID
   * @param {string} event - Event name
   * @param {Object} data - Event data
   * @param {Object} options - Propagation options
   * @returns {Promise<string[]>} - Room IDs that received the event
   */
  async propagateEventDown(roomId, event, data, options = {}) {
    const notifiedRooms = [roomId];
    const queue = [roomId];
    const processed = new Set([roomId]);

    try {
      // Record event in starting room if configured
      if (options.persist) {
        const eventKey = this.getRoomEventKey(roomId, event);
        await this.redis.rpush(
          eventKey,
          JSON.stringify({
            timestamp: Date.now(),
            data,
            source: roomId,
          })
        );
        await this.redis.expire(eventKey, 86400); // 24 hour TTL
      }

      // Breadth-first traversal of the hierarchy
      while (queue.length > 0) {
        const currentRoomId = queue.shift();
        const room = await this.getRoomMetadata(currentRoomId);

        if (!room || !room.children) continue;

        // Add all children to the queue
        for (const childId of room.children) {
          if (!processed.has(childId)) {
            queue.push(childId);
            processed.add(childId);
            notifiedRooms.push(childId);

            // Record event in child room if configured
            if (options.persist) {
              const eventKey = this.getRoomEventKey(childId, event);
              await this.redis.rpush(
                eventKey,
                JSON.stringify({
                  timestamp: Date.now(),
                  data,
                  source: roomId,
                })
              );
              await this.redis.expire(eventKey, 86400); // 24 hour TTL
            }
          }
        }
      }

      return notifiedRooms;
    } catch (error) {
      logger.error("Error propagating event down:", error);
      return notifiedRooms;
    }
  }

  /**
   * Update room activity timestamp
   * @param {string} roomId - Room ID
   * @returns {Promise<boolean>} - True if successful
   */
  async updateRoomActivity(roomId) {
    try {
      const key = this.getRoomKey(roomId);
      const now = Date.now();
      await this.redis.hset(key, "lastActivity", now);
      await this.redis.hset(key, "updatedAt", now);
      return true;
    } catch (error) {
      logger.error("Error updating room activity:", error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    clearInterval(this.roomCleanupInterval);
  }

  /**
   * Clean up stale rooms
   */
  async cleanupStaleRooms() {
    const now = Date.now();
    const staleThreshold = now - 24 * 60 * 60 * 1000;

    let cursor = "0";
    const pattern = `${this.namespace}:room:*`;

    try {
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          "100"
        );

        cursor = nextCursor;

        for (const key of keys) {
          const room = await this.redis.hgetall(key);

          if (parseInt(room.lastActivity) < staleThreshold) {
            await this.redis.del(key);

            // Also clean up access control data
            const roomId = key.split(":").slice(2).join(":");
            const accessKey = this.getAccessKey(roomId);
            await this.redis.del(accessKey);

            // Clean up event data
            const eventPattern = `${this.namespace}:events:${roomId}:*`;
            const [, eventKeys] = await this.redis.scan(
              "0",
              "MATCH",
              eventPattern,
              "COUNT",
              "100"
            );
            for (const eventKey of eventKeys) {
              await this.redis.del(eventKey);
            }

            logger.debug(`Cleaned up stale room and associated data: ${key}`);
          }
        }
      } while (cursor !== "0");
    } catch (error) {
      logger.error("Error during room cleanup:", error);
    }
  }

  /**
   * Check if a room exists
   * @param {string} roomId - Room ID
   * @returns {Promise<boolean>} - True if room exists
   */
  async roomExists(roomId) {
    const key = this.getRoomKey(roomId);
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * Get all rooms in the hierarchy
   * @returns {Promise<string[]>} - Array of room IDs
   */
  async getAllRooms() {
    const pattern = `${this.namespace}:room:*`;
    const rooms = [];
    let cursor = "0";

    try {
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          "MATCH",
          pattern,
          "COUNT",
          "100"
        );

        cursor = nextCursor;

        for (const key of keys) {
          const roomId = key.split(":").slice(2).join(":");
          rooms.push(roomId);
        }
      } while (cursor !== "0");

      return rooms;
    } catch (error) {
      logger.error("Error getting all rooms:", error);
      return [];
    }
  }
}

module.exports = { RoomManager, ROOM_TYPES, ACCESS_LEVELS };
