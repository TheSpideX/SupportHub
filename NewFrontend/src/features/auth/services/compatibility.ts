/**
 * Auth Compatibility Layer
 * 
 * Provides compatibility with the old auth system.
 * This allows existing code to continue working while we transition to the new system.
 */

import { logger } from '@/utils/logger';
import { authService } from './AuthService';
import { tokenService } from './TokenService';
import { webSocketAuthService } from './WebSocketAuthService';

/**
 * Create a compatibility wrapper for TokenService
 */
export function createTokenServiceCompat() {
  logger.debug('Creating TokenService compatibility wrapper', {
    component: 'auth/compatibility'
  });
  
  return {
    // Core token methods
    hasTokens: () => tokenService.hasTokens(),
    clearTokens: () => tokenService.clearTokens(),
    refreshToken: () => tokenService.refreshToken(),
    
    // CSRF token methods
    getCsrfToken: () => tokenService.getCsrfToken(),
    
    // Event subscription
    on: (event: string, callback: Function) => {
      // Map old events to new events
      switch (event) {
        case 'token:refresh:started':
          return tokenService.on('refresh:started', callback);
        case 'token:refresh:success':
          return tokenService.on('refresh:success', callback);
        case 'token:refresh:failed':
          return tokenService.on('refresh:error', callback);
        case 'token:cleared':
          return tokenService.on('tokens:cleared', callback);
        default:
          logger.warn(`Unhandled TokenService event in compatibility layer: ${event}`, {
            component: 'auth/compatibility'
          });
          return () => {}; // No-op unsubscribe
      }
    },
    
    // Stub methods that are no longer needed
    initialize: () => Promise.resolve(),
    getAccessToken: () => null, // HTTP-only cookies, can't access directly
    getRefreshToken: () => null, // HTTP-only cookies, can't access directly
    isRefreshing: () => false,
    
    // Add any other methods needed for compatibility
  };
}

/**
 * Create a compatibility wrapper for SessionService
 */
export function createSessionServiceCompat() {
  logger.debug('Creating SessionService compatibility wrapper', {
    component: 'auth/compatibility'
  });
  
  return {
    // Session status
    isSessionActive: () => authService.isAuthenticated(),
    getSessionExpiry: () => authService.getSessionExpiry(),
    
    // Activity tracking
    updateUserActivity: () => authService.updateUserActivity(),
    
    // Event subscription
    on: (event: string, callback: Function) => {
      // Map old events to new events
      switch (event) {
        case 'session:expired':
          return authService.on('session:expired', callback);
        case 'session:timeout:warning':
          return authService.on('session:timeout_warning', callback);
        default:
          logger.warn(`Unhandled SessionService event in compatibility layer: ${event}`, {
            component: 'auth/compatibility'
          });
          return () => {}; // No-op unsubscribe
      }
    },
    
    // Stub methods that are no longer needed
    initialize: () => Promise.resolve(),
    syncWithServer: () => Promise.resolve(),
    
    // Add any other methods needed for compatibility
  };
}

/**
 * Create a compatibility wrapper for SecurityService
 */
export function createSecurityServiceCompat() {
  logger.debug('Creating SecurityService compatibility wrapper', {
    component: 'auth/compatibility'
  });
  
  return {
    // Device fingerprinting
    getDeviceFingerprint: () => webSocketAuthService.getDeviceId() || '',
    
    // Stub methods that are no longer needed
    initialize: () => Promise.resolve(),
    
    // Add any other methods needed for compatibility
  };
}

/**
 * Create a compatibility wrapper for AuthService
 */
export function createAuthServiceCompat() {
  logger.debug('Creating AuthService compatibility wrapper', {
    component: 'auth/compatibility'
  });
  
  return {
    // Auth state
    isAuthenticated: () => authService.isAuthenticated(),
    getUser: () => authService.getUser(),
    getAuthState: () => authService.getAuthState(),
    
    // Auth operations
    login: (credentials: any) => authService.login(credentials),
    logout: () => authService.logout(),
    register: (data: any) => authService.register(data),
    
    // Event subscription
    on: (event: string, callback: Function) => {
      // Map old events to new events
      switch (event) {
        case 'auth:state:changed':
          return authService.on('state:changed', callback);
        case 'auth:login:success':
          return authService.on('login:success', callback);
        case 'auth:login:failed':
          return authService.on('login:error', callback);
        case 'auth:logout:success':
          return authService.on('logout:success', callback);
        case 'auth:logout:failed':
          return authService.on('logout:error', callback);
        case 'auth:register:success':
          return authService.on('register:success', callback);
        case 'auth:register:failed':
          return authService.on('register:error', callback);
        default:
          logger.warn(`Unhandled AuthService event in compatibility layer: ${event}`, {
            component: 'auth/compatibility'
          });
          return () => {}; // No-op unsubscribe
      }
    },
    
    // Initialization
    initialize: () => authService.initializeAuthState(),
    
    // Stub methods that are no longer needed
    initializeWebSocketAuth: () => {
      webSocketAuthService.connect();
      return Promise.resolve();
    },
    
    // Add any other methods needed for compatibility
  };
}

/**
 * Create compatibility wrappers for all auth services
 */
export function createAuthServicesCompat() {
  return {
    authService: createAuthServiceCompat(),
    tokenService: createTokenServiceCompat(),
    sessionService: createSessionServiceCompat(),
    securityService: createSecurityServiceCompat()
  };
}

// Export individual compatibility services
export const authServiceCompat = createAuthServiceCompat();
export const tokenServiceCompat = createTokenServiceCompat();
export const sessionServiceCompat = createSessionServiceCompat();
export const securityServiceCompat = createSecurityServiceCompat();
