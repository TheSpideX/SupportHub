/**
 * Authentication system constants
 * Based on the auth-system-architecture using HTTP-only cookies
 */
// Import API config to ensure alignment
import { API_CONFIG } from '../../../config/api';

export const AUTH_CONSTANTS = {
  // Cookie names (for HTTP-only cookies set by server)
  COOKIES: {
    ACCESS_TOKEN: 'access_token', // Match backend naming
    REFRESH_TOKEN: 'refresh_token', // Match backend naming
    CSRF_TOKEN: 'csrf_token', // Match backend naming
    SESSION_ID: 'session-id',
  },
  
  // Token settings (for reference, actual tokens managed by server)
  TOKENS: {
    ACCESS_EXPIRY: 15 * 60 * 1000, // 15 minutes
    REFRESH_EXPIRY: 7 * 24 * 60 * 60 * 1000, // 7 days
    REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes before expiry
  },
  
  // Session settings
  SESSION: {
    TIMEOUT: API_CONFIG.AUTH.SESSION.TIMEOUT, // 30 minutes - reference API_CONFIG
    ACTIVITY_EVENTS: ['mousedown', 'keydown', 'scroll', 'touchstart'],
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
    TOKEN_REVOKED: 'TOKEN_REVOKED',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    DEVICE_NOT_TRUSTED: 'DEVICE_NOT_TRUSTED',
    RATE_LIMITED: 'RATE_LIMITED',
    LOCATION_CHANGED: 'LOCATION_CHANGED',
    IP_BLOCKED: 'IP_BLOCKED',
    MFA_REQUIRED: 'MFA_REQUIRED',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    SERVER_ERROR: 'SERVER_ERROR',
  },
  
  // API endpoints
  ENDPOINTS: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REGISTER: '/api/auth/register',
    REFRESH: '/api/auth/token/refresh',
    VERIFY_EMAIL: '/api/auth/verify-email',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
    CHANGE_PASSWORD: '/api/auth/change-password',
    TWO_FACTOR: '/api/auth/security/verify-2fa',
    VERIFY_DEVICE: '/api/auth/security/verify-device',
    CSRF_TOKEN: '/api/auth/token/csrf',
    USER_INFO: '/api/auth/me',
    VALIDATE_SESSION: '/api/auth/session/validate', // Updated to match backend
    SESSION_HEARTBEAT: '/api/auth/session/heartbeat',
  },
  
  // Events for cross-component and cross-tab communication
  EVENTS: {
    LOGIN_SUCCESS: 'auth:login:success',
    LOGIN_FAILURE: 'auth:login:failure',
    LOGOUT: 'auth:logout',
    SESSION_EXPIRED: 'auth:session:expired',
    TOKEN_REFRESHED: 'auth:token:refreshed',
    TOKEN_REFRESH_FAILED: 'auth:token:refresh:failed',
    SECURITY_VIOLATION: 'auth:security:violation',
    USER_UPDATED: 'auth:user:updated',
    CROSS_TAB_SYNC: 'auth:cross-tab:sync',
  },
  
  // CSRF protection settings
  CSRF: {
    HEADER_NAME: 'X-CSRF-Token',
    COOKIE_NAME: 'csrf_token', // Changed from 'XSRF-TOKEN' to match backend
    METHODS_REQUIRING_TOKEN: ['POST', 'PUT', 'PATCH', 'DELETE'],
  },
  
  // HTTP request settings
  HTTP: {
    WITH_CREDENTIALS: true, // Essential for sending cookies with requests
    RETRY_COUNT: 3,
    RETRY_DELAY: 1000,
    TIMEOUT: 15000, // 15 seconds
  },
  
  // Local storage keys (for non-sensitive data only)
  STORAGE: {
    USER_PREFERENCES: 'auth_user_prefs',
    THEME: 'auth_theme',
    LANGUAGE: 'auth_language',
    LAST_ACTIVE: 'auth_last_active',
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
