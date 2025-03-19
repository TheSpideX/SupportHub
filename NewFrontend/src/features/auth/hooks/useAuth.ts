import { useCallback } from 'react';
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
  clearAuthState
} from '../store';
// Fix the import to use the getter function instead of direct import
import { getAuthService } from '../services';
import { LoginCredentials, RegistrationData, PasswordResetData, User } from '../types/auth.types';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { logger } from '@/utils/logger';
import { RootState } from '@/store';

/**
 * Custom hook for authentication state and operations
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  // Get the auth service instance
  const authService = getAuthService();
  // Fix 1: Properly type the state selector
  const { user, isAuthenticated, isLoading, error } = useSelector((state: RootState) => state.auth);

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
   * Login with credentials
   */
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    
    try {
      const result = await authService.login(credentials);
      
      if (!result) {
        // If login failed, the error should be in the auth state already
        // set by the AuthService
        const currentError = error; // Using the error from the hook's state
        
        logger.error('Authentication error', { 
          component: 'useAuth',
          error: currentError || {}
        });
        
        // Throw the error to be caught by the UI
        throw currentError || new Error('Login failed');
      }
      
      return result;
    } catch (error) {
      logger.error('Authentication error', { 
        component: 'useAuth',
        error: error || {}
      });
      
      // Dispatch the error to the store
      dispatch(setError({
        code: error.code || 'LOGIN_FAILED',
        message: error.message || 'Login failed. Please try again.'
      }));
      
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  }

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
    user,
    isAuthenticated,
    isLoading,
    error,
    
    // Auth methods
    login,
    logout,
    register,
    resetPassword,
    refreshUserData
  };
}
