import axios from 'axios';
import { getTokenService } from '@/features/auth/services';

// Create API client instance
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  withCredentials: true, // This is crucial for sending cookies with requests
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
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
