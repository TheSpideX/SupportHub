// Import API configuration
import { API_CONFIG } from '../../../config/api';

// Define environment
const isDevelopment = import.meta.env.MODE === 'development';

/**
 * Session configuration - aligned with Backend/src/modules/auth/config/session.config.js
 * Only includes data needed by frontend
 */

// Session timeouts (in seconds)
export const SESSION_TIMEOUT_SECONDS = 1800; // 30 minutes idle timeout
export const SESSION_ABSOLUTE_TIMEOUT_SECONDS = 86400; // 24 hours absolute timeout
export const SESSION_WARNING_THRESHOLD_SECONDS = 300; // 5 minutes warning before timeout
export const SESSION_ACTIVITY_CHECK_INTERVAL_SECONDS = 60; // Check activity every minute

// Convert to milliseconds for components that need it
export const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_SECONDS * 1000;
export const SESSION_ABSOLUTE_TIMEOUT_MS = SESSION_ABSOLUTE_TIMEOUT_SECONDS * 1000;
export const SESSION_WARNING_THRESHOLD_MS = SESSION_WARNING_THRESHOLD_SECONDS * 1000;
export const SESSION_ACTIVITY_CHECK_INTERVAL_MS = SESSION_ACTIVITY_CHECK_INTERVAL_SECONDS * 1000;

// Activity events that reset the idle timer
export const SESSION_ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'];

// Cross-tab synchronization settings
export const SESSION_SYNC = {
  ENABLED: true,
  CHECK_INTERVAL: 10, // Check every 10 seconds
  STORAGE_KEY: 'session_sync'
};

// WebSocket integration settings
export const SESSION_SOCKET = {
  HEARTBEAT_INTERVAL: 30, // 30 seconds
  RECONNECT_DELAY: 2, // 2 seconds initial reconnect delay
  MAX_RECONNECT_DELAY: 30, // 30 seconds max reconnect delay
  RECONNECT_ATTEMPTS: 10 // Maximum reconnection attempts
};

// Session limits
export const SESSION_LIMITS = {
  MAX_CONCURRENT_SESSIONS: isDevelopment ? 10 : 5,
  MAX_DEVICES_PER_USER: isDevelopment ? 10 : 5
};

// Export as default for backward compatibility
export default {
  SESSION_TIMEOUT_SECONDS,
  SESSION_ABSOLUTE_TIMEOUT_SECONDS,
  SESSION_WARNING_THRESHOLD_SECONDS,
  SESSION_ACTIVITY_CHECK_INTERVAL_SECONDS,
  SESSION_TIMEOUT_MS,
  SESSION_ABSOLUTE_TIMEOUT_MS,
  SESSION_WARNING_THRESHOLD_MS,
  SESSION_ACTIVITY_CHECK_INTERVAL_MS,
  SESSION_ACTIVITY_EVENTS,
  SESSION_SYNC,
  SESSION_SOCKET,
  SESSION_LIMITS
};
