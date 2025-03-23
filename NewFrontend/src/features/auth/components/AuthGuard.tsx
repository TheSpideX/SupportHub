import { ReactNode, useState, useRef, useEffect, useCallback } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store";
import { APP_ROUTES } from "@/config/routes";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { clearAuthState, setInitialized } from "@/features/auth/store";
import LoadingScreen from "@/components/shared/LoadingScreen";
import { logger } from "@/utils/logger";
import { getAuthService } from "@/features/auth/services";
import { setAuthState } from "@/features/auth/store";

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
  requiredPermissions = [],
}: AuthGuardProps) => {
  const location = useLocation();
  const dispatch = useDispatch();
  const { isAuthenticated, isInitialized } = useSelector(
    (state: RootState) => state.auth
  );
  const { hasAllPermissions } = usePermissions();
  const { refreshUserData } = useAuth();
  const [isLoading, setIsLoading] = useState(!isInitialized);
  const validationInProgress = useRef(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const lastVerifyTime = useRef<number>(0);

  // Enhanced logging for component evaluation
  logger.info("AuthGuard evaluation", {
    component: "AuthGuard",
    isAuthenticated,
    isInitialized,
    isLoading,
    path: location.pathname,
    requiredPermissions,
  });

  // Define the debounced verifyAuth function properly
  const verifyAuthDebounced = useCallback(() => {
    const now = Date.now();

    // Only verify if more than 2 seconds since last check
    if (now - lastVerifyTime.current < 2000) {
      return;
    }

    // Prevent concurrent calls
    if (isVerifying) {
      return;
    }

    // Set flags
    setIsVerifying(true);
    lastVerifyTime.current = now;

    // Perform actual verification (calling the detailed verifyAuth function)
    verifyAuthDetailed();
  }, [isVerifying]);

  // Define the detailed verification function
  const verifyAuthDetailed = async () => {
    try {
      // Skip if validation is already in progress
      if (validationInProgress.current) {
        logger.info("Auth validation already in progress, skipping", {
          component: "AuthGuard",
        });
        return;
      }

      validationInProgress.current = true;
      setIsLoading(true);

      logger.info("AuthGuard verifyAuth started", {
        component: "AuthGuard",
        isInitialized,
        isAuthenticated,
        cookies: document.cookie ? "Cookies present" : "No cookies",
        path: location.pathname,
      });

      // Get auth service to check current state
      const authService = getAuthService();
      const serviceAuthState = authService.getAuthState();

      logger.info("Auth service state check", {
        component: "AuthGuard",
        serviceIsAuthenticated: serviceAuthState.isAuthenticated,
        serviceHasUser: !!serviceAuthState.user,
        reduxIsAuthenticated: isAuthenticated,
      });

      // If service shows authenticated but Redux doesn't, sync the state
      if (
        serviceAuthState.isAuthenticated &&
        serviceAuthState.user &&
        !isAuthenticated
      ) {
        logger.info(
          "Auth state mismatch detected - syncing Redux with service state",
          {
            component: "AuthGuard",
          }
        );

        // Update Redux state with service state
        dispatch(
          setAuthState({
            user: serviceAuthState.user,
            isAuthenticated: true,
            sessionExpiry:
              serviceAuthState.sessionExpiry != null
                ? typeof serviceAuthState.sessionExpiry === "object"
                  ? serviceAuthState.sessionExpiry.getTime()
                  : serviceAuthState.sessionExpiry
                : Date.now() + 30 * 60 * 1000,
          })
        );

        // Skip further validation since we've updated the state
        validationInProgress.current = false;
        setIsLoading(false);
        return;
      }

      // If not initialized, initialize auth
      if (!isInitialized) {
        logger.info("Auth not initialized, initializing now", {
          component: "AuthGuard",
        });

        // Check if we have a valid session
        logger.info("Calling validateSession API", {
          component: "AuthGuard",
        });
        const isValid = await authService.validateSession();

        // If session is valid but Redux state doesn't reflect it, force update
        if (isValid) {
          const authState = authService.getAuthState();

          if (authState.isAuthenticated && authState.user) {
            logger.info("Session is valid, updating Redux state", {
              component: "AuthGuard",
            });

            dispatch(
              setAuthState({
                user: authState.user,
                isAuthenticated: true,
                sessionExpiry:
                  authState.sessionExpiry != null
                    ? typeof authState.sessionExpiry === "object"
                      ? authState.sessionExpiry.getTime()
                      : authState.sessionExpiry
                    : Date.now() + 30 * 60 * 1000,
              })
            );
          }
        }

        // Mark as initialized regardless of validation result
        dispatch(setInitialized(true));
      }
    } catch (error) {
      logger.error("Error verifying authentication", {
        component: "AuthGuard",
        error: error instanceof Error ? error.message : "Unknown error",
      });

      // On error, mark as initialized but not authenticated
      dispatch(setInitialized(true));
      dispatch(clearAuthState());
    } finally {
      validationInProgress.current = false;
      setIsLoading(false);
      setIsVerifying(false);
    }
  };

  // Use effect to trigger verification on mount and dependency changes
  useEffect(() => {
    // Skip if already authenticated and initialized
    if (isInitialized && isAuthenticated) {
      setIsLoading(false);
      return;
    }

    // Use the debounced verify auth function
    verifyAuthDebounced();
  }, [dispatch, isInitialized, isAuthenticated, verifyAuthDebounced]);

  // Use a better loading component
  if (isLoading) {
    return <LoadingScreen message="Authenticating..." />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    logger.info("AuthGuard redirecting to login", {
      component: "AuthGuard",
      from: location.pathname,
    });
    // Use direct path
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check permissions if required
  if (
    requiredPermissions.length > 0 &&
    !hasAllPermissions(requiredPermissions)
  ) {
    logger.warn("AuthGuard permission check failed", {
      component: "AuthGuard",
      requiredPermissions,
      path: location.pathname,
    });
    return <Navigate to={APP_ROUTES.ERRORS.FORBIDDEN} replace />;
  }

  logger.info("AuthGuard rendering protected content", {
    component: "AuthGuard",
    path: location.pathname,
  });
  return <>{children}</>;
};
