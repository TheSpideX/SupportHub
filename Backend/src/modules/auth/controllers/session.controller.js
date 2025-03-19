const { asyncHandler } = require('../../../utils/errorHandlers');
const { AppError } = require('../../../utils/errors');
const Session = require('../models/session.model');
const User = require('../models/user.model');
const logger = require('../../../utils/logger');
const sessionConfig = require('../config/session.config');

/**
 * Get all active sessions for the current user
 */
exports.getUserSessions = asyncHandler(async (req, res) => {
  const sessions = await Session.find({ 
    userId: req.user._id,
    isActive: true 
  }).sort({ createdAt: -1 });
  
  res.status(200).json({
    status: 'success',
    data: {
      sessions: sessions.map(session => ({
        id: session._id,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        lastActiveAt: session.updatedAt,
        current: session._id.toString() === req.session._id.toString()
      }))
    }
  });
});

/**
 * Terminate a specific session
 */
exports.terminateSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  
  // Verify session belongs to user
  const session = await Session.findOne({ 
    _id: sessionId,
    userId: req.user._id 
  });
  
  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }
  
  // Deactivate session
  session.isActive = false;
  await session.save();
  
  res.status(200).json({
    status: 'success',
    message: 'Session terminated successfully'
  });
});

/**
 * Terminate all sessions except current
 */
exports.terminateAllSessions = asyncHandler(async (req, res) => {
  // Update all sessions except current one
  await Session.updateMany(
    { 
      userId: req.user._id,
      isActive: true,
      _id: { $ne: req.session._id }
    },
    { isActive: false }
  );
  
  // Increment token version to invalidate all refresh tokens
  await User.findByIdAndUpdate(
    req.user._id,
    { $inc: { 'security.tokenVersion': 1 } }
  );
  
  res.status(200).json({
    status: 'success',
    message: 'All other sessions terminated successfully'
  });
});

/**
 * Sync session data from client
 * Supports cross-tab synchronization
 */
exports.syncSession = asyncHandler(async (req, res) => {
  const { lastActivity, metrics, deviceInfo, sessionId } = req.body;
  
  // Ensure user is authenticated
  if (!req.user) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }
  
  // Find the session
  let session = null;
  
  if (sessionId) {
    // Try to find by sessionId if it's a valid ObjectId
    if (sessionId.match(/^[0-9a-fA-F]{24}$/)) {
      session = await Session.findOne({ 
        _id: sessionId,
        userId: req.user._id,
        isActive: true 
      });
    } else {
      // If sessionId is not a valid ObjectId (like "session-timestamp"),
      // we need to find by other means or create a new session
      session = await Session.findOne({ 
        userId: req.user._id,
        isActive: true 
      }).sort({ createdAt: -1 });
    }
  } else {
    // If no sessionId provided, find the most recent active session
    session = await Session.findOne({ 
      userId: req.user._id,
      isActive: true 
    }).sort({ createdAt: -1 });
  }
  
  // If no session found, create a new one
  if (!session) {
    session = await Session.create({
      userId: req.user._id,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      deviceInfo: deviceInfo || {},
      isActive: true,
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + (24 * 60 * 60 * 1000)) // 24 hours
    });
  }
  
  // Update session with latest activity data
  session.lastActivity = new Date();
  
  // Update device info if provided and different
  if (deviceInfo && JSON.stringify(session.deviceInfo || {}) !== JSON.stringify(deviceInfo)) {
    session.deviceInfo = {
      ...session.deviceInfo || {},
      ...deviceInfo
    };
    
    // Log device change for security monitoring
    logger.info('Device info updated during session', {
      userId: req.user._id,
      deviceChange: {
        previous: session.deviceInfo || {},
        current: deviceInfo
      }
    });
  }
  
  // Store metrics if provided
  if (metrics) {
    session.metrics = {
      ...session.metrics || {},
      ...metrics
    };
  }
  
  await session.save();
  
  // Calculate remaining time for session
  const sessionConfig = require('../config/session.config');
  const idleTimeout = sessionConfig.idleTimeout;
  const absoluteTimeout = sessionConfig.absoluteTimeout;
  
  const now = new Date();
  const idleExpiresAt = new Date(now.getTime() + idleTimeout * 1000);
  const absoluteExpiresAt = session.createdAt 
    ? new Date(session.createdAt.getTime() + absoluteTimeout * 1000)
    : new Date(now.getTime() + absoluteTimeout * 1000);
  
  // Return the MongoDB _id as sessionId to maintain consistency
  res.status(200).json({
    status: 'success',
    data: {
      session: {
        sessionId: session._id.toString(),
        lastActivity: session.lastActivity,
        idleExpiresAt,
        absoluteExpiresAt,
        expiresAt: new Date(Math.min(idleExpiresAt.getTime(), absoluteExpiresAt.getTime()))
      }
    }
  });
});
