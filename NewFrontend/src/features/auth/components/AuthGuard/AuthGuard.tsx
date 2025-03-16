import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { APP_ROUTES } from '@/config/routes';
import { logger } from '@/utils/logger';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { setSessionAlert } from "../../store/authSlice";
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
  const { isAuthenticated, user, isLoading, securityContext } = useSelector((state: any) => state.auth);
  const { hasAnyPermission, hasAllPermissions } = usePermissions();
  const { refreshToken: refreshAuthToken, isAuthenticated: isAuth } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [tokenRefreshed, setTokenRefreshed] = useState(false);

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
          return <Navigate to={APP_ROUTES.AUTH.REAUTH} state={{ from: location }} replace />;
        }
      }
      
      // Check for suspicious activity
      if (securityContext?.suspiciousActivity && securityContext.requiresVerification) {
        return <Navigate to={APP_ROUTES.AUTH.VERIFY_DEVICE} state={{ from: location }} replace />;
      }
    };
    
    checkSecurityRequirements();
  }, [isAuth, securityLevel, securityContext, location, dispatch, isVerifying]);

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
    
    // Analytics tracking removed
    
    // Redirect to appropriate page based on user role
    if (user?.role && ROLE_REDIRECTS[user.role]) {
      return <Navigate to={ROLE_REDIRECTS[user.role]} replace />;
    }
    
    // Default redirect to dashboard
    return <Navigate to={APP_ROUTES.DASHBOARD.ROOT} replace />;
  };

  // Handle loading state
  if (isLoading) {
    return <LoadingScreen message="Verifying access..." />;
  }

  // Handle unauthenticated users
  if (!isAuth) {
    logger.info('User not authenticated, redirecting to login', {
      path: location.pathname
    });
    
    return <Navigate to={APP_ROUTES.AUTH.LOGIN} state={{ from: location }} replace />;
  }

  // Refresh token if needed
  useEffect(() => {
    let isMounted = true;
    let refreshAttempted = false;
    
    const checkTokenFreshness = async () => {
      try {
        // Only attempt refresh once per mount to prevent loops
        if (refreshAttempted) return;
        refreshAttempted = true;
        
        if (isAuth) {
          // Check if token is expiring soon - use isTokenExpiringSoon instead of isTokenExpiring
          const isExpiring = await tokenService.isTokenExpiringSoon(120); // 2 minutes threshold
          
          if (isExpiring) {
            // Use the auth hook's refreshToken method
            await refreshAuthToken();
            if (isMounted) setTokenRefreshed(true);
          }
        }
      } catch (error) {
        console.error('Failed to refresh token:', error);
        // Only navigate if component is still mounted
        if (isMounted) {
          navigate(APP_ROUTES.AUTH.LOGIN, { state: { from: location } });
        }
      }
    };
    
    checkTokenFreshness();
    
    return () => {
      isMounted = false;
    };
  }, [isAuth, location, navigate, refreshAuthToken]);

  // Check permissions if needed
  if ((permissions.length > 0 || requiredRoles.length > 0) && !validateAccess()) {
    return handleRedirect();
  }

  return <>{children}</>;
};
