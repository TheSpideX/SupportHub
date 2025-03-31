/**
 * Token and Tab Synchronization Service
 * Handles synchronization of tokens across devices and tabs
 * and coordinates multiple tabs of the same user
 */
const logger = require('../../../utils/logger');
const socketConfig = require('../config/websocket.config');
const { EVENT_NAMES } = require('../constants/event-names.constant');
const socketService = require('./socket.service');

class TokenSyncService {
  constructor(io, tokenService) {
    this.io = io;
    this.tokenService = tokenService;
    this.leaderRegistry = new Map(); // userId -> {leaderId, lastHeartbeat, version}
    this.sharedStateRegistry = new Map(); // userId -> {stateData, version}
    this.heartbeatInterval = null;
    
    // Token sync configuration
    this.syncConfig = {
      enableCrossTabs: true,
      enableCrossDevices: true,
      syncInterval: 5 * 60 * 1000, // 5 minutes
      notifyOnRefresh: true
    };
    
    // Cross-tab coordination configuration
    this.crossTabConfig = socketConfig.crossTab || {
      leaderElection: {
        heartbeatInterval: 5000,
        missedHeartbeatsThreshold: 3,
        candidateDelay: 2000,
        leaderPriority: {
          visible: 100,
          hidden: 50
        }
      },
      connectionSharing: {
        enabled: true,
        maxSharedConnections: 5
      },
      stateSync: {
        syncInterval: 10000,
        autoSync: true
      }
    };
    
    logger.info('Token sync and cross-tab coordination service initialized');
  }

  /**
   * Initialize the service
   */
  initialize() {
    // Start heartbeat monitoring for leader election
    this.heartbeatInterval = setInterval(() => {
      this.monitorLeaderHeartbeats();
    }, this.crossTabConfig.leaderElection.heartbeatInterval);
    
    logger.info('Cross-Tab Coordinator initialized');
  }

  /**
   * Initialize token synchronization for a socket
   * @param {Object} socket - Socket.IO socket
   */
  initializeTokenSync(socket) {
    // Set up token sync event handlers
    socket.on(EVENT_NAMES.TOKEN_REFRESH, (data) => this.handleTokenRefresh(socket, data));
    socket.on(EVENT_NAMES.TOKEN_INVALIDATE, (data) => this.handleTokenInvalidate(socket, data));
    socket.on(EVENT_NAMES.TOKEN_SYNC_REQUEST, () => this.handleTokenSyncRequest(socket));
    
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

  /**
   * Register socket for leader election
   * @param {Object} socket - Socket.IO socket
   */
  registerSocket(socket) {
    if (!socket.data || !socket.data.userId) return;
    
    const { userId, tabId } = socket.data;
    
    // Set up leader election handlers
    socket.on(EVENT_NAMES.LEADER_HEARTBEAT, (data) => this.handleHeartbeat(socket, data));
    socket.on(EVENT_NAMES.LEADER_ELECTION, (data) => this.handleElection(socket, data));
    socket.on(EVENT_NAMES.LEADER_TRANSFER, (data) => this.handleLeaderTransfer(socket, data));
    
    // Initialize leader election
    this.initiateLeaderElection(socket);
  }

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
          message: 'No refresh token provided',
          code: 'MISSING_REFRESH_TOKEN'
        });
        return;
      }
      
      // Refresh token
      const result = await this.tokenService.refreshAccessToken(refreshToken);
      
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
      
      // Notify other tabs on same device
      if (this.syncConfig.enableCrossTabs && deviceId) {
        const deviceRoom = socketService.createRoomName('device', deviceId);
        socket.to(deviceRoom).emit(EVENT_NAMES.TOKEN_UPDATED, {
          token,
          refreshToken: newRefreshToken,
          updatedAt: Date.now(),
          source: tabId || socket.id
        });
      }
      
      // Notify other devices if cross-device sync is enabled
      if (this.syncConfig.enableCrossDevices) {
        const userRoom = socketService.createRoomName('user', userId);
        const deviceRoom = socketService.createRoomName('device', deviceId);
        
        // Send notification to other devices (without tokens)
        this.io.to(userRoom).except(deviceRoom).emit(EVENT_NAMES.TOKEN_REFRESH_NOTIFICATION, {
          deviceId: deviceId,
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
  }

  /**
   * Handle token invalidation event
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Invalidation data
   */
  async handleTokenInvalidate(socket, data) {
    try {
      const { reason = 'user_request', allDevices = false } = data;
      const { userId, deviceId } = socket.data;
      
      if (!userId) {
        socket.emit(EVENT_NAMES.TOKEN_ERROR, {
          message: 'Unauthorized',
          code: 'UNAUTHORIZED'
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
        // Invalidate tokens across all devices using consistent room naming
        const userRoom = socketService.createRoomName('user', userId);
        this.io.to(userRoom).emit(EVENT_NAMES.TOKEN_INVALIDATED, {
          reason,
          timestamp: Date.now(),
          source: socket.id
        });
      } else if (deviceId && this.syncConfig.enableCrossTabs) {
        // Invalidate tokens on current device only using consistent room naming
        const deviceRoom = socketService.createRoomName('device', deviceId);
        socket.to(deviceRoom).emit(EVENT_NAMES.TOKEN_INVALIDATED, {
          reason,
          timestamp: Date.now(),
          source: socket.id
        });
      }
      
      logger.debug(`Tokens invalidated for user ${userId}, reason: ${reason}`);
    } catch (error) {
      logger.error(`Error handling token invalidation:`, error);
      socket.emit(EVENT_NAMES.TOKEN_ERROR, {
        message: 'Error invalidating tokens',
        code: 'INVALIDATION_ERROR'
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
          message: 'Unauthorized',
          code: 'UNAUTHORIZED'
        });
        return;
      }
      
      // Get current tokens
      const tokens = await this.tokenService.getCurrentTokens(userId, deviceId);
      
      if (tokens) {
        socket.emit(EVENT_NAMES.TOKEN_UPDATED, {
          ...tokens,
          updatedAt: Date.now()
        });
      }
    } catch (error) {
      logger.error(`Error handling token sync request:`, error);
      socket.emit(EVENT_NAMES.TOKEN_ERROR, {
        message: 'Error syncing tokens',
        code: 'SYNC_ERROR'
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
    
    // Initialize vector clock for this tab
    socket.data.vectorClock = {
      [tabId]: Date.now(),
      timestamp: Date.now()
    };
    
    // Check if a leader exists and is active
    const leaderInfo = this.leaderRegistry.get(userId);
    
    if (!leaderInfo || Date.now() - leaderInfo.lastHeartbeat > 
        this.crossTabConfig.leaderElection.heartbeatInterval * this.crossTabConfig.leaderElection.missedHeartbeatsThreshold) {
      // No active leader, become leader
      this.electAsLeader(socket, priority);
    } else {
      // Leader exists, send election request with vector clock
      socket.to(`user:${userId}`).emit(EVENT_NAMES.LEADER_ELECTION, {
        candidateId: tabId,
        priority,
        vectorClock: socket.data.vectorClock,
        timestamp: Date.now()
      });
      
      // Set timeout to become leader if no response
      setTimeout(() => {
        const currentLeaderInfo = this.leaderRegistry.get(userId);
        // Only become leader if no leader exists or if the leader hasn't changed
        if (!currentLeaderInfo || 
            (leaderInfo && currentLeaderInfo.leaderId === leaderInfo.leaderId && 
             Date.now() - currentLeaderInfo.lastHeartbeat > 
             this.crossTabConfig.leaderElection.heartbeatInterval * this.crossTabConfig.leaderElection.missedHeartbeatsThreshold)) {
          this.electAsLeader(socket, priority);
        }
      }, this.crossTabConfig.leaderElection.candidateDelay);
    }
  }

  /**
   * Elect socket as leader with enhanced consensus
   * @param {Object} socket - Socket.IO socket
   * @param {number} priority - Tab priority
   */
  electAsLeader(socket, priority) {
    const { userId, tabId } = socket.data;
    
    // Update vector clock
    socket.data.vectorClock[tabId] = Date.now();
    
    this.leaderRegistry.set(userId, {
      leaderId: tabId,
      socketId: socket.id,
      lastHeartbeat: Date.now(),
      priority,
      vectorClock: socket.data.vectorClock,
      version: (this.leaderRegistry.get(userId)?.version || 0) + 1
    });
    
    // Mark socket as leader
    socket.data.isLeader = true;
    
    // Notify all tabs about new leader with vector clock
    socket.to(`user:${userId}`).emit(EVENT_NAMES.LEADER_ELECTED, {
      leaderId: tabId,
      version: this.leaderRegistry.get(userId).version,
      vectorClock: socket.data.vectorClock,
      timestamp: Date.now()
    });
    
    // Set up heartbeat
    if (socket.data.heartbeatInterval) {
      clearInterval(socket.data.heartbeatInterval);
    }
    
    socket.data.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat(socket);
    }, this.crossTabConfig.leaderElection.heartbeatInterval);
    
    // Initialize leader state
    if (!this.sharedStateRegistry.has(userId)) {
      this.sharedStateRegistry.set(userId, {
        stateData: {},
        version: 1,
        vectorClock: socket.data.vectorClock,
        updatedBy: tabId,
        updatedAt: Date.now()
      });
    }
    
    logger.debug(`Tab ${tabId} elected as leader for user ${userId} with version ${this.leaderRegistry.get(userId).version}`);
  }

  /**
   * Send leader heartbeat
   * @param {Object} socket - Socket.IO socket
   */
  sendHeartbeat(socket) {
    const { userId, tabId } = socket.data;
    const leaderInfo = this.leaderRegistry.get(userId);
    
    if (!leaderInfo || leaderInfo.leaderId !== tabId) {
      // No longer leader, clear interval
      clearInterval(socket.data.heartbeatInterval);
      socket.data.isLeader = false;
      return;
    }
    
    // Update heartbeat timestamp
    leaderInfo.lastHeartbeat = Date.now();
    this.leaderRegistry.set(userId, leaderInfo);
    
    // Send heartbeat to all tabs
    socket.to(`user:${userId}`).emit(EVENT_NAMES.LEADER_HEARTBEAT, {
      leaderId: tabId,
      version: leaderInfo.version,
      timestamp: Date.now()
    });
  }

  /**
   * Handle leader heartbeat
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Heartbeat data
   */
  handleHeartbeat(socket, data) {
    const { userId } = socket.data;
    const { leaderId, version, timestamp } = data;
    
    // Update leader registry
    this.leaderRegistry.set(userId, {
      leaderId,
      lastHeartbeat: Date.now(),
      version
    });
  }

  /**
   * Handle leader election request with enhanced consensus
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Election data
   */
  handleElection(socket, data) {
    const { userId, tabId } = socket.data;
    const priority = this.getTabPriority(socket);
    const { candidateId, candidatePriority, vectorClock, timestamp } = data;
    
    // Update local vector clock with candidate's information
    if (vectorClock && socket.data.vectorClock) {
      socket.data.vectorClock = this.mergeVectorClocks(socket.data.vectorClock, vectorClock);
      socket.data.vectorClock[tabId] = Date.now();
    }
    
    // If this socket is the leader, respond with current status
    if (socket.data.isLeader) {
      const leaderInfo = this.leaderRegistry.get(userId);
      
      socket.to(`tab:${candidateId}`).emit(EVENT_NAMES.LEADER_ELECTED, {
        leaderId: tabId,
        version: leaderInfo.version,
        vectorClock: socket.data.vectorClock || leaderInfo.vectorClock,
        timestamp: Date.now()
      });
      
      // Update leader's vector clock
      if (leaderInfo) {
        leaderInfo.vectorClock = socket.data.vectorClock;
        leaderInfo.lastHeartbeat = Date.now();
        this.leaderRegistry.set(userId, leaderInfo);
      }
    } 
    // If this socket has higher priority, contest the election
    else if (priority > candidatePriority) {
      socket.to(`user:${userId}`).emit(EVENT_NAMES.LEADER_ELECTION, {
        candidateId: tabId,
        priority,
        vectorClock: socket.data.vectorClock,
        timestamp: Date.now()
      });
    }
    // If same priority, use tab ID as tiebreaker
    else if (priority === candidatePriority && tabId > candidateId) {
      socket.to(`user:${userId}`).emit(EVENT_NAMES.LEADER_ELECTION, {
        candidateId: tabId,
        priority,
        vectorClock: socket.data.vectorClock,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle graceful leader transfer with state preservation
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Transfer data
   */
  handleLeaderTransfer(socket, data) {
    const { userId, tabId } = socket.data;
    const { newLeaderId, version, state, vectorClock } = data;
    
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
      vectorClock: vectorClock || leaderInfo.vectorClock
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
        transferredTo: newLeaderId
      });
    }
    
    // Clear leader status
    clearInterval(socket.data.heartbeatInterval);
    socket.data.isLeader = false;
    
    // Notify all tabs about new leader
    socket.to(`user:${userId}`).emit(EVENT_NAMES.LEADER_TRANSFERRED, {
      previousLeaderId: tabId,
      newLeaderId,
      version: version + 1,
      state,
      vectorClock: vectorClock || leaderInfo.vectorClock,
      timestamp: Date.now()
    });
    
    logger.debug(`Leader transferred from ${tabId} to ${newLeaderId} for user ${userId}`);
  }

  /**
   * Monitor leader heartbeats and trigger re-election if needed
   */
  monitorLeaderHeartbeats() {
    const now = Date.now();
    
    for (const [userId, leaderInfo] of this.leaderRegistry.entries()) {
      const { lastHeartbeat, leaderId } = leaderInfo;
      
      // Check if leader is inactive
      if (now - lastHeartbeat > 
          this.crossTabConfig.leaderElection.heartbeatInterval * this.crossTabConfig.leaderElection.missedHeartbeatsThreshold) {
        // Remove inactive leader
        this.leaderRegistry.delete(userId);
        
        // Notify all tabs about leader failure
        this.io.to(`user:${userId}`).emit(EVENT_NAMES.LEADER_FAILED, {
          previousLeaderId: leaderId,
          timestamp: now
        });
        
        logger.debug(`Leader ${leaderId} for user ${userId} failed, triggering re-election`);
      }
    }
  }

  /**
   * Get tab priority based on visibility state
   * @param {Object} socket - Socket.IO socket
   * @returns {number} Priority value
   */
  getTabPriority(socket) {
    const { visibilityState = 'hidden' } = socket.data;
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
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * Clean up when socket disconnects
   * @param {Object} socket - Socket.IO socket
   */
  handleDisconnect(socket) {
    const { userId, tabId, isLeader } = socket.data;
    
    if (isLeader) {
      // Clear heartbeat interval
      clearInterval(socket.data.heartbeatInterval);
      
      // Remove from leader registry
      this.leaderRegistry.delete(userId);
      
      // Trigger re-election
      socket.to(`user:${userId}`).emit(EVENT_NAMES.LEADER_FAILED, {
        previousLeaderId: tabId,
        timestamp: Date.now()
      });
      
      logger.debug(`Leader ${tabId} for user ${userId} disconnected, triggering re-election`);
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
    socket.on(EVENT_NAMES.CONNECTION_SHARE_REQUEST, (data) => this.handleConnectionShareRequest(socket, data));
    socket.on(EVENT_NAMES.CONNECTION_SHARE_RESPONSE, (data) => this.handleConnectionShareResponse(socket, data));
    
    // If this is a leader, it can accept connection sharing requests
    if (socket.data.isLeader) {
      socket.data.sharedConnections = [];
      socket.data.maxSharedConnections = this.crossTabConfig.connectionSharing.maxSharedConnections;
    }
    
    logger.debug(`Connection sharing initialized for tab ${tabId} of user ${userId}`);
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
      socket.to(`tab:${requesterId}`).emit(EVENT_NAMES.CONNECTION_SHARE_RESPONSE, {
        accepted: false,
        reason: 'Not a leader tab'
      });
      return;
    }
    
    // Check if max shared connections reached
    if (socket.data.sharedConnections.length >= socket.data.maxSharedConnections) {
      socket.to(`tab:${requesterId}`).emit(EVENT_NAMES.CONNECTION_SHARE_RESPONSE, {
        accepted: false,
        reason: 'Max shared connections reached'
      });
      return;
    }
    
    // Accept the request
    socket.data.sharedConnections.push({
      tabId: requesterId,
      resources,
      since: Date.now()
    });
    
    socket.to(`tab:${requesterId}`).emit(EVENT_NAMES.CONNECTION_SHARE_RESPONSE, {
      accepted: true,
      leaderId: tabId,
      timestamp: Date.now()
    });
    
    logger.debug(`Connection sharing accepted for tab ${requesterId} by leader ${tabId}`);
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
    socket.on(EVENT_NAMES.STATE_SYNC, (data) => this.handleStateSync(socket, data));
    socket.on(EVENT_NAMES.STATE_UPDATE, (data) => this.handleStateUpdate(socket, data));
    
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
        timestamp: Date.now()
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
      stateData: {}
    };
    
    // Check if update is newer using vector clocks
    const isNewer = this.isVectorClockNewer(vectorClock, stateInfo.vectorClock);
    
    // Handle conflict resolution if needed
    if (isNewer === null) {
      // Conflict detected, merge states
      const mergedState = this.mergeStates(stateInfo.stateData, state);
      const mergedVectorClock = this.mergeVectorClocks(stateInfo.vectorClock, vectorClock);
      
      this.sharedStateRegistry.set(userId, {
        stateData: mergedState,
        version: stateInfo.version + 1,
        vectorClock: mergedVectorClock,
        updatedBy: tabId,
        updatedAt: Date.now(),
        conflictResolved: true
      });
      
      // Broadcast merged state to all tabs on same device
      socket.to(`user:${userId}:device:${deviceId}`).emit(EVENT_NAMES.STATE_UPDATE, {
        state: mergedState,
        version: stateInfo.version + 1,
        vectorClock: mergedVectorClock,
        updatedBy: tabId,
        conflictResolved: true,
        timestamp: Date.now()
      });
      
      // Broadcast to other devices if requested
      if (syncAcrossDevices && this.syncConfig.enableCrossDevices) {
        const userRoom = socketService.createRoomName('user', userId);
        const deviceRoom = socketService.createRoomName('device', deviceId);
        
        this.io.to(userRoom).except(deviceRoom).emit(EVENT_NAMES.STATE_UPDATE, {
          state: mergedState,
          version: stateInfo.version + 1,
          vectorClock: mergedVectorClock,
          updatedBy: tabId,
          sourceDevice: deviceId,
          conflictResolved: true,
          timestamp: Date.now()
        });
      }
      
      logger.debug(`State conflict resolved for user ${userId}, new version ${stateInfo.version + 1}`);
    } 
    // Only update if version is newer
    else if (isNewer || version > stateInfo.version) {
      this.sharedStateRegistry.set(userId, {
        stateData: state,
        version: Math.max(version, stateInfo.version + 1),
        vectorClock: vectorClock || stateInfo.vectorClock,
        updatedBy: tabId,
        updatedAt: Date.now()
      });
      
      // Broadcast to all tabs on same device except sender
      socket.to(`user:${userId}:device:${deviceId}`).emit(EVENT_NAMES.STATE_UPDATE, {
        state,
        version: Math.max(version, stateInfo.version + 1),
        vectorClock: vectorClock || stateInfo.vectorClock,
        updatedBy: tabId,
        timestamp: Date.now()
      });
      
      // Broadcast to other devices if requested
      if (syncAcrossDevices && this.syncConfig.enableCrossDevices) {
        const userRoom = socketService.createRoomName('user', userId);
        const deviceRoom = socketService.createRoomName('device', deviceId);
        
        this.io.to(userRoom).except(deviceRoom).emit(EVENT_NAMES.STATE_UPDATE, {
          state,
          version: Math.max(version, stateInfo.version + 1),
          vectorClock: vectorClock || stateInfo.vectorClock,
          updatedBy: tabId,
          sourceDevice: deviceId,
          timestamp: Date.now()
        });
      }
      
      logger.debug(`State updated for user ${userId} by tab ${tabId}, version ${Math.max(version, stateInfo.version + 1)}`);
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
      this.io.to(`user:${userId}`).emit(EVENT_NAMES.STATE_SYNC, {
        state: stateInfo.stateData,
        version: stateInfo.version,
        timestamp: Date.now()
      });
      
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
      if (key === 'timestamp') continue;
      
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
      if (key === 'timestamp') {
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
        if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
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
    const { userId, tabId, isLeader } = socket.data;
    
    if (!isLeader) return;
    
    // Find best candidate for leadership transfer
    this.findLeadershipCandidate(userId, tabId).then(candidate => {
      if (candidate) {
        // Get current state
        const stateInfo = this.sharedStateRegistry.get(userId);
        const leaderInfo = this.leaderRegistry.get(userId);
        
        // Transfer leadership
        this.transferLeadership(socket, candidate.tabId, stateInfo?.stateData || {});
        
        logger.debug(`Prepared offline leadership transfer from ${tabId} to ${candidate.tabId}`);
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
      // Get all sockets for this user
      const userRoom = socketService.createRoomName('user', userId);
      const sockets = await this.io.in(userRoom).fetchSockets();
      
      // Filter out current leader and sort by priority
      const candidates = sockets
        .filter(s => s.data.tabId !== currentLeaderId)
        .map(s => ({
          tabId: s.data.tabId,
          socketId: s.id,
          priority: this.getTabPriority(s)
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
    const { userId, tabId } = socket.data;
    const { state } = data;
    
    // Update socket data
    socket.data.visibilityState = state;
    
    // Update priority
    const newPriority = this.getTabPriority(socket);
    
    // If this is the leader and visibility changed to hidden, consider transferring leadership
    if (socket.data.isLeader && state === 'hidden') {
      this.considerLeadershipTransfer(socket);
    }
    
    // Notify other tabs about visibility change
    socket.to(`user:${userId}`).emit(EVENT_NAMES.TAB_VISIBILITY_CHANGED, {
      tabId,
      state,
      priority: newPriority,
      timestamp: Date.now()
    });
    
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
      this.transferLeadership(socket, candidate.tabId, stateInfo?.stateData || {});
      
      logger.debug(`Leadership transferred from hidden tab ${tabId} to visible tab ${candidate.tabId}`);
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
      // Get all sockets for this user
      const userRoom = socketService.createRoomName('user', userId);
      const sockets = await this.io.in(userRoom).fetchSockets();
      
      // Filter for visible tabs and sort by priority
      const candidates = sockets
        .filter(s => s.data.tabId !== currentLeaderId && s.data.visibilityState === 'visible')
        .map(s => ({
          tabId: s.data.tabId,
          socketId: s.id,
          priority: this.getTabPriority(s)
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
      if (now - lastHeartbeat > 
          this.crossTabConfig.leaderElection.heartbeatInterval * this.crossTabConfig.leaderElection.missedHeartbeatsThreshold) {
        // Remove inactive leader
        this.leaderRegistry.delete(userId);
        
        // Notify all tabs about leader failure
        this.io.to(`user:${userId}`).emit(EVENT_NAMES.LEADER_FAILED, {
          previousLeaderId: leaderId,
          timestamp: now
        });
        
        logger.debug(`Leader ${leaderId} for user ${userId} failed, triggering re-election`);
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
    socket.on(EVENT_NAMES.DEVICE_STATE_SYNC_REQUEST, (data) => this.handleDeviceStateSyncRequest(socket, data));
    socket.on(EVENT_NAMES.DEVICE_STATE_UPDATE, (data) => this.handleDeviceStateUpdate(socket, data));
    
    // Join device-specific room for targeted updates
    const deviceRoom = socketService.createRoomName('device', deviceId);
    socket.join(deviceRoom);
    
    logger.debug(`Cross-device sync initialized for device ${deviceId} of user ${userId}`);
  }

  /**
   * Handle device state sync request
   * @param {Object} socket - Socket.IO socket
   * @param {Object} data - Request data
   */
  async handleDeviceStateSyncRequest(socket, data) {
    const { userId, deviceId } = socket.data;
    const { targetDeviceId, stateTypes = ['auth', 'preferences', 'notifications'] } = data;
    
    if (!userId) {
      socket.emit(EVENT_NAMES.SYNC_ERROR, {
        message: 'Unauthorized',
        code: 'UNAUTHORIZED'
      });
      return;
    }
    
    try {
      // Get current device state from database
      const deviceStates = await this.deviceStateRepository.getDeviceStates(userId, targetDeviceId || deviceId, stateTypes);
      
      // Send state to requesting device
      socket.emit(EVENT_NAMES.DEVICE_STATE_SYNC, {
        states: deviceStates,
        timestamp: Date.now()
      });
      
      logger.debug(`Device state synced for user ${userId}, device ${deviceId}`);
    } catch (error) {
      logger.error(`Error handling device state sync:`, error);
      socket.emit(EVENT_NAMES.SYNC_ERROR, {
        message: 'Error syncing device state',
        code: 'SYNC_ERROR'
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
        message: 'Unauthorized',
        code: 'UNAUTHORIZED'
      });
      return;
    }
    
    try {
      // Update device state in database
      await this.deviceStateRepository.updateDeviceState(userId, deviceId, stateType, state, version);
      
      // Broadcast to other devices if requested
      if (broadcast && this.syncConfig.enableCrossDevices) {
        const userRoom = socketService.createRoomName('user', userId);
        const deviceRoom = socketService.createRoomName('device', deviceId);
        
        // Send to all devices except the current one
        this.io.to(userRoom).except(deviceRoom).emit(EVENT_NAMES.DEVICE_STATE_UPDATED, {
          sourceDeviceId: deviceId,
          stateType,
          state,
          version,
          timestamp: Date.now()
        });
        
        logger.debug(`Device state broadcast from device ${deviceId} to all devices of user ${userId}`);
      }
    } catch (error) {
      logger.error(`Error handling device state update:`, error);
      socket.emit(EVENT_NAMES.SYNC_ERROR, {
        message: 'Error updating device state',
        code: 'UPDATE_ERROR'
      });
    }
  }
}

module.exports = TokenSyncService;
