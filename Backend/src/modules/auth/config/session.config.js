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
  
  // Session timeout (idle timeout) - 30 minutes
  // IMPORTANT: This must match frontend's sessionTimeout value (30 * 60 * 1000)
  idleTimeout: 30 * 60, // 30 minutes in seconds
  
  // Session absolute timeout (force re-login) - 24 hours
  absoluteTimeout: 24 * 60 * 60, // 24 hours in seconds
  
  // Session synchronization - 5 minutes
  // IMPORTANT: This must match frontend's syncInterval value (5 * 60 * 1000)
  syncInterval: 5 * 60, // 5 minutes in seconds
  
  // Device tracking
  trackDevices: true,
  requireDeviceVerification: !isDevelopment,
  
  // Cross-tab synchronization
  enableCrossTabs: true,
  
  // Session warning threshold - 5 minutes before expiry
  // IMPORTANT: This must match frontend's sessionWarningThreshold value (5 * 60 * 1000)
  warningThreshold: 5 * 60 // 5 minutes in seconds
};

module.exports = sessionConfig;
