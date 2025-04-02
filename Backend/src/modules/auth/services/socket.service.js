/**
 * Socket Service
 * Centralized service for WebSocket operations with room hierarchy support
 */
const { Server } = require('socket.io');
const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');
const config = require('../config');
const { roomRegistry, socketAdapter, eventPropagation } = config;
const logger = require('../../../utils/logger');

// Import services
const sessionService = require('./session.service');
const tokenService = require('./token.service');

// Define event names
const EVENT_NAMES = {
  TOKEN_UPDATED: 'auth:token:updated',
  TOKEN_INVALIDATED: 'auth:token:invalidated',
  TOKEN_ERROR: 'auth:token:error',
  LEADER_TRANSFER: 'auth:leader:transfer'
};

class SocketService {
  constructor() {
    this.io = null;
    this.roomRegistry = null; // Will be initialized as Redis client
    this.eventHandlers = new Map(); // Registry for event handlers
    this.heartbeatIntervals = new Map(); // Track heartbeats by namespace
    this.authIO = null; // Auth namespace
  }

  /**
   * Initialize Socket.IO server
   * @param {Object} httpServer - HTTP server instance
   */
  initialize(httpServer) {
    // Create Redis clients for adapter
    const pubClient = new Redis(socketAdapter.redis);
    const subClient = pubClient.duplicate();
    
    // Initialize room registry with Redis
    this.roomRegistry = new Redis(socketAdapter.redis);
    
    // Create Socket.IO server
    this.io = new Server(httpServer, {
      cors: {
        origin: config.websocket.cors.origin,
        credentials: true
      },
      cookie: {
        name: config.websocket.cookie.name,
        httpOnly: true,
        path: config.websocket.cookie.path,
        sameSite: config.websocket.cookie.sameSite,
        secure: process.env.NODE_ENV === 'production'
      },
      adapter: createAdapter(pubClient, subClient)
    });
    
    logger.info('Socket.IO server initialized with Redis adapter');
    
    // Apply global connection throttling
    const rateLimitMiddleware = require('../middleware/rate-limit');
    this.io.use(rateLimitMiddleware.socketConnectionThrottle());
    
    // Initialize auth namespace
    this.setupAuthNamespace(httpServer);
    
    return this.io;
  }
  
  /**
   * Sets up the authentication WebSocket namespace
   * @param {Object} httpServer - HTTP server instance
   * @returns {Object} Socket.IO instance for auth
   */
  setupAuthNamespace() {
    try {
      // Create auth namespace
      this.authIO = this.io.of('/auth');
      
      // Import rate limit middleware
      const rateLimitMiddleware = require('../middleware/rate-limit');
      
      // Apply auth rate limiting
      this.authIO.use(rateLimitMiddleware.socketAuthRateLimit());
      
      // Use centralized authentication middleware
      this.authIO.use(this.authMiddleware.bind(this));
      
      // Set up heartbeat
      this.setupHeartbeat(this.authIO, 30000);
      
      // Handle connections with room management
      this.authIO.on("connection", async (socket) => {
        try {
          // Set isAlive property for heartbeat
          socket.isAlive = true;
          
          // Apply message rate limiting
          rateLimitMiddleware.socketMessageRateLimit(this.io)(socket);
          
          // Handle pong messages
          socket.on("pong", () => {
            socket.isAlive = true;
          });
          
          // Join socket to hierarchical rooms
          await this.joinHierarchicalRooms(socket);
          
          // Handle token refresh events
          this.setupTokenRefreshHandlers(socket);
          
          // Handle session events
          this.setupSessionEventHandlers(socket);
          
          // Handle security events
          this.setupSecurityEventHandlers(socket);
          
          // Handle server events
          socket.on("server:status", () => {
            socket.emit("server:info", {
              status: "healthy",
              version: process.env.APP_VERSION || "1.0.0",
              timestamp: Date.now()
            });
          });
          
          // Handle disconnect
          socket.on("disconnect", async (reason) => {
            try {
              logger.debug(`Auth socket disconnected: ${socket.id}, reason: ${reason}`);
              
              // Clean up any resources
              await this.cleanupSocketResources(socket);
            } catch (error) {
              logger.error("Error handling socket disconnect:", error);
            }
          });
        } catch (error) {
          logger.error("Error setting up socket connection:", error);
          socket.disconnect(true);
        }
      });
      
      logger.info('Auth namespace initialized');
      return this.authIO;
    } catch (error) {
      logger.error("Error setting up Auth Socket.IO:", error);
      throw error;
    }
  }
  
  /**
   * Set up token refresh event handlers
   * @param {Object} socket - Socket.IO socket
   */
  setupTokenRefreshHandlers(socket) {
    socket.on('auth:token:refresh', async (data) => {
      try {
        const { refreshToken } = data;
        const { userId, deviceId, tabId } = socket.data;
        
        if (!refreshToken) {
          socket.emit(EVENT_NAMES.TOKEN_ERROR, {
            message: 'No refresh token provided',
            code: 'MISSING_REFRESH_TOKEN'
          });
          return;
        }
        
        // Refresh token
        const result = await tokenService.refreshAccessToken(refreshToken);
        
        if (!result) {
          socket.emit(EVENT_NAMES.TOKEN_ERROR, {
            message: 'Token refresh failed',
            code: 'REFRESH_FAILED'
          });
          return;
        }
        
        const { token, refreshToken: newRefreshToken } = result;
        
        // Send new tokens to client
        socket.emit(EVENT_NAMES.TOKEN_UPDATED, {
          token,
          refreshToken: newRefreshToken,
          updatedAt: Date.now()
        });
        
        // Notify other tabs on same device using consistent room naming
        if (deviceId) {
          const deviceRoom = this.createRoomName('device', deviceId);
          socket.to(deviceRoom).emit(EVENT_NAMES.TOKEN_UPDATED, {
            token,
            refreshToken: newRefreshToken,
            updatedAt: Date.now(),
            source: tabId || socket.id
          });
        }
        
        logger.debug(`Token refreshed for user ${userId}`);
      } catch (error) {
        logger.error(`Error handling token refresh:`, error);
        socket.emit(EVENT_NAMES.TOKEN_ERROR, {
          message: 'Error refreshing token',
          code: 'REFRESH_ERROR'
        });
      }
    });
  }
  
  /**
   * Set up session event handlers
   * @param {Object} socket - Socket.IO socket
   */
  setupSessionEventHandlers(socket) {
    socket.on('auth:session:heartbeat', async () => {
      try {
        const { sessionId } = socket.data;
        if (sessionId) {
          await sessionService.updateSessionActivity(sessionId);
          socket.emit('auth:session:updated', { 
            status: 'active',
            timestamp: Date.now()
          });
        }
      } catch (error) {
        logger.error('Error updating session activity:', error);
      }
    });
  }
  
  /**
   * Set up security event handlers
   * @param {Object} socket - Socket.IO socket
   */
  setupSecurityEventHandlers(socket) {
    socket.on('auth:logout', async (data = {}) => {
      try {
        const { allDevices = false } = data;
        const { userId, deviceId } = socket.data;
        
        // Invalidate tokens
        if (allDevices) {
          await tokenService.invalidateAllUserTokens(userId);
        } else {
          await tokenService.invalidateDeviceTokens(userId, deviceId);
        }
        
        // Notify other clients
        if (allDevices) {
          // Invalidate tokens across all devices using consistent room naming
          const userRoom = this.createRoomName('user', userId);
          this.io.to(userRoom).emit(EVENT_NAMES.TOKEN_INVALIDATED, {
            reason: 'user_logout',
            timestamp: Date.now(),
            source: socket.id
          });
        } else if (deviceId) {
          // Invalidate tokens on current device only using consistent room naming
          const deviceRoom = this.createRoomName('device', deviceId);
          socket.to(deviceRoom).emit(EVENT_NAMES.TOKEN_INVALIDATED, {
            reason: 'device_logout',
            timestamp: Date.now(),
            source: socket.id
          });
        }
        
        socket.emit('auth:logout:success');
        socket.disconnect(true);
      } catch (error) {
        logger.error('Error handling logout:', error);
        socket.emit('auth:logout:error', { message: 'Logout failed' });
      }
    });
  }
  
  /**
   * Get the Auth IO instance
   * @returns {Object} Auth namespace
   */
  getAuthIO() {
    if (!this.authIO) {
      throw new Error("Auth Socket.IO not initialized");
    }
    return this.authIO;
  }
  
  /**
   * Create and configure a namespace with authentication and heartbeat
   * @param {string} namespace - Namespace path
   * @param {Object} options - Configuration options
   * @returns {Object} Configured namespace
   */
  createNamespace(namespace, options = {}) {
    const ns = this.io.of(namespace);
    
    // Apply rate limiting if enabled
    if (options.rateLimit !== false) {
      const rateLimitMiddleware = require('../middleware/rate-limit');
      
      // Apply connection throttling
      ns.use(rateLimitMiddleware.socketConnectionThrottle(options.connectionThrottle));
      
      // Apply auth rate limiting if authentication is required
      if (options.auth !== false) {
        ns.use(rateLimitMiddleware.socketAuthRateLimit(options.authRateLimit));
      }
    }
    
    // Set up authentication middleware
    ns.use(this.authMiddleware.bind(this));
    
    // Set up heartbeat if enabled
    if (options.heartbeat !== false) {
      this.setupHeartbeat(ns, options.heartbeatInterval);
    }
    
    // Set up connection handler
    ns.on('connection', (socket) => {
      // Apply message rate limiting if enabled
      if (options.rateLimit !== false) {
        const rateLimitMiddleware = require('../middleware/rate-limit');
        rateLimitMiddleware.socketMessageRateLimit(this.io, options.messageRateLimit)(socket);
      }
      
      this.handleConnection(socket, options);
    });
    
    logger.info(`Namespace created: ${namespace}`);
    return ns;
  }
  
  /**
   * Set up heartbeat for a namespace
   * @param {Object} namespace - Socket.IO namespace
   * @param {Number} interval - Heartbeat interval in ms
   */
  setupHeartbeat(namespace, interval = 30000) {
    // Clear any existing heartbeat for this namespace
    if (this.heartbeatIntervals.has(namespace.name)) {
      clearInterval(this.heartbeatIntervals.get(namespace.name));
    }
    
    const heartbeatInterval = setInterval(() => {
      const sockets = Array.from(namespace.sockets.values());
      let activeCount = 0;
      let terminatedCount = 0;

      sockets.forEach((socket) => {
        if (socket.isAlive === false) {
          logger.warn(`Terminating inactive socket on ${namespace.name}: ${socket.id}`);
          socket.disconnect(true);
          terminatedCount++;
        } else {
          socket.isAlive = false;
          socket.emit("ping");
          activeCount++;
        }
      });

      if (activeCount > 0 || terminatedCount > 0) {
        logger.debug(`Heartbeat on ${namespace.name}: ${activeCount} active, ${terminatedCount} terminated`);
      }
    }, interval);
    
    // Store interval reference
    this.heartbeatIntervals.set(namespace.name, heartbeatInterval);
    
    // Clean up interval on namespace close
    namespace.on("close", () => {
      clearInterval(heartbeatInterval);
      this.heartbeatIntervals.delete(namespace.name);
    });
    
    return heartbeatInterval;
  }
  
  /**
   * Authentication middleware for Socket.IO
   * @param {Object} socket - Socket.IO socket
   * @param {Function} next - Next middleware function
   */
  async authMiddleware(socket, next) {
    try {
      // Extract token from HTTP-only cookie
      const cookies = socket.request.headers.cookie;
      if (!cookies) {
        return this.handleSocketError(next, 'No cookies provided', 'MISSING_COOKIES');
      }
      
      // Parse cookies
      const cookie = require('cookie');
      const parsedCookies = cookie.parse(cookies);
      const accessToken = parsedCookies[config.token.cookieName];
      
      if (!accessToken) {
        return this.handleSocketError(next, 'No access token found', 'MISSING_TOKEN');
      }
      
      // Validate token using token service
      const tokenService = require('./token.service');
      try {
        const decoded = await tokenService.verifyAccessToken(accessToken);
        
        // Get session info
        const sessionService = require('./session.service');
        const sessionId = decoded.sessionId;
        const session = await sessionService.getSessionById(sessionId);
        
        if (!session) {
          return this.handleSocketError(next, 'Session not found', 'INVALID_SESSION');
        }
        
        // Set user data in socket
        socket.data = {
          userId: decoded.userId || decoded.sub,
          sessionId: sessionId,
          deviceId: session.deviceId || socket.handshake.query.deviceId,
          tabId: socket.handshake.query.tabId
        };
        
        // Register socket connection
        await tokenService.registerSocketConnection(socket, socket.data.userId, sessionId);
        
        // Reset auth rate limit on successful authentication if key exists
        if (socket.authRateLimitKey) {
          const rateLimitMiddleware = require('../middleware/rate-limit');
          await rateLimitMiddleware.rateLimitService.resetRateLimit(
            socket.authRateLimitKey,
            'socketAuth'
          );
        }
        
        next();
      } catch (error) {
        // Try token refresh if access token is expired
        if (error.name === "TokenExpiredError" && parsedCookies[config.token.refreshCookieName]) {
          try {
            const refreshToken = parsedCookies[config.token.refreshCookieName];
            const refreshResult = await tokenService.refreshAccessToken(refreshToken);
            
            if (refreshResult && refreshResult.accessToken) {
              const decoded = await tokenService.verifyAccessToken(refreshResult.accessToken);
              
              // Get session info
              const sessionService = require('./session.service');
              const sessionId = decoded.sessionId;
              const session = await sessionService.getSessionById(sessionId);
              
              if (!session) {
                return this.handleSocketError(next, 'Session not found after refresh', 'INVALID_SESSION');
              }
              
              // Set user data in socket
              socket.data = {
                userId: decoded.userId || decoded.sub,
                sessionId: sessionId,
                deviceId: session.deviceId || socket.handshake.query.deviceId,
                tabId: socket.handshake.query.tabId
              };
              
              // Register socket connection
              await tokenService.registerSocketConnection(socket, socket.data.userId, sessionId);
              
              next();
            } else {
              return this.handleSocketError(next, 'Token refresh failed', 'REFRESH_FAILED');
            }
          } catch (refreshError) {
            return this.handleSocketError(next, 'Token refresh error', 'REFRESH_ERROR', refreshError);
          }
        } else {
          return this.handleSocketError(next, 'Invalid token', 'INVALID_TOKEN', error);
        }
      }
    } catch (error) {
      return this.handleSocketError(next, 'Authentication error', 'AUTH_ERROR', error);
    }
  }

  /**
   * Handle socket errors with standardized format
   * @param {Function} next - Next middleware function
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Error} [error] - Original error object
   */
  handleSocketError(next, message, code, error = null) {
    if (error) {
      logger.error(`Socket error (${code}):`, { message, error: error.message, stack: error.stack });
    } else {
      logger.warn(`Socket error: ${message} (${code})`);
    }
    
    const socketError = new Error(message);
    socketError.code = code;
    return next(socketError);
  }
  
  /**
   * Handle new socket connection
   * @param {Object} socket - Socket.IO socket
   * @param {Object} options - Connection options
   */
  handleConnection(socket, options = {}) {
    logger.debug(`New socket connection: ${socket.id}`, {
      userId: socket.data?.userId,
      sessionId: socket.data?.sessionId,
      namespace: socket.nsp.name
    });
    
    // Set isAlive property for heartbeat
    socket.isAlive = true;
    
    // Handle pong messages
    socket.on("pong", () => {
      socket.isAlive = true;
    });
    
    socket.on("heartbeat:response", () => {
      socket.isAlive = true;
    });
    
    // Join hierarchical rooms
    this.joinHierarchicalRooms(socket);
    
    // Set up disconnection handler
    socket.on('disconnect', (reason) => this.handleDisconnect(socket, reason));
    
    // Register standard event handlers
    this.registerStandardEventHandlers(socket);
    
    // Register custom event handlers if provided
    if (options.eventHandlers) {
      this.registerCustomEventHandlers(socket, options.eventHandlers);
    }
  }
  
  /**
   * Register standard event handlers for a socket
   * @param {Object} socket - Socket.IO socket
   */
  registerStandardEventHandlers(socket) {
    // Room management events
    socket.on('join:room', (data) => this.handleJoinRoom(socket, data));
    socket.on('leave:room', (data) => this.handleLeaveRoom(socket, data));
    
    // Server info events
    socket.on('server:status', () => {
      socket.emit('server:info', {
        status: 'healthy',
        version: process.env.APP_VERSION || '1.0.0',
        timestamp: Date.now()
      });
    });
  }
  
  /**
   * Register custom event handlers for a socket
   * @param {Object} socket - Socket.IO socket
   * @param {Object} handlers - Map of event names to handler functions
   */
  registerCustomEventHandlers(socket, handlers) {
    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event, (data) => handler(socket, data));
    }
  }
  
  /**
   * Register global event handlers for a specific event type
   * @param {string} eventType - Event type identifier
   * @param {Object} handlers - Map of event names to handler functions
   */
  registerGlobalEventHandlers(eventType, handlers) {
    this.eventHandlers.set(eventType, handlers);
    logger.debug(`Registered global event handlers for ${eventType}`);
    return handlers;
  }
  
  /**
   * Join socket to hierarchical rooms
   * @param {Object} socket - Socket.IO socket
   * @returns {Object} Room information
   */
  joinHierarchicalRooms(socket) {
    try {
      const { userId, deviceId, sessionId, tabId } = socket.data;
      
      // Create room names using config
      const userRoom = this.createRoomName('user', userId);
      const deviceRoom = this.createRoomName('device', deviceId);
      const sessionRoom = this.createRoomName('session', sessionId);
      const tabRoom = tabId ? this.createRoomName('tab', tabId) : null;
      
      // Join rooms
      socket.join(userRoom);
      socket.join(deviceRoom);
      socket.join(sessionRoom);
      if (tabRoom) socket.join(tabRoom);
      
      // Store room info in socket
      const rooms = {
        userRoom,
        deviceRoom,
        sessionRoom,
        tabRoom
      };
      
      socket.rooms = rooms;
      
      // Store room hierarchy in Redis
      this.storeRoomHierarchy(rooms);
      
      logger.debug(`Socket ${socket.id} joined hierarchical rooms`, rooms);
      return rooms;
    } catch (error) {
      logger.error('Error joining hierarchical rooms:', error);
      throw error;
    }
  }
  
  /**
   * Store room hierarchy in Redis
   * @param {Object} rooms - Room information
   */
  async storeRoomHierarchy(rooms) {
    try {
      const { userRoom, deviceRoom, sessionRoom, tabRoom } = rooms;
      
      // Store parent-child relationships
      if (deviceRoom) {
        await this.roomRegistry.sadd(`${userRoom}:children`, deviceRoom);
        await this.roomRegistry.set(`${deviceRoom}:parent`, userRoom);
      }
      
      if (sessionRoom) {
        await this.roomRegistry.sadd(`${deviceRoom}:children`, sessionRoom);
        await this.roomRegistry.set(`${sessionRoom}:parent`, deviceRoom);
      }
      
      if (tabRoom) {
        await this.roomRegistry.sadd(`${sessionRoom}:children`, tabRoom);
        await this.roomRegistry.set(`${tabRoom}:parent`, sessionRoom);
      }
    } catch (error) {
      logger.error('Error storing room hierarchy:', error);
    }
  }
  
  /**
   * Create room name using config
   * @param {string} type - Room type
   * @param {string} id - Room identifier
   * @returns {string} Room name
   */
  createRoomName(type, id) {
    const prefix = roomRegistry.roomTypes[type]?.prefix || `${type}:`;
    return `${prefix}${id}`;
  }
  
  /**
   * Handle socket disconnection
   * @param {Object} socket - Socket.IO socket
   * @param {string} reason - Disconnection reason
   */
  handleDisconnect(socket, reason) {
    logger.debug(`Socket disconnected: ${socket.id}`, {
      reason,
      userId: socket.data?.userId,
      sessionId: socket.data?.sessionId
    });
    
    // Clean up resources
    this.cleanupSocketResources(socket);
  }
  
  /**
   * Clean up resources when socket disconnects
   * @param {Object} socket - Socket.IO socket
   */
  async cleanupSocketResources(socket) {
    try {
      // Unregister socket connection if authenticated
      if (socket.data?.userId && socket.data?.sessionId) {
        const tokenService = require('./token.service');
        await tokenService.unregisterSocketConnection(socket, socket.data.userId, socket.data.sessionId);
      }
      
      // Update session last activity time
      if (socket.data && socket.data.sessionId) {
        await sessionService.updateSessionActivity(socket.data.sessionId);
      }
    } catch (error) {
      logger.error('Error cleaning up socket resources:', error);
    }
  }
  
  /**
   * Handle join room request
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Room data
   */
  async handleJoinRoom(socket, data) {
    try {
      const { roomName, roomType, roomId } = data;
      
      // Create room name if not provided
      const targetRoom = roomName || this.createRoomName(roomType, roomId);
      
      // Check if user has permission to join room
      if (!(await this.canJoinRoom(socket, targetRoom))) {
        socket.emit('room:error', {
          message: 'Permission denied to join room',
          code: 'PERMISSION_DENIED',
          room: targetRoom
        });
        return;
      }
      
      // Join room
      socket.join(targetRoom);
      
      // Register room if needed
      await this.registerRoom(targetRoom, data.options || {});
      
      socket.emit('room:joined', { room: targetRoom });
      logger.debug(`Socket ${socket.id} joined room ${targetRoom}`);
    } catch (error) {
      logger.error(`Error joining room:`, error);
      socket.emit('room:error', {
        message: 'Failed to join room',
        code: 'JOIN_FAILED',
        error: error.message
      });
    }
  }
  
  /**
   * Check if socket can join a room
   * @param {Object} socket - Socket.IO socket
   * @param {string} roomName - Room name
   * @returns {boolean} Whether socket can join room
   */
  async canJoinRoom(socket, roomName) {
    // Default implementation - override in subclasses for specific authorization
    // For now, just check if user is authenticated
    return !!socket.data?.userId;
  }
  
  /**
   * Handle leave room request
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Room data
   */
  handleLeaveRoom(socket, data) {
    try {
      const { roomName, roomType, roomId } = data;
      
      // Create room name if not provided
      const targetRoom = roomName || this.createRoomName(roomType, roomId);
      
      // Leave room
      socket.leave(targetRoom);
      socket.emit('room:left', { room: targetRoom });
      logger.debug(`Socket ${socket.id} left room ${targetRoom}`);
    } catch (error) {
      logger.error(`Error leaving room:`, error);
      socket.emit('room:error', {
        message: 'Failed to leave room',
        code: 'LEAVE_FAILED',
        error: error.message
      });
    }
  }
  
  /**
   * Register a room in the hierarchy
   * @param {string} roomName - Room name
   * @param {Object} options - Room options
   */
  async registerRoom(roomName, options = {}) {
    try {
      const { parent, metadata = {} } = options;
      
      // Store room metadata in Redis
      await this.roomRegistry.hmset(`room:${roomName}`, {
        name: roomName,
        parent: parent || '',
        createdAt: new Date().toISOString(),
        ...metadata
      });
      
      // Store parent-child relationship if parent exists
      if (parent) {
        await this.roomRegistry.sadd(`${parent}:children`, roomName);
        await this.roomRegistry.set(`${roomName}:parent`, parent);
      }
      
      logger.debug(`Room registered: ${roomName}`, { parent, metadata });
      return true;
    } catch (error) {
      logger.error(`Error registering room ${roomName}:`, error);
      return false;
    }
  }
  
  /**
   * Emit event to a room
   * @param {string} roomName - Room name
   * @param {string} eventName - Event name
   * @param {Object} data - Event data
   */
  emitToRoom(roomName, eventName, data) {
    if (!this.io) {
      logger.error('Socket.IO not initialized');
      return false;
    }
    
    this.io.to(roomName).emit(eventName, data);
    logger.debug(`Emitted ${eventName} to ${roomName}`);
    return true;
  }
  
  /**
   * Emit event with propagation based on configuration
   * @param {string} roomName - Room name
   * @param {string} eventName - Event name
   * @param {Object} data - Event data
   * @param {Object} propagationConfig - Propagation configuration
   */
  async emitWithPropagation(roomName, eventName, data, propagationConfig = {}) {
    const { direction = 'none', depth = 1 } = propagationConfig;
    
    // Emit to the target room
    this.emitToRoom(roomName, eventName, data);
    
    // Handle propagation based on direction
    if (direction === 'up' || direction === 'both') {
      await this.propagateUp(roomName, eventName, data, depth);
    }
    
    if (direction === 'down' || direction === 'both') {
      await this.propagateDown(roomName, eventName, data, depth);
    }
    
    return true;
  }
  
  /**
   * Propagate event up the room hierarchy
   * @param {string} roomName - Starting room name
   * @param {string} eventName - Event name
   * @param {Object} data - Event data
   * @param {number} depth - Maximum propagation depth
   */
  async propagateUp(roomName, eventName, data, depth = 1) {
    if (depth <= 0) return;
    
    try {
      // Get parent room
      const parent = await this.roomRegistry.get(`${roomName}:parent`);
      
      if (parent) {
        // Emit to parent
        this.emitToRoom(parent, eventName, {
          ...data,
          _propagation: { direction: 'up', sourceRoom: roomName }
        });
        
        // Continue propagation
        if (depth > 1) {
          await this.propagateUp(parent, eventName, data, depth - 1);
        }
      }
    } catch (error) {
      logger.error(`Error propagating event up from ${roomName}:`, error);
    }
  }
  
  /**
   * Propagate event down the room hierarchy
   * @param {string} roomName - Starting room name
   * @param {string} eventName - Event name
   * @param {Object} data - Event data
   * @param {number} depth - Maximum propagation depth
   */
  async propagateDown(roomName, eventName, data, depth = 1) {
    if (depth <= 0) return;
    
    try {
      // Get child rooms
      const children = await this.roomRegistry.smembers(`${roomName}:children`);
      
      for (const child of children) {
        // Emit to child
        this.emitToRoom(child, eventName, {
          ...data,
          _propagation: { direction: 'down', sourceRoom: roomName }
        });
        
        // Continue propagation
        if (depth > 1) {
          await this.propagateDown(child, eventName, data, depth - 1);
        }
      }
    } catch (error) {
      logger.error(`Error propagating event down from ${roomName}:`, error);
    }
  }
  
  /**
   * Get debug information about a socket
   * @param {string} socketId - Socket ID
   * @returns {Object} Socket debug info
   */
  getSocketInfo(socketId) {
    if (!this.io) return null;
    
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return null;
    
    return {
      id: socket.id,
      connected: socket.connected,
      handshake: {
        address: socket.handshake.address,
        time: socket.handshake.time,
        query: socket.handshake.query
      },
      rooms: Array.from(socket.rooms),
      data: socket.data
    };
  }
  
  /**
   * Get debug information about a room
   * @param {string} roomName - Room name
   * @returns {Object} Room debug info
   */
  async getRoomInfo(roomName) {
    if (!this.io) return null;
    
    try {
      // Get room metadata from Redis
      const metadata = await this.roomRegistry.hgetall(`room:${roomName}`);
      
      // Get sockets in room
      const socketsInRoom = await this.io.in(roomName).fetchSockets();
      
      // Get parent and children
      const parent = await this.roomRegistry.get(`${roomName}:parent`);
      const children = await this.roomRegistry.smembers(`${roomName}:children`);
      
      return {
        name: roomName,
        metadata,
        socketCount: socketsInRoom.length,
        socketIds: socketsInRoom.map(s => s.id),
        parent,
        children
      };
    } catch (error) {
      logger.error(`Error getting room info for ${roomName}:`, error);
      return null;
    }
  }
  
  /**
   * Initialize debugging capabilities
   */
  initializeDebugging() {
    if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_SOCKET_DEBUG) {
      logger.info('Socket debugging disabled in production');
      return;
    }
    
    // Load debug service
    const WebSocketDebugService = require('./websocket-debug.service');
    this.debugService = new WebSocketDebugService(this.io);
    
    logger.info('Socket debugging initialized');
  }

  /**
   * Setup Socket.IO event handlers
   * @param {Object} io - Socket.IO server instance
   * @param {Object} services - Services to use for handling events
   */
  setupSocketHandlers(io, services = {}) {
    // Store services for later use
    this.services = services;
    
    // Initialize the Socket.IO server if not already initialized
    if (!this.io) {
      this.io = io;
    }
    
    // Setup auth namespace
    this.setupAuthNamespace();
    
    logger.info('Socket.IO event handlers initialized');
    return this.io;
  }
}

// Export singleton instance
const socketService = new SocketService();
module.exports = socketService;
