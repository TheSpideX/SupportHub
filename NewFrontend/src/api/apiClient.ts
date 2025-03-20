import axios from 'axios';
import { getTokenService } from '@/features/auth/services';

// Configure base URL to avoid duplication
const apiClient = axios.create({
  baseURL: '', // Remove any base URL here to prevent duplication
  timeout: 30000,
  withCredentials: true, // Important for cookies
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
});

// Add request interceptor for CSRF token
apiClient.interceptors.request.use(
  (config) => {
    // Get CSRF token from TokenService if available
    const tokenService = getTokenService();
    const csrfToken = tokenService.getCsrfToken() || 
      document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1];
    
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle auth responses
apiClient.interceptors.response.use(
  (response) => {
    // If response contains CSRF token, store it
    if (response.data?.csrfToken) {
      const tokenService = getTokenService();
      tokenService.setCsrfToken(response.data.csrfToken);
    }
    return response;
  },
  (error) => Promise.reject(error)
);

export { apiClient };
