import axios from 'axios';
import { API_CONFIG } from '@/config/api';
import { logger } from '@/utils/logger';

// Update API client configuration to include credentials
const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL || '/api',
  timeout: 10000,
  withCredentials: true, // Critical for cookies
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Add request interceptor to include CSRF token
apiClient.interceptors.request.use(
  (config) => {
    // Get CSRF token from cookie
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('XSRF-TOKEN='))
      ?.split('=')[1];
    
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        logger.debug('Token expired, attempting refresh');
        
        // Attempt to refresh the token
        const refreshResponse = await apiClient.post('/api/auth/refresh-token', {}, { 
          withCredentials: true,
          // Add headers to help with CSRF protection
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        
        // Check if refresh was successful
        if (refreshResponse.status === 200) {
          logger.debug('Token refresh successful');
          
          // If CSRF token is in the response, update it
          if (refreshResponse.data?.csrfToken) {
            // Update CSRF token in storage or state
            if (window.tokenService && typeof window.tokenService.setCsrfToken === 'function') {
              window.tokenService.setCsrfToken(refreshResponse.data.csrfToken);
            }
          }
          
          // Retry the original request
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        logger.error('Token refresh failed', refreshError);
        
        // If refresh fails, redirect to login
        // But first, check if we're already on the login page to avoid redirect loops
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login?session=expired';
        }
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export { apiClient };
