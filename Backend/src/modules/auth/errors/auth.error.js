/**
 * Custom error class for authentication-related errors
 */
class AuthError extends Error {
  /**
   * Create a new AuthError
   * @param {string} code - Error code
   * @param {Object|string} messageOrOptions - Error message or options object
   * @param {Object} [details] - Additional error details (if first param is string)
   */
  constructor(code, messageOrOptions = {}, details = {}) {
    // Standard error messages to prevent information leakage
    const errorMessages = {
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
      'PERMISSION_DENIED': 'Permission denied',
      'SERVER_ERROR': 'Internal server error'
    };
    
    let message;
    let optionsObj = {};
    
    // Handle different parameter patterns
    if (typeof messageOrOptions === 'string') {
      message = messageOrOptions;
      optionsObj = { details };
    } else {
      optionsObj = messageOrOptions || {};
      message = optionsObj.message || errorMessages[code] || 'Authentication error';
    }
    
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.details = optionsObj.details || {};
    this.timestamp = new Date();
    this.status = optionsObj.statusCode || AuthError.getStatusCode(code);
    
    // Remove sensitive information from details
    if (this.details.password) delete this.details.password;
    if (this.details.token) delete this.details.token;
    
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