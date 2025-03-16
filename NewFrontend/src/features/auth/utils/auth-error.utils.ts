import { AuthErrorCode } from '../types/auth.types';
import axios from 'axios';
import { store } from '@/store';
import { setError, logout } from '../store/authSlice';
import { AUTH_ERROR_MESSAGES, AUTH_ERROR_REDIRECTS } from '../constants/auth.constants';

export interface AuthenticationError {
  code: AuthErrorCode | string;
  message: string;
  details?: Record<string, any>;
  redirectPath?: string;
  isNetworkError?: boolean;
}

/**
 * Centralized auth error handler
 * @param error Any error type
 * @param context Additional context about where the error occurred
 * @returns Standardized AuthenticationError
 */
export function handleAuthError(error: unknown, context?: { action?: string; component?: string }): AuthenticationError {
  // Create standardized error object
  const authError = createAuthError(error, context);
  
  // Log error with context
  logAuthError(authError, context);
  
  // Dispatch to store if available
  dispatchAuthError(authError);
  
  // Handle special cases (redirects, logout, etc.)
  handleSpecialCases(authError);
  
  return authError;
}

/**
 * Create standardized auth error from any error type
 */
function createAuthError(error: unknown, context?: { action?: string; component?: string }): AuthenticationError {
  // Default error
  let authError: AuthenticationError = {
    code: 'UNKNOWN_ERROR',
    message: AUTH_ERROR_MESSAGES.UNKNOWN_ERROR || 'An unknown error occurred',
    details: { context },
    isNetworkError: false
  };
  
  try {
    // Handle axios errors
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        authError = {
          code: 'NETWORK_ERROR',
          message: AUTH_ERROR_MESSAGES.NETWORK_ERROR || 'Network error occurred',
          details: { action: context?.action },
          isNetworkError: true
        };
      } else {
        // Extract error from response
        const serverError = error.response.data;
        
        if (serverError && serverError.code) {
          // Map backend error code to frontend error
          const errorCode = serverError.code;
          const errorMessage = getErrorMessage(errorCode, serverError.details);
          
          authError = {
            code: errorCode,
            message: errorMessage,
            details: { ...(serverError.details || {}), action: context?.action },
            redirectPath: AUTH_ERROR_REDIRECTS[errorCode as keyof typeof AUTH_ERROR_REDIRECTS]
          };
        } else {
          // Handle case where server response doesn't have expected structure
          authError = {
            code: 'SERVER_ERROR',
            message: AUTH_ERROR_MESSAGES.SERVER_ERROR || 'Server error occurred',
            details: { statusCode: error.response.status, action: context?.action }
          };
        }
      }
    } else if (error instanceof Error) {
      // Handle standard JS errors
      authError = {
        code: 'CLIENT_ERROR',
        message: error.message || 'Client error occurred',
        details: { stack: error.stack, action: context?.action }
      };
    } else if (typeof error === 'object' && error !== null) {
      // Handle error-like objects
      const errorObj = error as any;
      authError = {
        code: errorObj.code || 'UNKNOWN_ERROR',
        message: errorObj.message || AUTH_ERROR_MESSAGES.UNKNOWN_ERROR,
        details: { ...(errorObj.details || {}), action: context?.action },
        redirectPath: errorObj.redirectPath,
        isNetworkError: !!errorObj.isNetworkError
      };
    } else {
      // Handle other types of errors
      authError = {
        code: 'UNKNOWN_ERROR',
        message: typeof error === 'string' ? error : AUTH_ERROR_MESSAGES.UNKNOWN_ERROR,
        details: { errorType: typeof error, action: context?.action }
      };
    }
  } catch (handlingError) {
    console.error('Error in createAuthError:', handlingError);
    // Fallback error when error handling itself fails
    authError = {
      code: 'ERROR_HANDLING_FAILED',
      message: 'An unexpected error occurred',
      details: { action: context?.action }
    };
  }
  
  return authError;
}

/**
 * Get appropriate error message based on error code and details
 */
function getErrorMessage(code: string, details?: any): string {
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
  return AUTH_ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Log auth error with context
 */
function logAuthError(error: AuthenticationError, context?: { action?: string; component?: string }): void {
  const logContext = {
    code: error.code,
    action: context?.action || 'unknown',
    component: context?.component || 'unknown',
    isNetworkError: error.isNetworkError,
    timestamp: new Date().toISOString()
  };
  
  console.error(`[Auth Error] ${error.code}: ${error.message}`, logContext, error.details);
  
  // Add analytics tracking here if needed
}

/**
 * Dispatch auth error to Redux store
 */
function dispatchAuthError(error: AuthenticationError): void {
  if (store && store.dispatch) {
    store.dispatch(setError({
      code: error.code,
      message: error.message,
      details: error.details
    }));
  }
}

/**
 * Handle special cases for certain error types
 */
function handleSpecialCases(error: AuthenticationError): void {
  // Handle session expiry
  if (error.code === 'SESSION_EXPIRED' || error.code === 'TOKEN_EXPIRED' || error.code === 'INVALID_TOKEN') {
    if (store && store.dispatch) {
      store.dispatch(logout());
    }
  }
  
  // Handle redirect paths
  if (error.redirectPath && typeof window !== 'undefined') {
    window.location.href = error.redirectPath;
  }
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return !error.response && !!error.request;
  }
  
  if (typeof error === 'object' && error !== null) {
    return !!(error as any).isNetworkError;
  }
  
  return false;
}

/**
 * Check if an error requires user action
 */
export function requiresUserAction(error: AuthenticationError): boolean {
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
 * Get user-friendly error message for display
 */
export function getUserFriendlyMessage(error: unknown): string {
  const authError = createAuthError(error);
  return authError.message;
}