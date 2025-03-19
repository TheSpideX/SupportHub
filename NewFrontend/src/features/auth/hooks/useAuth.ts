import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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
// Fix the import to use the getter function instead of direct import
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
      
      // Redirect to login on auth errors
      navigate('/login', { replace: true });
    }
    
    // Show user-friendly error message
    toast.error(error?.response?.data?.message || 'Authentication failed. Please try again.');
    
    throw error;
  };

  /**
   * Login with email and password
   */
  const login = useCallback(async (credentials: LoginCredentials): Promise<boolean> => {
    logger.info('Login attempt', { component: 'useAuth' });
    
    try {
      // Get the auth service instance
      const authServiceInstance = authService || getAuthService();
      
      // Attempt login through auth service
      const userData = await authServiceInstance.login(credentials);
      
      if (userData) {
        logger.info('Login successful', { component: 'useAuth' });
        
        // Calculate session expiry time (30 minutes from now)
        const expiryTime = Date.now() + 30 * 60 * 1000;
        
        // Update Redux state with user info - use timestamp instead of Date object
        dispatch(setAuthState({
          user: userData,
          isAuthenticated: true,
          sessionExpiry: expiryTime // Store as timestamp (number) instead of Date object
        }));
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Login failed', { 
        component: 'useAuth', 
        error: error instanceof Error ? { message: error.message } : error 
      });
      
      // Handle auth error
      handleAuthError(error);
      
      return false;
    }
  }, [authService, dispatch]);

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
