import { Middleware } from 'redux';
import { SessionService, SESSION_CHANNEL_EVENTS } from '../services/session.service';
import { tokenService } from '../services/token.service';
import { securityService } from '../services/security.service';
import { AUTH_CONSTANTS } from '../constants/auth.constants';
import { errorHandler } from '@/core/errors/errorHandler';
import { AuthenticationError } from '@/core/errors/base';
import { AuthError } from '../errors/auth-error';
import { serverStatusService } from '@/services/server-status.service';
import { networkMonitorService } from '@/services/network-monitor.service';
import { handleAuthError } from '../utils/error-handler';

// Create an instance of SessionService
const sessionService = new SessionService();

/**
 * Advanced session middleware that handles:
 * - Activity tracking
 * - Session timeout management
 * - Security context validation
 * - Token refresh orchestration
 * - Session health monitoring
 * - Cross-tab synchronization
 * - Session analytics
 * - Error handling integration
 */
export const sessionMiddleware: Middleware = (store) => {
  // Use the same channel name as in SessionService
  const sessionChannel = new BroadcastChannel('auth_session_channel');
  let healthCheckInterval: NodeJS.Timeout | null = null;
  let lastNetworkStatus = navigator.onLine;
  
  // Initialize session monitoring
  const initializeSessionMonitoring = () => {
    // Clear any existing interval first to prevent duplicates
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }
    
    // Only set up monitoring if not already active
    if (!healthCheckInterval) {
      healthCheckInterval = setInterval(() => {
        const state = store.getState();
        if (state.auth.isAuthenticated) {
          performSessionHealthCheck(state);
        }
      }, AUTH_CONSTANTS.SESSION.HEALTH_CHECK_INTERVAL);
      
      // Initialize network monitoring only once at application startup
      // This is now handled centrally in main.tsx
      
      // Listen for cross-tab session events
      sessionChannel.onmessage = (event) => handleSessionChannelMessage(event, store);
    }
  };
  
  // Cleanup function
  const cleanup = () => {
    if (healthCheckInterval) clearInterval(healthCheckInterval);
    window.removeEventListener('online', handleNetworkStatusChange);
    window.removeEventListener('offline', handleNetworkStatusChange);
    sessionChannel.close();
  };
  
  // Handle network status changes
  const handleNetworkStatusChange = () => {
    const currentNetworkStatus = navigator.onLine;
    
    // Network status changed
    if (lastNetworkStatus !== currentNetworkStatus) {
      lastNetworkStatus = currentNetworkStatus;
      
      // Don't start/stop server status monitoring here
      // Just use the existing service
      
      const state = store.getState();
      if (state.auth.isAuthenticated) {
        if (currentNetworkStatus) {
          // Came back online - verify session with server
          store.dispatch({ type: 'auth/validateSessionWithServer' });
        } else {
          // Went offline - mark session as offline
          store.dispatch({ type: 'auth/setSessionOffline' });
        }
      }
    }
  };
  
  // Handle session channel messages from other tabs
  const handleSessionChannelMessage = (event: MessageEvent, store: any) => {
    const { type, data } = event.data;
    
    switch (type) {
      case 'GLOBAL_LOGOUT':
        // Another tab logged out, sync this tab
        store.dispatch(logoutAction());
        break;
        
      case 'SESSION_TERMINATED':
        // Session was terminated in another tab
        store.dispatch(logoutAction());
        break;
        
      case 'USER_SWITCHED':
        // User switched in another tab
        const currentUser = store.getState().auth.user;
        if (currentUser?.id === data.previousUserId) {
          // This tab has the old user, log them out
          store.dispatch(logoutAction());
        }
        break;
        
      case 'SESSION_INITIALIZED':
        // New session started in another tab
        const state = store.getState();
        if (state.auth.isAuthenticated && state.auth.user?.id === data.userId) {
          // This is the same user, update session info
          store.dispatch(updateSessionInfo({
            sessionId: data.sessionId,
            lastActivity: data.timestamp
          }));
        }
        break;
        
      case 'SESSION_ACTIVITY_UPDATE':
        // Activity in another tab
        store.dispatch(updateLastActivity(data.timestamp));
        break;
        
      case 'TOKEN_REFRESHED':
        store.dispatch({ type: 'auth/syncTokens', payload: data.tokens });
        break;
        
      case 'SECURITY_CONTEXT_CHANGED':
        store.dispatch({ type: 'auth/validateSecurityContext' });
        break;
        
      case 'SESSION_ERROR':
        handleSessionError(data.error, store);
        break;
        
      case 'SESSION_UPDATED':
        store.dispatch({ type: 'auth/syncSession', payload: data });
        break;
        
      case 'ACTIVITY_UPDATE':
        store.dispatch({ type: 'auth/syncLastActivity', payload: { timestamp: data.timestamp } });
        break;
    }
  };
  
  // Handle session-related errors
  const handleSessionError = (error: any, store: any) => {
    try {
      // Convert to appropriate error type if needed
      let sessionError;
      
      if (error.code && typeof error.code === 'string') {
        // Create AuthError from error data
        sessionError = new AuthError(
          error.code,
          error.message,
          error.redirectPath,
          error.details
        );
      } else {
        // Create AuthenticationError for the core error system
        sessionError = new AuthenticationError(
          error.code || 'SESSION_ERROR',
          error.message || 'Session error occurred',
          error.redirectPath,
          error.details
        );
      }
      
      // Log the error through the centralized error handler
      try {
        errorHandler.handleError(sessionError, {
          component: 'SessionMiddleware',
          action: 'sessionHealthCheck',
          timestamp: Date.now()
        });
      } catch (handlerError) {
        // Fallback if error handler fails
        console.error('Error while handling session error:', handlerError);
        console.error('Original error:', sessionError);
      }
      
      // Dispatch appropriate action based on error type
      if (
        error.code === 'SESSION_EXPIRED' || 
        error.code === 'TOKEN_EXPIRED' || 
        error.code === 'INVALID_TOKEN'
      ) {
        store.dispatch({ type: 'auth/sessionExpired', payload: { error: sessionError } });
      } else if (error.code === 'SECURITY_CONTEXT_VIOLATION') {
        store.dispatch({ 
          type: 'auth/securityContextViolation', 
          payload: { error: sessionError } 
        });
      } else {
        // For other errors, just update the auth state with the error
        store.dispatch({ 
          type: 'auth/sessionError', 
          payload: { error: sessionError } 
        });
      }
    } catch (e) {
      console.error('Error while handling session error:', e);
    }
  };
  
  // Perform session health check
  const performSessionHealthCheck = async (state) => {
    try {
      const now = Date.now();
      
      // Prevent health checks too close together (throttle)
      const lastHealthCheck = state.auth.lastHealthCheck || 0;
      if (now - lastHealthCheck < AUTH_CONSTANTS.SESSION.HEALTH_CHECK_THROTTLE) {
        return; // Skip this health check if too soon after the last one
      }
      
      // Check token expiration
      const tokenExpiry = await tokenService.getAccessTokenExpiry();
      if (tokenExpiry && tokenExpiry < now) {
        // Token has expired, attempt to refresh
        try {
          await authService.refreshToken();
        } catch (refreshError) {
          const tokenError = new AuthError(
            'TOKEN_EXPIRED',
            'Your authentication token has expired',
            '/auth/login'
          );
          handleSessionError(tokenError, store);
          return;
        }
      }
      
      // Only update session metrics if significant time has passed
      // This prevents excessive dispatching of the same action
      if (now - lastHealthCheck >= AUTH_CONSTANTS.SESSION.METRICS_UPDATE_INTERVAL) {
        store.dispatch({ 
          type: 'auth/updateSessionMetrics', 
          payload: { healthCheckTime: now } 
        });
      }
    } catch (error) {
      // Handle any other errors during health check
      console.error('Session health check failed:', error);
    }
  };
  
  // Initialize monitoring when middleware is created
  initializeSessionMonitoring();
  
  // Return the middleware function
  return next => action => {
    // Process the action first
    const result = next(action);
    const state = store.getState();
    
    try {
      // Handle specific auth actions
      switch (action.type) {
        case 'auth/login/fulfilled':
          initializeSessionMonitoring();
          break;
          
        case 'auth/logout/fulfilled':
          cleanup();
          break;
          
        case 'auth/sessionExpired':
        case 'auth/forceLogout':
          cleanup();
          sessionService.endSession(action.type === 'auth/sessionExpired' ? 'EXPIRED' : 'FORCED');
          
          // Broadcast session termination to other tabs
          sessionChannel.postMessage({
            type: SESSION_CHANNEL_EVENTS.SESSION_TERMINATED,
            data: { 
              reason: action.type === 'auth/sessionExpired' ? 'EXPIRED' : 'FORCED',
              timestamp: Date.now(),
              sessionId: state.auth.session?.id
            }
          });
          break;
          
        case 'auth/refreshTokens/rejected':
          // Handle token refresh failures
          if (action.error) {
            handleSessionError({
              code: 'TOKEN_REFRESH_FAILED',
              message: 'Failed to refresh authentication token',
              details: { originalError: action.error }
            }, store);
          }
          break;
      }
      
      // Update last activity on user actions (excluding system actions)
      if (
        state.auth.isAuthenticated && 
        !action.type.startsWith('@@') && 
        !action.type.startsWith('auth/') &&
        action.type !== 'IDLE'
      ) {
        const timestamp = Date.now();
        store.dispatch({ type: 'auth/updateLastActivity', payload: { timestamp } });
        
        // Broadcast activity to other tabs
        sessionChannel.postMessage({ 
          type: SESSION_CHANNEL_EVENTS.SESSION_ACTIVITY_UPDATE, 
          data: { 
            timestamp, 
            actionType: action.type,
            sessionId: state.auth.session?.id 
          } 
        });
        
        // Analytics tracking removed
      }
    } catch (middlewareError) {
      // Handle errors in the middleware itself
      errorHandler.handleError(middlewareError, {
        component: 'SessionMiddleware',
        action: 'processAction',
        timestamp: Date.now()
      });
    }
    
    return result;
  };
};
