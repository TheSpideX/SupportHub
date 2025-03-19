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
      // Check if cookies exist
      const cookies = document.cookie;
      console.log('🔍 [DEBUG] Cookies present:', cookies ? 'Yes' : 'No', 
        cookies ? `(length: ${cookies.length})` : '');
      
      // Use apiInstance instead of api
      const response = await apiInstance.get<SessionValidationResponse>('/api/auth/validate-session', {
        withCredentials: true, // Important for cookies
      });
      
      console.log('🔍 [DEBUG] validate-session API response:', response.status, response.data);
      
      // Check response headers for Set-Cookie
      const setCookieHeader = response.headers['set-cookie'];
      console.log('🔍 [DEBUG] Set-Cookie header present:', setCookieHeader ? 'Yes' : 'No');
      
      // Ensure session data is properly structured
      const responseData: SessionValidationResponse = response.data;
      
      // Add default values for required fields if they're missing
      if (responseData.user) {
        responseData.user.name = responseData.user.name || responseData.user.email?.split('@')[0] || '';
        responseData.user.twoFactorEnabled = responseData.user.twoFactorEnabled || false;
        responseData.user.emailVerified = responseData.user.emailVerified || false;
      }
      
      return {
        success: true,
        data: responseData
      };
    } catch (error) {
      console.log('🔍 [DEBUG] validate-session API error:', error);
      // Define a simple error handler if handleApiError is not defined
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Session validation failed'
      };
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
