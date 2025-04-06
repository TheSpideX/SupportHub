import axios, { AxiosResponse } from 'axios';
import { API_CONFIG } from '@/config/api';
import { SecurityContext, SessionData, UserRole } from '../types/auth.types';
import { apiClient } from '@/api/apiClient';
import { tokenService } from '../services/TokenService';
import { refreshQueueService } from '../services/RefreshQueueService';

// Helper function to convert string role to UserRole enum
const mapStringToUserRole = (role: string): UserRole => {
  switch (role.toUpperCase()) {
    case 'ADMIN':
      return UserRole.ADMIN;
    // Map backend roles to frontend roles
    case 'CUSTOMER':
      return UserRole.CUSTOMER;
    case 'SUPPORT':
      return UserRole.SUPPORT;
    case 'TECHNICAL':
      return UserRole.TECHNICAL;
    case 'TEAM_LEAD':
      return UserRole.TEAM_LEAD;
    default:
      return UserRole.CUSTOMER; // Default to CUSTOMER role
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
      
      // Check if a refresh is already in progress
      if (refreshQueueService.isRefreshInProgress()) {
        try {
          // Wait for the ongoing refresh to complete
          await refreshQueueService.enqueue();
          // Retry the original request
          return apiInstance(originalRequest);
        } catch (queueError) {
          // If refresh failed, redirect to login
          window.location.href = '/login'; // Updated from '/auth/login'
          return Promise.reject(queueError);
        }
      }
      
      // Set refreshing flag
      refreshQueueService.setRefreshing(true);
      
      try {
        // Try to refresh the token
        await authApi.refreshToken();
        
        // Process queue with success
        refreshQueueService.processQueue(true);
        
        // Retry the original request
        return apiInstance(originalRequest);
      } catch (refreshError) {
        // Process queue with failure
        refreshQueueService.processQueue(false, refreshError);
        
        // If refresh fails, redirect to login - use direct path
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
      // First try the status endpoint which works without authentication
      const response = await apiInstance.get('/api/auth/session/status');
      
      // If authenticated, then get full session details
      if (response.data && response.data.authenticated) {
        // Optionally get more detailed session info if needed
        const detailsResponse = await apiInstance.get('/api/auth/session/validate');
        return {
          success: true,
          data: detailsResponse.data
        };
      }
      
      return {
        success: false,
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
        withCredentials: true,
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
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
  
  updateSessionActivity: async () => {
    try {
      const response = await apiInstance.post('/api/auth/session/heartbeat', {}, {
        withCredentials: true,
        headers: {
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Session activity update error:', error);
      throw error;
    }
  },
  
  // Add method to get active sessions
  getActiveSessions: async () => {
    try {
      const csrfToken = tokenService.getCsrfToken() || 
                        localStorage.getItem('csrf_token') || '';
      
      const response = await apiInstance.get('/api/auth/session/active', {
        withCredentials: true,
        headers: {
          'X-CSRF-Token': csrfToken,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Get active sessions error:', error);
      throw error;
    }
  },
  
  // Update the sessionSync method to properly handle cross-tab synchronization
  sessionSync: async (data: {
    tabId: string;
    lastActivity: number;
    sessionId: string | null;
    screenSize?: { width: number; height: number };
  }) => {
    try {
      // Get CSRF token from cookie directly
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1] || '';
      
      console.log('Using CSRF token:', csrfToken);
      
      const response = await apiInstance.post('/api/auth/session/sync', data, {
        withCredentials: true,
        headers: {
          'X-CSRF-Token': csrfToken,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      // Update session data in storage
      if (response.data?.sessionId && response.data?.expiresAt) {
        const sessionData = {
          id: response.data.sessionId,
          expiresAt: new Date(response.data.expiresAt).getTime(),
          warningAt: response.data.warningAt ? new Date(response.data.warningAt).getTime() : null
        };
        
        // Store updated session data
        localStorage.setItem(API_CONFIG.AUTH.SESSION.STORAGE_KEY, JSON.stringify(sessionData));
        
        // Broadcast session update to other tabs if BroadcastChannel is available
        if (window.BroadcastChannel) {
          const authChannel = new BroadcastChannel('auth_channel');
          authChannel.postMessage({
            type: 'SESSION_UPDATED',
            payload: sessionData
          });
        }
      }
      
      return response.data;
    } catch (error) {
      console.error('Session sync error:', error);
      throw error;
    }
  },
  
  // Add method to acknowledge session warnings
  acknowledgeWarning: async (warningType: 'IDLE' | 'ABSOLUTE' | 'SECURITY') => {
    try {
      const csrfToken = tokenService.getCsrfToken() || 
                        localStorage.getItem('csrf_token') || '';
      
      const response = await apiInstance.post('/api/auth/session/acknowledge-warning', 
        { warningType },
        {
          withCredentials: true,
          headers: {
            'X-CSRF-Token': csrfToken,
            'X-Requested-With': 'XMLHttpRequest'
          }
        }
      );
      
      // Update session data if response contains updated expiration
      if (response.data?.success && response.data?.session?.expiresAt) {
        const currentSessionData = JSON.parse(
          localStorage.getItem(API_CONFIG.AUTH.SESSION.STORAGE_KEY) || '{}'
        );
        
        const updatedSessionData = {
          ...currentSessionData,
          expiresAt: new Date(response.data.session.expiresAt).getTime()
        };
        
        localStorage.setItem(API_CONFIG.AUTH.SESSION.STORAGE_KEY, JSON.stringify(updatedSessionData));
        
        // Broadcast to other tabs
        if (window.BroadcastChannel) {
          const authChannel = new BroadcastChannel('auth_channel');
          authChannel.postMessage({
            type: 'SESSION_UPDATED',
            payload: updatedSessionData
          });
        }
      }
      
      return response.data;
    } catch (error) {
      console.error('Acknowledge warning error:', error);
      throw error;
    }
  }
};
