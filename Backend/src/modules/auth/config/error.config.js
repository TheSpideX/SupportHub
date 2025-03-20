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
  }
};

/**
 * Create standardized error response
 * @param {string} code - Error code from errorCodes
 * @param {string} [customMessage] - Optional custom message
 * @param {Object} [details] - Optional error details
 */
const createErrorResponse = (code, customMessage, details) => {
  const error = errorCodes[code] || {
    code: 'UNKNOWN_ERROR',
    status: 500,
    message: 'An unknown error occurred'
  };
  
  return {
    success: false,
    errorCode: error.code,
    message: customMessage || error.message,
    ...(details && { details })
  };
};

module.exports = {
  errorCodes,
  createErrorResponse
};