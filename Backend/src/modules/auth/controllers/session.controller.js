/**
 * Session Controller
 * Handles all session-related operations
 */
const Session = require('../models/session.model');
const { AppError } = require('../../../utils/errors');
const sessionService = require('../services/session.service');
const sessionConfig = require('../config/session.config');

/**
 * Validate current session
 * @route GET /api/auth/session/validate
 */
exports.validateSession = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const sessionId = req.session.id;
    
    // Get session from database
    const session = await Session.findOne({ _id: sessionId, userId });
    
    if (!session) {
      return next(new AppError('Session not found', 404, 'SESSION_NOT_FOUND'));
    }
    
    // Check if session is expired
    if (session.isExpired()) {
      return next(new AppError('Session expired', 401, 'SESSION_EXPIRED'));
    }
    
    // Return session info
    res.status(200).json({
      status: 'success',
      data: {
        session: {
          id: session._id,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          expiresAt: session.expiresAt,
          device: session.deviceInfo
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Synchronize session across tabs
 * @route POST /api/auth/session/sync
 */
exports.syncSession = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const sessionId = req.session.id;
    const { tabId, screenSize, lastUserActivity } = req.body;
    
    // Get session from database
    const session = await Session.findOne({ _id: sessionId, userId });
    
    if (!session) {
      return next(new AppError('Session not found', 404, 'SESSION_NOT_FOUND'));
    }
    
    // Update session with tab information
    if (tabId) {
      // Add or update tab in session
      const tabIndex = session.activeTabs.findIndex(tab => tab.id === tabId);
      
      if (tabIndex >= 0) {
        // Update existing tab
        session.activeTabs[tabIndex].lastActivity = new Date();
        if (screenSize) session.activeTabs[tabIndex].screenSize = screenSize;
      } else {
        // Add new tab
        session.activeTabs.push({
          id: tabId,
          createdAt: new Date(),
          lastActivity: new Date(),
          screenSize: screenSize || {}
        });
      }
    }
    
    // Update session last activity
    if (lastUserActivity) {
      session.lastActivity = new Date(lastUserActivity);
    } else {
      session.lastActivity = new Date();
    }
    
    await session.save();
    
    // Return updated session info
    res.status(200).json({
      status: 'success',
      data: {
        session: {
          id: session._id,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          expiresAt: session.expiresAt,
          activeTabs: session.activeTabs,
          device: session.deviceInfo,
          timeouts: {
            idle: sessionConfig.timeouts.idle,
            absolute: sessionConfig.timeouts.absolute,
            warning: sessionConfig.timeouts.warning
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Acknowledge session timeout warning
 * @route POST /api/auth/session/acknowledge-warning
 */
exports.acknowledgeWarning = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const sessionId = req.session.id;
    const { warningType } = req.body;
    
    if (!['IDLE', 'ABSOLUTE', 'SECURITY'].includes(warningType)) {
      return next(new AppError('Invalid warning type', 400));
    }
    
    // Update session with acknowledgment
    const session = await Session.findOne({ _id: sessionId, userId });
    
    if (!session) {
      return next(new AppError('Session not found', 404, 'SESSION_NOT_FOUND'));
    }
    
    // Find the most recent warning of this type
    const warningIndex = session.warningsSent.findIndex(
      w => w.warningType === warningType && !w.acknowledged
    );
    
    if (warningIndex >= 0) {
      session.warningsSent[warningIndex].acknowledged = true;
      session.lastWarningAcknowledged = new Date();
      await session.save();
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Warning acknowledged'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get active sessions for current user
 * @route GET /api/auth/session/active
 */
exports.getActiveSessions = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    // Get all active sessions for user
    const sessions = await Session.find({
      userId,
      expiresAt: { $gt: new Date() }
    }).select('_id createdAt lastActivity deviceInfo ipAddress userAgent');
    
    res.status(200).json({
      status: 'success',
      results: sessions.length,
      data: {
        sessions
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Terminate specific session
 * @route DELETE /api/auth/session/:sessionId
 */
exports.terminateSession = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { sessionId } = req.params;
    const currentSessionId = req.session.id;
    
    // Prevent terminating current session through this endpoint
    if (sessionId === currentSessionId) {
      return next(new AppError(
        'Cannot terminate current session. Use logout instead.',
        400,
        'INVALID_OPERATION'
      ));
    }
    
    // Find and terminate session
    const session = await Session.findOne({ _id: sessionId, userId });
    
    if (!session) {
      return next(new AppError('Session not found', 404, 'SESSION_NOT_FOUND'));
    }
    
    // End session
    await sessionService.endSession(sessionId, 'user_terminated');
    
    res.status(200).json({
      status: 'success',
      message: 'Session terminated'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Terminate all sessions except current
 * @route POST /api/auth/session/terminate-all
 */
exports.terminateAllSessions = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const currentSessionId = req.session.id;
    
    // Find all other active sessions
    const sessions = await Session.find({
      userId,
      _id: { $ne: currentSessionId },
      expiresAt: { $gt: new Date() }
    });
    
    // Terminate each session
    const terminationPromises = sessions.map(session => 
      sessionService.endSession(session._id, 'user_terminated_all')
    );
    
    await Promise.all(terminationPromises);
    
    res.status(200).json({
      status: 'success',
      message: `Terminated ${sessions.length} sessions`,
      data: {
        terminatedCount: sessions.length
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get session by ID
 * @route GET /api/auth/session/:sessionId
 */
exports.getSessionById = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { sessionId } = req.params;
    
    // Get session from database
    const session = await Session.findOne({ _id: sessionId, userId });
    
    if (!session) {
      return next(new AppError('Session not found', 404, 'SESSION_NOT_FOUND'));
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        session
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update session activity (heartbeat)
 * @route POST /api/auth/session/heartbeat
 */
exports.updateSessionActivity = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const sessionId = req.session.id;
    
    // Update session last activity
    await Session.findOneAndUpdate(
      { _id: sessionId, userId },
      { lastActivity: new Date() }
    );
    
    res.status(200).json({
      status: 'success',
      message: 'Session activity updated'
    });
  } catch (error) {
    next(error);
  }
};
