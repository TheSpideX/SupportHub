import axios from 'axios';
import { API_CONFIG } from '@/config/api';
import { logger } from '@/utils/logger';
import { getSocketService } from '@/services/socket';
import { getTokenService } from '@/features/auth/services';

// Create API client with proper configuration
const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL || '/api',
  timeout: API_CONFIG.TIMEOUT || 15000,
  withCredentials: true, // Critical for cookies
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
});

// Add request interceptor for CSRF token and device tracking
apiClient.interceptors.request.use(
  (config) => {
    // Get CSRF token from cookie
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${API_CONFIG.CSRF.COOKIE_NAME}=`))
      ?.split('=')[1];
    
    if (csrfToken) {
      config.headers[API_CONFIG.CSRF.HEADER_NAME] = csrfToken;
    }
    
    // Add device and tab identifiers if socket service is available
    const socketService = getSocketService();
    if (socketService) {
      config.headers['X-Device-ID'] = socketService.getDeviceId();
      config.headers['X-Tab-ID'] = socketService.getTabId();
      
      // Add leader status if this tab is the leader
      if (socketService.isLeaderTab()) {
        config.headers['X-Tab-Leader'] = 'true';
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for token refresh and session management
apiClient.interceptors.response.use(
  (response) => {
    // Handle session expiration information
    const tokenExpiresIn = response.headers['x-session-expires-in'];
    if (tokenExpiresIn) {
      const expiresInMs = parseInt(tokenExpiresIn, 10) * 1000;
      if (!isNaN(expiresInMs) && expiresInMs > 0) {
        const socketService = getSocketService();
        
        // If we have a socket service, let it handle token refresh scheduling
        if (socketService) {
          socketService.updateSessionExpiration(expiresInMs);
        } else {
          // Fallback to traditional refresh scheduling
          const refreshThreshold = API_CONFIG.AUTH.REFRESH_THRESHOLD || 5 * 60 * 1000;
          const refreshIn = Math.max(expiresInMs - refreshThreshold, 1000);
          
          logger.debug(`Scheduling token refresh in ${Math.round(refreshIn/1000)} seconds`);
          
          // Clear any existing refresh timeout
          if (window.tokenRefreshTimeout) {
            clearTimeout(window.tokenRefreshTimeout);
          }
          
          // Set new refresh timeout
          window.tokenRefreshTimeout = setTimeout(() => {
            logger.debug('Executing scheduled token refresh');
            apiClient.post('/auth/refresh-token', {})
              .then(() => logger.debug('Token refresh successful'))
              .catch(err => logger.error('Token refresh failed:', err));
          }, refreshIn);
        }
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
        const socketService = getSocketService();
        const tokenService = getTokenService();
        
        logger.debug('Token expired, attempting refresh');
        
        // If we have a socket service and we're not the leader tab,
        // wait for the leader to refresh the token
        if (socketService && !socketService.isLeaderTab()) {
          logger.debug('Waiting for leader tab to refresh token');
          await socketService.waitForTokenRefresh();
        } else {
          // This tab will handle the token refresh
          logger.debug('This tab is refreshing the token');
          await apiClient.post('/auth/refresh-token', {});
          
          // If we have a socket service, notify other tabs
          if (socketService && socketService.isLeaderTab()) {
            socketService.notifyTokenRefreshed();
          }
        }
        
        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        logger.error('Token refresh failed', refreshError);
        
        // If refresh fails, redirect to login
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login?session=expired';
        }
        return Promise.reject(refreshError);
      }
    }
    
    // Handle 403 errors that might be related to CSRF
    if (error.response?.status === 403 && 
        error.response?.data?.message?.includes('CSRF')) {
      try {
        logger.debug('CSRF token invalid, attempting to refresh');
        
        // Try to get a new CSRF token
        const tokenService = getTokenService();
        if (tokenService) {
          await tokenService.refreshCsrfToken();
          
          // Update the CSRF token in the original request
          originalRequest.headers[API_CONFIG.CSRF.HEADER_NAME] = 
            tokenService.getCsrfToken();
          
          // Retry the original request
          return apiClient(originalRequest);
        }
      } catch (csrfError) {
        logger.error('CSRF refresh failed', csrfError);
      }
    }
    
    return Promise.reject(error);
  }
);

export { apiClient };
