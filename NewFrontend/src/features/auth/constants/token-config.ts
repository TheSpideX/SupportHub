// Import environment variables if needed
import { API_CONFIG } from '../../../config/api';

/**
 * Token configuration - aligned with backend
 * Only includes data needed by frontend
 */

// Token expiry times (in seconds)
export const ACCESS_TOKEN_EXPIRY_SECONDS = 900; // 15 minutes
export const REFRESH_TOKEN_EXPIRY_SECONDS = 604800; // 7 days - aligned with session TTL

// Token refresh threshold (in seconds)
export const REFRESH_THRESHOLD_SECONDS = 300; // 5 minutes before expiry

// Convert to milliseconds for components that need it
export const ACCESS_TOKEN_EXPIRY_MS = ACCESS_TOKEN_EXPIRY_SECONDS * 1000;
export const REFRESH_TOKEN_EXPIRY_MS = REFRESH_TOKEN_EXPIRY_SECONDS * 1000;
export const REFRESH_THRESHOLD_MS = REFRESH_THRESHOLD_SECONDS * 1000;

// CSRF configuration
export const CSRF_CONFIG = {
  HEADER_NAME: 'X-CSRF-Token',
  COOKIE_NAME: 'csrf_token'
};

// Cookie names
export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  CSRF_TOKEN: 'csrf_token',
  SESSION_ID: 'session_id'
};

// WebSocket notification settings
export const SOCKET_CONFIG = {
  NOTIFY_BEFORE_EXPIRY: true,
  EXPIRY_WARNING_TIME: 300, // 5 minutes before expiry
  REFRESH_QUEUE_DELAY: 100 // ms between concurrent refresh attempts
};

// Export as default for backward compatibility
export default {
  ACCESS_TOKEN_EXPIRY_SECONDS,
  REFRESH_TOKEN_EXPIRY_SECONDS,
  REFRESH_THRESHOLD_SECONDS,
  ACCESS_TOKEN_EXPIRY_MS,
  REFRESH_TOKEN_EXPIRY_MS,
  REFRESH_THRESHOLD_MS,
  CSRF_CONFIG,
  COOKIE_NAMES,
  SOCKET_CONFIG
};
