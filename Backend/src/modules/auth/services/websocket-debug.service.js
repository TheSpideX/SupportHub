/**
 * WebSocket Debugging Service
 * Provides debugging capabilities for WebSocket connections
 */
const logger = require('../../../utils/logger');
const { EVENT_NAMES } = require('../constants/event-names.constant');

class WebSocketDebugService {
  constructor(io) {
    this.io = io;
    this.debugSockets = new Map(); // socketId -> debug info
    this.roomMonitoring = new Map(); // roomName -> {active, subscribers}
    this.eventMonitoring = new Map(); // eventName -> {active, subscribers}
    this.isDebugMode = process.env.NODE_ENV !== 'production';
  }

  /**
   * Initialize debugging for a socket
   * @param {Object} socket - Socket.IO socket
   */
  initializeSocketDebugging(socket) {
    // Only allow debugging in non-production or for admin users
    if (!this.isDebugMode && !socket.data.isAdmin) {
      return;
    }
    
    // Set up debug event handlers
    socket.on(EVENT_NAMES.DEBUG_MONITOR_ROOM, (data) => this.handleMonitorRoom(socket, data));
    socket.on(EVENT_NAMES.DEBUG_MONITOR_EVENT, (data) => this.handleMonitorEvent(socket, data));
    socket.on(EVENT_NAMES.DEBUG_GET_SOCKET_INFO, (data) => this.handleGetSocketInfo(socket, data));
    socket.on(EVENT_NAMES.DEBUG_GET_ROOM_INFO, (data) => this.handleGetRoomInfo(socket, data));
    
    // Register socket for debugging
    this.debugSockets.set(socket.id, {
      id: socket.id,
      userId: socket.data.userId,
      deviceId: socket.data.deviceId,
      sessionId: socket.data.sessionId,
      tabId: socket.data.tabId,
      monitoringRooms: [],
      monitoringEvents: [],
      startTime: Date.now()
    });
    
    logger.debug(`Socket debugging initialized for ${socket.id}`);
  }

  /**
   * Handle room monitoring request
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Request data
   */
  handleMonitorRoom(socket, data) {
    const { roomName, active = true } = data;
    
    // Validate room name
    if (!roomName) {
      socket.emit(EVENT_NAMES.DEBUG_ERROR, {
        message: 'Room name is required',
        code: 'INVALID_ROOM'
      });
      return;
    }
    
    // Get or initialize room monitoring
    if (!this.roomMonitoring.has(roomName)) {
      this.roomMonitoring.set(roomName, {
        active: false,
        subscribers: new Set(),
        events: []
      });
    }
    
    const roomMonitoring = this.roomMonitoring.get(roomName);
    
    if (active) {
      // Add socket as subscriber
      roomMonitoring.subscribers.add(socket.id);
      roomMonitoring.active = true;
      
      // Add to socket's monitoring list
      const socketDebug = this.debugSockets.get(socket.id);
      if (socketDebug && !socketDebug.monitoringRooms.includes(roomName)) {
        socketDebug.monitoringRooms.push(roomName);
      }
      
      socket.emit(EVENT_NAMES.DEBUG_MONITOR_ROOM_STARTED, {
        roomName,
        subscribers: roomMonitoring.subscribers.size
      });
      
      logger.debug(`Socket ${socket.id} started monitoring room ${roomName}`);
    } else {
      // Remove socket as subscriber
      roomMonitoring.subscribers.delete(socket.id);
      
      // If no subscribers left, mark as inactive
      if (roomMonitoring.subscribers.size === 0) {
        roomMonitoring.active = false;
      }
      
      // Remove from socket's monitoring list
      const socketDebug = this.debugSockets.get(socket.id);
      if (socketDebug) {
        socketDebug.monitoringRooms = socketDebug.monitoringRooms.filter(r => r !== roomName);
      }
      
      socket.emit(EVENT_NAMES.DEBUG_MONITOR_ROOM_STOPPED, {
        roomName,
        subscribers: roomMonitoring.subscribers.size
      });
      
      logger.debug(`Socket ${socket.id} stopped monitoring room ${roomName}`);
    }
  }

  /**
   * Handle event monitoring request
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Request data
   */
  handleMonitorEvent(socket, data) {
    const { eventName, active = true } = data;
    
    // Validate event name
    if (!eventName) {
      socket.emit(EVENT_NAMES.DEBUG_ERROR, {
        message: 'Event name is required',
        code: 'INVALID_EVENT'
      });
      return;
    }
    
    // Get or initialize event monitoring
    if (!this.eventMonitoring.has(eventName)) {
      this.eventMonitoring.set(eventName, {
        active: false,
        subscribers: new Set(),
        occurrences: []
      });
    }
    
    const eventMonitoring = this.eventMonitoring.get(eventName);
    
    if (active) {
      // Add socket as subscriber
      eventMonitoring.subscribers.add(socket.id);
      eventMonitoring.active = true;
      
      // Add to socket's monitoring list
      const socketDebug = this.debugSockets.get(socket.id);
      if (socketDebug && !socketDebug.monitoringEvents.includes(eventName)) {
        socketDebug.monitoringEvents.push(eventName);
      }
      
      socket.emit(EVENT_NAMES.DEBUG_MONITOR_EVENT_STARTED, {
        eventName,
        subscribers: eventMonitoring.subscribers.size
      });
      
      logger.debug(`Socket ${socket.id} started monitoring event ${eventName}`);
    } else {
      // Remove socket as subscriber
      eventMonitoring.subscribers.delete(socket.id);
      
      // If no subscribers left, mark as inactive
      if (eventMonitoring.subscribers.size === 0) {
        eventMonitoring.active = false;
      }
      
      // Remove from socket's monitoring list
      const socketDebug = this.debugSockets.get(socket.id);
      if (socketDebug) {
        socketDebug.monitoringEvents = socketDebug.monitoringEvents.filter(e => e !== eventName);
      }
      
      socket.emit(EVENT_NAMES.DEBUG_MONITOR_EVENT_STOPPED, {
        eventName,
        subscribers: eventMonitoring.subscribers.size
      });
      
      logger.debug(`Socket ${socket.id} stopped monitoring event ${eventName}`);
    }
  }

  /**
   * Track event emission for debugging
   * @param {String} eventName - Event name
   * @param {String} roomName - Room name
   * @param {Object} data - Event data
   */
  trackEventEmission(eventName, roomName, data) {
    // Skip if not in debug mode
    if (!this.isDebugMode) return;
    
    // Skip if no one is monitoring this event
    const eventMonitoring = this.eventMonitoring.get(eventName);
    const roomMonitoring = this.roomMonitoring.get(roomName);
    
    if ((!eventMonitoring || !eventMonitoring.active) && 
        (!roomMonitoring || !roomMonitoring.active)) {
      return;
    }
    
    const eventInfo = {
      eventName,
      roomName,
      timestamp: Date.now(),
      dataSnapshot: this.sanitizeData(data)
    };
    
    // Store event occurrence
    if (eventMonitoring && eventMonitoring.active) {
      eventMonitoring.occurrences.push(eventInfo);
      
      // Limit stored occurrences
      if (eventMonitoring.occurrences.length > 100) {
        eventMonitoring.occurrences.shift();
      }
      
      // Notify subscribers
      for (const socketId of eventMonitoring.subscribers) {
        this.io.to(socketId).emit(EVENT_NAMES.DEBUG_EVENT_OCCURRED, eventInfo);
      }
    }
    
    // Store event for room monitoring
    if (roomMonitoring && roomMonitoring.active) {
      roomMonitoring.events.push(eventInfo);
      
      // Limit stored events
      if (roomMonitoring.events.length > 100) {
        roomMonitoring.events.shift();
      }
      
      // Notify subscribers
      for (const socketId of roomMonitoring.subscribers) {
        this.io.to(socketId).emit(EVENT_NAMES.DEBUG_ROOM_EVENT, eventInfo);
      }
    }
  }

  /**
   * Sanitize data for debugging (remove sensitive information)
   * @private
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized data
   */
  sanitizeData(data) {
    if (!data) return null;
    
    // Create a deep copy
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'credential'];
    
    const sanitizeObject = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      for (const key of Object.keys(obj)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      }
    };
    
    sanitizeObject(sanitized);
    return sanitized;
  }

  /**
   * Handle get socket info request
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Request data
   */
  handleGetSocketInfo(socket, data) {
    const { socketId = socket.id } = data;
    
    // Only allow admins to get info about other sockets
    if (socketId !== socket.id && !socket.data.isAdmin) {
      socket.emit(EVENT_NAMES.DEBUG_ERROR, {
        message: 'Not authorized to view other socket info',
        code: 'NOT_AUTHORIZED'
      });
      return;
    }
    
    // Get socket debug info
    const socketInfo = this.debugSockets.get(socketId);
    if (!socketInfo) {
      socket.emit(EVENT_NAMES.DEBUG_ERROR, {
        message: 'Socket not found or not in debug mode',
        code: 'SOCKET_NOT_FOUND'
      });
      return;
    }
    
    // Get socket rooms
    const socketRooms = Array.from(this.io.sockets.adapter.sids.get(socketId) || [])
      .filter(room => room !== socketId); // Filter out the default room
    
    // Send socket info
    socket.emit(EVENT_NAMES.DEBUG_SOCKET_INFO, {
      ...socketInfo,
      rooms: socketRooms,
      uptime: Date.now() - socketInfo.startTime,
      isConnected: this.io.sockets.sockets.has(socketId)
    });
    
    logger.debug(`Socket info for ${socketId} sent to ${socket.id}`);
  }

  /**
   * Handle get room info request
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Request data
   */
  handleGetRoomInfo(socket, data) {
    const { roomName } = data;
    
    // Validate room name
    if (!roomName) {
      socket.emit(EVENT_NAMES.DEBUG_ERROR, {
        message: 'Room name is required',
        code: 'INVALID_ROOM'
      });
      return;
    }
    
    // Get sockets in room
    const socketsInRoom = this.io.sockets.adapter.rooms.get(roomName);
    if (!socketsInRoom) {
      socket.emit(EVENT_NAMES.DEBUG_ERROR, {
        message: 'Room not found',
        code: 'ROOM_NOT_FOUND'
      });
      return;
    }
    
    // Get room monitoring info
    const roomMonitoring = this.roomMonitoring.get(roomName) || {
      active: false,
      subscribers: new Set(),
      events: []
    };
    
    // Get socket info for sockets in room
    const socketInfos = [];
    for (const socketId of socketsInRoom) {
      const socketInfo = this.debugSockets.get(socketId);
      if (socketInfo) {
        socketInfos.push({
          id: socketInfo.id,
          userId: socketInfo.userId,
          deviceId: socketInfo.deviceId,
          sessionId: socketInfo.sessionId,
          tabId: socketInfo.tabId
        });
      }
    }
    
    // Send room info
    socket.emit(EVENT_NAMES.DEBUG_ROOM_INFO, {
      roomName,
      socketCount: socketsInRoom.size,
      sockets: socketInfos,
      monitoring: {
        active: roomMonitoring.active,
        subscriberCount: roomMonitoring.subscribers.size,
        recentEvents: roomMonitoring.events.slice(-10) // Last 10 events
      }
    });
    
    logger.debug(`Room info for ${roomName} sent to ${socket.id}`);
  }
}

module.exports = WebSocketDebugService;
