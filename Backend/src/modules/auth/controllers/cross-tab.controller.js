const tokenSyncService = require('../services/cross-tab.service');
const socketService = require('../services/socket.service');
const { ApiError } = require('../../../utils/errors');
const logger = require('../../../config/logger');
const { EVENT_NAMES } = require('../constants/socket.constants');

/**
 * Cross-Tab Controller - Handles tab synchronization operations
 * Most cross-tab functionality is handled via WebSockets, but these
 * endpoints provide REST API access for fallback and initial state.
 */
class CrossTabController {
  /**
   * Get leader information for the current user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getLeaderInfo(req, res) {
    const userId = req.user.id;
    const leaderInfo = tokenSyncService.getLeaderInfo(userId);
    
    if (!leaderInfo) {
      return res.json({ hasLeader: false });
    }
    
    res.json({
      hasLeader: true,
      leaderId: leaderInfo.leaderId,
      lastHeartbeat: leaderInfo.lastHeartbeat,
      version: leaderInfo.version
    });
  }

  /**
   * Register as a leader candidate
   * This is a fallback for when WebSocket is not available
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async registerLeaderCandidate(req, res) {
    const userId = req.user.id;
    const { tabId, priority, deviceId } = req.body;
    
    if (!tabId) {
      throw new ApiError(400, 'Tab ID is required');
    }
    
    const result = tokenSyncService.registerLeaderCandidate(userId, tabId, priority, deviceId);
    res.json(result);
  }

  /**
   * Send heartbeat from leader
   * This is a fallback for when WebSocket is not available
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async sendLeaderHeartbeat(req, res) {
    const userId = req.user.id;
    const { tabId } = req.body;
    
    if (!tabId) {
      throw new ApiError(400, 'Tab ID is required');
    }
    
    const result = tokenSyncService.updateLeaderHeartbeat(userId, tabId);
    
    if (!result) {
      throw new ApiError(400, 'Not the current leader');
    }
    
    res.json({ success: true, timestamp: result.lastHeartbeat });
  }

  /**
   * Get shared state for the current user
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getSharedState(req, res) {
    const userId = req.user.id;
    const stateInfo = tokenSyncService.getSharedState(userId);
    
    if (!stateInfo) {
      return res.json({ hasState: false, stateData: {} });
    }
    
    res.json({
      hasState: true,
      stateData: stateInfo.stateData,
      version: stateInfo.version,
      updatedAt: stateInfo.updatedAt,
      updatedBy: stateInfo.updatedBy
    });
  }

  /**
   * Update shared state
   * This is a fallback for when WebSocket is not available
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateSharedState(req, res) {
    const userId = req.user.id;
    const { tabId, state, version, vectorClock, deviceId } = req.body;
    
    if (!tabId) {
      throw new ApiError(400, 'Tab ID is required');
    }
    
    // Check if this tab is the leader
    const leaderInfo = tokenSyncService.getLeaderInfo(userId);
    const isLeader = leaderInfo && leaderInfo.leaderId === tabId;
    
    // Only leader can update state unless force flag is set
    if (!isLeader && !req.body.force) {
      throw new ApiError(403, 'Only leader tab can update state');
    }
    
    const result = tokenSyncService.updateSharedState(userId, {
      state,
      version,
      vectorClock,
      updatedBy: tabId
    });
    
    // Notify other tabs on same device
    if (deviceId) {
      const deviceRoom = socketService.createRoomName('device', deviceId);
      req.io.to(deviceRoom).emit(EVENT_NAMES.STATE_UPDATE, {
        state,
        version: result.version,
        vectorClock: result.vectorClock,
        updatedBy: tabId,
        timestamp: Date.now()
      });
    }
    
    res.json({
      success: true,
      version: result.version,
      updatedAt: result.updatedAt
    });
  }
}

module.exports = new CrossTabController();