/**
 * Event Propagation Service
 * Manages event propagation through the room hierarchy
 */
const logger = require('../../../utils/logger');
const roomRegistryService = require('./room-registry.service');

class EventPropagationService {
  constructor(io) {
    this.io = io;
    this.eventHandlers = new Map();
    this.propagationRules = new Map();
  }

  /**
   * Initialize the event propagation service
   * @param {Object} io - Socket.IO server instance
   */
  initialize(io, config = null) {
    this.io = io;
    
    // Load configuration if provided
    if (config) {
      this.loadEventRules(config);
    }
    
    logger.info('Event Propagation Service initialized');
    return this;
  }

  /**
   * Register an event handler
   * @param {String} eventName - Event name
   * @param {Function} handler - Event handler function
   * @param {Object} options - Handler options
   */
  registerEventHandler(eventName, handler, options = {}) {
    this.eventHandlers.set(eventName, { handler, options });
    logger.debug(`Event handler registered: ${eventName}`);
  }

  /**
   * Register a propagation rule for an event
   * @param {String} eventName - Event name
   * @param {Object} rule - Propagation rule
   */
  registerPropagationRule(eventName, rule) {
    this.propagationRules.set(eventName, rule);
    logger.debug(`Propagation rule registered: ${eventName}`);
  }

  /**
   * Emit event to a room
   * @param {String} roomName - Room name
   * @param {String} eventName - Event name
   * @param {Object} data - Event data
   */
  emitToRoom(roomName, eventName, data) {
    if (!this.io) {
      logger.error('Socket.IO not initialized');
      return false;
    }
    
    this.io.to(roomName).emit(eventName, data);
    
    // Store event in room history if needed
    roomRegistryService.storeRoomEvent(roomName, eventName, data);
    
    return true;
  }

  /**
   * Apply event propagation rules based on room type and event type
   * @param {String} roomName - Room name
   * @param {String} eventName - Event name
   * @param {Object} data - Event data
   * @param {Object} options - Propagation options
   * @returns {Object} Modified propagation options
   */
  async applyPropagationRules(roomName, eventName, data, options) {
    // Get room type (user, device, session, tab)
    const roomType = roomName.split(':')[0];
    
    // Get propagation rule for this event
    const rule = this.propagationRules.get(eventName);
    
    if (!rule) return options;
    
    // Apply rule based on room type
    const modifiedOptions = { ...options };
    
    // Apply direction rules
    if (rule.roomTypeRules && rule.roomTypeRules[roomType]) {
      const roomTypeRule = rule.roomTypeRules[roomType];
      
      if (roomTypeRule.direction) {
        modifiedOptions.direction = roomTypeRule.direction;
      }
      
      if (roomTypeRule.depth !== undefined) {
        modifiedOptions.depth = roomTypeRule.depth;
      }
      
      if (roomTypeRule.persist !== undefined) {
        modifiedOptions.persist = roomTypeRule.persist;
      }
    }
    
    return modifiedOptions;
  }

  /**
   * Emit event with propagation through the room hierarchy
   * @param {String} roomName - Target room name
   * @param {String} eventName - Event name
   * @param {Object} data - Event data
   * @param {Object} options - Propagation options
   */
  async emitWithPropagation(roomName, eventName, data, options = {}) {
    try {
      const {
        direction = 'down',
        depth = 1,
        persist = false,
        skipRooms = []
      } = options;
      
      // Get propagation rule for this event if exists
      const rule = this.propagationRules.get(eventName);
      
      // Apply rule if exists
      let propagationOptions = rule ? { ...options, ...rule } : options;
      
      // Apply room-specific rules
      propagationOptions = await this.applyPropagationRules(
        roomName, 
        eventName, 
        data, 
        propagationOptions
      );
      
      // Check if this room should receive this event
      const shouldReceive = await this.shouldReceiveEvent(roomName, eventName);
      if (!shouldReceive) {
        logger.debug(`Room ${roomName} skipped for event ${eventName} based on rules`);
        return false;
      }
      
      // Emit to the target room
      this.emitToRoom(roomName, eventName, data);
      
      // Store event if persistence is enabled
      if (propagationOptions.persist) {
        await roomRegistryService.storeRoomEvent(roomName, eventName, data);
      }
      
      // Handle propagation based on direction
      if (propagationOptions.direction === 'up' || propagationOptions.direction === 'both') {
        await this.propagateUp(roomName, eventName, data, propagationOptions.depth, skipRooms);
      }
      
      if (propagationOptions.direction === 'down' || propagationOptions.direction === 'both') {
        await this.propagateDown(roomName, eventName, data, propagationOptions.depth, skipRooms);
      }
      
      return true;
    } catch (error) {
      logger.error(`Error emitting event ${eventName} to room ${roomName}:`, error);
      return false;
    }
  }

  /**
   * Propagate event up the room hierarchy
   * @param {String} roomName - Starting room name
   * @param {String} eventName - Event name
   * @param {Object} data - Event data
   * @param {Number} depth - Maximum propagation depth
   * @param {Array} skipRooms - Rooms to skip
   */
  async propagateUp(roomName, eventName, data, depth = 1, skipRooms = []) {
    if (depth <= 0 || skipRooms.includes(roomName)) return;
    
    try {
      // Get parent room
      const parent = await roomRegistryService.getParentRoom(roomName);
      
      if (parent && !skipRooms.includes(parent)) {
        // Emit to parent with propagation metadata
        this.emitToRoom(parent, eventName, {
          ...data,
          _propagation: { direction: 'up', sourceRoom: roomName }
        });
        
        // Continue propagation
        if (depth > 1) {
          await this.propagateUp(parent, eventName, data, depth - 1, [...skipRooms, roomName]);
        }
      }
    } catch (error) {
      logger.error(`Error propagating event up from ${roomName}:`, error);
    }
  }

  /**
   * Propagate event down the room hierarchy
   * @param {String} roomName - Starting room name
   * @param {String} eventName - Event name
   * @param {Object} data - Event data
   * @param {Number} depth - Maximum propagation depth
   * @param {Array} skipRooms - Rooms to skip
   */
  async propagateDown(roomName, eventName, data, depth = 1, skipRooms = []) {
    if (depth <= 0 || skipRooms.includes(roomName)) return;
    
    try {
      // Get child rooms
      const children = await roomRegistryService.getChildRooms(roomName);
      
      for (const childRoom of children) {
        if (!skipRooms.includes(childRoom)) {
          // Emit to child with propagation metadata
          this.emitToRoom(childRoom, eventName, {
            ...data,
            _propagation: { direction: 'down', sourceRoom: roomName }
          });
          
          // Continue propagation
          if (depth > 1) {
            await this.propagateDown(childRoom, eventName, data, depth - 1, [...skipRooms, roomName]);
          }
        }
      }
    } catch (error) {
      logger.error(`Error propagating event down from ${roomName}:`, error);
    }
  }

  /**
   * Process an event based on registered handlers with authentication check
   * @param {String} eventName - Event name
   * @param {Object} data - Event data
   * @param {Object} context - Event context including socket and user info
   */
  async processEvent(eventName, data, context = {}) {
    const handlerInfo = this.eventHandlers.get(eventName);
    
    if (!handlerInfo) {
      logger.debug(`No handler registered for event: ${eventName}`);
      return false;
    }
    
    try {
      const { handler, options } = handlerInfo;
      
      // Check authentication if required
      if (options.requireAuth && (!context.user || !context.user.id)) {
        logger.warn(`Authentication required for event ${eventName} but user not authenticated`);
        return false;
      }
      
      // Check permissions if specified
      if (options.requiredPermissions && options.requiredPermissions.length > 0) {
        const hasPermission = context.user && 
          options.requiredPermissions.every(perm => 
            context.user.permissions && context.user.permissions.includes(perm)
          );
        
        if (!hasPermission) {
          logger.warn(`Permission denied for event ${eventName}`);
          return false;
        }
      }
      
      // Apply handler with context
      await handler(data, {
        ...context,
        io: this.io,
        emitToRoom: this.emitToRoom.bind(this),
        emitWithPropagation: this.emitWithPropagation.bind(this)
      });
      
      return true;
    } catch (error) {
      logger.error(`Error processing event ${eventName}:`, error);
      return false;
    }
  }

  /**
   * Load event propagation rules from configuration
   * @param {Object} config - Configuration object containing event rules
   */
  loadEventRules(config) {
    if (!config || !config.events) {
      logger.warn('No event propagation rules found in configuration');
      return;
    }
    
    // Clear existing rules
    this.propagationRules.clear();
    
    // Load rules from config
    Object.entries(config.events).forEach(([eventName, rule]) => {
      this.registerPropagationRule(eventName, rule);
    });
    
    logger.info(`Loaded ${Object.keys(config.events).length} event propagation rules`);
  }

  /**
   * Get room hierarchy path for a room
   * @param {String} roomName - Room name
   * @returns {Promise<Array>} - Array of room names in hierarchy path
   */
  async getRoomHierarchyPath(roomName) {
    const path = [roomName];
    let currentRoom = roomName;
    
    try {
      while (true) {
        const parent = await roomRegistryService.getParentRoom(currentRoom);
        if (!parent) break;
        
        path.unshift(parent);
        currentRoom = parent;
      }
      
      return path;
    } catch (error) {
      logger.error(`Error getting room hierarchy path for ${roomName}:`, error);
      return path;
    }
  }

  /**
   * Check if a room should receive an event based on room type and event type
   * @param {String} roomName - Room name
   * @param {String} eventName - Event name
   * @returns {Promise<Boolean>} - Whether the room should receive the event
   */
  async shouldReceiveEvent(roomName, eventName) {
    // Get room type (user, device, session, tab)
    const roomType = roomName.split(':')[0];
    
    // Get propagation rule for this event
    const rule = this.propagationRules.get(eventName);
    
    if (!rule) return true; // Default to true if no rule exists
    
    // Check if this room type is in the target rooms for this event
    if (rule.targetRooms && !rule.targetRooms.includes(roomType)) {
      return false;
    }
    
    return true;
  }
}

// Export singleton instance
const eventPropagationService = new EventPropagationService();
module.exports = eventPropagationService;
