import axios from "axios";
import { API_CONFIG, API_ERRORS, CORS_CONFIG } from "@/config/api";
import { logger } from "@/utils/logger";
import { RetryHandler } from "@/core/errors/retryHandler";
import { errorHandler } from "@/core/errors/errorHandler";
import { securityService } from '@/features/auth/services/security.service';
import { serverStatusService } from '@/components/ui/ServerStatusIndicator';
import { AuthApi } from '@/features/auth/api/auth-api';

// Create axios instance with proper configuration
export const axiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: API_CONFIG.HEADERS,
  withCredentials: true, // This is crucial for sending cookies with requests
});

// Set global default for all axios requests
axios.defaults.withCredentials = true;

// Add request interceptor to ensure withCredentials is always set
axiosInstance.interceptors.request.use(config => {
  // Always include credentials with requests
  config.withCredentials = true;
  
  // Log auth-related requests in development
  if (process.env.NODE_ENV === 'development' && config.url?.includes('/auth/')) {
    console.log(`Making ${config.method?.toUpperCase() || 'GET'} request to ${config.url} with credentials`);
  }
  
  return config;
});

// Add request interceptor to include CSRF token
axiosInstance.interceptors.request.use(
  (config) => {
    // Get CSRF token from storage or state
    const csrfToken = localStorage.getItem('csrfToken') || '';
    
    // Add CSRF token to headers if available
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to save CSRF token
axiosInstance.interceptors.response.use(
  (response) => {
    // Save CSRF token if present in response headers
    const csrfToken = response.headers['x-csrf-token'];
    if (csrfToken) {
      localStorage.setItem('csrfToken', csrfToken);
    }
    
    return response;
  },
  (error) => Promise.reject(error)
);

// Add request ID to each request
axiosInstance.interceptors.request.use(
  (config) => {
    // Generate a unique request ID
    config.headers = config.headers || {};
    config.headers['X-Request-ID'] = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle token refresh
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't tried to refresh token yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh the token
        const refreshed = await tokenService.refreshTokens();
        
        if (refreshed) {
          // Retry the original request
          return axiosInstance(originalRequest);
        } else {
          // If refresh failed, clear auth state
          await tokenService.clearTokens();
          store.dispatch({ type: 'auth/logout' });
        }
      } catch (refreshError) {
        // If refresh throws an error, clear auth state
        await tokenService.clearTokens();
        store.dispatch({ type: 'auth/logout' });
      }
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;