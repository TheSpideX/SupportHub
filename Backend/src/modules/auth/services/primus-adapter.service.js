/**
 * Primus Adapter Service
 * Provides compatibility layer between Primus and the existing Socket.IO-based code
 */

const logger = require('../../../utils/logger');
const primusService = require('../../../services/primus.service');
const sessionService = require('./session.service');
const tokenService = require('./token.service');

// Define event names
const EVENT_NAMES = {
  TOKEN_UPDATED: 'auth:token:updated',
  TOKEN_INVALIDATED: 'auth:token:invalidated',
  TOKEN_ERROR: 'auth:token:error',
  LEADER_TRANSFER: 'auth:leader:transfer'
};

class PrimusAdapterService {
  constructor() {
    this.primus = null;
    this.services = {};
  }

  /**
   * Setup Primus event handlers
   * @param {Object} primus - Primus server instance
   * @param {Object} services - Services to use for handling events
   */
  setupSocketHandlers(primus, services = {}) {
    // Store services for later use
    this.services = services;
    
    // Store Primus instance
    this.primus = primus;
    
    // Set up connection handler
    if (primus) {
      logger.info('Setting up Primus event handlers');
      
      // Primus already has connection handlers set up in the primus.service.js
      // This is just an adapter to maintain compatibility with the existing code
    }
    
    logger.info('Primus event handlers initialized');
    return primus;
  }

  /**
   * Emit event to a room
   * @param {string} roomName - Room name
   * @param {string} eventName - Event name
   * @param {Object} data - Event data
   */
  emitToRoom(roomName, eventName, data) {
    if (!this.primus) {
      logger.error('Primus not initialized');
      return false;
    }
    
    primusService.broadcastToRoom(roomName, eventName, data);
    logger.debug(`Emitted ${eventName} to ${roomName}`);
    return true;
  }

  /**
   * Get the Primus instance
   * @returns {Object} Primus instance
   */
  getPrimus() {
    return this.primus;
  }
}

// Export singleton instance
const primusAdapterService = new PrimusAdapterService();
module.exports = primusAdapterService;
