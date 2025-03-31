/**
 * Room Registry Service
 * Manages the registration, tracking, and hierarchy of WebSocket rooms
 */
const { redisClient } = require("../../../config/redis");
const logger = require("../../../utils/logger");
const { AuthError } = require("../../../utils/errors");

// Constants
const ROOM_REGISTRY_KEY_PREFIX = "room:registry:";
const ROOM_HIERARCHY_KEY_PREFIX = "room:hierarchy:";
const ROOM_METADATA_KEY_PREFIX = "room:metadata:";
const ROOM_TTL = 60 * 60 * 24; // 24 hours

/**
 * Room Registry Service
 * Manages WebSocket room registration, hierarchy, and metadata
 */
class RoomRegistryService {
  constructor() {
    this.roomTypes = {
      USER: "user",
      DEVICE: "device",
      SESSION: "session",
      TAB: "tab"
    };
    
    this.roomPrefixes = {
      USER: "user:",
      DEVICE: "device:",
      SESSION: "session:",
      TAB: "tab:"
    };
    
    logger.info("Room Registry Service initialized");
  }

  /**
   * Initialize the Room Registry Service with configuration
   * @param {Object} config - Auth module configuration
   * @returns {Promise<void>}
   */
  async initialize(config) {
    try {
      // Update room TTL to match session TTL if provided
      if (config && config.session && config.session.store && config.session.store.ttl) {
        ROOM_TTL = config.session.store.ttl;
        logger.info(`Room Registry TTL set to ${ROOM_TTL} seconds`);
      }
      
      logger.info("Room Registry Service initialized");
      return true;
    } catch (error) {
      logger.error("Error initializing Room Registry Service:", error);
      return false;
    }
  }

  /**
   * Register a room in the registry
   * @param {string} roomId - Room identifier
   * @param {string} roomType - Type of room (user, device, session, tab)
   * @param {string} parentRoomId - Parent room ID (optional)
   * @param {Object} metadata - Room metadata (optional)
   * @returns {Promise<boolean>} - Success status
   */
  async registerRoom(roomId, roomType, parentRoomId = null, metadata = {}) {
    try {
      if (!roomId || !roomType) {
        throw new AuthError("Room ID and type are required", "INVALID_ROOM_PARAMS");
      }
      
      // Validate room type
      if (!Object.values(this.roomTypes).includes(roomType)) {
        throw new AuthError(`Invalid room type: ${roomType}`, "INVALID_ROOM_TYPE");
      }
      
      const registryKey = `${ROOM_REGISTRY_KEY_PREFIX}${roomType}`;
      
      // Add room to registry
      await redisClient.sadd(registryKey, roomId);
      
      // Set room TTL
      await redisClient.expire(registryKey, ROOM_TTL);
      
      // If parent room is provided, establish hierarchy
      if (parentRoomId) {
        await this.setRoomParent(roomId, parentRoomId);
      }
      
      // Store metadata if provided
      if (metadata && Object.keys(metadata).length > 0) {
        await this.setRoomMetadata(roomId, metadata);
      }
      
      logger.debug(`Room ${roomId} registered with type ${roomType}`);
      return true;
    } catch (error) {
      logger.error("Error registering room:", error);
      return false;
    }
  }

  /**
   * Unregister a room from the registry
   * @param {string} roomId - Room identifier
   * @param {string} roomType - Type of room
   * @returns {Promise<boolean>} - Success status
   */
  async unregisterRoom(roomId, roomType) {
    try {
      if (!roomId || !roomType) {
        throw new AuthError("Room ID and type are required", "INVALID_ROOM_PARAMS");
      }
      
      const registryKey = `${ROOM_REGISTRY_KEY_PREFIX}${roomType}`;
      
      // Remove room from registry
      await redisClient.srem(registryKey, roomId);
      
      // Remove hierarchy information
      await redisClient.del(`${ROOM_HIERARCHY_KEY_PREFIX}${roomId}`);
      
      // Remove metadata
      await redisClient.del(`${ROOM_METADATA_KEY_PREFIX}${roomId}`);
      
      logger.debug(`Room ${roomId} unregistered`);
      return true;
    } catch (error) {
      logger.error("Error unregistering room:", error);
      return false;
    }
  }

  /**
   * Set parent room for a child room
   * @param {string} childRoomId - Child room ID
   * @param {string} parentRoomId - Parent room ID
   * @returns {Promise<boolean>} - Success status
   */
  async setRoomParent(childRoomId, parentRoomId) {
    try {
      if (!childRoomId || !parentRoomId) {
        throw new AuthError("Child and parent room IDs are required", "INVALID_ROOM_PARAMS");
      }
      
      const hierarchyKey = `${ROOM_HIERARCHY_KEY_PREFIX}${childRoomId}`;
      
      // Store parent-child relationship
      await redisClient.set(hierarchyKey, parentRoomId);
      await redisClient.expire(hierarchyKey, ROOM_TTL);
      
      // Add child to parent's children set
      const parentChildrenKey = `${ROOM_HIERARCHY_KEY_PREFIX}${parentRoomId}:children`;
      await redisClient.sadd(parentChildrenKey, childRoomId);
      await redisClient.expire(parentChildrenKey, ROOM_TTL);
      
      logger.debug(`Room ${childRoomId} set as child of ${parentRoomId}`);
      return true;
    } catch (error) {
      logger.error("Error setting room parent:", error);
      return false;
    }
  }

  /**
   * Get parent room for a child room
   * @param {string} roomId - Room ID
   * @returns {Promise<string|null>} - Parent room ID or null
   */
  async getRoomParent(roomId) {
    try {
      if (!roomId) {
        throw new AuthError("Room ID is required", "INVALID_ROOM_PARAMS");
      }
      
      const hierarchyKey = `${ROOM_HIERARCHY_KEY_PREFIX}${roomId}`;
      return await redisClient.get(hierarchyKey);
    } catch (error) {
      logger.error("Error getting room parent:", error);
      return null;
    }
  }

  /**
   * Get child rooms for a parent room
   * @param {string} roomId - Parent room ID
   * @returns {Promise<Array<string>>} - Array of child room IDs
   */
  async getRoomChildren(roomId) {
    try {
      if (!roomId) {
        throw new AuthError("Room ID is required", "INVALID_ROOM_PARAMS");
      }
      
      const childrenKey = `${ROOM_HIERARCHY_KEY_PREFIX}${roomId}:children`;
      return await redisClient.smembers(childrenKey) || [];
    } catch (error) {
      logger.error("Error getting room children:", error);
      return [];
    }
  }

  /**
   * Set metadata for a room
   * @param {string} roomId - Room ID
   * @param {Object} metadata - Room metadata
   * @returns {Promise<boolean>} - Success status
   */
  async setRoomMetadata(roomId, metadata) {
    try {
      if (!roomId || !metadata) {
        throw new AuthError("Room ID and metadata are required", "INVALID_ROOM_PARAMS");
      }
      
      const metadataKey = `${ROOM_METADATA_KEY_PREFIX}${roomId}`;
      
      // Store metadata as JSON
      await redisClient.set(metadataKey, JSON.stringify(metadata));
      await redisClient.expire(metadataKey, ROOM_TTL);
      
      logger.debug(`Metadata set for room ${roomId}`);
      return true;
    } catch (error) {
      logger.error("Error setting room metadata:", error);
      return false;
    }
  }

  /**
   * Get metadata for a room
   * @param {string} roomId - Room ID
   * @returns {Promise<Object|null>} - Room metadata or null
   */
  async getRoomMetadata(roomId) {
    try {
      if (!roomId) {
        throw new AuthError("Room ID is required", "INVALID_ROOM_PARAMS");
      }
      
      const metadataKey = `${ROOM_METADATA_KEY_PREFIX}${roomId}`;
      const metadata = await redisClient.get(metadataKey);
      
      return metadata ? JSON.parse(metadata) : null;
    } catch (error) {
      logger.error("Error getting room metadata:", error);
      return null;
    }
  }

  /**
   * Get all rooms of a specific type
   * @param {string} roomType - Type of room
   * @returns {Promise<Array<string>>} - Array of room IDs
   */
  async getRoomsByType(roomType) {
    try {
      if (!roomType) {
        throw new AuthError("Room type is required", "INVALID_ROOM_PARAMS");
      }
      
      // Validate room type
      if (!Object.values(this.roomTypes).includes(roomType)) {
        throw new AuthError(`Invalid room type: ${roomType}`, "INVALID_ROOM_TYPE");
      }
      
      const registryKey = `${ROOM_REGISTRY_KEY_PREFIX}${roomType}`;
      return await redisClient.smembers(registryKey) || [];
    } catch (error) {
      logger.error("Error getting rooms by type:", error);
      return [];
    }
  }

  /**
   * Get room hierarchy path from leaf to root
   * @param {string} roomId - Starting room ID
   * @returns {Promise<Array<string>>} - Array of room IDs from leaf to root
   */
  async getRoomHierarchyPath(roomId) {
    try {
      if (!roomId) {
        throw new AuthError("Room ID is required", "INVALID_ROOM_PARAMS");
      }
      
      const path = [roomId];
      let currentRoomId = roomId;
      let parentRoomId = null;
      
      // Traverse up the hierarchy
      while ((parentRoomId = await this.getRoomParent(currentRoomId))) {
        path.push(parentRoomId);
        currentRoomId = parentRoomId;
        
        // Prevent infinite loops
        if (path.length > 10) {
          logger.warn(`Possible circular reference in room hierarchy for ${roomId}`);
          break;
        }
      }
      
      return path;
    } catch (error) {
      logger.error("Error getting room hierarchy path:", error);
      return [roomId];
    }
  }

  /**
   * Create a complete room hierarchy for a user session
   * @param {string} userId - User ID
   * @param {string} deviceId - Device ID
   * @param {string} sessionId - Session ID
   * @param {string} tabId - Tab ID
   * @returns {Promise<Object>} - Room hierarchy object
   */
  async createRoomHierarchy(userId, deviceId, sessionId, tabId) {
    try {
      // Create room IDs
      const userRoom = `${this.roomPrefixes.USER}${userId}`;
      const deviceRoom = `${this.roomPrefixes.DEVICE}${deviceId}`;
      const sessionRoom = `${this.roomPrefixes.SESSION}${sessionId}`;
      const tabRoom = `${this.roomPrefixes.TAB}${tabId}`;
      
      // Register rooms
      await this.registerRoom(userRoom, this.roomTypes.USER);
      await this.registerRoom(deviceRoom, this.roomTypes.DEVICE, userRoom);
      await this.registerRoom(sessionRoom, this.roomTypes.SESSION, deviceRoom);
      await this.registerRoom(tabRoom, this.roomTypes.TAB, sessionRoom);
      
      // Set metadata
      await this.setRoomMetadata(userRoom, { userId });
      await this.setRoomMetadata(deviceRoom, { userId, deviceId });
      await this.setRoomMetadata(sessionRoom, { userId, deviceId, sessionId });
      await this.setRoomMetadata(tabRoom, { userId, deviceId, sessionId, tabId });
      
      return {
        userRoom,
        deviceRoom,
        sessionRoom,
        tabRoom
      };
    } catch (error) {
      logger.error("Error creating room hierarchy:", error);
      throw error;
    }
  }
}

module.exports = new RoomRegistryService();
