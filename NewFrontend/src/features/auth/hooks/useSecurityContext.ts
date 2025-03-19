import { getAuthServices } from '../services';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useCallback } from 'react';
import { 
  selectSecurityState,
  setSecurityContext,
  addSecurityEvent
} from '../store';

/**
 * Hook for accessing security functionality
 */
export function useSecurityContext() {
  const dispatch = useDispatch();
  const securityState = useSelector(selectSecurityState);
  // Get the security service from auth services
  const { securityService } = getAuthServices();
  
  // Subscribe to security events
  useEffect(() => {
    const unsubscribe = securityService.subscribe((event: string, payload?: any) => {
      dispatch(addSecurityEvent({ 
        type: event, 
        payload,
        timestamp: Date.now(),
        resolved: false
      }));
    });
    
    return () => {
      unsubscribe();
    };
  }, [dispatch, securityService]); // Add securityService to dependency array
  
  // Initialize security context
  useEffect(() => {
    const initSecurity = async () => {
      const context = await securityService.getSecurityContext();
      if (context) {
        dispatch(setSecurityContext(context));
      }
    };
    
    initSecurity();
  }, [dispatch]);
  
  // Validate security context
  const validateSecurityContext = useCallback(async () => {
    return securityService.validateSecurityContext();
  }, []);
  
  // Refresh security context
  const refreshSecurityContext = useCallback(async () => {
    const context = await securityService.refreshSecurityContext();
    if (context) {
      dispatch(setSecurityContext(context));
    }
    return context;
  }, [dispatch]);
  
  // Report suspicious activity
  const reportSuspiciousActivity = useCallback((activity: any) => {
    return securityService.reportSuspiciousActivity(activity);
  }, []);
  
  // Detect suspicious activity
  const detectSuspiciousActivity = useCallback((activity: any) => {
    return securityService.detectSuspiciousActivity(activity);
  }, []);
  
  return {
    // Security state
    securityContext: securityState.context,
    securityEvents: securityState.events,
    
    // Security methods
    validateSecurityContext,
    refreshSecurityContext,
    reportSuspiciousActivity,
    detectSuspiciousActivity,
    
    // Helper methods
    hasRecentSecurityEvent: (eventType: string, timeWindow: number = 60000) => {
      const now = Date.now();
      return securityState.events.some(
        event => event.type === eventType && (now - event.timestamp) < timeWindow
      );
    }
  };
}
