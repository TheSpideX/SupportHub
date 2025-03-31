/**
 * Standardized error codes for authentication system
 */
const errorCodes = {
  // Authentication errors
  AUTH_REQUIRED: {
    code: 'AUTH_REQUIRED',
    status: 401,
    message: 'Authentication required'
  },
  INVALID_CREDENTIALS: {
    code: 'INVALID_CREDENTIALS',
    status: 401,
    message: 'Invalid email or password'
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    status: 401,
    message: 'Authentication token has expired'
  },
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    status: 401,
    message: 'Invalid authentication token'
  },
  
  // Session errors
  SESSION_EXPIRED: {
    code: 'SESSION_EXPIRED',
    status: 401,
    message: 'Session has expired'
  },
  SESSION_NOT_FOUND: {
    code: 'SESSION_NOT_FOUND',
    status: 404,
    message: 'Session not found'
  },
  SESSION_TERMINATED: {
    code: 'SESSION_TERMINATED',
    status: 401,
    message: 'Session has been terminated'
  },
  SESSION_LIMIT_EXCEEDED: {
    code: 'SESSION_LIMIT_EXCEEDED',
    status: 403,
    message: 'Maximum number of active sessions exceeded'
  },
  
  // CSRF errors
  CSRF_MISSING: {
    code: 'CSRF_MISSING',
    status: 403,
    message: 'CSRF token is missing'
  },
  CSRF_INVALID: {
    code: 'CSRF_INVALID',
    status: 403,
    message: 'Invalid CSRF token'
  },
  
  // Permission errors
  FORBIDDEN: {
    code: 'FORBIDDEN',
    status: 403,
    message: 'You do not have permission to access this resource'
  },
  
  // WebSocket specific errors
  SOCKET_CONNECTION_ERROR: {
    code: 'SOCKET_CONNECTION_ERROR',
    status: 500,
    message: 'Failed to establish WebSocket connection'
  },
  SOCKET_AUTH_FAILED: {
    code: 'SOCKET_AUTH_FAILED',
    status: 401,
    message: 'WebSocket authentication failed'
  },
  SOCKET_ROOM_JOIN_FAILED: {
    code: 'SOCKET_ROOM_JOIN_FAILED',
    status: 403,
    message: 'Failed to join WebSocket room'
  },
  SOCKET_ROOM_NOT_FOUND: {
    code: 'SOCKET_ROOM_NOT_FOUND',
    status: 404,
    message: 'WebSocket room not found'
  },
  SOCKET_EVENT_REJECTED: {
    code: 'SOCKET_EVENT_REJECTED',
    status: 403,
    message: 'WebSocket event rejected'
  },
  SOCKET_RATE_LIMITED: {
    code: 'SOCKET_RATE_LIMITED',
    status: 429,
    message: 'Too many WebSocket requests'
  },
  
  // Token refresh errors
  TOKEN_REFRESH_FAILED: {
    code: 'TOKEN_REFRESH_FAILED',
    status: 401,
    message: 'Failed to refresh authentication token'
  },
  TOKEN_REVOKED: {
    code: 'TOKEN_REVOKED',
    status: 401,
    message: 'Authentication token has been revoked'
  },
  
  // Device errors
  DEVICE_NOT_RECOGNIZED: {
    code: 'DEVICE_NOT_RECOGNIZED',
    status: 403,
    message: 'Device not recognized'
  },
  DEVICE_VERIFICATION_REQUIRED: {
    code: 'DEVICE_VERIFICATION_REQUIRED',
    status: 403,
    message: 'Device verification required'
  },
  DEVICE_BLOCKED: {
    code: 'DEVICE_BLOCKED',
    status: 403,
    message: 'Device has been blocked'
  },
  
  // Cross-tab coordination errors
  LEADER_ELECTION_FAILED: {
    code: 'LEADER_ELECTION_FAILED',
    status: 500,
    message: 'Failed to elect leader tab'
  },
  TAB_SYNC_ERROR: {
    code: 'TAB_SYNC_ERROR',
    status: 500,
    message: 'Failed to synchronize tabs'
  },
  
  // Room hierarchy errors
  ROOM_HIERARCHY_ERROR: {
    code: 'ROOM_HIERARCHY_ERROR',
    status: 500,
    message: 'Error in room hierarchy'
  },
  PARENT_ROOM_NOT_JOINED: {
    code: 'PARENT_ROOM_NOT_JOINED',
    status: 400,
    message: 'Parent room must be joined first'
  },
  
  // Event propagation errors
  EVENT_PROPAGATION_FAILED: {
    code: 'EVENT_PROPAGATION_FAILED',
    status: 500,
    message: 'Failed to propagate event'
  },
  EVENT_VALIDATION_FAILED: {
    code: 'EVENT_VALIDATION_FAILED',
    status: 400,
    message: 'Event validation failed'
  },
  
  // Security events
  SECURITY_PASSWORD_CHANGED: {
    code: 'SECURITY_PASSWORD_CHANGED',
    status: 401,
    message: 'Password has been changed'
  },
  SECURITY_SUSPICIOUS_ACTIVITY: {
    code: 'SECURITY_SUSPICIOUS_ACTIVITY',
    status: 403,
    message: 'Suspicious activity detected'
  },
  
  // Network errors
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR',
    status: 503,
    message: 'Network error occurred'
  },
  TIMEOUT_ERROR: {
    code: 'TIMEOUT_ERROR',
    status: 504,
    message: 'Request timed out'
  },
  
  // Server errors
  SERVER_ERROR: {
    code: 'SERVER_ERROR',
    status: 500,
    message: 'Server error occurred'
  },
  SERVICE_UNAVAILABLE: {
    code: 'SERVICE_UNAVAILABLE',
    status: 503,
    message: 'Service temporarily unavailable'
  },
  
  // Validation errors
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    status: 400,
    message: 'Validation error occurred'
  },
  INVALID_REQUEST: {
    code: 'INVALID_REQUEST',
    status: 400,
    message: 'Invalid request'
  },
  
  // Rate limiting
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    status: 429,
    message: 'Too many requests'
  }
};

/**
 * Create standardized error response
 * @param {string} code - Error code from errorCodes
 * @param {string} [customMessage] - Optional custom message
 * @param {Object} [details] - Optional error details
 * @param {Object} [metadata] - Optional metadata for logging/tracking
 * @returns {Object} Standardized error response object
 */
const createErrorResponse = (code, customMessage, details, metadata = {}) => {
  const error = errorCodes[code] || {
    code: 'UNKNOWN_ERROR',
    status: 500,
    message: 'An unknown error occurred'
  };
  
  // Log error with metadata if provided
  if (metadata.logError && typeof metadata.logger === 'function') {
    metadata.logger({
      code: error.code,
      message: customMessage || error.message,
      details,
      ...metadata
    });
  }
  
  return {
    success: false,
    errorCode: error.code,
    message: customMessage || error.message,
    ...(details && { details }),
    status: error.status
  };
};

/**
 * Map HTTP status code to appropriate error
 * @param {number} statusCode - HTTP status code
 * @param {string} [defaultMessage] - Optional default message
 * @returns {string} Error code
 */
const mapStatusToErrorCode = (statusCode, defaultMessage) => {
  switch (statusCode) {
    case 400: return 'INVALID_REQUEST';
    case 401: return 'AUTH_REQUIRED';
    case 403: return 'FORBIDDEN';
    case 404: return 'SESSION_NOT_FOUND';
    case 429: return 'RATE_LIMITED';
    case 500: return 'SERVER_ERROR';
    case 503: return 'SERVICE_UNAVAILABLE';
    case 504: return 'TIMEOUT_ERROR';
    default: return 'UNKNOWN_ERROR';
  }
};

/**
 * Group errors by category for easier reference
 */
const errorCategories = {
  authentication: [
    'AUTH_REQUIRED',
    'INVALID_CREDENTIALS',
    'TOKEN_EXPIRED',
    'INVALID_TOKEN',
    'TOKEN_REFRESH_FAILED',
    'TOKEN_REVOKED'
  ],
  session: [
    'SESSION_EXPIRED',
    'SESSION_NOT_FOUND',
    'SESSION_TERMINATED',
    'SESSION_LIMIT_EXCEEDED'
  ],
  security: [
    'CSRF_MISSING',
    'CSRF_INVALID',
    'FORBIDDEN',
    'SECURITY_PASSWORD_CHANGED',
    'SECURITY_SUSPICIOUS_ACTIVITY'
  ],
  websocket: [
    'SOCKET_CONNECTION_ERROR',
    'SOCKET_AUTH_FAILED',
    'SOCKET_ROOM_JOIN_FAILED',
    'SOCKET_ROOM_NOT_FOUND',
    'SOCKET_EVENT_REJECTED',
    'SOCKET_RATE_LIMITED'
  ],
  device: [
    'DEVICE_NOT_RECOGNIZED',
    'DEVICE_VERIFICATION_REQUIRED',
    'DEVICE_BLOCKED'
  ],
  crossTab: [
    'LEADER_ELECTION_FAILED',
    'TAB_SYNC_ERROR'
  ],
  roomHierarchy: [
    'ROOM_HIERARCHY_ERROR',
    'PARENT_ROOM_NOT_JOINED'
  ],
  eventPropagation: [
    'EVENT_PROPAGATION_FAILED',
    'EVENT_VALIDATION_FAILED'
  ],
  network: [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'SERVICE_UNAVAILABLE'
  ],
  server: [
    'SERVER_ERROR'
  ],
  validation: [
    'VALIDATION_ERROR',
    'INVALID_REQUEST'
  ],
  rateLimit: [
    'RATE_LIMITED'
  ]
};

module.exports = {
  errorCodes,
  createErrorResponse,
  mapStatusToErrorCode,
  errorCategories
};
