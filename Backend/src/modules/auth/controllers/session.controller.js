const { asyncHandler } = require('../../../utils/errorHandlers');
const { AppError } = require('../../../utils/errors');
const Session = require('../models/session.model');
const User = require('../models/user.model');
const logger = require('../../../utils/logger');
const sessionConfig = require('../config/session.config');
const TokenBlacklist = require('../models/token-blacklist.model');
const Token = require('../models/token.model');

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
    { isActive: false, endedAt: new Date(), endReason: 'user_terminated_all' }
  );
  
  // Increment token version to invalidate all refresh tokens
  await User.findByIdAndUpdate(
    req.user._id,
    { $inc: { 'security.tokenVersion': 1 } }
  );
  
  // Blacklist all refresh tokens except current
  await TokenBlacklist.insertMany(
    await Token.find({
      user: req.user._id,
      type: 'refresh',
      sessionId: { $ne: req.session._id }
    }).select('jti expiresAt').lean()
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
  let session;
  
  if (sessionId) {
    // If sessionId provided, find that specific session
    session = await Session.findOne({
      _id: sessionId,
      userId: req.user._id,
      isActive: true
    });
  } else if (req.session) {
    // Use the current session from request
    session = req.session;
  } else {
    // Create a new session if none exists
    session = await sessionService.createSession(req.user._id, {
      ipAddress: req.ip,
      deviceInfo: deviceInfo || req.deviceInfo
    });
  }
  
  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }
  
  // Check if session has expired
  const now = new Date();
  const idleTimeoutMs = sessionConfig.idleTimeout * 1000;
  const lastActiveTime = lastActivity ? new Date(lastActivity) : session.lastActivity;
  
  if (lastActiveTime && (now - lastActiveTime) > idleTimeoutMs) {
    // Session has expired due to inactivity
    await Session.findByIdAndUpdate(session._id, {
      isActive: false,
      endedAt: now,
      endReason: 'idle_timeout'
    });
    
    throw new AppError('Session expired', 401, 'SESSION_EXPIRED');
  }
  
  // Update session with latest activity
  session = await Session.findByIdAndUpdate(
    session._id,
    {
      lastActivity: now,
      deviceInfo: deviceInfo || session.deviceInfo,
      $set: {
        'metrics': { ...session.metrics, ...metrics }
      }
    },
    { new: true }
  );
  
  // Generate new CSRF token if needed
  let csrfToken = null;
  if (req.cookies && !req.cookies[CSRF_COOKIE_NAME]) {
    csrfToken = crypto.randomBytes(32).toString('hex');
    // Set CSRF cookie in response
    res.cookie(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: sessionConfig.idleTimeout * 1000
    });
  }
  
  // Return updated session data
  res.status(200).json({
    success: true,
    session: {
      id: session._id,
      lastActivity: session.lastActivity,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      deviceInfo: session.deviceInfo
    },
    tokens: csrfToken ? { csrfToken } : undefined,
    timeouts: {
      idle: sessionConfig.idleTimeout,
      absolute: sessionConfig.absoluteTimeout,
      sync: sessionConfig.syncInterval
    }
  });
});
