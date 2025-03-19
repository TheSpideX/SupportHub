import axios, { AxiosResponse } from 'axios';
import { API_CONFIG } from '@/config/api';
import { SecurityContext, SessionData } from '../types/auth.types';

// Create auth-specific API client
const apiInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  withCredentials: true, // Important for HTTP-only cookies
  headers: API_CONFIG.HEADERS
});

export const authApi = {
  // Security-related API calls
  validateSecurityContext: async (data: { 
    securityContext: SecurityContext, 
    deviceFingerprint: string | null 
  }) => {
    return apiInstance.post('/api/auth/security/validate', data);
  },
  
  // Session-related API calls
  validateSession: async (sessionId: string) => {
    return apiInstance.post('/api/auth/session/validate', { sessionId });
  },
  
  refreshSession: async (sessionId: string) => {
    return apiInstance.post('/api/auth/session/refresh', { sessionId });
  },
  
  terminateSession: async (sessionId: string) => {
    return apiInstance.post('/api/auth/session/terminate', { sessionId });
  },
  
  /**
   * Sync session with the server
   * @param sessionData Current session data
   * @returns Promise with sync response
   */
  syncSession: (sessionData: SessionData) => {
    return apiInstance.post('/api/auth/session/sync', {
      sessionId: sessionData.metadata?.sessionId || null,
      lastActivity: sessionData.lastActivity,
      metrics: sessionData.metrics || {},
      deviceInfo: sessionData.deviceInfo
    });
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
        // If any error occurs, use a fallback fingerprint
        fingerprint = `${navigator.userAgent}|${navigator.language}|${new Date().getTimezoneOffset()}|${window.screen.width}x${window.screen.height}`;
        localStorage.setItem('device_fingerprint', fingerprint);
      }
      
      // Create a new request object with only the fields expected by the backend
      const backendRequest = {
        email: credentials.email,
        password: credentials.password,
        rememberMe: credentials.rememberMe || false,
        deviceInfo: {
          fingerprint: fingerprint,
          userAgent: navigator.userAgent,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          location: {}
        }
      };
      
      const response = await apiInstance.post('/api/auth/login', backendRequest);
      
      return response.data;
    } catch (error) {
      if (error.code === 'ERR_NETWORK') {
        throw new Error('Cannot connect to server. Please check your internet connection.');
      }
      throw error;
    }
  },
  
  logout: async () => {
    return apiInstance.post('/api/auth/logout');
  },
  
  refreshToken: async (refreshToken) => {
    return apiInstance.post('/api/auth/refresh', { refreshToken });
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
  }
};
