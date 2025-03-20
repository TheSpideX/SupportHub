/**
 * Session configuration - single source of truth
 * Ensures consistency between frontend and backend timeout values
 */
const isDevelopment = process.env.NODE_ENV === 'development';

const sessionConfig = {
  // Session storage
  store: {
    type: process.env.SESSION_STORE || 'redis',
    prefix: 'sess:',
    ttl: 7 * 24 * 60 * 60 // 7 days (matches refresh token)
  },
  
  // Session ID
  idLength: 64,
  
  // Session limits
  maxConcurrentSessions: isDevelopment ? 10 : 5,
  
  // Session timeouts
  timeouts: {
    idle: process.env.SESSION_IDLE_TIMEOUT || 30 * 60, // 30 minutes
    absolute: process.env.SESSION_ABSOLUTE_TIMEOUT || 24 * 60 * 60, // 24 hours
    warning: 5 * 60 // 5 minutes before timeout
  },
  
  // Session tracking
  tracking: {
    updateFrequency: 60, // Update last activity every 60 seconds
    deviceInfo: true, // Store device information
    maxConcurrentSessions: isDevelopment ? 10 : 5
  },
  
  // Cross-tab synchronization
  sync: {
    enabled: true,
    checkInterval: 10 * 1000, // Check every 10 seconds
    storageKey: 'session_sync'
  }
};

module.exports = sessionConfig;
