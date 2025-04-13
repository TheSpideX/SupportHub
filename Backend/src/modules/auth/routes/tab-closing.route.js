/**
 * Tab Closing Route
 * Handles beacon requests for tab closing notifications
 */
const express = require('express');
const router = express.Router();
const logger = require('../../../utils/logger');
const crossTabService = require('../services/cross-tab.service');

/**
 * Handle tab closing beacon request
 * This endpoint is used by the frontend to notify the backend when a tab is closing
 * using the navigator.sendBeacon API for more reliable delivery
 */
router.post('/api/auth/tab-closing', express.json(), (req, res) => {
  try {
    const { tabId, deviceId, isLeader, timestamp } = req.body;
    
    if (!tabId) {
      logger.warn('Tab closing beacon received without tabId');
      return res.status(400).json({ success: false, message: 'Missing tabId' });
    }
    
    logger.info(`Tab closing beacon received for tab ${tabId}`, {
      tabId,
      deviceId,
      isLeader,
      timestamp,
      userId: req.user?.id
    });
    
    // If this is a leader tab, handle it specially
    if (isLeader && req.user?.id && crossTabService) {
      // Create a mock socket data object
      const mockSocket = {
        data: {
          userId: req.user.id,
          tabId,
          deviceId,
          isLeader
        }
      };
      
      // Handle tab closing through cross-tab service
      if (typeof crossTabService.handleTabClosing === 'function') {
        crossTabService.handleTabClosing(mockSocket, {
          tabId,
          deviceId,
          isLeader,
          timestamp: timestamp || Date.now(),
          source: 'beacon'
        });
        
        logger.debug(`Leader tab ${tabId} closing handled via beacon`);
      }
    }
    
    // Always return success to the beacon
    return res.status(202).json({ success: true });
  } catch (error) {
    logger.error('Error handling tab closing beacon', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
