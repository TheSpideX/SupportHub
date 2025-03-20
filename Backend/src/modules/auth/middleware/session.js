const { AppError } = require('../../../utils/errors');
const Session = require('../models/session.model');
const config = require('../config');
const { session: sessionConfig } = config;

/**
 * Middleware to validate session state
 * Works alongside authenticateToken middleware
 */
exports.validateSession = async (req, res, next) => {
  try {
    // Skip if no user (not authenticated)
    if (!req.user) {
      return next();
    }
    
    // Skip if session already validated by authenticateToken
    if (req.session) {
      return next();
    }
    
    // Get session ID from token payload
    const sessionId = req.user.sessionId;
    
    if (!sessionId) {
      return next(new AppError('Session ID not found in token', 401, 'SESSION_NOT_FOUND'));
    }
    
    // Find session
    const session = await Session.findById(sessionId);
    
    if (!session) {
      return next(new AppError('Session not found', 401, 'SESSION_NOT_FOUND'));
    }
    
    // Check if session is expired
    const now = new Date();
    
    // Check absolute timeout
    if (session.expiresAt && now > session.expiresAt) {
      return next(new AppError('Session expired', 401, 'SESSION_EXPIRED'));
    }
    
    // Check idle timeout
    const lastActivity = session.lastActiveAt || session.createdAt;
    const idleTimeout = session.idleTimeout || sessionConfig.timeouts.idle;
    const idleExpiresAt = new Date(lastActivity.getTime() + idleTimeout * 1000);
    
    if (now > idleExpiresAt) {
      return next(new AppError('Session idle timeout', 401, 'SESSION_IDLE_TIMEOUT'));
    }
    
    // Set session in request
    req.session = session;
    
    // Update session activity asynchronously
    Session.findByIdAndUpdate(
      sessionId,
      { lastActiveAt: new Date() },
      { new: true }
    ).catch(err => {
      console.error('Failed to update session activity:', err);
    });
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to enforce session limits
 */
exports.enforceSessionLimits = async (req, res, next) => {
  try {
    // Only apply during login/registration
    if (!['POST:/api/auth/login', 'POST:/api/auth/register'].includes(`${req.method}:${req.path}`)) {
      return next();
    }
    
    // Skip if no user yet
    if (!req.user) {
      return next();
    }
    
    const userId = req.user._id;
    
    // Count active sessions
    const activeSessions = await Session.countDocuments({
      userId,
      expiresAt: { $gt: new Date() }
    });
    
    // Check if limit exceeded
    if (activeSessions >= sessionConfig.maxConcurrentSessions) {
      return next(new AppError(
        `Maximum of ${sessionConfig.maxConcurrentSessions} concurrent sessions allowed`,
        400,
        'MAX_SESSIONS_EXCEEDED'
      ));
    }
    
    next();
  } catch (error) {
    next(error);
  }
};