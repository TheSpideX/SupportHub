import axios, { AxiosResponse } from 'axios';
import { API_CONFIG } from '@/config/api';
import { SecurityContext, SessionData } from '../types/auth.types';
import { apiClient } from '@/api/apiClient';

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
  validateSession: async () => {
    try {
      const response = await apiClient.get('/api/auth/validate-session', {
        withCredentials: true
      });
      
      return response.data;
    } catch (error) {
      console.error('Session validation API error:', error);
      
      // Format error response
      if (error.response && error.response.data) {
        throw error.response.data;
      }
      
      throw error;
    }
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
    return apiInstance.post('/auth/session/sync', {
      // Only send sessionId if it's a valid MongoDB ObjectId
      sessionId: sessionData.metadata?.sessionId && 
                 sessionData.metadata.sessionId.match(/^[0-9a-fA-F]{24}$/) ? 
                 sessionData.metadata.sessionId : null,
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
        console.error('Error getting device fingerprint:', error);
        fingerprint = 'fingerprint-error';
      }
      
      // Add device info to credentials
      const requestData = {
        ...credentials,
        deviceInfo: {
          fingerprint,
          userAgent: navigator.userAgent,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };
      
      // Make login request
      const response = await apiClient.post('/api/auth/login', requestData, {
        withCredentials: true
      });
      
      // Return response data
      return response.data;
    } catch (error) {
      console.error('Login API error:', error);
      
      // Format error response
      if (error.response && error.response.data) {
        // Make sure we're not throwing a success message as an error
        if (error.response.data.status === 'success') {
          return error.response.data;
        }
        throw error.response.data;
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
