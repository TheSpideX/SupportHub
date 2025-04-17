import { useCallback, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import {
  selectAuthState,
  selectUser,
  selectIsAuthenticated,
  selectIsLoading,
  selectAuthError,
  setUser,
  setLoading,
  setError,
  clearAuthState,
  setAuthState,
} from "../store";
import { getAuthService } from "../services";
import {
  LoginCredentials,
  RegistrationData,
  PasswordResetData,
  User,
} from "../types/auth.types";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { logger } from "@/utils/logger";
import { RootState } from "@/store";
import { APP_ROUTES } from "../../../config/routes";

/**
 * Custom hook for authentication state and operations
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [authService] = useState(getAuthService());
  // Add store reference with proper typing
  const store = useStore<RootState>();
  // Fix 1: Properly type the state selector
  const authState = useSelector((state: RootState) => state.auth);

  logger.debug("useAuth hook called", {
    component: "useAuth",
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    path: location.pathname,
  });

  const redirectToLogin = useCallback(() => {
    navigate(APP_ROUTES.AUTH.LOGIN);
  }, [navigate]);

  /**
   * Improved error handling for auth operations
   */
  const handleAuthError = (error: any) => {
    logger.error("Authentication error", { component: "useAuth", error });

    if (
      error?.response?.status === 500 ||
      error?.response?.status === 401 ||
      error?.code === "AUTHENTICATION_ERROR"
    ) {
      dispatch(clearAuthState());

      // Use consistent login path
      navigate(APP_ROUTES.AUTH.LOGIN, { replace: true });
    }

    toast.error(
      error?.response?.data?.message ||
        "Authentication failed. Please try again."
    );

    throw error;
  };

  /**
   * Login with email and password
   */
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    dispatch(setLoading(true));

    try {
      // Get the auth service instance
      const authServiceInstance = getAuthService();

      // Make login request through auth service
      const result = await authServiceInstance.login(credentials);

      if (result) {
        logger.info("Login successful", { component: "useAuth" });

        // Get the current user data from the auth state
        const currentState = authServiceInstance.getAuthState();
        const userData = currentState.user;

        logger.info("User data for redirect decision:", {
          component: "useAuth",
          role: userData?.role,
          hasUser: !!userData,
        });

        // Determine the appropriate dashboard based on user role
        let dashboardPath = "/dashboard";

        if (userData && userData.role) {
          // Map user roles to their respective dashboards
          switch (userData.role) {
            case "admin":
              dashboardPath = "/admin-dashboard";
              break;
            case "support":
            case "support_member":
              dashboardPath = "/support-dashboard";
              break;
            case "team_lead":
              // Check if the user is a support team lead or technical team lead
              if (userData.teamType === "support") {
                dashboardPath = "/team-lead-support-dashboard";
              } else if (userData.teamType === "technical") {
                dashboardPath = "/team-lead-technical-dashboard";
              }
              break;
            case "customer":
              dashboardPath = "/dashboard"; // Customer dashboard
              break;
            default:
              dashboardPath = "/dashboard"; // Default dashboard
          }
        }

        // Get the redirect path from state or use the role-based dashboard
        const from = location.state?.from?.pathname || dashboardPath;

        logger.info("Redirecting after login", {
          component: "useAuth",
          path: from,
          role: userData?.role,
        });

        // Redirect to the intended destination
        navigate(from, { replace: true });

        return true;
      }

      // If login failed but no error was thrown
      return false;
    } catch (error) {
      // Handle authentication error
      return handleAuthError(error);
    } finally {
      dispatch(setLoading(false));
    }
  };

  // Logout
  const logout = useCallback(async () => {
    dispatch(setLoading(true));

    try {
      await authService.logout();
      dispatch(clearAuthState());
      return true;
    } catch (error: any) {
      dispatch(
        setError({
          code: error.code || "LOGOUT_FAILED",
          message: error.message || "Logout failed. Please try again.",
        })
      );
      return false;
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  // Register
  const register = useCallback(
    async (data: RegistrationData) => {
      dispatch(setLoading(true));
      dispatch(setError(null));

      try {
        const result = await authService.register(data);
        return result;
      } catch (error: any) {
        dispatch(
          setError({
            code: error.code || "REGISTRATION_FAILED",
            message: error.message || "Registration failed. Please try again.",
          })
        );

        // Important: Re-throw the error so the component can handle it
        throw error;
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch]
  );

  // Reset password
  const resetPassword = useCallback(
    async (data: PasswordResetData) => {
      dispatch(setLoading(true));
      dispatch(setError(null));

      try {
        const result = await authService.resetPassword(data);
        return result;
      } catch (error: any) {
        dispatch(
          setError({
            code: error.code || "PASSWORD_RESET_FAILED",
            message:
              error.message || "Password reset failed. Please try again.",
          })
        );
        return false;
      } finally {
        dispatch(setLoading(false));
      }
    },
    [dispatch]
  );

  // Refresh user data
  const refreshUserData = useCallback(async () => {
    dispatch(setLoading(true));

    try {
      const userData = await authService.refreshUserData();
      if (userData) {
        dispatch(setUser(userData));
        return true;
      }
      return false;
    } catch (error: any) {
      dispatch(
        setError({
          code: error.code || "REFRESH_FAILED",
          message: error.message || "Failed to refresh user data.",
        })
      );
      return false;
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  // Login with registration data
  const loginWithRegistrationData = useCallback(async () => {
    try {
      const result = await authService.loginWithRegistrationData();
      return result;
    } catch (error) {
      logger.error("Error logging in with registration data:", error);
      return false;
    }
  }, []);

  return {
    // Auth state
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    error: authState.error,

    // Auth methods
    login,
    logout,
    register,
    resetPassword,
    refreshUserData,
    loginWithRegistrationData,
  };
};

// Example of how to use the TokenService in other files
import { TokenService } from "../services/TokenService";

// Get the singleton instance instead of creating a new one
const tokenService = TokenService.getInstance();
