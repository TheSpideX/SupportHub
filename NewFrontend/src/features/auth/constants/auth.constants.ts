export const AUTH_CONSTANTS = {
  SESSION: {
    HEALTH_CHECK_INTERVAL: 60000, // 1 minute
    HEALTH_CHECK_THROTTLE: 30000, // 30 seconds minimum between checks
    EXPIRY_THRESHOLD: 300000, // 5 minutes
    MAX_INACTIVITY: 1800000, // 30 minutes
  },
  STORAGE: {
    AUTH_TOKENS: 'auth_tokens',
    SECURITY_CONTEXT: 'security_context',
    SESSION_DATA: 'session_data',
    LOGOUT_EVENT: 'auth_logout_event',
    SESSION_UPDATED: 'auth_session_updated'
  },
  STORAGE_KEYS: {
    AUTH_EVENT: 'auth_event',
    AUTH_TOKENS: 'auth_tokens',
    REMEMBER_ME: 'remember_me',
    DEVICE_ID: 'device_id',
    SECURITY_CONTEXT: 'security_context'
  },
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
