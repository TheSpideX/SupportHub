// Storage keys for cross-tab communication
export const STORAGE_KEYS = {
  AUTH_TOKENS: 'auth_tokens',
  REFRESH_TOKEN: 'refresh_token',
  ACCESS_TOKEN: 'access_token',
  USER_DATA: 'user_data',
  SECURITY_CONTEXT: 'security_context',
  SESSION_DATA: 'session_data',
  LOGOUT_EVENT: 'auth_logout',
  SESSION_UPDATED: 'auth_session_updated',
  AUTH_EVENT: 'auth_event'
};

// For backward compatibility
export const STORAGE = STORAGE_KEYS;

// Export all constants
export const AUTH_CONSTANTS = {
  SESSION: {
    EXPIRY_THRESHOLD: 5 * 60 * 1000, // 5 minutes
    WARNING_THRESHOLD: 10 * 60 * 1000, // 10 minutes
    CRITICAL_WARNING_THRESHOLD: 60 * 1000, // 1 minute
    VERIFICATION_TIMEOUT: 5 * 60 * 1000, // 5 minutes
    INACTIVITY_THRESHOLD: 30 * 60 * 1000 // 30 minutes
  },
  STORAGE_KEYS,
  ROUTES: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    VERIFY_EMAIL: '/auth/verify-email',
    TWO_FACTOR: '/auth/2fa',
    VERIFY_DEVICE: '/auth/verify-device',
    REAUTH: '/auth/reauth',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    DASHBOARD: '/dashboard',
  },
  ERROR_CODES: {
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    SESSION_EXPIRED: 'SESSION_EXPIRED',
    REQUIRES_2FA: 'REQUIRES_2FA',
    NETWORK_ERROR: 'NETWORK_ERROR',
    RATE_LIMITED: 'RATE_LIMITED',
    DEVICE_NOT_RECOGNIZED: 'DEVICE_NOT_RECOGNIZED',
    SECURITY_ACTION_REQUIRED: 'SECURITY_ACTION_REQUIRED'
  }
};

export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
};

export const AUTH_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_LOCKED: (time: number) => `Account locked. Try again in ${time} minutes`,
  SESSION_EXPIRED: 'Your session has expired. Please login again',
  DEVICE_NOT_TRUSTED: 'This device requires verification',
  NETWORK_ERROR: 'Connection error. Please check your internet connection',
  RATE_LIMITED: (time: number) => `Too many attempts. Try again in ${time} seconds`,
  SECURITY_CHECK_FAILED: 'Additional security verification required',
  MFA_REQUIRED: 'Two-factor authentication required',
  TOKEN_EXPIRED: 'Your session has expired',
  INVALID_TOKEN: 'Invalid authentication token',
  DEVICE_CHANGED: 'Device verification required',
  LOCATION_CHANGED: 'New location detected, verification required',
  CONCURRENT_SESSION: 'Another session is active',
  INVALID_MFA_CODE: 'Invalid verification code',
  PASSWORD_EXPIRED: 'Password change required',
  CSRF_ERROR: 'Security token error. Please refresh the page',
  INVALID_STATE: 'Session state error. Please login again',
  UNKNOWN_ERROR: 'An unexpected error occurred',
  INVALID_2FA_TOKEN: 'Verification session expired. Please login again',
  USER_NOT_FOUND: 'User not found',
  PASSWORD_COMPROMISED: 'Your password appears in a data breach. Please change it immediately',
  DEVICE_VERIFICATION_REQUIRED: 'This device needs to be verified',
  IP_BLOCKED: 'Access blocked due to suspicious activity',
  ACCOUNT_DISABLED: 'Your account has been disabled',
  PERMISSION_DENIED: 'You do not have permission to perform this action',
  SERVER_ERROR: 'Server error occurred. Please try again later',
  SERVER_UNAVAILABLE: 'Authentication server is not available. Please check if the backend is running.'
};

// Map backend error codes to redirect paths
export const AUTH_ERROR_REDIRECTS = {
  DEVICE_NOT_TRUSTED: '/auth/verify-device',
  MFA_REQUIRED: '/auth/two-factor',
  PASSWORD_EXPIRED: '/auth/change-password',
  LOCATION_CHANGED: '/auth/verify-location',
  SECURITY_CHECK_FAILED: '/auth/security-check'
};
