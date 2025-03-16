// API Configuration
export const API_CONFIG = {
  // Base configuration
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:4290', // Default to localhost:3000 if not set
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
  },

  // Request retry configuration
  RETRY: {
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // 1 second
    RETRY_STATUS_CODES: [408, 429, 500, 502, 503, 504],
  },

  // Rate limiting
  RATE_LIMIT: {
    MAX_REQUESTS_PER_SECOND: 10,
  },
} as const;

// CORS Configuration
export const CORS_CONFIG = {
  credentials: true,
  withCredentials: true,
  exposedHeaders: ['X-CSRF-Token'],
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
} as const;

// Response Status Codes
export const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Type exports
export type ApiConfig = typeof API_CONFIG;
export type ApiErrors = typeof API_ERRORS;
export type StatusCodes = typeof STATUS_CODES;