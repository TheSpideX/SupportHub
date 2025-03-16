import { Middleware } from '@reduxjs/toolkit';
import { logger } from '@/utils/logger';

// Actions that should not be logged to prevent excessive logging
const EXCLUDED_ACTIONS = [
  'auth/updateSessionMetrics',
  'auth/updateLastActivity',
  'auth/syncLastActivity'
];

// Actions that should be logged but at debug level only
const DEBUG_LEVEL_ACTIONS = [
  'auth/validateSessionWithServer',
  'auth/checkSession'
];

export const loggingMiddleware: Middleware = (store) => (next) => (action) => {
  const startTime = performance.now();
  const prevState = store.getState();
  
  const result = next(action);
  
  const nextState = store.getState();
  const duration = performance.now() - startTime;

  // Skip logging for excluded actions to prevent log spam
  if (EXCLUDED_ACTIONS.includes(action.type)) {
    return result;
  }

  // Use debug level for frequent but less important actions
  if (DEBUG_LEVEL_ACTIONS.includes(action.type)) {
    logger.debug('Redux action dispatched', {
      component: 'Redux',
      action: action.type,
      category: 'system',
      duration,
      payload: action.payload,
      stateDiff: {
        auth: {
          isAuthenticated: prevState.auth.isAuthenticated !== nextState.auth.isAuthenticated,
          hasError: prevState.auth.error !== nextState.auth.error,
        }
      }
    });
  } else {
    // Normal logging for other actions
    logger.debug('Redux action dispatched', {
      component: 'Redux',
      action: action.type,
      category: 'system',
      duration,
      payload: action.payload,
      stateDiff: {
        auth: {
          isAuthenticated: prevState.auth.isAuthenticated !== nextState.auth.isAuthenticated,
          hasError: prevState.auth.error !== nextState.auth.error,
        }
      }
    });
  }

  return result;
};