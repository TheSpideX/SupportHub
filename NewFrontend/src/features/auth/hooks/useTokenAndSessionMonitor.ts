import { useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { tokenService } from '../services/token.service';
import { sessionService } from '../services/session.service';
import { setSessionAlert, setSessionExpiry } from '../store/authSlice';
import { AUTH_CONSTANTS } from '../constants';
import { useLogger } from '../../../hooks/useLogger';

/**
 * Hook to monitor token and session status
 */
export const useTokenAndSessionMonitor = () => {
  const dispatch = useDispatch();
  const logger = useLogger('useTokenAndSessionMonitor');
  
  // Check token and session status
  const checkStatus = useCallback(async () => {
    try {
      // Check token status
      const tokenValid = await tokenService.checkAndRefreshTokenIfNeeded();
      
      if (!tokenValid) {
        logger.warn('Token refresh failed');
        dispatch(setSessionAlert({
          type: 'error',
          message: 'Your authentication has expired. Please log in again.',
          action: 'login'
        }));
        return false;
      }
      
      // Check session status
      const session = await sessionService.getSession();
      if (!session) return false;
      
      const now = Date.now();
      const timeRemaining = session.expiresAt - now;
      
      // Update session expiry in store
      dispatch(setSessionExpiry(session.expiresAt));
      
      // If session is expiring soon, show appropriate alerts
      if (timeRemaining <= AUTH_CONSTANTS.SESSION.CRITICAL_WARNING_THRESHOLD) {
        dispatch(setSessionAlert({
          type: 'danger',
          message: 'Your session is about to expire in less than a minute',
          action: 'extend',
          expiresAt: session.expiresAt
        }));
      } else if (timeRemaining <= AUTH_CONSTANTS.SESSION.WARNING_THRESHOLD) {
        dispatch(setSessionAlert({
          type: 'warning',
          message: 'Your session will expire soon',
          action: 'extend',
          expiresAt: session.expiresAt
        }));
      }
      
      return true;
    } catch (error) {
      logger.error('Status check failed', { error });
      return false;
    }
  }, [dispatch, logger]);
  
  // Extend session and refresh token
  const extendSessionAndToken = useCallback(async (): Promise<boolean> => {
    try {
      // Clear session alert
      dispatch(setSessionAlert(null));
      
      // Refresh token
      const tokenRefreshed = await tokenService.refreshTokens();
      if (!tokenRefreshed) {
        logger.warn('Token refresh failed during session extension');
        return false;
      }
      
      // Extend session
      await sessionService.extendSession();
      
      // Update session expiry in store
      const session = await sessionService.getSession();
      if (session) {
        dispatch(setSessionExpiry(session.expiresAt));
      }
      
      return true;
    } catch (error) {
      logger.error('Session and token extension failed', { error });
      return false;
    }
  }, [dispatch, logger]);
  
  // Set up monitoring on component mount
  useEffect(() => {
    // Initial check
    checkStatus();
    
    // Set up interval for periodic checks
    const intervalId = setInterval(() => {
      checkStatus();
    }, AUTH_CONSTANTS.SESSION.CHECK_INTERVAL);
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [checkStatus]);
  
  return {
    checkStatus,
    extendSessionAndToken
  };
};