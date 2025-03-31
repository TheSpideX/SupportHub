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
    ttl: 604800 // 7 days (matches refresh token)
  },
  
  // Session ID
  idLength: 64,
  
  // Session limits
  maxConcurrentSessions: isDevelopment ? 10 : 5,
  
  // Session timeouts
  timeouts: {
    idle: parseInt(process.env.SESSION_IDLE_TIMEOUT || '1800'), // 30 minutes
    absolute: parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT || '86400'), // 24 hours
    warning: 5 * 60 // 5 minutes before timeout
  },
  
  // Session tracking
  tracking: {
    updateFrequency: 60, // Update last activity every 60 seconds
    deviceInfo: true, // Store device information
    maxDevicesPerUser: isDevelopment ? 10 : 5
  },
  
  // Cross-tab synchronization
  sync: {
    enabled: true,
    checkInterval: 10, // Check every 10 seconds
    storageKey: 'session_sync'
  },
  
  // WebSocket integration
  socket: {
    heartbeatInterval: 30, // 30 seconds
    reconnectDelay: 2, // 2 seconds initial reconnect delay
    maxReconnectDelay: 30, // 30 seconds max reconnect delay
    reconnectAttempts: 10 // Maximum reconnection attempts
  }
};

module.exports = sessionConfig;
