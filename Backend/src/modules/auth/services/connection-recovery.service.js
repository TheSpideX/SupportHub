/**
 * Connection Recovery Service
 * 
 * Handles reconnection logic and state recovery for WebSocket connections
 * Provides robust mechanisms to handle network interruptions and browser tab changes
 */

const { redisClient } = require('../../../config/redis');
const logger = require('../../../utils/logger');
const config = require('../config');
const { roomRegistry } = config;
const socketConfig = config.websocket;

class ConnectionRecoveryService {
  constructor(io, sessionService, tokenService) {
    this.io = io;
    this.sessionService = sessionService;
    this.tokenService = tokenService;
    this.recoveryRegistry = new Map(); // Map of recovery tokens to connection data
    this.recoveryTimeout = socketConfig.connection.reconnection.recoveryTimeout || 60000; // 1 minute default
    this.maxRecoveryAttempts = socketConfig.connection.reconnection.maxRecoveryAttempts || 5;
    
    // Initialize Redis for distributed recovery
    this.redisPrefix = 'socket:recovery:';
    this.redisExpiry = Math.floor(this.recoveryTimeout / 1000) + 10; // Add 10s buffer
    
    logger.info('Connection recovery service initialized');
  }
  
  /**
   * Generate recovery token for a socket
   * @param {Object} socket - Socket.IO socket
   * @returns {Promise<string>} Recovery token
   */
  async generateRecoveryToken(socket) {
    try {
      if (!socket || !socket.data || !socket.data.userId) {
        logger.warn('Cannot generate recovery token for unauthenticated socket');
        return null;
      }
      
      // Generate a unique recovery token
      const crypto = require('crypto');
      const recoveryToken = crypto.randomBytes(16).toString('hex');
      
      // Store connection data
      const connectionData = {
        userId: socket.data.userId,
        sessionId: socket.data.sessionId,
        deviceId: socket.data.deviceId,
        tabId: socket.data.tabId,
        rooms: Array.from(socket.rooms || []),
        isLeader: !!socket.data.isLeader,
        timestamp: Date.now(),
        socketId: socket.id,
        attempts: 0
      };
      
      // Store in local registry
      this.recoveryRegistry.set(recoveryToken, connectionData);
      
      // Store in Redis for distributed recovery
      await redisClient.set(
        `${this.redisPrefix}${recoveryToken}`,
        JSON.stringify(connectionData),
        'EX',
        this.redisExpiry
      );
      
      // Set expiry for local registry
      setTimeout(() => {
        this.recoveryRegistry.delete(recoveryToken);
      }, this.recoveryTimeout);
      
      logger.debug(`Recovery token generated for socket ${socket.id}: ${recoveryToken}`);
      return recoveryToken;
    } catch (error) {
      logger.error('Failed to generate recovery token:', error);
      return null;
    }
  }
  
  /**
   * Handle socket reconnection with recovery token
   * @param {Object} socket - New Socket.IO socket
   * @param {string} recoveryToken - Recovery token from previous connection
   * @returns {Promise<boolean>} Success status
   */
  async handleReconnection(socket, recoveryToken) {
    try {
      // Get connection data from local registry or Redis
      let connectionData = this.recoveryRegistry.get(recoveryToken);
      
      if (!connectionData) {
        // Try to get from Redis
        const redisData = await redisClient.get(`${this.redisPrefix}${recoveryToken}`);
        if (redisData) {
          connectionData = JSON.parse(redisData);
        } else {
          logger.warn(`Recovery token not found: ${recoveryToken}`);
          return false;
        }
      }
      
      // Check if max attempts exceeded
      connectionData.attempts = (connectionData.attempts || 0) + 1;
      if (connectionData.attempts > this.maxRecoveryAttempts) {
        logger.warn(`Max recovery attempts exceeded for token: ${recoveryToken}`);
        return false;
      }
      
      // Update connection data
      await redisClient.set(
        `${this.redisPrefix}${recoveryToken}`,
        JSON.stringify(connectionData),
        'EX',
        this.redisExpiry
      );
      
      // Restore socket data
      socket.data = {
        ...socket.data,
        userId: connectionData.userId,
        sessionId: connectionData.sessionId,
        deviceId: connectionData.deviceId,
        tabId: connectionData.tabId,
        isLeader: connectionData.isLeader,
        recoveredAt: Date.now(),
        recoveredFrom: connectionData.socketId,
        recoveryToken
      };
      
      // Join rooms
      for (const room of connectionData.rooms) {
        if (room !== socket.id && room !== connectionData.socketId) {
          await socket.join(room);
        }
      }
      
      // Update session activity
      await this.sessionService.updateSessionActivity(connectionData.sessionId);
      
      // Notify about successful recovery
      socket.emit('connection:recovered', {
        recoveryToken,
        timestamp: Date.now(),
        previousSocketId: connectionData.socketId,
        recoveredRooms: connectionData.rooms
      });
      
      // Broadcast recovery to user's rooms
      socket.to(`user:${connectionData.userId}`).emit('connection:peer-recovered', {
        socketId: socket.id,
        previousSocketId: connectionData.socketId,
        tabId: connectionData.tabId,
        deviceId: connectionData.deviceId,
        timestamp: Date.now()
      });
      
      // If this was a leader, handle leadership recovery
      if (connectionData.isLeader) {
        this.handleLeadershipRecovery(socket, connectionData);
      }
      
      logger.info(`Socket ${socket.id} successfully recovered from ${connectionData.socketId}`);
      return true;
    } catch (error) {
      logger.error('Failed to handle reconnection:', error);
      return false;
    }
  }
  
  /**
   * Handle leadership recovery
   * @param {Object} socket - Socket.IO socket
   * @param {Object} connectionData - Previous connection data
   */
  async handleLeadershipRecovery(socket, connectionData) {
    try {
      // Emit leadership recovery event
      socket.to(`user:${connectionData.userId}`).emit('leader:recovered', {
        leaderId: connectionData.tabId,
        socketId: socket.id,
        timestamp: Date.now()
      });
      
      // Set up heartbeat for leader
      if (socket.data.heartbeatInterval) {
        clearInterval(socket.data.heartbeatInterval);
      }
      
      socket.data.heartbeatInterval = setInterval(() => {
        this.sendLeaderHeartbeat(socket);
      }, socketConfig.crossTab.leaderElection.heartbeatInterval);
      
      logger.debug(`Leadership recovered for user ${connectionData.userId}, tab ${connectionData.tabId}`);
    } catch (error) {
      logger.error('Failed to handle leadership recovery:', error);
    }
  }
  
  /**
   * Send leader heartbeat
   * @param {Object} socket - Socket.IO socket
   */
  sendLeaderHeartbeat(socket) {
    try {
      const { userId, tabId } = socket.data;
      
      // Send heartbeat to all tabs
      socket.to(`user:${userId}`).emit('leader:heartbeat', {
        leaderId: tabId,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Failed to send leader heartbeat:', error);
    }
  }
  
  /**
   * Handle socket disconnection
   * @param {Object} socket - Socket.IO socket
   * @param {string} reason - Disconnection reason
   */
  async handleDisconnection(socket, reason) {
    try {
      // Skip if socket is not authenticated
      if (!socket.data || !socket.data.userId) {
        return;
      }
      
      // Generate recovery token if disconnection is recoverable
      if (this.isRecoverableDisconnection(reason)) {
        const recoveryToken = await this.generateRecoveryToken(socket);
        
        // Notify other tabs about disconnection with recovery token
        if (recoveryToken) {
          socket.to(`user:${socket.data.userId}`).emit('connection:peer-disconnected', {
            socketId: socket.id,
            tabId: socket.data.tabId,
            deviceId: socket.data.deviceId,
            recoveryToken,
            reason,
            recoverable: true,
            timestamp: Date.now()
          });
        }
      } else {
        // Non-recoverable disconnection
        socket.to(`user:${socket.data.userId}`).emit('connection:peer-disconnected', {
          socketId: socket.id,
          tabId: socket.data.tabId,
          deviceId: socket.data.deviceId,
          reason,
          recoverable: false,
          timestamp: Date.now()
        });
      }
      
      // If this was a leader, notify about leadership loss
      if (socket.data.isLeader) {
        socket.to(`user:${socket.data.userId}`).emit('leader:disconnected', {
          leaderId: socket.data.tabId,
          socketId: socket.id,
          reason,
          timestamp: Date.now()
        });
      }
      
      logger.debug(`Socket ${socket.id} disconnected: ${reason}`);
    } catch (error) {
      logger.error('Failed to handle disconnection:', error);
    }
  }
  
  /**
   * Check if disconnection reason is recoverable
   * @param {string} reason - Disconnection reason
   * @returns {boolean} Whether disconnection is recoverable
   */
  isRecoverableDisconnection(reason) {
    const recoverableReasons = [
      'transport close',
      'transport error',
      'ping timeout',
      'client namespace disconnect',
      'server namespace disconnect'
    ];
    
    return recoverableReasons.includes(reason);
  }
  
  /**
   * Clean up expired recovery tokens
   */
  async cleanupExpiredTokens() {
    try {
      // Local cleanup is handled by setTimeout when creating tokens
      
      // Redis cleanup (not strictly necessary due to TTL, but good for monitoring)
      const keys = await redisClient.keys(`${this.redisPrefix}*`);
      let expiredCount = 0;
      
      for (const key of keys) {
        const data = await redisClient.get(key);
        if (data) {
          const connectionData = JSON.parse(data);
          const age = Date.now() - connectionData.timestamp;
          
          if (age > this.recoveryTimeout) {
            await redisClient.del(key);
            expiredCount++;
          }
        }
      }
      
      if (expiredCount > 0) {
        logger.debug(`Cleaned up ${expiredCount} expired recovery tokens`);
      }
    } catch (error) {
      logger.error('Failed to clean up expired recovery tokens:', error);
    }
  }
}

module.exports = ConnectionRecoveryService;
