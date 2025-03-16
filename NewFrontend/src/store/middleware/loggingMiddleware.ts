import { Middleware } from '@reduxjs/toolkit';
import { logger } from '@/utils/logger';

export const loggingMiddleware: Middleware = (store) => (next) => (action) => {
  const startTime = performance.now();
  const prevState = store.getState();
  
  const result = next(action);
  
  const nextState = store.getState();
  const duration = performance.now() - startTime;

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

  return result;
};