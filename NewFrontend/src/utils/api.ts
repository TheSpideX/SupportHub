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
  (response) => {
    // Check for token expiration header
    const tokenExpiresIn = response.headers['x-token-expires-in'];
    if (tokenExpiresIn) {
      const expiresInMs = parseInt(tokenExpiresIn, 10) * 1000;
      if (!isNaN(expiresInMs) && expiresInMs > 0) {
        // Schedule refresh based on server-provided expiration time
        const refreshThreshold = API_CONFIG.AUTH.REFRESH_THRESHOLD || 5 * 60 * 1000;
        const refreshIn = Math.max(expiresInMs - refreshThreshold, 1000); // At least 1 second
        
        logger.debug(`Scheduling token refresh in ${Math.round(refreshIn/1000)} seconds`);
        
        // Clear any existing refresh timeout
        if (window.tokenRefreshTimeout) {
          clearTimeout(window.tokenRefreshTimeout);
        }
        
        // Set new refresh timeout
        window.tokenRefreshTimeout = setTimeout(() => {
          logger.debug('Executing scheduled token refresh');
          apiClient.post('/auth/refresh-token', {}, { 
            withCredentials: true,
            headers: {
              'X-Requested-With': 'XMLHttpRequest'
            }
          })
          .then(() => logger.debug('Token refresh successful'))
          .catch(err => logger.error('Token refresh failed:', err));
        }, refreshIn);
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        logger.debug('Token expired, attempting refresh');
        
        // Remove the /api prefix since apiClient likely already has it
        const refreshResponse = await apiClient.post('/auth/refresh-token', {}, { 
          withCredentials: true,
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
