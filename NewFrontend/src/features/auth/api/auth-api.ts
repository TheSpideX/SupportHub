import axios from "axios";
import { API_ROUTES } from "@/config/routes";
import { logger } from "@/utils/logger";
import { AuthError, createAuthError } from "../errors/auth-error";
import { API_CONFIG, CORS_CONFIG } from "@/config/api";

// Create a dedicated instance for auth requests
const axiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true, // Add this to ensure cookies are sent
  ...CORS_CONFIG
});

// Ensure axiosInstance is configured to send credentials with every request
axiosInstance.defaults.withCredentials = true;

// Types
import type { 
  LoginCredentials, 
  RegisterData, 
  ResetPasswordData,
  ChangePasswordData,
  TwoFactorVerificationData,
  DeviceInfo,
  AuthResponse,
  TokenResponse,
  ProfileResponse,
  SessionResponse
} from '../types/auth-types';

// Constants
const COMPONENT = "auth-api";
const getSecurityService = () => {
  // Import dynamically to avoid circular dependency
  return require('../services/security.service').securityService;
};

// Add auth token interceptor
axiosInstance.interceptors.request.use(async (config) => {
  // Add auth token if exists
  const tokens = JSON.parse(
    localStorage.getItem('auth_tokens') || 
    sessionStorage.getItem('auth_tokens') || 
    '{}'
  );

  if (tokens.accessToken) {
    config.headers['Authorization'] = `Bearer ${tokens.accessToken}`;
  }
  
  return config;
});

// Add a request interceptor to ensure CSRF token is included in all requests
axiosInstance.interceptors.request.use(async (config) => {
  // Try to get CSRF token
  try {
    const token = await AuthApi.ensureCsrfToken();
    if (token) {
      config.headers['X-CSRF-Token'] = token;
      // Add alternative header names
      config.headers['CSRF-Token'] = token;
      config.headers['X-XSRF-TOKEN'] = token;
    }
  } catch (error) {
    console.error('Failed to set CSRF token in request', error);
  }
  return config;
});

// Debug interceptors
if (process.env.NODE_ENV === 'development') {
  axiosInstance.interceptors.request.use(
    (config) => {
      logger.debug('API Request:', {
        method: config.method,
        url: config.url,
        data: config.data,
        headers: config.headers
      });
      return config;
    },
    (error) => {
      logger.error('Request Error:', error);
      return Promise.reject(error);
    }
  );

  axiosInstance.interceptors.response.use(
    (response) => {
      logger.debug('API Response:', {
        status: response.status,
        data: response.data,
        url: response.config.url
      });
      return response;
    },
    (error) => {
      logger.error('Response Error:', {
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      });
      return Promise.reject(error);
    }
  );
}

/**
 * Authentication API service
 * Handles all authentication-related API calls
 */
export class AuthApi {
  // Store CSRF token
  private static csrfToken: string | null = null;
  private static csrfTokenPromise: Promise<string | null> | null = null;
  private static csrfTokenLastFetch: number = 0;
  private static csrfTokenTTL: number = 60 * 60 * 1000; // 1 hour in milliseconds
  private static _csrfRequestInProgress = false;
  private static _pendingRequests: Array<{
    resolve: (value: string | null) => void;
    reject: (reason: any) => void;
  }> = [];

  /**
   * Send login request to the API
   */
  static async loginRequest(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      logger.debug('Making login request', { 
        component: COMPONENT,
        hasEmail: !!credentials.email,
        hasPassword: !!credentials.password,
        hasDeviceInfo: !!credentials.deviceInfo
      });
      
      // Validate credentials before making request
      if (!credentials.email || !credentials.password) {
        throw new Error('Email and password are required');
      }
      
      // Ensure deviceInfo is present
      if (!credentials.deviceInfo) {
        logger.warn('Missing deviceInfo in login credentials, creating fallback', {
          component: COMPONENT
        });
        
        // Create minimal device info to continue
        credentials.deviceInfo = {
          fingerprint: 'fallback-fingerprint',
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        };
      }
      
      // Try to get CSRF token, but continue even if it fails
      try {
        await this.ensureCsrfToken(true);
      } catch (csrfError) {
        logger.warn('Failed to get CSRF token before login, continuing anyway', {
          component: COMPONENT,
          error: csrfError
        });
        // Continue with login attempt even if CSRF token fetch fails
      }
      
      // Get CSRF token if available
      const csrfToken = this.getCsrfToken();
      if (csrfToken) {
        axiosInstance.defaults.headers.common['X-CSRF-Token'] = csrfToken;
      }
      
      // Log right before the actual API call
      logger.debug('Sending login API request', {
        component: COMPONENT,
        url: API_ROUTES.AUTH.LOGIN,
        hasToken: !!csrfToken
      });
      
      // Make the API call
      const response = await axiosInstance.post(API_ROUTES.AUTH.LOGIN, credentials);
      
      logger.debug('Login successful', { component: COMPONENT });
      return response.data;
    } catch (error) {
      logger.error('Login failed', { 
        component: COMPONENT, 
        error: error.message || 'Unknown error',
        errorType: error?.constructor?.name || typeof error,
        isAxiosError: axios.isAxiosError(error),
        hasResponse: !!error?.response,
        email: credentials.email // Don't log password
      });
      
      throw this.handleApiError(error, 'LOGIN_FAILED');
    }
  }

  /**
   * Send logout request to the API
   */
  static async logoutRequest(refreshToken?: string): Promise<void> {
    try {
      const deviceInfo = await getSecurityService().getDeviceInfo();
      
      await axiosInstance.post(API_ROUTES.AUTH.LOGOUT, {
        refreshToken,
        deviceInfo
      });
      
      logger.debug('Logout request successful', { component: COMPONENT });
    } catch (error) {
      logger.error('Logout request failed', { component: COMPONENT, error });
      // Don't throw on logout errors, just log them
    }
  }

  /**
   * Send refresh token request to the API
   */
  static async refreshTokenRequest(refreshToken: string): Promise<TokenResponse> {
    try {
      const deviceInfo = await getSecurityService().getDeviceInfo();
      
      const response = await axiosInstance.post(API_ROUTES.AUTH.REFRESH_TOKEN, { 
        refreshToken,
        deviceInfo
      });
      
      logger.debug('Token refresh successful', { component: COMPONENT });
      return response.data;
    } catch (error) {
      logger.error('Token refresh failed', { component: COMPONENT, error });
      throw this.handleApiError(error, 'REFRESH_FAILED');
    }
  }

  /**
   * Send registration request to the API
   */
  static async registerRequest(data: RegisterData): Promise<AuthResponse> {
    try {
      // Get device info for security context
      const deviceInfo = await getSecurityService().getDeviceInfo();
      
      // Get CSRF token if needed
      await this.ensureCsrfToken();
      
      // Make registration request
      const response = await axiosInstance.post(API_ROUTES.AUTH.REGISTER, {
        ...data,
        deviceInfo
      });
      
      logger.debug('Registration successful', { component: COMPONENT });
      return response.data;
    } catch (error) {
      logger.error('Registration failed', { 
        component: COMPONENT, 
        error,
        email: data.email // Don't log password
      });
      
      throw this.handleApiError(error, 'REGISTRATION_FAILED');
    }
  }

  /**
   * Send forgot password request to the API
   */
  static async forgotPasswordRequest(email: string): Promise<void> {
    try {
      // Get CSRF token if needed
      await this.ensureCsrfToken();
      
      await axiosInstance.post(API_ROUTES.AUTH.FORGOT_PASSWORD, { email });
      
      logger.debug('Forgot password request successful', { component: COMPONENT });
    } catch (error) {
      logger.error('Forgot password request failed', { component: COMPONENT, error });
      throw this.handleApiError(error, 'FORGOT_PASSWORD_FAILED');
    }
  }

  /**
   * Send reset password request to the API
   */
  static async resetPasswordRequest(data: ResetPasswordData): Promise<void> {
    try {
      // Get CSRF token if needed
      await this.ensureCsrfToken();
      
      await axiosInstance.post(API_ROUTES.AUTH.RESET_PASSWORD, data);
      
      logger.debug('Reset password successful', { component: COMPONENT });
    } catch (error) {
      logger.error('Reset password failed', { component: COMPONENT, error });
      throw this.handleApiError(error, 'RESET_PASSWORD_FAILED');
    }
  }

  /**
   * Send change password request to the API
   */
  static async changePasswordRequest(data: ChangePasswordData): Promise<void> {
    try {
      await axiosInstance.post(API_ROUTES.USER.CHANGE_PASSWORD, data);
      
      logger.debug('Change password successful', { component: COMPONENT });
    } catch (error) {
      logger.error('Change password failed', { component: COMPONENT, error });
      throw this.handleApiError(error, 'CHANGE_PASSWORD_FAILED');
    }
  }

  /**
   * Send verify email request to the API
   */
  static async verifyEmailRequest(token: string): Promise<void> {
    try {
      await axiosInstance.post(API_ROUTES.AUTH.VERIFY_EMAIL, { token });
      
      logger.debug('Email verification successful', { component: COMPONENT });
    } catch (error) {
      logger.error('Email verification failed', { component: COMPONENT, error });
      throw this.handleApiError(error, 'EMAIL_VERIFICATION_FAILED');
    }
  }

  /**
   * Send verify two-factor authentication request to the API
   */
  static async verifyTwoFactorRequest(data: TwoFactorVerificationData): Promise<AuthResponse> {
    try {
      const deviceInfo = await getSecurityService().getDeviceInfo();
      
      const response = await axiosInstance.post(API_ROUTES.SECURITY.VERIFY_2FA, {
        ...data,
        deviceInfo
      });
      
      logger.debug('2FA verification successful', { component: COMPONENT });
      return response.data;
    } catch (error) {
      logger.error('2FA verification failed', { component: COMPONENT, error });
      throw this.handleApiError(error, 'TWO_FACTOR_VERIFICATION_FAILED');
    }
  }

  /**
   * Send setup two-factor authentication request to the API
   */
  static async setupTwoFactorRequest(): Promise<{ secret: string; qrCode: string }> {
    try {
      const response = await axiosInstance.post(API_ROUTES.SECURITY.SETUP_2FA);
      
      logger.debug('2FA setup successful', { component: COMPONENT });
      return response.data;
    } catch (error) {
      logger.error('2FA setup failed', { component: COMPONENT, error });
      throw this.handleApiError(error, 'TWO_FACTOR_SETUP_FAILED');
    }
  }

  /**
   * Send verify and enable two-factor authentication request to the API
   */
  static async verifyAndEnableTwoFactorRequest(code: string): Promise<void> {
    try {
      await axiosInstance.post(API_ROUTES.SECURITY.VERIFY_AND_ENABLE_2FA, { code });
      
      logger.debug('2FA verification and enablement successful', { component: COMPONENT });
    } catch (error) {
      logger.error('2FA verification and enablement failed', { component: COMPONENT, error });
      throw this.handleApiError(error, 'TWO_FACTOR_ENABLE_FAILED');
    }
  }

  /**
   * Send disable two-factor authentication request to the API
   */
  static async disableTwoFactorRequest(code: string): Promise<void> {
    try {
      await axiosInstance.post(API_ROUTES.SECURITY.DISABLE_2FA, { code });
      
      logger.debug('2FA disablement successful', { component: COMPONENT });
    } catch (error) {
      logger.error('2FA disablement failed', { component: COMPONENT, error });
      throw this.handleApiError(error, 'TWO_FACTOR_DISABLE_FAILED');
    }
  }

  /**
   * Get user profile from the API
   */
  static async getProfileRequest(): Promise<ProfileResponse> {
    try {
      const response = await axiosInstance.get(API_ROUTES.USER.PROFILE);
      
      logger.debug('Get profile successful', { component: COMPONENT });
      return response.data;
    } catch (error) {
      logger.error('Get profile failed', { component: COMPONENT, error });
      throw this.handleApiError(error, 'GET_PROFILE_FAILED');
    }
  }

  /**
   * Update user profile in the API
   */
  static async updateProfileRequest(data: Partial<ProfileResponse['user']>): Promise<ProfileResponse> {
    try {
      const response = await axiosInstance.put(API_ROUTES.USER.UPDATE_PROFILE, data);
      
      logger.debug('Update profile successful', { component: COMPONENT });
      return response.data;
    } catch (error) {
      logger.error('Update profile failed', { component: COMPONENT, error });
      throw this.handleApiError(error, 'UPDATE_PROFILE_FAILED');
    }
  }

  /**
   * Validate session with the API
   */
  static async validateSessionRequest(): Promise<SessionResponse> {
    try {
      const deviceInfo = await getSecurityService().getDeviceInfo();
      
      const response = await axiosInstance.post(API_ROUTES.AUTH.VALIDATE_SESSION, { deviceInfo });
      
      logger.debug('Session validation successful', { component: COMPONENT });
      return response.data;
    } catch (error) {
      logger.error('Session validation failed', { component: COMPONENT, error });
      throw this.handleApiError(error, 'SESSION_VALIDATION_FAILED');
    }
  }

  /**
   * Report security incident to the API
   */
  static async reportSecurityIncidentRequest(
    incidentType: string, 
    details: Record<string, any>
  ): Promise<void> {
    try {
      const deviceInfo = await getSecurityService().getDeviceInfo();
      
      await axiosInstance.post(API_ROUTES.SECURITY.REPORT_INCIDENT, {
        incidentType,
        details,
        deviceInfo
      });
      
      logger.debug('Security incident report successful', { component: COMPONENT });
    } catch (error) {
      logger.error('Security incident report failed', { component: COMPONENT, error });
      // Don't throw on security report errors, just log them
    }
  }

  /**
   * Verify device with the API
   */
  static async verifyDeviceRequest(verificationCode: string): Promise<void> {
    try {
      const deviceInfo = await getSecurityService().getDeviceInfo();
      
      await axiosInstance.post(API_ROUTES.SECURITY.VALIDATE_DEVICE, {
        verificationCode,
        deviceInfo
      });
      
      logger.debug('Device verification successful', { component: COMPONENT });
    } catch (error) {
      logger.error('Device verification failed', { component: COMPONENT, error });
      throw this.handleApiError(error, 'DEVICE_VERIFICATION_FAILED');
    }
  }

  /**
   * Ensure CSRF token is available - with optimized caching
   * @param forceRefresh Force refresh the token even if one exists
   */
  static async ensureCsrfToken(forceRefresh = false): Promise<string | null> {
    try {
      // If we already have a token and it's not expired and don't need to refresh, return it
      const tokenAge = Date.now() - this.csrfTokenLastFetch;
      if (this.csrfToken && !forceRefresh && tokenAge < this.csrfTokenTTL) {
        return this.csrfToken;
      }
      
      // Check for existing token in cookies first
      const cookieToken = this.getCsrfTokenFromCookie();
      if (cookieToken && !forceRefresh) {
        this.setCsrfToken(cookieToken);
        return this.csrfToken;
      }
      
      // Fetch new token from server
      const response = await axios.get(`${API_CONFIG.BASE_URL}${API_ROUTES.AUTH.CSRF_TOKEN}`, {
        withCredentials: true
      });
      
      if (response.data && (response.data.csrfToken || response.data.token)) {
        const token = response.data.csrfToken || response.data.token;
        this.setCsrfToken(token);
        return token;
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to ensure CSRF token', { component: COMPONENT, error });
      return null;
    }
  }

  /**
   * Get CSRF token from cookie
   * @private
   */
  private static getCsrfTokenFromCookie(): string | null {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.startsWith('XSRF-TOKEN=')) {
        return cookie.substring('XSRF-TOKEN='.length, cookie.length);
      }
    }
    return null;
  }

  /**
   * Set CSRF token
   * @private
   */
  private static setCsrfToken(token: string): void {
    this.csrfToken = token;
    // Also set it in axios defaults
    axiosInstance.defaults.headers.common['X-CSRF-Token'] = token;
  }

  /**
   * Get current CSRF token
   */
  static getCsrfToken(): string | null {
    return this.csrfToken;
  }

  /**
   * Handle API errors
   */
  private static handleApiError(error: any, defaultCode: string): Error {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const errorData = error.response.data;
      return createAuthError(
        errorData.code || defaultCode,
        errorData.message || 'An error occurred during the request'
      );
    } else if (error.request) {
      // The request was made but no response was received
      return createAuthError('NETWORK_ERROR', 'No response received from server');
    } else {
      // Something happened in setting up the request that triggered an Error
      return createAuthError(defaultCode, error.message || 'An unknown error occurred');
    }
  }

  /**
   * Check if error is a network error
   */
  static isNetworkError(error: any): boolean {
    return !error.response && error.request;
  }

  /**
   * Check if error is a server error
   */
  static isServerError(error: any): boolean {
    return error.response?.status >= 500;
  }

  /**
   * Check if error is an authentication error
   */
  static isAuthError(error: any): boolean {
    return error.response?.status === 401;
  }

  /**
   * Direct CSRF token fetch for debugging
   */
  static async testCsrfEndpoint(): Promise<void> {
    try {
      // Use a static flag to prevent multiple test calls
      if (this._testingCsrf) {
        logger.debug('CSRF test already in progress, skipping', { component: COMPONENT });
        return;
      }
      
      this._testingCsrf = true;
      
      logger.debug('Testing CSRF endpoint directly', {
        component: COMPONENT,
        endpoint: `${API_CONFIG.BASE_URL}${API_ROUTES.AUTH.CSRF_TOKEN}`
      });
      
      const response = await axios.get(`${API_CONFIG.BASE_URL}${API_ROUTES.AUTH.CSRF_TOKEN}`, {
        withCredentials: true
      });
      
      logger.debug('CSRF test response', {
        component: COMPONENT,
        status: response.status,
        data: response.data
      });
      
      this._testingCsrf = false;
    } catch (error) {
      this._testingCsrf = false;
      
      logger.error('CSRF test failed', {
        component: COMPONENT,
        error: error.message,
        status: error.response?.status,
        url: `${API_CONFIG.BASE_URL}${API_ROUTES.AUTH.CSRF_TOKEN}`
      });
    }
  }

  // Add this static property to track testing state
  private static _testingCsrf = false;
}
// Add this at the end of the file to export the class as a singleton instance
export const authApi = new AuthApi();

// Export the axios instance for use in other services
export { axiosInstance };
