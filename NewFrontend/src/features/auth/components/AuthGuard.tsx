import { ReactNode, useState } from 'react';
import { useLocation, Navigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store";
import { APP_ROUTES } from "@/config/routes";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { clearAuthState, setInitialized } from "@/features/auth/store";
import { useEffect } from "react";
import LoadingScreen from "@/components/shared/LoadingScreen";
import { logger } from "@/utils/logger";
import { getAuthService } from "@/features/auth/services";
import { setAuthState, setAuthInitialized } from "@/features/auth/store";

interface AuthGuardProps {
  children: ReactNode;
  requiredPermissions?: string[];
}

/**
 * AuthGuard component that protects routes requiring authentication
 * Implements the auth-system-architecture with HTTP-only cookie support
 */
export const AuthGuard = ({ 
  children, 
  requiredPermissions = [] 
}: AuthGuardProps) => {
  const location = useLocation();
  const dispatch = useDispatch();
  const { isAuthenticated, isInitialized } = useSelector((state: RootState) => state.auth);
  const { hasAllPermissions } = usePermissions();
  const { refreshUserData } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  
  // Add detailed logging
  logger.info('AuthGuard evaluation', {
    component: 'AuthGuard',
    isAuthenticated,
    isInitialized,
    isLoading,
    path: location.pathname,
    requiredPermissions
  });
  
  // Verify authentication status on mount and when dependencies change
  useEffect(() => {
    const verifyAuth = async () => {
      logger.info('AuthGuard verifyAuth started', { 
        component: 'AuthGuard',
        isInitialized: isInitialized,
        isAuthenticated: '[REDACTED]'
      });
      
      try {
        // If not initialized, initialize auth
        if (!isInitialized) {
          logger.info('Setting auth as initialized', { component: 'AuthGuard' });
          
          // Check if we have a valid session
          const isValid = await getAuthService().validateSession();
          
          // If session is valid but Redux state doesn't reflect it, force update
          if (isValid && !isAuthenticated && getAuthService().getAuthState().isAuthenticated) {
            const authState = getAuthService().getAuthState();
            dispatch(setAuthState({
              user: authState.user,
              isAuthenticated: true,
              // Convert Date to timestamp to avoid non-serializable warning
              sessionExpiry: typeof authState.sessionExpiry === 'object' 
                ? authState.sessionExpiry.getTime() 
                : authState.sessionExpiry || Date.now() + (30 * 60 * 1000)
            }));
          }
          
          // Mark as initialized regardless of validation result
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
        // Set loading to false
        setIsLoading(false);
      }
    };
    
    verifyAuth();
  }, [dispatch, isInitialized, isAuthenticated]);

  // Use a better loading component
  if (!isInitialized || (isLoading && isAuthenticated)) {
    logger.info('AuthGuard showing loading screen', {
      component: 'AuthGuard',
      isInitialized,
      isLoading
    });
    return <LoadingScreen message="Verifying authentication..." />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    logger.info('AuthGuard redirecting to login', {
      component: 'AuthGuard',
      from: location.pathname
    });
    return <Navigate to={APP_ROUTES.AUTH.LOGIN} state={{ from: location }} replace />;
  }
  
  // Check permissions if required
  if (requiredPermissions.length > 0 && !hasAllPermissions(requiredPermissions)) {
    logger.warn('AuthGuard permission check failed', {
      component: 'AuthGuard',
      requiredPermissions,
      path: location.pathname
    });
    return <Navigate to={APP_ROUTES.ERRORS.FORBIDDEN} replace />;
  }
  
  logger.info('AuthGuard rendering protected content', {
    component: 'AuthGuard',
    path: location.pathname
  });
  return <>{children}</>;
};
