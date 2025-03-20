const { redisClient } = require('../../../config/redis');
const logger = require('../../../utils/logger');
const Session = require('../models/session.model');
const sessionConfig = require('../config/session.config');

// Store cleanup intervals for proper shutdown
const cleanupIntervals = [];

const tokenService = require('./token.service');

/**
 * Create a new session
 * @param {Object} options
 * @param {string} options.userId
 * @param {string} options.userAgent
 * @param {string} options.ipAddress
 * @param {Object} options.deviceInfo
 * @returns {Object} session
 */
exports.createSession = async ({ userId, userAgent, ipAddress, deviceInfo, sessionData = {} }) => {
  try {
    // Create a session document
    const session = await Session.create({
      userId: userId.toString(),
      isActive: true,
      expiresAt: new Date(Date.now() + sessionConfig.store.ttl * 1000),
      ipAddress,
      deviceInfo: {
        userAgent,
        ...deviceInfo
      },
      lastActivity: new Date(),
      ...sessionData
    });

    // Store session in Redis for faster access
    const sessionKey = `session:${session._id}`;
    const sessionValue = JSON.stringify({
      userId: session.userId,
      isActive: session.isActive,
      expiresAt: session.expiresAt,
      lastActivity: session.lastActivity
    });

    // Use the redisClient wrapper which handles fallback
    await redisClient.set(
      sessionKey,
      sessionValue,
      'EX',
      Math.floor(sessionConfig.store.ttl)
    );

    return session;
  } catch (error) {
    logger.error('Failed to create session', error);
    throw new Error('Session creation failed');
  }
};

/**
 * Get session by ID
 * @param {string} sessionId
 * @returns {Object} session
 */
exports.getSessionById = async (sessionId) => {
  const sessionData = await redisClient.get(`session:${sessionId}`);
  
  if (!sessionData) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }
  
  const session = JSON.parse(sessionData);
  
  // Check if session is expired
  if (session.expiresAt < Date.now()) {
    throw new AppError('Session expired', 401, 'SESSION_EXPIRED');
  }
  
  return session;
};

/**
 * Update session activity
 * @param {string} sessionId
 * @returns {Object} updated session
 */
exports.updateSessionActivity = async (sessionId) => {
  const session = await exports.getSessionById(sessionId);
  
  // Update last active time
  session.lastActiveAt = Date.now();
  
  // Update expiry time
  session.expiresAt = Date.now() + sessionConfig.maxAge;
  
  // Store updated session
  await redisClient.set(
    `session:${sessionId}`,
    JSON.stringify(session),
    'EX',
    Math.ceil(sessionConfig.maxAge / 1000)
  );
  
  return session;
};

/**
 * End session
 * @param {string} sessionId
 * @param {string} reason - Reason for ending session
 * @returns {boolean}
 */
exports.endSession = async (sessionId, reason = 'user_logout') => {
  try {
    const session = await exports.getSessionById(sessionId);
    
    // Update session status
    session.status = 'ended';
    session.endedAt = Date.now();
    session.endReason = reason;
    
    // Store updated session with shorter TTL for audit purposes
    await redisClient.set(
      `session:${sessionId}`,
      JSON.stringify(session),
      'EX',
      sessionConfig.endedSessionTtl || 86400 // Default 24 hours
    );
    
    // Remove from user's active sessions
    await redisClient.sRem(`user:${session.userId}:sessions`, sessionId);
    
    return true;
  } catch (error) {
    logger.error('Failed to end session', { sessionId, error: error.message });
    return false;
  }
};

/**
 * Mark session for cleanup
 * @param {string} sessionId
 * @returns {boolean}
 */
exports.markSessionForCleanup = async (sessionId) => {
  try {
    const session = await exports.getSessionById(sessionId);
    
    // Mark session for cleanup
    session.markedForCleanup = true;
    session.markedAt = Date.now();
    
    // Store updated session
    await redisClient.set(
      `session:${sessionId}`,
      JSON.stringify(session),
      'EX',
      Math.ceil(sessionConfig.maxAge / 1000)
    );
    
    return true;
  } catch (error) {
    logger.error('Failed to mark session for cleanup', { sessionId, error: error.message });
    return false;
  }
};

/**
 * Get all sessions for a user
 * @param {string} userId
 * @returns {Array} sessions
 */
exports.getUserSessions = async (userId) => {
  const sessionIds = await redisClient.sMembers(`user:${userId}:sessions`);
  
  if (!sessionIds || sessionIds.length === 0) {
    return [];
  }
  
  const sessions = [];
  
  for (const sessionId of sessionIds) {
    try {
      const session = await exports.getSessionById(sessionId);
      sessions.push(session);
    } catch (error) {
      // Skip sessions that can't be retrieved
      logger.warn('Failed to retrieve session', { sessionId, error: error.message });
    }
  }
  
  return sessions;
};

/**
 * End all sessions for a user except the current one
 * @param {string} userId
 * @param {string} currentSessionId - Session ID to keep active
 * @returns {number} Number of sessions ended
 */
exports.endAllUserSessionsExceptCurrent = async (userId, currentSessionId) => {
  const sessions = await exports.getUserSessions(userId);
  
  let endedCount = 0;
  
  for (const session of sessions) {
    if (session.id !== currentSessionId) {
      const ended = await exports.endSession(session.id, 'user_logged_out_elsewhere');
      if (ended) {
        endedCount++;
      }
    }
  }
  
  return endedCount;
};

/**
 * Get session info for frontend
 * @param {string} sessionId
 * @param {Object} clientInfo - Client information
 * @returns {Object} Session info
 */
exports.getSessionInfo = async (sessionId, clientInfo = {}) => {
  const session = await exports.getSessionById(sessionId);
  
  // Calculate expiry times
  const now = Date.now();
  const timeRemaining = session.expiresAt - now;
  const warningTime = session.expiresAt - (sessionConfig.warningThreshold || 5 * 60 * 1000); // 5 minutes before expiry by default
  
  return {
    id: session.id,
    createdAt: session.createdAt,
    lastActiveAt: session.lastActiveAt,
    expiresAt: session.expiresAt,
    timeRemaining,
    warningAt: warningTime,
    deviceInfo: session.deviceInfo || {},
    status: session.status
  };
};

/**
 * Update tab activity in a session
 * @param {string} sessionId - Session ID
 * @param {string} tabId - Tab ID
 * @param {Object} data - Tab data
 * @returns {boolean} - Success status
 */
exports.updateTabActivity = async (sessionId, tabId, data = {}) => {
  try {
    // Get session
    const sessionKey = `session:${sessionId}`;
    const sessionData = await redisClient.get(sessionKey);
    
    if (!sessionData) {
      return false;
    }
    
    const session = JSON.parse(sessionData);
    
    // Initialize activeTabs array if it doesn't exist
    if (!session.activeTabs) {
      session.activeTabs = [];
    }
    
    // Find existing tab
    const existingTabIndex = session.activeTabs.findIndex(tab => tab.tabId === tabId);
    
    // Update or add tab
    const now = Date.now();
    const tabData = {
      tabId,
      lastActivity: now,
      ...data
    };
    
    if (existingTabIndex >= 0) {
      session.activeTabs[existingTabIndex] = {
        ...session.activeTabs[existingTabIndex],
        ...tabData
      };
    } else {
      session.activeTabs.push(tabData);
    }
    
    // Update session lastActiveAt
    session.lastActiveAt = now;
    
    // Clean up inactive tabs (older than 5 minutes)
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    session.activeTabs = session.activeTabs.filter(tab => 
      tab.lastActivity > fiveMinutesAgo || tab.tabId === tabId
    );
    
    // Update session
    await redisClient.set(
      sessionKey,
      JSON.stringify(session),
      'EX',
      Math.ceil((session.expiresAt - now) / 1000)
    );
    
    return true;
  } catch (error) {
    console.error('Failed to update tab activity', { sessionId, tabId, error: error.message });
    return false;
  }
};

/**
 * Mark tab as inactive
 * @param {string} sessionId
 * @param {string} tabId
 * @returns {boolean}
 */
exports.markTabInactive = async (sessionId, tabId) => {
  try {
    const session = await exports.getSessionById(sessionId);
    
    // Remove tab from active tabs
    if (session.activeTabs) {
      session.activeTabs = session.activeTabs.filter(tab => tab.tabId !== tabId);
      
      // Update session
      await redisClient.set(
        `session:${sessionId}`,
        JSON.stringify(session),
        'EX',
        Math.ceil(sessionConfig.maxAge / 1000)
      );
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to mark tab as inactive', { sessionId, tabId, error: error.message });
    return false;
  }
};

/**
 * Initialize session service
 * @param {Object} options - Configuration options
 */
exports.initialize = function(options = {}) {
  logger.info('Initializing session service');
  
  // Apply configuration
  if (options.store) {
    sessionConfig.store = options.store;
  }
  
  if (options.timeouts) {
    sessionConfig.timeouts = {
      ...sessionConfig.timeouts,
      ...options.timeouts
    };
  }
  
  if (options.tracking) {
    sessionConfig.tracking = {
      ...sessionConfig.tracking,
      ...options.tracking
    };
  }
  
  // Set up scheduled cleanup of expired sessions
  setupSessionCleanup();
  
  logger.info('Session service initialized');
};

/**
 * Set up scheduled cleanup of expired sessions
 */
function setupSessionCleanup() {
  logger.info('Setting up session cleanup schedule');
  
  // Set up interval to clean up expired sessions
  const cleanupInterval = setInterval(async () => {
    try {
      const now = Date.now();
      
      // Use SCAN instead of KEYS
      let sessionKeys = [];
      let cursor = '0';
      
      do {
        const [nextCursor, keys] = await redisClient.scan(
          cursor, 
          'MATCH', 
          'session:*', 
          'COUNT', 
          100
        );
        
        cursor = nextCursor;
        sessionKeys = sessionKeys.concat(keys);
        
        // Process in batches to avoid memory issues
        if (sessionKeys.length > 500) break;
      } while (cursor !== '0');
      
      logger.debug(`Session cleanup: checking ${sessionKeys.length} sessions`);
      
      let cleanedCount = 0;
      let activeCount = 0;
      let idleCount = 0;
      
      for (const key of sessionKeys) {
        const sessionData = await redisClient.get(key);
        if (!sessionData) continue;
        
        try {
          const session = JSON.parse(sessionData);
          
          // Check absolute expiry
          if (session.expiresAt < now) {
            await redisClient.del(key);
            cleanedCount++;
            continue;
          }
          
          // Check idle timeout
          const idleTimeout = sessionConfig.timeouts.idle * 1000;
          if (now - session.lastActiveAt > idleTimeout) {
            await redisClient.del(key);
            idleCount++;
            continue;
          }
          
          activeCount++;
        } catch (error) {
          // Invalid session data, clean it up
          logger.error(`Invalid session data for ${key}, removing`, error);
          await redisClient.del(key);
          cleanedCount++;
        }
      }
      
      // Log cleanup results
      logger.info(`Session cleanup complete: ${cleanedCount} expired, ${idleCount} idle, ${activeCount} active`);
      
      // Monitor session count
      if (activeCount > 10000) {
        logger.warn(`High number of active sessions (${activeCount}), consider reviewing session management`);
      }
    } catch (error) {
      logger.error('Error during session cleanup:', error);
    }
  }, 60 * 60 * 1000); // Run every hour
  
  // Run more frequent lightweight cleanup
  const lightCleanupInterval = setInterval(async () => {
    try {
      // Use SCAN instead of KEYS for production environments
      let sessionKeys = [];
      let cursor = '0';
      
      do {
        // Use scan instead of keys
        const [nextCursor, keys] = await redisClient.scan(
          cursor, 
          'MATCH', 
          'session:*', 
          'COUNT', 
          100
        );
        
        cursor = nextCursor;
        sessionKeys = sessionKeys.concat(keys);
        
        // Limit the number of keys to process in one batch
        if (sessionKeys.length > 200) break;
      } while (cursor !== '0' && sessionKeys.length < 200);
      
      // Sample the keys if there are too many
      const sampleSize = Math.min(100, sessionKeys.length);
      const sampleKeys = sessionKeys.sort(() => 0.5 - Math.random()).slice(0, sampleSize);
      
      let cleanedCount = 0;
      const now = Date.now();
      
      for (const key of sampleKeys) {
        const sessionData = await redisClient.get(key);
        if (!sessionData) continue;
        
        try {
          const session = JSON.parse(sessionData);
          if (session.expiresAt < now) {
            await redisClient.del(key);
            cleanedCount++;
          }
        } catch (error) {
          await redisClient.del(key);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        logger.debug(`Light session cleanup: removed ${cleanedCount}/${sampleSize} sampled sessions`);
      }
    } catch (error) {
      logger.error('Error during light session cleanup:', error);
    }
  }, 5 * 60 * 1000); // Run every 5 minutes
  
  // Store interval references for cleanup
  cleanupIntervals.push(cleanupInterval, lightCleanupInterval);
  
  logger.info('Session cleanup schedule established');
}

/**
 * Clean up expired sessions
 */
async function cleanupExpiredSessions() {
  // Implementation depends on your storage mechanism
  // For Redis, you might use SCAN with pattern matching and check expiry
  
  logger.info('Cleaned up expired sessions');
}

/**
 * Calculate session expiry times
 * @param {Object} session - Session object
 * @returns {Object} - Expiry times
 */
function calculateSessionExpiryTimes(session) {
  const now = Date.now();
  const expiresAt = session.expiresAt;
  const warningThreshold = sessionConfig.warningThreshold || 5 * 60 * 1000; // 5 minutes
  
  return {
    absolute: expiresAt,
    idle: session.lastActiveAt + sessionConfig.maxAge,
    warning: expiresAt - warningThreshold
  };
}

/**
 * Initialize WebSocket for session synchronization
 */
function initializeSessionWebSocket(io) {
  const sessionNamespace = io.of('/session');
  
  sessionNamespace.on('connection', (socket) => {
    logger.info('Client connected to session WebSocket');
    
    // Authenticate the socket connection
    socket.use(async (packet, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication required'));
        }
        
        const decoded = await tokenService.verifyToken(token);
        socket.userId = decoded.userId;
        socket.sessionId = decoded.sessionId;
        next();
      } catch (error) {
        next(new Error('Invalid authentication'));
      }
    });
    
    // Handle session sync
    socket.on('sync', async (data) => {
      try {
        if (!socket.sessionId) {
          return socket.emit('error', { message: 'Not authenticated' });
        }
        
        const session = await exports.getSessionById(socket.sessionId);
        if (!session) {
          return socket.emit('error', { message: 'Session not found' });
        }
        
        // Update tab activity
        if (data.tabId) {
          await exports.updateTabActivity(socket.sessionId, data.tabId);
        }
        
        // Send session data back to client
        const sessionData = await exports.getSessionInfo(socket.sessionId, {
          tabId: data.tabId,
          clientInfo: data.clientInfo
        });
        
        socket.emit('session-update', sessionData);
      } catch (error) {
        logger.error('Error in session sync:', error);
        socket.emit('error', { message: 'Failed to sync session' });
      }
    });
    
    // Handle disconnect
    socket.on('disconnect', async () => {
      try {
        if (socket.sessionId && socket.userId) {
          logger.info('Client disconnected from session WebSocket');
          // Mark tab as inactive
          if (socket.handshake.query.tabId) {
            await exports.markTabInactive(socket.sessionId, socket.handshake.query.tabId);
          }
        }
      } catch (error) {
        logger.error('Error handling socket disconnect:', error);
      }
    });
  });
  
  return sessionNamespace;
}

/**
 * Clean up resources used by the session service
 * Called during application shutdown
 */
exports.cleanup = async function() {
  logger.info('Cleaning up session service resources');
  
  try {
    // Clear all intervals
    cleanupIntervals.forEach(interval => {
      clearInterval(interval);
    });
    cleanupIntervals.length = 0;
    
    logger.info('Session service cleanup completed');
    return true;
  } catch (error) {
    logger.error('Error during session service cleanup:', error);
    return false;
  }
};

// Export the module
module.exports = exports;
