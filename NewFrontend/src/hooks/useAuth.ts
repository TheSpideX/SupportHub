/**
 * useAuth Hook
 *
 * React hook for using the auth system in components.
 */

import { useState, useEffect, useCallback } from "react";
import {
  authService,
  AuthState,
  LoginCredentials,
  RegistrationData,
  AuthEventType,
} from "@/features/auth/services";

/**
 * useAuth hook
 */
export function useAuth() {
  // State
  const [authState, setAuthState] = useState<AuthState>(
    authService.getAuthState()
  );

  // Update state when auth state changes
  useEffect(() => {
    const unsubscribe = authService.on(
      AuthEventType.STATE_CHANGED,
      (newState: AuthState) => {
        setAuthState(newState);
      }
    );

    return unsubscribe;
  }, []);

  // Login
  const login = useCallback(async (credentials: LoginCredentials) => {
    return authService.login(credentials);
  }, []);

  // Logout
  const logout = useCallback(async () => {
    return authService.logout();
  }, []);

  // Register
  const register = useCallback(async (data: RegistrationData) => {
    return authService.register(data);
  }, []);

  // Update user activity
  const updateActivity = useCallback(() => {
    authService.updateUserActivity();
  }, []);

  // Return auth state and methods
  return {
    // Auth state
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    user: authState.user,
    error: authState.error,
    sessionExpiry: authState.sessionExpiry,

    // Auth methods
    login,
    logout,
    register,
    updateActivity,
  };
}

export default useAuth;
