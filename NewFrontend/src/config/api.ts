// API Configuration
export const API_CONFIG = {
  // Base configuration
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:4290',
  TIMEOUT: 15000, // 15 seconds
  
  // Headers
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },

  // Authentication
  AUTH: {
    TOKEN_TYPE: 'Bearer',
    REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes in milliseconds
    TOKEN_STORAGE: {
      TYPE: 'httpOnly', // 'httpOnly', 'localStorage', 'sessionStorage'
      KEY_PREFIX: 'auth_'
    },
    SESSION: {
      EXPIRY_THRESHOLD: 15 * 60 * 1000, // 15 minutes
      ALERT_THRESHOLD: 5 * 60 * 1000, // 5 minutes
      STORAGE_KEY: 'session_data'
    }
  },

  // Request retry configuration
  RETRY: {
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // 1 second
    RETRY_STATUS_CODES: [408, 429, 500, 502, 503, 504],
    BACKOFF_FACTOR: 1.5 // Exponential backoff
  },

  // Rate limiting
  RATE_LIMIT: {
    MAX_REQUESTS_PER_SECOND: 10,
    BURST_SIZE: 20
  },

  // CSRF Protection
  CSRF: {
    HEADER_NAME: 'X-CSRF-Token',
    COOKIE_NAME: 'csrf_token', // Changed from 'XSRF-TOKEN' to match backend
    TOKEN_TTL: 30 * 60 * 1000 // 30 minutes
  },

  // Cache configuration
  CACHE: {
    TTL: 5 * 60 * 1000, // 5 minutes
    STORAGE_TYPE: 'memory', // 'memory', 'localStorage', 'sessionStorage'
    CACHEABLE_METHODS: ['GET']
  }
} as const;

// CORS Configuration
export const CORS_CONFIG = {
  credentials: true,
  withCredentials: true,
  exposedHeaders: ['X-CSRF-Token', 'Content-Disposition'],
};

// Error Messages
export const API_ERRORS = {
  NETWORK: 'Network error occurred. Please check your connection.',
  TIMEOUT: 'Request timed out. Please try again.',
  SERVER: 'Server error occurred. Please try again later.',
  UNAUTHORIZED: 'Unauthorized access. Please login again.',
  FORBIDDEN: 'Access forbidden. You don\'t have permission to access this resource.',
  NOT_FOUND: 'Requested resource not found.',
  VALIDATION: 'Validation error occurred. Please check your input.',
  RATE_LIMITED: 'Too many requests. Please try again later.',
  OFFLINE: 'You are currently offline. Some features may be unavailable.',
  CSRF_MISSING: 'CSRF token is missing or invalid. Please refresh the page.',
  SESSION_EXPIRED: 'Your session has expired. Please login again.'
} as const;

// Response Status Codes
export const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;

// Type exports
export type ApiConfig = typeof API_CONFIG;
export type ApiErrors = typeof API_ERRORS;
export type StatusCodes = typeof STATUS_CODES;
