/**
 * TODO: Future Enhancements
 * 1. Implement processOfflineAuthQueue function to handle offline authentication actions
 * 2. Add comprehensive user data fetching with caching strategy
 * 3. Enhance session security with additional validation checks
 * 4. Implement token refresh mechanism with proper retry logic
 * 5. Add support for multi-factor authentication flows
 * 6. Implement proper security context validation
 * 7. Add biometric authentication support for mobile devices
 * 8. Implement progressive authentication for offline scenarios
 * 9. Add comprehensive error handling with recovery strategies
 */

import { logger } from '@/utils/logger';
import { encryptData, decryptData } from '@/utils/crypto';
import { 
  getSessionMetadata, 
  hasAuthTokens, 
  getOfflineAuthQueue,
  queueOfflineAuthAction as storageQueueAction
} from './storage.utils';
import { jwtDecode } from 'jwt-decode';
import {
  UserData,
  TokenData,
  SessionData,
  SecurityContext,
  AuthError,
  OfflineAuthAction,
  AUTH_ERROR_CODES
} from '../types/auth.types';

/**
 * Extracts session data from tokens and metadata
 * This function processes token data but relies on storage.utils for retrieval
 * @param tokenData - Token data
 * @returns Session data
 */
export function extractSessionData(tokenData: TokenData): SessionData {
  const metadata = getSessionMetadata() || { lastActivity: Date.now() };
  
  return {
    userId: tokenData.userId || '',
    expiresAt: tokenData.exp ? tokenData.exp * 1000 : calculateSessionExpiry(30 * 60), // Default 30 min
    createdAt: tokenData.iat ? tokenData.iat * 1000 : Date.now(),
    lastActivity: metadata.lastActivity,
    deviceInfo: {
      browser: getBrowserInfo(),
      os: getOSInfo(),
      deviceType: getDeviceType()
    }
  };
}

/**
 * Calculates session expiry timestamp
 * @param durationSeconds - Session duration in seconds
 * @returns Expiry timestamp
 */
export function calculateSessionExpiry(durationSeconds: number): number {
  return Date.now() + (durationSeconds * 1000);
}

/**
 * Checks if a session is expired
 * @param sessionData - The session data to check
 * @returns True if the session is expired
 */
export function isSessionExpired(sessionData?: SessionData): boolean {
  if (!sessionData) return true;
  const now = Date.now();
  return now >= sessionData.expiresAt;
}

/**
 * Sanitizes credentials by removing sensitive data
 * @param data - Data to sanitize
 * @returns Sanitized data
 */
export function sanitizeCredentials(data: any): any {
  if (!data) return data;
  
  const sanitized = { ...data };
  
  // Remove sensitive fields
  if ('password' in sanitized) sanitized.password = '[REDACTED]';
  if ('token' in sanitized) sanitized.token = '[REDACTED]';
  if ('refreshToken' in sanitized) sanitized.refreshToken = '[REDACTED]';
  
  return sanitized;
}

// Security context evaluation
// Removed evaluateSecurityContext function

// Removed processOfflineAuthQueue function

/**
 * Queues an authentication action for offline processing
 * This is a wrapper around the storage utility that adds auth-specific logic
 * @param action - Action type
 * @param payload - Action payload
 * @returns Promise that resolves when action is queued
 */
export async function queueOfflineAuthAction(
  action: 'login' | 'logout' | 'refresh' | 'update',
  payload: any
): Promise<string> {
  const actionId = `${action}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const offlineAction: OfflineAuthAction = {
    type: action,
    payload: sanitizeCredentials(payload),
    timestamp: Date.now(),
    id: actionId
  };
  
  // Use the imported function from storage.utils.ts
  await storageQueueAction(offlineAction);
  
  logger.debug(`Queued offline auth action: ${action}`, { actionId });
  
  return actionId;
}

// Implement proper browser detection utilities instead of placeholders
function getBrowserInfo(): string {
  const userAgent = navigator.userAgent;
  if (userAgent.indexOf("Chrome") > -1) return "Chrome";
  if (userAgent.indexOf("Safari") > -1) return "Safari";
  if (userAgent.indexOf("Firefox") > -1) return "Firefox";
  if (userAgent.indexOf("MSIE") > -1 || userAgent.indexOf("Trident") > -1) return "IE";
  if (userAgent.indexOf("Edge") > -1) return "Edge";
  return "Unknown";
}

function getOSInfo(): string {
  const userAgent = navigator.userAgent;
  if (userAgent.indexOf("Windows") > -1) return "Windows";
  if (userAgent.indexOf("Mac") > -1) return "MacOS";
  if (userAgent.indexOf("Linux") > -1) return "Linux";
  if (userAgent.indexOf("Android") > -1) return "Android";
  if (userAgent.indexOf("iOS") > -1 || userAgent.indexOf("iPhone") > -1 || userAgent.indexOf("iPad") > -1) return "iOS";
  return "Unknown";
}

function getDeviceType(): string {
  const userAgent = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) return "Tablet";
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(userAgent)) return "Mobile";
  return "Desktop";
}

/**
 * Checks if the current authentication state is valid
 * @returns Boolean indicating if auth state is valid
 */
export function isAuthStateValid(): boolean {
  // Check if we have tokens
  if (!hasAuthTokens()) return false;
  
  // Check if session is expired
  if (isSessionExpired()) return false;
  
  return true;
}

/**
 * Extract user data from API response
 * @param userData - User data from API
 * @returns Normalized user data
 */
export const extractUserData = (userData: any): UserData => {
  // Handle case where user data is nested in response
  const user = userData || {};
  
  return {
    id: user.id || '',
    email: user.email || '',
    name: user.name || user.email?.split('@')[0] || '',
    role: user.role || 'user',
    permissions: user.permissions || [],
    emailVerified: !!user.emailVerified,
    twoFactorEnabled: !!user.twoFactorEnabled,
    preferences: user.preferences || {},
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null
  };
};

/**
 * Formats authentication errors
 * @param error - Raw error
 * @returns Formatted auth error
 */
export function formatAuthError(error: any): AuthError {
  // Default error
  const defaultError: AuthError = {
    code: AUTH_ERROR_CODES.UNKNOWN,
    message: 'An unknown authentication error occurred',
    retry: false
  };

  if (!error) return defaultError;

  // Network errors
  if (error.message && error.message.includes('network')) {
    return {
      code: AUTH_ERROR_CODES.NETWORK_ERROR,
      message: 'Network error. Please check your connection',
      retry: true
    };
  }

  // Server errors with status codes
  if (error.status === 401) {
    return {
      code: AUTH_ERROR_CODES.UNAUTHORIZED,
      message: 'You are not authorized. Please log in again',
      retry: false
    };
  }

  if (error.status === 403) {
    return {
      code: AUTH_ERROR_CODES.FORBIDDEN,
      message: 'You do not have permission to perform this action',
      retry: false
    };
  }

  // Return the error with defaults for missing fields
  return {
    code: error.code || defaultError.code,
    message: error.message || defaultError.message,
    details: error.details,
    retry: error.retry !== undefined ? error.retry : defaultError.retry
  };
}

/**
 * Retry function with exponential backoff
 * @param fn - Function to retry
 * @param options - Retry options
 * @returns Promise with the function result
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelay?: number } = {}
): Promise<T> {
  const maxRetries = options.maxRetries || 3;
  const baseDelay = options.baseDelay || 1000;
  
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Creates a standardized auth error object
 * @param code - Error code from AUTH_ERROR_CODES
 * @param message - Error message
 * @param originalError - Original error object
 * @returns Standardized auth error
 */
export function createAuthError(
  code: keyof typeof AUTH_ERROR_CODES,
  message: string,
  originalError?: any
): AuthError {
  const error: AuthError = {
    code: AUTH_ERROR_CODES[code],
    message
    // Remove timestamp as it's not in the AuthError type
  };
  
  // Use type assertion if you need to add properties not in the type
  // or update your AuthError type definition to include these properties
  if (originalError) {
    (error as any).originalError = originalError;
  }
  
  logger.error(`Auth error: ${message}`, { code: error.code, originalError });
  
  return error;
}

/**
 * Updates the last activity timestamp in session data
 * @param sessionData - The session data to update
 * @param timestamp - The timestamp to set (defaults to current time)
 * @returns Updated session data
 */
export function updateLastActivity(sessionData: SessionData, timestamp: number = Date.now()): SessionData {
  return {
    ...sessionData,
    lastActivity: timestamp
  };
}

export default {
  extractUserData,
  calculateSessionExpiry,
  isSessionExpired,
  formatAuthError,
  sanitizeCredentials,
  withRetry,
  extractSessionData,
  isAuthStateValid,
  AUTH_ERROR_CODES
};
