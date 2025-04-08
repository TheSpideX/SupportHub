/**
 * Primus WebSocket Service
 * Replaces Socket.IO with Primus for bidirectional communication
 */

const Primus = require('primus');
const PrimusEmit = require('primus-emit');
const http = require('http');
const logger = require('../utils/logger');
const config = require('../config');

// Store the Primus instance
let primusInstance = null;

// Store connected sparks (clients)
const connectedSparks = new Map();

// Store room memberships
const rooms = new Map();

/**
 * Initialize Primus server
 * @param {http.Server} server - HTTP server instance
 * @param {Object} options - Configuration options
 * @returns {Primus} Primus instance
 */
function initializePrimus(server, options = {}) {
  if (primusInstance) {
    logger.warn('Primus already initialized');
    return primusInstance;
  }

  const defaultOptions = {
    transformer: 'websockets',
    pathname: '/primus',
    parser: 'json',
    compression: true,
    pingInterval: 30000, // 30 seconds
    maxLength: 500000, // Max message size
    cors: {
      origin: config.cors.origin || '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  };

  const mergedOptions = { ...defaultOptions, ...options };
  
  logger.info('Initializing Primus with options:', mergedOptions);
  
  // Create Primus instance
  primusInstance = new Primus(server, mergedOptions);
  
  // Add emit plugin
  primusInstance.plugin('emit', PrimusEmit);

  // Setup connection handling
  primusInstance.on('connection', handleConnection);
  
  // Setup error handling
  primusInstance.on('error', (err) => {
    logger.error('Primus server error:', err);
  });

  logger.info('Primus initialized successfully');
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
  spark.on('data', (data) => handleData(spark, data));
  
  // Set up close handler
  spark.on('end', () => handleDisconnect(spark));
  
  // Set up error handler
  spark.on('error', (err) => {
    logger.error(`Spark error (${spark.id}):`, err);
  });
  
  // Emit connection event
  spark.emit('connected', { id: spark.id, timestamp: Date.now() });
}

/**
 * Handle incoming data
 * @param {Spark} spark - Primus spark (client connection)
 * @param {Object} data - Received data
 */
function handleData(spark, data) {
  if (!data || typeof data !== 'object') {
    logger.warn(`Invalid data received from ${spark.id}`);
    return;
  }
  
  logger.debug(`Data received from ${spark.id}:`, data);
  
  // Handle different event types
  if (data.event && typeof data.event === 'string') {
    switch (data.event) {
      case 'join':
        joinRoom(spark, data.room);
        break;
      case 'leave':
        leaveRoom(spark, data.room);
        break;
      case 'auth':
        handleAuth(spark, data.payload);
        break;
      case 'activity':
        handleActivity(spark, data.payload);
        break;
      default:
        // Forward the event to any listeners
        spark.emit(data.event, data.payload);
    }
  }
}

/**
 * Handle client disconnect
 * @param {Spark} spark - Primus spark (client connection)
 */
function handleDisconnect(spark) {
  logger.debug(`Connection closed: ${spark.id}`);
  
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
  if (!roomName || typeof roomName !== 'string') {
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
  spark.emit('room:joined', { room: roomName });
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
  spark.emit('room:left', { room: roomName });
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
  spark.emit('auth:success', { 
    id: spark.id, 
    timestamp: Date.now() 
  });
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
    broadcastToUser(spark.authData.userId, 'activity:update', activityData, spark.id);
  }
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
    throw new Error('Primus not initialized');
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

module.exports = {
  initializePrimus,
  getPrimus,
  getClientLibrary,
  getConnectedCount,
  getRoomCount,
  broadcastToRoom,
  broadcastToUser,
  broadcastToDevice
};
