const logger = require('../../../utils/logger');
const AppError = require('../../../utils/appError');

/**
 * Tiered error recovery approach for authentication errors
 */
class AuthErrorHandler {
  constructor() {
    this.errorMetrics = {
      level1Count: 0,
      level2Count: 0,
      level3Count: 0,
      level4Count: 0
    };
  }
  
  /**
   * Handle authentication errors with tiered recovery approach
   * @param {Error} error - The error to handle
   * @param {Object} options - Options for error handling
   * @returns {Object} - Response with error details and recovery action
   */
  handleError(error, options = {}) {
    const { userId, sessionId, requestId, source } = options;
    
    // Log error with context
    logger.error('Auth error:', {
      message: error.message,
      code: error.code,
      userId,
      sessionId,
      requestId,
      source,
      stack: error.stack
    });
    
    // Determine error level
    const errorLevel = this.determineErrorLevel(error);
    
    // Track error metrics
    this.trackErrorMetrics(errorLevel);
    
    // Apply recovery strategy based on level
    return this.applyRecoveryStrategy(error, errorLevel, options);
  }
  
  /**
   * Determine the error level based on error type
   * @param {Error} error - The error to categorize
   * @returns {number} - Error level (1-4)
   */
  determineErrorLevel(error) {
    // Level 1 (Silent): Automatic retries without user notification
    if (
      error.code === 'TOKEN_EXPIRED' || 
      error.code === 'NETWORK_ERROR' ||
      error.name === 'TokenExpiredError'
    ) {
      return 1;
    }
    
    // Level 2 (Background): Retries with non-intrusive user notification
    if (
      error.code === 'SESSION_EXPIRED' ||
      error.code === 'REFRESH_NEEDED' ||
      error.code === 'CSRF_INVALID'
    ) {
      return 2;
    }
    
    // Level 3 (User-Assisted): Requires user action to resolve
    if (
      error.code === 'INVALID_CREDENTIALS' ||
      error.code === 'ACCOUNT_LOCKED' ||
      error.code === 'PASSWORD_EXPIRED' ||
      error.code === 'MFA_REQUIRED'
    ) {
      return 3;
    }
    
    // Level 4 (Fallback): Alternative authentication flow
    if (
      error.code === 'AUTH_SERVICE_DOWN' ||
      error.code === 'DATABASE_ERROR' ||
      error.code === 'CRITICAL_ERROR'
    ) {
      return 4;
    }
    
    // Default to Level 3 if unknown
    return 3;
  }
  
  /**
   * Apply recovery strategy based on error level
   * @param {Error} error - The original error
   * @param {number} level - Error level (1-4)
   * @param {Object} options - Context options
   * @returns {Object} - Response with recovery action
   */
  applyRecoveryStrategy(error, level, options) {
    switch (level) {
      case 1: // Silent recovery
        return {
          success: false,
          error: {
            message: 'Temporary issue detected',
            code: error.code || 'TEMPORARY_ERROR',
            level: 'silent'
          },
          recovery: {
            action: 'RETRY',
            delay: 1000,
            maxRetries: 3
          }
        };
        
      case 2: // Background recovery
        return {
          success: false,
          error: {
            message: error.message || 'Session issue detected',
            code: error.code || 'SESSION_ERROR',
            level: 'background'
          },
          recovery: {
            action: 'REFRESH_SESSION',
            notification: true,
            redirectUrl: null
          }
        };
        
      case 3: // User-assisted recovery
        return {
          success: false,
          error: {
            message: error.message || 'Authentication required',
            code: error.code || 'AUTH_REQUIRED',
            level: 'user-assisted'
          },
          recovery: {
            action: 'REAUTHENTICATE',
            notification: true,
            redirectUrl: '/auth/login'
          }
        };
        
      case 4: // Fallback recovery
        return {
          success: false,
          error: {
            message: 'Critical authentication error',
            code: error.code || 'CRITICAL_ERROR',
            level: 'fallback'
          },
          recovery: {
            action: 'ALTERNATIVE_AUTH',
            notification: true,
            redirectUrl: '/auth/alternative'
          }
        };
        
      default:
        return {
          success: false,
          error: {
            message: error.message || 'Unknown authentication error',
            code: error.code || 'UNKNOWN_ERROR',
            level: 'critical'
          },
          recovery: {
            action: 'CONTACT_SUPPORT',
            notification: true
          }
        };
    }
  }
  
  /**
   * Track error metrics for monitoring
   * @param {number} level - Error level
   */
  trackErrorMetrics(level) {
    switch (level) {
      case 1:
        this.errorMetrics.level1Count++;
        break;
      case 2:
        this.errorMetrics.level2Count++;
        break;
      case 3:
        this.errorMetrics.level3Count++;
        break;
      case 4:
        this.errorMetrics.level4Count++;
        break;
    }
    
    // Report metrics if threshold reached
    if (this.errorMetrics.level4Count > 5) {
      logger.warn('Critical auth errors threshold reached', this.errorMetrics);
      // Could trigger alerts or notifications here
    }
  }
  
  /**
   * Get current error metrics
   * @returns {Object} - Error metrics
   */
  getErrorMetrics() {
    return { ...this.errorMetrics };
  }
}

// Export singleton instance
module.exports = new AuthErrorHandler();