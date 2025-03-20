import axios, { AxiosResponse } from 'axios';
import { API_CONFIG } from '@/config/api';
import { SecurityContext, SessionData, UserRole } from '../types/auth.types';
import { apiClient } from '@/api/apiClient';

// Helper function to convert string role to UserRole enum
const mapStringToUserRole = (role: string): UserRole => {
  switch (role.toUpperCase()) {
    case 'ADMIN':
      return UserRole.ADMIN;
    case 'MANAGER':
      return UserRole.MANAGER;
    case 'USER':
      return UserRole.USER;
    // Map backend roles to frontend roles
    case 'CUSTOMER':
      return UserRole.USER;
    case 'SUPPORT':
      return UserRole.USER;
    case 'TECHNICAL':
      return UserRole.USER;
    case 'TEAM_LEAD':
      return UserRole.MANAGER;
    default:
      return UserRole.GUEST;
  }
};

// Define the SessionValidationResponse interface
interface SessionValidationResponse {
  success?: boolean;
  isValid?: boolean;
  valid?: boolean;
  user?: {
    id: string;
    email: string;
    name: string; // Add required name property
    role: string;
    permissions?: string[];
    twoFactorEnabled: boolean; // Add required property
    emailVerified: boolean; // Add required property
    createdAt?: string;
    updatedAt?: string;
    preferences?: Record<string, any>;
    [key: string]: any;
  };
  session?: {
    id?: string;
    expiresAt?: string; // Make optional to avoid TypeScript errors
    createdAt?: string;
    [key: string]: any;
  };
  message?: string;
  [key: string]: any;
}

// Create auth-specific API client with interceptors for CSRF token
const apiInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL, // Make sure this doesn't already include '/api'
  timeout: API_CONFIG.TIMEOUT,
  withCredentials: true,
  headers: API_CONFIG.HEADERS
});

// Add request interceptor to include CSRF token in headers
apiInstance.interceptors.request.use(
  (config) => {
    // Get CSRF token from cookie
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrf_token='))
      ?.split('=')[1];
    
    // Add CSRF token to header if available
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle token expiration
apiInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is due to token expiration and we haven't tried refreshing yet
    if (error.response?.status === 401 && 
        error.response?.data?.errorName === 'AppError' && 
        error.response?.data?.message?.includes('Token expired') && 
        !originalRequest._retry) {
      
      originalRequest._retry = true;
      
      try {
        // Try to refresh the token
        await authApi.refreshToken();
        
        // Retry the original request
        return apiInstance(originalRequest);
      } catch (refreshError) {
        // If refresh fails, redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export const authApi = {
  // Security-related API calls
  validateSecurityContext: async (data: { 
    securityContext: SecurityContext, 
    deviceFingerprint: string | null 
  }) => {
    return apiInstance.post('/api/auth/security/validate', data);
  },
  
  validateSession: async () => {
    try {
      const response = await apiInstance.get('/api/auth/session/validate');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.log('🔍 [DEBUG] validate-session API error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Session validation failed'
      };
    }
  },
  
  refreshSession: async () => {
    return apiInstance.post('/api/auth/token/refresh');
  },
  
  sessionHeartbeat: async () => {
    return apiInstance.post('/api/auth/session/heartbeat');
  },
  
  terminateSession: async (sessionId: string) => {
    return apiInstance.delete(`/api/auth/session/${sessionId}`);
  },
  
  // Other auth API calls
  login: async (credentials) => {
    try {
      // Get device fingerprint from security service or generate a fallback
      let fingerprint;
      try {
        // Try to get fingerprint from security service if available
        if (window.securityService && typeof window.securityService.getDeviceFingerprint === 'function') {
          fingerprint = await window.securityService.getDeviceFingerprint();
        } else {
          // Fallback to stored fingerprint or generate new one
          fingerprint = localStorage.getItem('device_fingerprint') || 
                        `${navigator.userAgent}|${navigator.language}|${new Date().getTimezoneOffset()}|${window.screen.width}x${window.screen.height}`;
          localStorage.setItem('device_fingerprint', fingerprint);
        }
      } catch (error) {
        console.error('Error getting device fingerprint:', error);
        fingerprint = 'fingerprint-error';
      }
      
      // Add device info to credentials
      const requestData = {
        ...credentials,
        deviceInfo: {
          fingerprint,
          userAgent: navigator.userAgent,
          ip: window.location.hostname // This is a fallback, actual IP will be determined by server
        }
      };
      
      // Make login request - use apiInstance for consistent cookie handling
      const response = await apiInstance.post('/api/auth/login', requestData, {
        withCredentials: true // Important for receiving HTTP-only cookies
      });
      
      // Return response data
      return response.data;
    } catch (error) {
      console.error('Login API error:', error);
      
      // Format error response
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      
      throw error;
    }
  },
  
  logout: async () => {
    return apiInstance.post('/api/auth/logout');
  },
  
  // Update the refreshToken method to properly handle HTTP-only cookies
  refreshToken: async () => {
    try {
      const response = await apiInstance.post('/api/auth/token/refresh', {}, {
        withCredentials: true // Ensure cookies are sent with the request
      });
      return response.data;
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  },
  
  /**
   * Report suspicious activity to the server
   * @param data Suspicious activity data
   * @returns API response
   */
  reportSuspiciousActivity: async (data: {
    timestamp: number;
    deviceFingerprint: string | null;
    securityContext: string | null;
    [key: string]: any;
  }): Promise<AxiosResponse> => {
    return apiInstance.post('/api/auth/security/report', data, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true // For HTTP-only cookie auth
    });
  },
  
  updateSessionActivity: async (sessionId) => {
    try {
      const response = await apiClient.post('/api/auth/sessions/activity', { sessionId }, {
        withCredentials: true // Important for HTTP-only cookies
      });
      return response.data;
    } catch (error) {
      console.error('Session activity update error:', error);
      throw error;
    }
  },
  
  // Update the sessionSync method to include CSRF token
  sessionSync: async (data: {
    tabId: string;
    lastActivity: number;
    sessionId: string | null;
  }) => {
    try {
      const response = await apiInstance.post('/api/auth/session/sync', data, {
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.error('Session sync error:', error);
      throw error;
    }
  }
};
