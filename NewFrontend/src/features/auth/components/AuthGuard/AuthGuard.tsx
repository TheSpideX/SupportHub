import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { APP_ROUTES } from '@/config/routes';
import { logger } from '@/utils/logger';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { setSessionAlert, setAuthInitialized } from "../../store/authSlice";
import LoadingScreen from '@/components/shared/LoadingScreen';
import { ROLE_REDIRECTS } from '../../config/permissions';
import { tokenService } from '../../services/token.service';
import { authService } from '../../services/auth.service';

interface AuthGuardProps {
  children: ReactNode;
  permissions?: string[];
  requireAll?: boolean;
  requiredRoles?: string[];
  securityLevel?: 'low' | 'medium' | 'high';
}

export const AuthGuard = ({ 
  children, 
  permissions = [], 
  requireAll = false,
  requiredRoles = [],
  securityLevel = 'low'
}: AuthGuardProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated, user, isLoading, securityContext, isInitialized } = useSelector((state: any) => state.auth);
  const { hasAnyPermission, hasAllPermissions } = usePermissions();
  const { refreshToken: refreshAuthToken, isAuthenticated: isAuth } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [tokenRefreshed, setTokenRefreshed] = useState(false);
  const [isValidatingSession, setIsValidatingSession] = useState(false);
  const [localInitialized, setLocalInitialized] = useState(false);
  
  // Log auth state for debugging
  useEffect(() => {
    logger.debug('AuthGuard state', {
      isLoading,
      isInitialized,
      localInitialized,
      isValidatingSession,
      isAuthenticated,
      isAuth
    });
  }, [isLoading, isInitialized, localInitialized, isValidatingSession, isAuthenticated, isAuth]);

  // Handle initialization status
  useEffect(() => {
    // If auth service has completed initialization but Redux state doesn't reflect it
    if (isInitialized === undefined && !localInitialized) {
      // Set a timeout to prevent infinite loading if auth service never initializes
      const timeout = setTimeout(() => {
        logger.warn('Auth initialization timeout reached, forcing initialization state');
        dispatch(setAuthInitialized(true));
        setLocalInitialized(true);
      }, 3000); // Reduce timeout to 3 seconds for faster feedback
      
      return () => clearTimeout(timeout);
    } else if (isInitialized === true && !localInitialized) {
      // Sync local state with Redux state
      setLocalInitialized(true);
    }
  }, [isInitialized, localInitialized, dispatch]);

  // Add this effect to check auth service initialization status
  useEffect(() => {
    // Check if auth is initialized in Redux
    if (!isInitialized && isAuthenticated) {
      // If we're authenticated but not marked as initialized, update the state
      logger.debug('Auth is authenticated but not marked as initialized, updating state');
      dispatch(setAuthInitialized(true));
    }
  }, [isAuthenticated, isInitialized, dispatch]);

  // Check if session needs verification
  useEffect(() => {
    const checkSecurityRequirements = async () => {
      if (!isAuth || isVerifying) return;

      // For high security routes, verify session freshness
      if (securityLevel === 'high' && securityContext?.lastAuthenticated) {
        const lastAuthTime = new Date(securityContext.lastAuthenticated).getTime();
        const currentTime = Date.now();
        const timeSinceAuth = currentTime - lastAuthTime;
        
        // If last authentication was more than 30 minutes ago, require re-authentication
        if (timeSinceAuth > 30 * 60 * 1000) {
          setIsVerifying(true);
          
          dispatch(setSessionAlert({
            type: 'warning',
            message: 'This action requires recent authentication',
            action: 'reauth'
          }));
          
          // Redirect to re-authentication page
          navigate(APP_ROUTES.AUTH.REAUTH, { state: { from: location } });
          return;
        }
      }
      
      // Check for suspicious activity
      if (securityContext?.suspiciousActivity && securityContext.requiresVerification) {
        navigate(APP_ROUTES.AUTH.VERIFY_DEVICE, { state: { from: location } });
        return;
      }
    };
    
    checkSecurityRequirements();
  }, [isAuth, securityLevel, securityContext, location, dispatch, isVerifying, navigate]);

  // Validate access permissions
  const validateAccess = () => {
    // Check permissions
    const hasPermission = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
    
    // Check roles
    const hasRole = requiredRoles.length === 0 || 
      requiredRoles.some(role => user?.role === role);
    
    return hasPermission && hasRole;
  };

  // Handle redirect for unauthorized access
  const handleRedirect = () => {
    logger.warn('Access denied - insufficient permissions', {
      path: location.pathname,
      requiredPermissions: permissions,
      requiredRoles,
      userPermissions: user?.permissions,
      userRole: user?.role
    });
    
    // Redirect to appropriate page based on user role
    if (user?.role && ROLE_REDIRECTS[user.role]) {
      return <Navigate to={ROLE_REDIRECTS[user.role]} replace />;
    }
    
    // Default redirect to dashboard
    return <Navigate to={APP_ROUTES.DASHBOARD.ROOT} replace />;
  };

  // Refresh token if needed
  useEffect(() => {
    let isMounted = true;
    
    const checkTokenFreshness = async () => {
      // Skip if not authenticated or already validating
      if (!isAuth || isValidatingSession) return;
      
      try {
        setIsValidatingSession(true);
        logger.debug('Checking token freshness');
        
        // Check if token is expiring soon
        const isExpiring = await tokenService.isTokenExpiringSoon(120); // 2 minutes threshold
        
        if (isExpiring) {
          logger.debug('Token is expiring soon, refreshing');
          // Use the auth hook's refreshToken method
          await refreshAuthToken();
          if (isMounted) setTokenRefreshed(true);
        } else {
          logger.debug('Token is still valid');
        }
      } catch (error) {
        logger.error('Failed to refresh token', { error });
        // Only navigate if component is still mounted
        if (isMounted) {
          navigate(APP_ROUTES.AUTH.LOGIN, { state: { from: location } });
        }
      } finally {
        if (isMounted) {
          setIsValidatingSession(false);
          logger.debug('Token validation completed');
        }
      }
    };
    
    checkTokenFreshness();
    
    return () => {
      isMounted = false;
    };
  }, [isAuth, location, navigate, refreshAuthToken, isValidatingSession]);

  // Determine if we should show loading screen
  const showLoading = isLoading || (isValidatingSession && isAuth);
  
  // If auth is not initialized yet, show loading screen
  if (!isInitialized && !localInitialized) {
    // Check if tokens exist - if not, redirect to login immediately
    if (!tokenService.hasStoredTokens()) {
      logger.debug('No stored tokens found, redirecting to login');
      return <Navigate to={APP_ROUTES.AUTH.LOGIN} state={{ from: location }} replace />;
    }
    
    logger.debug('Auth not initialized yet, showing loading screen');
    return <LoadingScreen message="Initializing authentication..." />;
  }
  
  // If we're validating the session for an authenticated user, show loading
  if (showLoading) {
    logger.debug('Validating session, showing loading screen');
    return <LoadingScreen message="Verifying access..." />;
  }

  // Handle unauthenticated users
  if (!isAuth) {
    logger.info('User not authenticated, redirecting to login', {
      path: location.pathname
    });
    
    return <Navigate to={APP_ROUTES.AUTH.LOGIN} state={{ from: location }} replace />;
  }

  // Check permissions if needed
  if ((permissions.length > 0 || requiredRoles.length > 0) && !validateAccess()) {
    return handleRedirect();
  }

  return <>{children}</>;
};
