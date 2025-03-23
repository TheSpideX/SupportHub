import { useCallback, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
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
  setAuthState
} from '../store';
import { getAuthService } from '../services';
import { LoginCredentials, RegistrationData, PasswordResetData, User } from '../types/auth.types';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { logger } from '@/utils/logger';
import { RootState } from '@/store';

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

  logger.debug('useAuth hook called', { 
    component: 'useAuth', 
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    path: location.pathname
  });

  /**
   * Improved error handling for auth operations
   */
  const handleAuthError = (error: any) => {
    logger.error('Authentication error', { component: 'useAuth', error });
    
    // Clear any stale auth state on critical errors
    if (error?.response?.status === 500 || 
        error?.response?.status === 401 || 
        error?.code === 'AUTHENTICATION_ERROR') {
      dispatch(clearAuthState());
      
      // Redirect to login on auth errors - use correct path
      navigate('/login', { replace: true });
    }
    
    // Show user-friendly error message
    toast.error(error?.response?.data?.message || 'Authentication failed. Please try again.');
    
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
        logger.info('Login successful', { component: 'useAuth' });
        
        // Get the redirect path from state or default to dashboard
        const from = location.state?.from?.pathname || '/dashboard';
        
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
      dispatch(setError({
        code: error.code || 'LOGOUT_FAILED',
        message: error.message || 'Logout failed. Please try again.'
      }));
      return false;
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);
  
  // Register
  const register = useCallback(async (data: RegistrationData) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    
    try {
      const result = await authService.register(data);
      return result;
    } catch (error: any) {
      dispatch(setError({
        code: error.code || 'REGISTRATION_FAILED',
        message: error.message || 'Registration failed. Please try again.'
      }));
      return false;
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);
  
  // Reset password
  const resetPassword = useCallback(async (data: PasswordResetData) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    
    try {
      const result = await authService.resetPassword(data);
      return result;
    } catch (error: any) {
      dispatch(setError({
        code: error.code || 'PASSWORD_RESET_FAILED',
        message: error.message || 'Password reset failed. Please try again.'
      }));
      return false;
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);
  
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
      dispatch(setError({
        code: error.code || 'REFRESH_FAILED',
        message: error.message || 'Failed to refresh user data.'
      }));
      return false;
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);
  
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
    refreshUserData
  };
}

// Example of how to use the TokenService in other files
import { TokenService } from '../services/TokenService';

// Get the singleton instance instead of creating a new one
const tokenService = TokenService.getInstance();
