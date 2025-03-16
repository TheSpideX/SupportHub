/**
 * Custom error class for authentication-related errors
 */
class AuthError extends Error {
  /**
   * Create a new AuthError
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {Object} details - Additional error details
   */
  constructor(message, code = 'UNKNOWN_ERROR', details = {}) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
    this.status = AuthError.getStatusCode(code);
    
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON() {
    return {
      success: false,
      error: {
        message: this.message,
        code: this.code,
        details: this.details,
        timestamp: this.timestamp
      }
    };
  }

  /**
   * Get default message for error code
   * @param {string} code - Error code
   * @returns {string} Default error message
   */
  static getDefaultMessage(code) {
    const messages = {
      'INVALID_CREDENTIALS': 'Invalid email or password',
      'ACCOUNT_INACTIVE': 'Account is inactive',
      'ACCOUNT_LOCKED': 'Account is locked due to too many failed attempts',
      'INVALID_TOKEN': 'Invalid or expired token',
      'TOKEN_REVOKED': 'Token has been revoked',
      'SESSION_EXPIRED': 'Session has expired',
      'DEVICE_NOT_TRUSTED': 'Device verification required',
      'RATE_LIMITED': 'Too many requests, please try again later',
      'LOCATION_CHANGED': 'Suspicious login location detected',
      'IP_BLOCKED': 'Your IP address has been temporarily blocked',
      'MFA_REQUIRED': 'Multi-factor authentication required',
      'PERMISSION_DENIED': 'You do not have permission to perform this action',
      'NETWORK_ERROR': 'Network connection error',
      'SERVER_ERROR': 'Server error occurred',
      'UNKNOWN_ERROR': 'An unknown error occurred'
    };
    
    return messages[code] || 'Authentication error';
  }

  /**
   * Get HTTP status code for error code
   * @param {string} code - Error code
   * @returns {number} HTTP status code
   */
  static getStatusCode(code) {
    const statusCodes = {
      'INVALID_CREDENTIALS': 401,
      'ACCOUNT_INACTIVE': 403,
      'ACCOUNT_LOCKED': 403,
      'INVALID_TOKEN': 401,
      'TOKEN_REVOKED': 401,
      'SESSION_EXPIRED': 401,
      'DEVICE_NOT_TRUSTED': 401,
      'RATE_LIMITED': 429,
      'LOCATION_CHANGED': 403,
      'IP_BLOCKED': 403,
      'MFA_REQUIRED': 403,
      'PERMISSION_DENIED': 403,
      'SERVER_ERROR': 500
    };
    
    return statusCodes[code] || 500;
  }
}

module.exports = AuthError;