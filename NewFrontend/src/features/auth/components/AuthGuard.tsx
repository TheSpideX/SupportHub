import { ReactNode } from 'react';
import { useLocation, Navigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store";
import { APP_ROUTES } from "@/config/routes";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { clearAuthState, setInitialized } from "@/features/auth/store";
import { useEffect } from "react";
import LoadingScreen from "@/components/shared/LoadingScreen";

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
  const { isAuthenticated, isInitialized, isLoading } = useSelector((state: RootState) => state.auth);
  const { hasAllPermissions } = usePermissions();
  const { refreshUserData } = useAuth();
  
  // Verify auth status on mount
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        if (!isInitialized) {
          // Force initialization if not already done
          dispatch(setInitialized(true));
        }
        
        if (isAuthenticated) {
          // Check with server if we're actually authenticated
          const isValid = await refreshUserData();
          
          // If server says we're not authenticated but our state thinks we are,
          // clear the auth state to fix the inconsistency
          if (!isValid) {
            dispatch(clearAuthState());
            // Redirect will happen automatically due to !isAuthenticated
          }
        }
      } catch (error) {
        // On any error, assume we're not authenticated
        if (isAuthenticated) {
          dispatch(clearAuthState());
        }
      }
    };
    
    verifyAuth();
  }, [isInitialized, isAuthenticated, dispatch, refreshUserData]);

  // Use a better loading component
  if (!isInitialized || (isLoading && isAuthenticated)) {
    return <LoadingScreen message="Verifying authentication..." />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={APP_ROUTES.AUTH.LOGIN} state={{ from: location }} replace />;
  }
  
  // Check permissions if required
  if (requiredPermissions.length > 0 && !hasAllPermissions(requiredPermissions)) {
    return <Navigate to={APP_ROUTES.ERRORS.FORBIDDEN} replace />;
  }
  
  return <>{children}</>;
};
