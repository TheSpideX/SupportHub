import { AuthErrorCode } from '../types/auth.types';
import axios from 'axios';
import { AUTH_ERROR_MESSAGES, AUTH_ERROR_REDIRECTS } from '../constants/auth.constants';

export type AuthErrorCode = 
  | 'INVALID_CREDENTIALS'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'SESSION_EXPIRED'
  | 'DEVICE_NOT_TRUSTED'
  | 'MFA_REQUIRED'
  | 'ACCOUNT_LOCKED'
  | 'SECURITY_CHECK_FAILED'
  | 'TOKEN_EXPIRED'
  | 'INVALID_TOKEN'
  | 'DEVICE_CHANGED'
  | 'LOCATION_CHANGED'
  | 'CONCURRENT_SESSION'
  | 'INVALID_MFA_CODE'
  | 'PASSWORD_EXPIRED'
  | 'CSRF_INVALID'
  | 'CSRF_ERROR';

export interface AuthenticationError {
  code: AuthErrorCode | string;
  message: string;
  details?: Record<string, any>;
  redirectPath?: string;
  isNetworkError?: boolean;
  timestamp?: Date;
  status?: number;
  originalError?: unknown;
}

export class AuthError extends Error {
  public readonly code: AuthErrorCode | string;
  public readonly redirectPath?: string;
  public readonly details?: Record<string, any>;
  public readonly isNetworkError: boolean;
  public readonly timestamp: Date;
  public readonly status?: number;
  public readonly originalError?: unknown;

  constructor(
    codeOrOptions: AuthErrorCode | string | AuthenticationError,
    message?: string,
    details?: Record<string, any>
  ) {
    // Handle different constructor patterns
    if (typeof codeOrOptions === 'object') {
      const options = codeOrOptions;
      super(options.message);
      this.code = options.code;
      this.details = options.details;
      this.redirectPath = options.redirectPath;
      this.isNetworkError = !!options.isNetworkError;
      this.status = options.status;
      this.originalError = options.originalError;
    } else {
      super(message || getAuthErrorMessage(codeOrOptions));
      this.code = codeOrOptions;
      this.details = details;
      this.redirectPath = AUTH_ERROR_REDIRECTS[codeOrOptions as keyof typeof AUTH_ERROR_REDIRECTS];
      this.isNetworkError = codeOrOptions === 'NETWORK_ERROR';
    }

    this.name = 'AuthError';
    this.timestamp = new Date();
  }

  toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      redirectPath: this.redirectPath,
      isNetworkError: this.isNetworkError,
      timestamp: this.timestamp,
      status: this.status
    };
  }
}

/**
 * Create standardized auth error from any error type
 */
export function createAuthError(error: unknown, context?: { action?: string; component?: string }): AuthenticationError {
  // Default error
  let authError: AuthenticationError = {
    code: 'UNKNOWN_ERROR',
    message: getAuthErrorMessage('UNKNOWN_ERROR'),
    details: { context },
    isNetworkError: false,
    timestamp: new Date()
  };
  
  try {
    // Handle axios errors
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        authError = {
          code: 'NETWORK_ERROR',
          message: getAuthErrorMessage('NETWORK_ERROR'),
          details: { action: context?.action },
          isNetworkError: true,
          originalError: error
        };
      } else {
        // Extract error from response
        const serverError = error.response.data;
        
        if (serverError && serverError.code) {
          // Map backend error code to frontend error
          const errorCode = serverError.code;
          const errorMessage = getAuthErrorMessage(errorCode, serverError.details);
          
          authError = {
            code: errorCode,
            message: errorMessage,
            details: { ...(serverError.details || {}), action: context?.action },
            redirectPath: AUTH_ERROR_REDIRECTS[errorCode as keyof typeof AUTH_ERROR_REDIRECTS],
            status: error.response.status,
            originalError: error
          };
        } else {
          // Handle case where server response doesn't have expected structure
          authError = {
            code: 'SERVER_ERROR',
            message: getAuthErrorMessage('SERVER_ERROR'),
            details: { statusCode: error.response.status, action: context?.action },
            status: error.response.status,
            originalError: error
          };
        }
      }
    } else if (error instanceof AuthError) {
      // Return existing AuthError
      return error;
    } else if (error instanceof Error) {
      // Handle standard JS errors
      authError = {
        code: 'CLIENT_ERROR',
        message: error.message || getAuthErrorMessage('CLIENT_ERROR'),
        details: { stack: error.stack, action: context?.action },
        originalError: error
      };
    } else if (typeof error === 'object' && error !== null) {
      // Handle error-like objects
      const errorObj = error as any;
      authError = {
        code: errorObj.code || 'UNKNOWN_ERROR',
        message: errorObj.message || getAuthErrorMessage('UNKNOWN_ERROR'),
        details: { ...(errorObj.details || {}), action: context?.action },
        redirectPath: errorObj.redirectPath,
        isNetworkError: !!errorObj.isNetworkError,
        originalError: error
      };
    } else {
      // Handle other types of errors
      authError = {
        code: 'UNKNOWN_ERROR',
        message: typeof error === 'string' ? error : getAuthErrorMessage('UNKNOWN_ERROR'),
        details: { errorType: typeof error, action: context?.action },
        originalError: error
      };
    }
  } catch (handlingError) {
    console.error('Error in createAuthError:', handlingError);
    // Fallback error when error handling itself fails
    authError = {
      code: 'ERROR_HANDLING_FAILED',
      message: 'An unexpected error occurred',
      details: { action: context?.action, handlingError }
    };
  }
  
  return authError;
}

/**
 * Type guard to check if an error is an AuthError
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError || 
         (typeof error === 'object' && 
          error !== null && 
          'code' in error && 
          'message' in error);
}

/**
 * Get appropriate error message based on error code and details
 */
export function getAuthErrorMessage(code: string | AuthErrorCode, details?: any): string {
  const messageHandler = AUTH_ERROR_MESSAGES[code as keyof typeof AUTH_ERROR_MESSAGES];
  
  // If message is a function (for dynamic messages)
  if (typeof messageHandler === 'function') {
    // For time-based messages (lockout, rate limiting)
    if (details?.lockoutDuration) {
      const minutes = Math.ceil(details.lockoutDuration / 60000);
      return messageHandler(minutes);
    }
    
    if (details?.remainingTime) {
      const seconds = Math.ceil(details.remainingTime / 1000);
      return messageHandler(seconds);
    }
    
    // Default value if no details
    return messageHandler(5);
  }
  
  // If message is a string
  if (typeof messageHandler === 'string') {
    return messageHandler;
  }
  
  // Default message
  return AUTH_ERROR_MESSAGES.UNKNOWN_ERROR || 'An unknown error occurred';
}

/**
 * Map API errors to client-side auth errors
 */
export function mapApiErrorToAuthError(apiError: any): AuthError {
  // Extract error details from response if available
  const status = apiError.response?.status || 500;
  const errorData = apiError.response?.data?.error || {};
  
  return new AuthError({
    code: errorData.code || `HTTP_${status}`,
    message: errorData.message || 'Authentication request failed',
    details: errorData.details || {},
    status,
    originalError: apiError
  });
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return !error.response && !!error.request;
  }
  
  if (error instanceof AuthError) {
    return error.isNetworkError;
  }
  
  if (typeof error === 'object' && error !== null) {
    return !!(error as any).isNetworkError;
  }
  
  return false;
}

/**
 * Check if an error requires user action
 */
export function requiresUserAction(error: AuthenticationError | AuthError): boolean {
  const actionRequiredCodes = [
    'DEVICE_NOT_TRUSTED',
    'MFA_REQUIRED',
    'PASSWORD_EXPIRED',
    'SECURITY_CHECK_FAILED',
    'LOCATION_CHANGED'
  ];
  
  return actionRequiredCodes.includes(error.code as string);
}

/**
 * Categorize auth errors by severity
 */
export function getErrorSeverity(error: AuthenticationError | AuthError): 'low' | 'medium' | 'high' {
  const highSeverityCodes = [
    'ACCOUNT_LOCKED',
    'SECURITY_CHECK_FAILED',
    'CONCURRENT_SESSION',
    'SUSPICIOUS_ACTIVITY'
  ];
  
  const mediumSeverityCodes = [
    'INVALID_CREDENTIALS',
    'SESSION_EXPIRED',
    'TOKEN_EXPIRED',
    'DEVICE_CHANGED',
    'LOCATION_CHANGED'
  ];
  
  if (highSeverityCodes.includes(error.code as string)) {
    return 'high';
  }
  
  if (mediumSeverityCodes.includes(error.code as string)) {
    return 'medium';
  }
  
  return 'low';
}

/**
 * Get user-friendly error message for display in UI components
 * @param error Any error type that will be normalized to AuthError
 * @returns User-friendly error message string
 */
export function getUserFriendlyMessage(error: unknown): string {
  // Convert to AuthError if not already
  const authError = error instanceof AuthError 
    ? error 
    : new AuthError(createAuthError(error));
  
  // Return user-friendly message based on error code
  switch (authError.code) {
    case 'INVALID_CREDENTIALS':
      return 'The email or password you entered is incorrect. Please try again.';
    
    case 'ACCOUNT_LOCKED':
      return `Your account has been temporarily locked due to multiple failed login attempts. 
              Please try again ${authError.details?.lockoutDuration 
                ? `in ${Math.ceil(authError.details.lockoutDuration / 60000)} minutes` 
                : 'later'}.`;
    
    case 'RATE_LIMITED':
      return 'Too many login attempts. Please try again later.';
    
    case 'NETWORK_ERROR':
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    
    case 'SESSION_EXPIRED':
      return 'Your session has expired. Please log in again.';
    
    case 'MFA_REQUIRED':
      return 'Additional verification is required. Please check your email or authentication app.';
    
    case 'DEVICE_NOT_TRUSTED':
      return 'Login from a new device detected. Please verify your identity.';
    
    case 'PASSWORD_EXPIRED':
      return 'Your password has expired. Please reset your password to continue.';
    
    default:
      return authError.message || 'An unexpected error occurred. Please try again.';
  }
}

export { handleAuthError } from '../utils/auth-error.utils';
