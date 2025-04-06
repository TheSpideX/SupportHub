/**
 * Authentication system constants
 * Based on the auth-system-architecture using HTTP-only cookies
 * Only includes data needed by frontend while maintaining consistency with backend
 */
import { API_CONFIG } from '../../../config/api';
import { 
  SESSION_TIMEOUT_MS, 
  SESSION_ACTIVITY_EVENTS 
} from './session-config';
import {
  ACCESS_TOKEN_EXPIRY_MS,
  REFRESH_TOKEN_EXPIRY_MS,
  REFRESH_THRESHOLD_MS,
  COOKIE_NAMES,
  CSRF_CONFIG
} from './token-config';

export const AUTH_CONSTANTS = {
  // Cookie names (for HTTP-only cookies set by server)
  COOKIES: COOKIE_NAMES,
  
  // Token settings (for reference, actual tokens managed by server)
  TOKENS: {
    ACCESS_EXPIRY: ACCESS_TOKEN_EXPIRY_MS,
    REFRESH_EXPIRY: REFRESH_TOKEN_EXPIRY_MS,
    REFRESH_THRESHOLD: REFRESH_THRESHOLD_MS,
  },
  
  // Session settings
  SESSION: {
    TIMEOUT: SESSION_TIMEOUT_MS,
    ACTIVITY_EVENTS: SESSION_ACTIVITY_EVENTS,
    INACTIVITY_CHECK_INTERVAL: 60 * 1000, // 1 minute
  },
  
  // Storage keys for localStorage/sessionStorage
  STORAGE_KEYS: {
    AUTH_TOKENS: 'auth_tokens',
    SECURITY_CONTEXT: 'auth_security_context',
    USER_DATA: 'auth_user_data',
    SESSION_DATA: 'auth_session_data'
  },
  
  // Error codes (matching backend)
  ERROR_CODES: {
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
    ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
    INVALID_TOKEN: 'INVALID_TOKEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    TOKEN_REVOKED: 'TOKEN_REVOKED',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
    DEVICE_NOT_TRUSTED: 'DEVICE_NOT_TRUSTED',
    RATE_LIMITED: 'RATE_LIMITED',
    LOCATION_CHANGED: 'LOCATION_CHANGED',
    IP_BLOCKED: 'IP_BLOCKED',
    MFA_REQUIRED: 'MFA_REQUIRED',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    SERVER_ERROR: 'SERVER_ERROR',
  },
  
  // API endpoints
  ENDPOINTS: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REGISTER: '/api/auth/register',
    REFRESH: '/api/auth/token/refresh',
    VERIFY_EMAIL: '/api/auth/verify-email',
    RESEND_VERIFICATION: '/api/auth/resend-verification',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
    CHANGE_PASSWORD: '/api/auth/change-password',
    TWO_FACTOR: '/api/auth/security/verify-2fa',
    VERIFY_DEVICE: '/api/auth/security/verify-device',
    CSRF_TOKEN: '/api/auth/token/csrf',
    USER_INFO: '/api/auth/me',
    STATUS: '/api/auth/status',
    VALIDATE_SESSION: '/api/auth/session/validate',
    SESSION_HEARTBEAT: '/api/auth/session/heartbeat',
    WS_AUTH_TOKEN: '/api/auth/token/ws-auth',
  },
  
  // Events for cross-component and cross-tab communication
  EVENTS: {
    LOGIN_SUCCESS: 'auth:login:success',
    LOGIN_FAILURE: 'auth:login:failure',
    LOGOUT: 'auth:logout',
    SESSION_EXPIRED: 'auth:session:expired',
    SESSION_TIMEOUT_WARNING: 'auth:session:timeout_warning',
    TOKEN_REFRESHED: 'auth:token:refreshed',
    TOKEN_REFRESH_FAILED: 'auth:token:refresh:failed',
    SECURITY_VIOLATION: 'auth:security:violation',
    USER_UPDATED: 'auth:user:updated',
    USER_ONLINE: 'user:online',
    USER_OFFLINE: 'user:offline',
    USER_IDLE: 'user:idle',
    USER_ACTIVE: 'user:active',
    CROSS_TAB_SYNC: 'auth:cross-tab:sync',
    FORCED_LOGOUT: 'auth:forced:logout',
    AUTH_ERROR: 'auth:error',
    INACTIVITY_LOGOUT: 'auth:inactivity:logout',
    TAB_VISIBLE: 'tab:visible',
    TAB_HIDDEN: 'tab:hidden',
  },
  
  // CSRF protection settings
  CSRF: {
    HEADER_NAME: CSRF_CONFIG.HEADER_NAME,
    COOKIE_NAME: CSRF_CONFIG.COOKIE_NAME,
    METHODS_REQUIRING_TOKEN: ['POST', 'PUT', 'PATCH', 'DELETE'],
  },
  
  // HTTP request settings
  HTTP: {
    WITH_CREDENTIALS: true, // Essential for sending cookies with requests
    RETRY_COUNT: 3,
    RETRY_DELAY: 1000,
    TIMEOUT: API_CONFIG.TIMEOUT || 15000, // 15 seconds
  },
  
  // Cross-tab synchronization settings
  CROSS_TAB: {
    ENABLED: true,
    CHANNEL_NAME: 'auth_session_channel',
    STORAGE_PREFIX: 'auth_sync_',
    STORAGE_LAST_SYNC: 'auth_sync_last_sync',
    STORAGE_LEADER: 'auth_sync_leader',
    DEBOUNCE_TIME: 300, // ms
    MESSAGE_TYPES: {
      SESSION_UPDATED: 'SESSION_UPDATED',
      SESSION_EXPIRED: 'SESSION_EXPIRED',
      USER_ACTIVITY: 'USER_ACTIVITY',
      TOKENS_UPDATED: 'TOKENS_UPDATED',
      LEADER_PING: 'LEADER_PING',
      LEADER_ELECTION: 'LEADER_ELECTION'
    }
  },
  
  // Security settings
  SECURITY: {
    LEVELS: {
      LOW: 'low',
      MEDIUM: 'medium',
      HIGH: 'high',
    },
    DEFAULT_LEVEL: 'medium',
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_REQUIRES_MIXED_CASE: true,
    PASSWORD_REQUIRES_NUMBERS: true,
    PASSWORD_REQUIRES_SYMBOLS: true,
  },
  
  // Feature flags
  FEATURES: {
    TWO_FACTOR_AUTH: true,
    REMEMBER_ME: true,
    PASSWORD_STRENGTH_METER: true,
    SOCIAL_LOGIN: false,
    CROSS_TAB_SYNC: true,
    OFFLINE_SUPPORT: false,
  },
};
