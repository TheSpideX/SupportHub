import axios from 'axios';
import { tokenService } from './token.service';
import { store } from '@/store';
import { logout } from '../store/authSlice';
import { authService } from './auth.service';

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

// Request interceptor - add basic error handling
axios.interceptors.request.use(
  config => {
    // Log request details for auth-related endpoints
    if (config.url && config.url.includes('/auth/')) {
      console.debug('Auth request details:', {
        url: config.url,
        method: config.method,
        hasCookies: document.cookie.length > 0,
        withCredentials: config.withCredentials
      });
    }
    
    // Ensure withCredentials is set to true for all requests
    // This is critical for cookies to be sent cross-domain
    config.withCredentials = true;
    
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor - improved error handling
axios.interceptors.response.use(
  response => response,
  async error => {
    // Basic error handling to prevent crashes
    if (!error) {
      return Promise.reject({ 
        message: 'Unknown error occurred',
        code: 'UNKNOWN_ERROR',
        isNetworkError: false
      });
    }
    
    // Handle network errors with more detail
    if (!error.response) {
      // Check if it's a CORS error
      if (error.message && error.message.includes('Network Error')) {
        console.error('Network error details:', {
          message: error.message,
          config: error.config
        });
        
        // Check if backend is running by making a simple OPTIONS request
        try {
          const isBackendAvailable = await checkBackendAvailability();
          
          const networkError = { 
            message: isBackendAvailable 
              ? 'CORS error - backend running but CORS not configured properly'
              : 'Unable to connect to server. Please check if the backend is running.',
            code: 'NETWORK_ERROR',
            isNetworkError: true,
            details: {
              url: error.config?.url,
              method: error.config?.method,
              backendAvailable: isBackendAvailable
            }
          };
          return Promise.reject(networkError);
        } catch (e) {
          // If check fails, assume backend is down
          const networkError = { 
            message: 'Unable to connect to server. Please check if the backend is running.',
            code: 'NETWORK_ERROR',
            isNetworkError: true,
            details: {
              url: error.config?.url,
              method: error.config?.method
            }
          };
          return Promise.reject(networkError);
        }
      }
      
      // Handle timeout errors
      if (error.code === 'ECONNABORTED') {
        const timeoutError = {
          message: 'Request timed out. Server may be overloaded or offline.',
          code: 'TIMEOUT_ERROR',
          isNetworkError: true
        };
        return Promise.reject(timeoutError);
      }
      
      // Generic network error
      const networkError = { 
        message: 'Network error - unable to connect to server',
        code: 'NETWORK_ERROR',
        isNetworkError: true
      };
      return Promise.reject(networkError);
    }
    
    // Handle 401 errors
    if (error.response.status === 401) {
      // Simple logout without complex token refresh logic for now
      store.dispatch(logout());
    }
    
    // Add consistent error structure to all errors
    const enhancedError = {
      ...error,
      code: error.response?.data?.code || `HTTP_${error.response?.status || 'UNKNOWN'}`,
      message: error.response?.data?.message || error.message || 'An unexpected error occurred',
      isNetworkError: !error.response
    };
    
    return Promise.reject(enhancedError);
  }
);

// Helper function to check if backend is available
async function checkBackendAvailability(): Promise<boolean> {
  try {
    // Use fetch with no-cors mode to check if server responds at all
    const response = await fetch(API_ROUTES.BASE_URL, { 
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-cache',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'text/plain'
      },
      redirect: 'follow',
      referrerPolicy: 'no-referrer'
    });
    
    // If we get here, server is responding (though we can't see the response in no-cors mode)
    return true;
  } catch (e) {
    // If fetch fails completely, server is likely down
    return false;
  }
}
