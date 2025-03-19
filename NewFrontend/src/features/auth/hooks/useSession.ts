import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getAuthServices } from '../services';
import { SessionData, SessionStatus } from '../types/auth.types';
import { 
  selectSessionState,
  setSessionStatus,
  setSessionData,
  setLastActivity
} from '../store/';

/**
 * Hook for accessing session functionality
 * 
 * Provides:
 * - Session state (active, inactive, warning, expired)
 * - Session data
 * - Session management methods
 * - Session timeout handling
 */
export function useSession() {
  const dispatch = useDispatch();
  const sessionState = useSelector(selectSessionState);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  // Get auth instance
  const auth = getAuthServices();
  
  // Track session activity
  const startTracking = useCallback(() => {
    // Use the extendSession method from auth instance
    const interval = setInterval(() => {
      auth.extendSession();
      dispatch(setLastActivity(Date.now()));
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [dispatch]);
  
  // Stop tracking
  const stopTracking = useCallback(() => {
    // No direct access needed to sessionService
  }, []);
  
  // Calculate time remaining in session
  useEffect(() => {
    if (sessionState.status === 'active' || sessionState.status === 'warning') {
      const interval = setInterval(() => {
        const remaining = sessionState.data?.expiresAt 
          ? Math.max(0, sessionState.data.expiresAt - Date.now()) 
          : null;
        setTimeRemaining(remaining);
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setTimeRemaining(null);
    }
  }, [sessionState.status, sessionState.data]);
  
  // Extend session
  const extendSession = useCallback(async () => {
    return auth.extendSession();
  }, [auth]);
  
  // Terminate session
  const terminateSession = useCallback(async (reason?: string) => {
    // Use logout as a proxy for terminate session
    return auth.logout();
  }, [auth]);
  
  return {
    // Session state
    status: sessionState.status,
    data: sessionState.data,
    timeRemaining,
    isActive: sessionState.status === 'active',
    isWarning: sessionState.status === 'warning',
    isExpired: sessionState.status === 'expired',
    
    // Session methods
    startTracking,
    stopTracking,
    extendSession,
    terminateSession,
  };
}
