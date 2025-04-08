/**
 * AuthGuard Component
 * 
 * Protects routes requiring authentication using the new WebSocketAuthService.
 */

import { ReactNode, useState, useRef, useEffect } from 'react';
import { useLocation, Navigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store";
import { APP_ROUTES } from "@/config/routes";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { clearAuthState, setInitialized, setAuthState } from "@/features/auth/store";
import LoadingScreen from "@/components/shared/LoadingScreen";
import { logger } from "@/utils/logger";
import { authService } from "@/features/auth/services";

interface AuthGuardProps {
  children: ReactNode;
  requiredPermissions?: string[];
}

/**
 * AuthGuard component that protects routes requiring authentication
 * Uses the new WebSocketAuthService for authentication
 */
export const AuthGuard = ({ 
  children, 
  requiredPermissions = [] 
}: AuthGuardProps) => {
  const location = useLocation();
  const dispatch = useDispatch();
  const { isAuthenticated, isInitialized } = useSelector((state: RootState) => state.auth);
  const { hasAllPermissions } = usePermissions();
  const { user, updateActivity } = useAuth();
  const [isLoading, setIsLoading] = useState(!isInitialized);
  const validationInProgress = useRef(false);
  
  // Update user activity when route changes
  useEffect(() => {
    if (isAuthenticated) {
      updateActivity();
    }
  }, [location.pathname, isAuthenticated, updateActivity]);
  
  // Verify authentication on mount and when auth state changes
  useEffect(() => {
    // Skip if already initialized and authenticated
    if (isInitialized && isAuthenticated) {
      return;
    }
    
    // Skip if validation is already in progress
    if (validationInProgress.current) {
      return;
    }
    
    const verifyAuth = async () => {
      // Set validation in progress
      validationInProgress.current = true;
      setIsLoading(true);
      
      try {
        logger.debug('Verifying authentication in AuthGuard', {
          component: 'AuthGuard',
          isInitialized,
          isAuthenticated
        });
        
        // Check if user is authenticated
        if (authService.isAuthenticated()) {
          // Get current user
          const currentUser = authService.getUser();
          
          // Update Redux state
          dispatch(setAuthState({
            user: currentUser,
            isAuthenticated: true,
            isInitialized: true,
            sessionExpiry: authService.getSessionExpiry()
          }));
          
          logger.debug('User is authenticated', {
            component: 'AuthGuard',
            userId: currentUser?.id
          });
        } else {
          logger.debug('User is not authenticated', {
            component: 'AuthGuard'
          });
          
          // Clear auth state
          dispatch(clearAuthState());
          dispatch(setInitialized(true));
        }
      } catch (error) {
        logger.error('Error verifying authentication', { 
          component: 'AuthGuard', 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // On error, mark as initialized but not authenticated
        dispatch(setInitialized(true));
        dispatch(clearAuthState());
      } finally {
        validationInProgress.current = false;
        setIsLoading(false);
      }
    };
    
    verifyAuth();
  }, [dispatch, isInitialized, isAuthenticated]);
  
  // Check permissions if required
  useEffect(() => {
    if (isAuthenticated && requiredPermissions.length > 0) {
      const hasPermission = hasAllPermissions(requiredPermissions);
      
      if (!hasPermission) {
        logger.warn('User lacks required permissions', {
          component: 'AuthGuard',
          requiredPermissions,
          userId: user?.id
        });
      }
    }
  }, [isAuthenticated, requiredPermissions, hasAllPermissions, user]);
  
  // Show loading screen while checking authentication
  if (isLoading) {
    return <LoadingScreen message="Authenticating..." />;
  }
  
  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    logger.info('AuthGuard redirecting to login', {
      component: 'AuthGuard',
      from: location.pathname
    });
    
    return <Navigate to={APP_ROUTES.AUTH.LOGIN} state={{ from: location.pathname }} replace />;
  }
  
  // Check permissions
  if (requiredPermissions.length > 0 && !hasAllPermissions(requiredPermissions)) {
    logger.warn('Access denied due to insufficient permissions', {
      component: 'AuthGuard',
      requiredPermissions,
      userId: user?.id
    });
    
    return <Navigate to={APP_ROUTES.DASHBOARD} replace />;
  }
  
  // User is authenticated and has required permissions
  return <>{children}</>;
};

export default AuthGuard;
