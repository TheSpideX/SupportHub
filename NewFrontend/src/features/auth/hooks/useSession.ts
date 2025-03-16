import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { sessionService } from '../services/session.service';
import { securityService } from '../services/security.service';
import { tokenService } from '../services/token.service';
import { setSessionAlert, setSessionExpiry, setSecurityContext } from "../store/authSlice";
import { RootState } from '../../../store';
import { logger } from '../../../utils/logger';
import { AUTH_CONSTANTS } from "../constants/auth.constants";
import { toast } from 'react-toastify';
import { useAuth } from './useAuth';
import axiosInstance from '../../../utils/axios';
import { API_CONFIG } from '../../../config/api';

const COMPONENT = "useSession";
const SESSION_CHECK_THROTTLE = 5000; // 5 seconds minimum between checks

export interface SessionInfo {
  id: string;
  startTime: number;
  lastActivity: number;
  expiresAt: number;
  deviceInfo: {
    fingerprint: string;
    userAgent: string;
    platform: string;
  };
  metadata: Record<string, any>;
}

export interface SessionMetrics {
  duration: number;
  interactions: number;
  idleTime: number;
  pageViews: number;
}

export interface UseSessionReturn {
  // Session state
  isActive: boolean;
  timeRemaining: number;
  lastActivity: number;
  sessionInfo: SessionInfo | null;
  sessionMetrics: SessionMetrics | null;
  
  // Session actions
  extendSession: () => Promise<boolean>;
  endSession: (reason?: string) => Promise<void>;
  refreshSession: () => Promise<boolean>;
  
  // Session utilities
  getSessionDuration: () => number;
  getIdleTime: () => number;
  isSessionExpiringSoon: () => boolean;
  
  // Session management
  forceLogout: (sessionId: string, reason?: string) => Promise<void>;
  getAllSessions: () => Promise<SessionInfo[]>;
  terminateOtherSessions: () => Promise<boolean>;
  
  // Session security
  validateSession: () => Promise<boolean>;
  checkSecurityContext: () => Promise<boolean>;
}

export function useSession(): UseSessionReturn {
  // Component identifier for logging
  const COMPONENT = 'useSession';
  
  // Redux hooks
  const dispatch = useDispatch();
  const { isAuthenticated } = useAuth();
  const sessionAlert = useSelector((state: RootState) => state.auth.sessionAlert);
  const securityContext = useSelector((state: RootState) => state.auth.securityContext);
  
  // State
  const [isActive, setIsActive] = useState<boolean>(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [sessionMetrics, setSessionMetrics] = useState<SessionMetrics | null>(null);
  
  // Refs for interval management
  const intervalIds = useRef<{ checkInterval: number | null; timerAnimationFrame: number | null }>({
    checkInterval: null,
    timerAnimationFrame: null
  });
  
  // Refs for throttling
  const checkInProgress = useRef<boolean>(false);
  const lastCheckTime = useRef<number>(0);
  const SESSION_CHECK_THROTTLE = 5000; // 5 seconds
  
  // Utility functions
  const getSessionDuration = useCallback((): number => {
    if (!sessionInfo) return 0;
    return Date.now() - sessionInfo.startTime;
  }, [sessionInfo]);
  
  const getIdleTime = useCallback((): number => {
    return Date.now() - lastActivity;
  }, [lastActivity]);
  
  const isSessionExpiringSoon = useCallback((): boolean => {
    if (!sessionInfo) return false;
    const timeLeft = sessionInfo.expiresAt - Date.now();
    return timeLeft < AUTH_CONSTANTS.SESSION.WARNING_THRESHOLD;
  }, [sessionInfo]);
  
  // Session management functions
  const updateSessionMetrics = useCallback(async (): Promise<void> => {
    try {
      if (!isAuthenticated) return;
      
      const metrics = await sessionService.getSessionMetrics();
      setSessionMetrics(metrics);
    } catch (error) {
      logger.error('Failed to update session metrics', {
        component: COMPONENT,
        action: 'updateSessionMetrics',
        error
      });
    }
  }, [isAuthenticated]);
  
  const endSession = useCallback(async (reason?: string): Promise<void> => {
    try {
      await sessionService.endSession(reason);
      setIsActive(false);
      setSessionInfo(null);
      setSessionMetrics(null);
      
      // Clear intervals
      if (intervalIds.current.checkInterval) {
        clearInterval(intervalIds.current.checkInterval);
        intervalIds.current.checkInterval = null;
      }
      
      if (intervalIds.current.timerAnimationFrame) {
        cancelAnimationFrame(intervalIds.current.timerAnimationFrame);
        intervalIds.current.timerAnimationFrame = null;
      }
      
      // Dispatch logout action if reason is EXPIRED or TERMINATED
      if (reason === 'EXPIRED' || reason === 'TERMINATED') {
        dispatch(logoutAction({ reason }));
      }
    } catch (error) {
      logger.error('Failed to end session', {
        component: COMPONENT,
        action: 'endSession',
        error
      });
    }
  }, [dispatch]);
  
  const stopSessionMonitoring = useCallback(() => {
    if (intervalIds.current.checkInterval) {
      clearInterval(intervalIds.current.checkInterval);
      intervalIds.current.checkInterval = null;
    }
    
    if (intervalIds.current.timerAnimationFrame) {
      cancelAnimationFrame(intervalIds.current.timerAnimationFrame);
      intervalIds.current.timerAnimationFrame = null;
    }
  }, []);
  
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const refreshed = await tokenService.refreshToken();
      
      if (refreshed) {
        await updateSessionMetrics();
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Session refresh failed', {
        component: COMPONENT,
        action: 'refreshSession',
        error
      });
      return false;
    }
  }, [updateSessionMetrics]);
  
  const handleSuspiciousActivity = useCallback((suspiciousActivity: any) => {
    try {
      logger.warn('Suspicious activity detected', {
        component: COMPONENT,
        action: 'handleSuspiciousActivity',
        details: suspiciousActivity
      });
      
      // Notify user and take appropriate action
      dispatch(setSessionAlert({
        type: 'danger',
        message: 'Suspicious activity detected. Please verify your identity.',
        action: 'verify',
        details: suspiciousActivity
      }));
      
      // Emit security issue event
      sessionService.events.emit('sessionSecurityIssue', suspiciousActivity);
    } catch (error) {
      logger.error('Failed to handle suspicious activity', {
        component: COMPONENT,
        action: 'handleSuspiciousActivity',
        error
      });
    }
  }, [dispatch]);
  
  const checkSessionStatus = useCallback(async () => {
    if (checkInProgress.current || !isAuthenticated) {
      return;
    }
    
    checkInProgress.current = true;
    
    try {
      // Check if sessionService is available
      if (!sessionService) {
        logger.error('Session service not available', {
          component: COMPONENT,
          action: 'checkSessionStatus'
        });
        checkInProgress.current = false;
        return;
      }

      // Get remaining time with proper error handling
      const timeRemaining = await sessionService.getSessionTimeRemaining().catch(error => {
        logger.error('Failed to get session time remaining', {
          component: COMPONENT,
          action: 'getSessionTimeRemaining',
          error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error)
        });
        return 0;
      });
      
      // Check if session is valid with better error handling
      try {
        const isValid = await sessionService.isSessionValid();
        if (!isValid) {
          // Try to recover session
          try {
            const recovered = await sessionService.attemptSessionRecovery();
            if (!recovered) {
              await endSession('EXPIRED');
              checkInProgress.current = false;
              return;
            }
          } catch (recoveryError) {
            logger.error('Session recovery failed', {
              component: COMPONENT,
              action: 'attemptSessionRecovery',
              error: recoveryError instanceof Error ? { message: recoveryError.message, stack: recoveryError.stack } : String(recoveryError)
            });
            await endSession('EXPIRED');
            checkInProgress.current = false;
            return;
          }
        }
      } catch (validityError) {
        logger.error('Session validity check failed', {
          component: COMPONENT,
          action: 'isSessionValid',
          error: validityError instanceof Error ? { message: validityError.message, stack: validityError.stack } : String(validityError)
        });
        checkInProgress.current = false;
        return;
      }
      
      // Check if session is about to expire
      if (sessionService.isSessionExpiringSoon()) {
        const timeRemaining = sessionService.getSessionTimeRemaining();
        
        // Update session expiry in store
        dispatch(setSessionExpiry(Date.now() + timeRemaining));
        
        // Show warning based on time remaining
        if (timeRemaining < AUTH_CONSTANTS.SESSION.CRITICAL_WARNING_THRESHOLD) {
          dispatch(setSessionAlert({
            type: 'danger',
            message: 'Your session is about to expire in less than a minute',
            action: 'extend',
            expiresAt: Date.now() + timeRemaining
          }));
        } else if (timeRemaining < AUTH_CONSTANTS.SESSION.WARNING_THRESHOLD) {
          dispatch(setSessionAlert({
            type: 'warning',
            message: 'Your session will expire soon',
            action: 'extend',
            expiresAt: Date.now() + timeRemaining
          }));
        }
      }
      
      // Check if token needs refresh
      if (tokenService.isTokenExpiringSoon()) {
        await refreshSession();
      }
      
      // Update session metrics
      await updateSessionMetrics();
      
      checkInProgress.current = false;
    } catch (error) {
      checkInProgress.current = false;
      logger.error('Session check failed', {
        component: COMPONENT,
        action: 'checkSessionStatus',
        error: error instanceof Error ? { 
          message: error.message, 
          stack: error.stack,
          name: error.name
        } : String(error)
      });
    }
  }, [isAuthenticated, dispatch, endSession, refreshSession, updateSessionMetrics]);
  
  const startSessionMonitoring = useCallback(() => {
    // Clear any existing intervals first
    stopSessionMonitoring();
    
    // Set up session check interval with a reasonable delay
    // Use a longer interval to prevent excessive checks
    intervalIds.current.checkInterval = window.setInterval(() => {
      checkSessionStatus().catch(error => {
        logger.error('Error in session check interval', {
          component: COMPONENT,
          error: error instanceof Error ? { 
            message: error.message, 
            stack: error.stack,
            name: error.name
          } : String(error)
        });
      });
    }, AUTH_CONSTANTS.SESSION.CHECK_INTERVAL);
    
    // Set up timer interval for UI updates
    // Use requestAnimationFrame for UI updates to be more efficient
    let lastUpdateTime = 0;
    const updateTimer = () => {
      const now = Date.now();
      // Only update UI every second
      if (now - lastUpdateTime >= 1000) {
        if (sessionInfo) {
          const remaining = sessionInfo.expiresAt - Date.now();
          setTimeRemaining(Math.max(0, remaining));
        }
        lastUpdateTime = now;
      }
      intervalIds.current.timerAnimationFrame = requestAnimationFrame(updateTimer);
    };
    
    intervalIds.current.timerAnimationFrame = requestAnimationFrame(updateTimer);
  }, [checkSessionStatus, stopSessionMonitoring, sessionInfo]);
  
  const initializeSessionData = useCallback(async () => {
    try {
      if (!isAuthenticated) return;
      
      const session = await sessionService.getSession();
      if (session) {
        setSessionInfo(session);
        setIsActive(true);
        setTimeRemaining(session.expiresAt - Date.now());
        setLastActivity(session.lastActivity);
        
        // Get session metrics
        const metrics = await sessionService.getSessionMetrics();
        setSessionMetrics(metrics);
      }
    } catch (error) {
      logger.error('Failed to initialize session data', {
        component: COMPONENT,
        action: 'initializeSessionData',
        error
      });
    }
  }, [isAuthenticated]);

  // Initialize session data and monitoring
  useEffect(() => {
    if (isAuthenticated) {
      initializeSessionData();
      startSessionMonitoring();
      
      return () => {
        stopSessionMonitoring();
      };
    } else {
      setSessionInfo(null);
      setSessionMetrics(null);
      setIsActive(false);
    }
  }, [isAuthenticated, initializeSessionData, startSessionMonitoring, stopSessionMonitoring]);

  // Activity tracking
  useEffect(() => {
    const updateActivity = () => {
      setLastActivity(Date.now());
      sessionService.updateLastActivity();
    };
    
    // Add event listeners for user activity
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);
    
    return () => {
      // Remove event listeners
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, []);

  // Additional session functions
  const extendSession = useCallback(async (): Promise<boolean> => {
    try {
      const extended = await sessionService.extendSession();
      if (extended) {
        const session = await sessionService.getSession();
        setSessionInfo(session);
        setTimeRemaining(session.expiresAt - Date.now());
        
        // Clear any session alerts
        dispatch(clearSessionAlert());
        
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to extend session', {
        component: COMPONENT,
        action: 'extendSession',
        error
      });
      return false;
    }
  }, [dispatch]);
  
  const forceLogout = useCallback(async (reason: string): Promise<void> => {
    try {
      await endSession(reason);
      dispatch(logoutAction({ reason }));
    } catch (error) {
      logger.error('Force logout failed', {
        component: COMPONENT,
        action: 'forceLogout',
        error
      });
    }
  }, [dispatch, endSession]);
  
  const getAllSessions = useCallback(async (): Promise<SessionInfo[]> => {
    try {
      return await sessionService.getAllSessions();
    } catch (error) {
      logger.error('Failed to get all sessions', {
        component: COMPONENT,
        action: 'getAllSessions',
        error
      });
      return [];
    }
  }, []);
  
  const terminateOtherSessions = useCallback(async (): Promise<boolean> => {
    try {
      return await sessionService.terminateOtherSessions();
    } catch (error) {
      logger.error('Failed to terminate other sessions', {
        component: COMPONENT,
        action: 'terminateOtherSessions',
        error
      });
      return false;
    }
  }, []);
  
  const validateSession = useCallback(async (): Promise<boolean> => {
    try {
      return await sessionService.validateSession();
    } catch (error) {
      logger.error('Session validation failed', {
        component: COMPONENT,
        action: 'validateSession',
        error
      });
      return false;
    }
  }, []);
  
  const checkSecurityContext = useCallback((): boolean => {
    try {
      return sessionService.checkSecurityContext(securityContext);
    } catch (error) {
      logger.error('Security context check failed', {
        component: COMPONENT,
        action: 'checkSecurityContext',
        error
      });
      return false;
    }
  }, [securityContext]);

  // Return the hook interface
  return {
    // Session state
    isActive,
    timeRemaining,
    lastActivity,
    sessionInfo,
    sessionMetrics,
    
    // Session actions
    extendSession,
    endSession,
    refreshSession,
    
    // Session utilities
    getSessionDuration,
    getIdleTime,
    isSessionExpiringSoon,
    
    // Session management
    forceLogout,
    getAllSessions,
    terminateOtherSessions,
    
    // Session security
    validateSession,
    checkSecurityContext
  };
};