import { tokenService } from "./token.service";
import { sessionService } from "./session.service";
import { securityService } from "./security.service";
import { deviceService } from "./device.service";
import { store } from "@/store";
import {
  setCredentials,
  clearCredentials,
  setAuthLoading,
  setAuthError,
  setSecurityContext,
} from "../store/authSlice";
import axios from "axios";
import { API_ROUTES } from "@/config/routes";
import { API_CONFIG, CORS_CONFIG } from "@/config/api";
import { Logger } from "@/utils/logger";
import {
  User,
  LoginCredentials,
  RegisterData,
  PasswordResetData,
  TwoFactorAuthData,
  SecurityContext,
  LoginResponse
} from "../types/auth.types";
import authPersistenceService from "./auth-persistence.service";
import { AuthError, createAuthError } from "../errors/auth-error";
import { offlineAuthService } from "./offline-auth.service";
import * as authApi from '../api/auth-api';

const COMPONENT = 'AuthService';
const logger = new Logger(COMPONENT);

// Create axios instance for auth service
const axiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  ...CORS_CONFIG
});

/**
 * Login user with email and password
 */
async function loginRequest(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await axiosInstance.post(API_ROUTES.AUTH.LOGIN, credentials);
  return response.data;
}

// Add CSRF token handling
let csrfToken: string | null = null;

async function ensureCsrfToken(forceRefresh = false): Promise<string> {
  if (!csrfToken || forceRefresh) {
    const response = await axiosInstance.get(API_ROUTES.AUTH.CSRF_TOKEN);
    csrfToken = response.data.token;
  }
  return csrfToken;
}

function getCsrfToken(): string | null {
  return csrfToken;
}

class AuthService {
  private static instance: AuthService;
  private logger: Logger;
  private loginAttempts: Map<string, { count: number; lastAttempt: Date }>;
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    this.logger = new Logger("AuthService");
    this.loginAttempts = new Map();
    this.setupEventListeners();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private setupEventListeners(): void {
    // Listen for storage events to sync auth state across tabs
    window.addEventListener("storage", (event) => {
      if (event.key === "auth_logout" && event.newValue === "true") {
        this.handleCrossTabLogout();
      }
    });

    // Set up network status monitoring
    window.addEventListener("online", () =>
      this.handleNetworkStatusChange(true)
    );
    window.addEventListener("offline", () =>
      this.handleNetworkStatusChange(false)
    );
  }

  private async handleCrossTabLogout(): Promise<void> {
    // Clear local state without making API call (already done in other tab)
    store.dispatch(clearCredentials());
    await tokenService.clearTokens();
    await sessionService.endSession("CROSS_TAB_LOGOUT");
    await securityService.clearSecurityContext();
  }

  private async syncSessionState(): Promise<void> {
    try {
      const isValid = await this.validateSession();
      if (!isValid) {
        await this.logout(true);
      }
    } catch (error) {
      this.logger.warn("Failed to sync session state", { error });
    }
  }

  /**
   * Login user with email and password
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      // Get device info for security context
      const deviceInfo = await deviceService.getDeviceInfo();
      
      // Add device info to login request
      const loginData = {
        ...credentials,
        deviceInfo
      };
      
      // Make the login request directly using axios
      const response = await axiosInstance.post(API_ROUTES.AUTH.LOGIN, loginData);
      
      if (!response.data || !response.data.success) {
        const message = response.data?.message || 'Login failed';
        throw createAuthError('AUTH_LOGIN_FAILED', message);
      }
      
      // Store token expiry times
      if (response.data.tokens) {
        await tokenService.storeTokenExpiry(response.data.tokens);
      }
      
      // Store user data in Redux
      store.dispatch(
        setCredentials({
          user: response.data.user,
          isAuthenticated: true,
          isOfflineMode: !navigator.onLine,
        })
      );
      
      // Store auth state for persistence - using the correct method name
      await authPersistenceService.persistAuthState({
        user: response.data.user,
        securityContext: response.data.securityContext
      }, {
        rememberMe: credentials.rememberMe || false
      });
      
      return {
        success: true,
        user: response.data.user
      };
    } catch (error) {
      this.logger.error('Login failed', { 
        error: error.response?.data?.message || error.message || 'Unknown error',
        status: error.response?.status || 'No status',
        code: error.response?.data?.code || error.code || 'No code'
      });
      
      throw error;
    }
  }

  private isRateLimited(email: string): boolean {
    const attempts = this.loginAttempts.get(email);
    if (!attempts) return false;

    const now = new Date();
    const timeSinceLastAttempt = now.getTime() - attempts.lastAttempt.getTime();

    if (
      attempts.count >= this.MAX_LOGIN_ATTEMPTS &&
      timeSinceLastAttempt < this.LOCKOUT_DURATION
    ) {
      return true;
    }

    // Reset if lockout period has passed
    if (timeSinceLastAttempt >= this.LOCKOUT_DURATION) {
      this.resetLoginAttempts(email);
    }

    return false;
  }

  private handleLoginError(email: string, error: any): void {
    // Track failed login attempts for rate limiting
    const attempts = this.loginAttempts.get(email) || {
      count: 0,
      lastAttempt: new Date(),
    };
    attempts.count += 1;
    attempts.lastAttempt = new Date();
    this.loginAttempts.set(email, attempts);

    // Set appropriate error message
    const errorMessage = this.getErrorMessage(error);
    store.dispatch(setAuthError(errorMessage));
  }

  private getErrorMessage(error: any): string {
    const errorCode = error.response?.data?.code || "";

    switch (errorCode) {
      case "INVALID_CREDENTIALS":
        return "Invalid email or password";
      case "ACCOUNT_LOCKED":
        return "Your account has been temporarily locked due to too many failed attempts";
      case "DEVICE_VERIFICATION_REQUIRED":
        return "Please verify this device using the link sent to your email";
      case "RATE_LIMIT_EXCEEDED":
        return "Too many login attempts. Please try again later";
      case "PASSWORD_EXPIRED":
        return "Your password has expired. Please reset it";
      default:
        return (
          error.response?.data?.message || "Login failed. Please try again"
        );
    }
  }

  private resetLoginAttempts(email: string): void {
    this.loginAttempts.delete(email);
  }

  private async handleTwoFactorRequired(data: any): Promise<never> {
    // Store temporary data for 2FA flow
    sessionStorage.setItem(
      "twoFactorAuth",
      JSON.stringify({
        userId: data.user.id,
        email: data.user.email,
        twoFactorToken: data.twoFactorToken,
        timestamp: Date.now(),
      })
    );

    throw new Error("TWO_FACTOR_REQUIRED");
  }

  async verifyTwoFactor(twoFactorData: TwoFactorAuthData): Promise<User> {
    try {
      store.dispatch(setAuthLoading(true));

      // Get stored 2FA data
      const storedData = JSON.parse(
        sessionStorage.getItem("twoFactorAuth") || "{}"
      );
      if (!storedData.userId || !storedData.twoFactorToken) {
        throw new Error("INVALID_2FA_SESSION");
      }

      // Check if 2FA session has expired (10 minutes)
      if (Date.now() - storedData.timestamp > 10 * 60 * 1000) {
        sessionStorage.removeItem("twoFactorAuth");
        throw new Error("TWO_FACTOR_EXPIRED");
      }

      const deviceInfo = await securityService.getDeviceInfo();

      // Verify 2FA code
      const response = await axiosInstance.post(API_ROUTES.AUTH.VERIFY_2FA, {
        userId: storedData.userId,
        code: twoFactorData.code,
        twoFactorToken: storedData.twoFactorToken,
        deviceInfo,
      });

      const { user, tokens, securityContext } = response.data;

      // Clear 2FA session data
      sessionStorage.removeItem("twoFactorAuth");

      // Store tokens
      await tokenService.setTokens(tokens);

      // Initialize session
      await sessionService.initializeSession(user, deviceInfo);

      // Update security context
      if (securityContext) {
        store.dispatch(setSecurityContext(securityContext));
        await securityService.updateSecurityContext(securityContext);
      }

      // Update Redux store
      store.dispatch(setCredentials({ user }));

      return user;
    } catch (error) {
      this.logger.error("2FA verification failed", { error });
      store.dispatch(
        setAuthError(
          error.response?.data?.message || "Two-factor authentication failed"
        )
      );
      throw error;
    } finally {
      store.dispatch(setAuthLoading(false));
    }
  }

  async logout(options: LogoutOptions = {}): Promise<void> {
    try {
      // Only call logout API if we have tokens
      if (await tokenService.hasTokens()) {
        try {
          await axiosInstance.post(API_ROUTES.AUTH.LOGOUT, {
            allDevices: options.allDevices || false
          });
        } catch (error) {
          this.logger.warn('Logout API call failed', { 
            error: error.message 
          });
          // Continue with local logout even if API call fails
        }
      }
      
      // Clear token data
      await tokenService.clearTokenData();
      
      // Clear auth state
      await authPersistenceService.clearAuthState();
      
      // Clear Redux state
      store.dispatch(clearCredentials());
      
      this.logger.info('User logged out successfully');
    } catch (error) {
      this.logger.error('Logout failed', { 
        error: error.message 
      });
      
      // Ensure we still clear local state even if API call fails
      await tokenService.clearTokenData();
      await authPersistenceService.clearAuthState();
      store.dispatch(clearCredentials());
      
      throw createAuthError(
        'AUTH_LOGOUT_FAILED',
        'Failed to complete logout process'
      );
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = await tokenService.getRefreshToken();
      if (!refreshToken) return false;

      const deviceInfo = await securityService.getDeviceInfo();

      const response = await axiosInstance.post(API_ROUTES.AUTH.REFRESH_TOKEN, {
        refreshToken,
        deviceInfo,
      });

      const { tokens, securityContext } = response.data;

      await tokenService.setTokens(tokens);

      // Update security context if provided
      if (securityContext) {
        store.dispatch(setSecurityContext(securityContext));
        await securityService.updateSecurityContext(securityContext);
      }

      // Update session activity
      await sessionService.updateSessionActivity();

      return true;
    } catch (error) {
      this.logger.error("Token refresh failed", { error });

      // If refresh fails due to invalid token, log out silently
      if (error.response?.status === 401) {
        await this.logout(true);
      }

      return false;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      // First check if we have valid token
      const hasValidToken = await tokenService.hasValidAccessToken();
      if (!hasValidToken) {
        return false;
      }
      
      // If we're offline, use local validation
      if (!navigator.onLine) {
        return true;
      }
      
      // If online, validate with server
      try {
        const response = await axiosInstance.post(API_ROUTES.AUTH.VALIDATE_SESSION, {
          timestamp: Date.now() // Add timestamp to prevent caching
        });
        
        return response.data.sessionValid === true;
      } catch (error) {
        this.logger.warn('Session validation failed', { 
          error: error.message 
        });
        
        // If server validation fails with 401/403, clear token data
        if (error.response?.status === 401 || error.response?.status === 403) {
          await tokenService.clearTokenData();
        }
        
        return false;
      }
    } catch (error) {
      this.logger.error('Authentication check failed', { 
        error: error.message 
      });
      return false;
    }
  }

  async validateSession(): Promise<boolean> {
    try {
      const accessTokenExpiry = await tokenService.getAccessTokenExpiry();
      if (!accessTokenExpiry || Date.now() > accessTokenExpiry) {
        this.logger.warn("No valid access token expiry found", {});
        return false;
      }

      // Validate session on server
      const response = await axiosInstance.post(
        API_ROUTES.AUTH.VALIDATE_SESSION,
        { timestamp: Date.now() } // Add timestamp to prevent caching
      );
      
      // Log the response for debugging
      this.logger.debug("Session validation response", { 
        status: response.status,
        sessionValid: response.data.sessionValid
      });
      
      return response.data.sessionValid === true;
    } catch (error) {
      this.logger.error("Session validation failed", { 
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      return false;
    }
  }

  async registerUser(data: RegisterData): Promise<User> {
    try {
      store.dispatch(setAuthLoading(true));

      // Validate password strength
      if (!securityService.isPasswordStrong(data.password)) {
        throw new Error("PASSWORD_TOO_WEAK");
      }

      const deviceInfo = await securityService.getDeviceInfo();

      const response = await axiosInstance.post(API_ROUTES.AUTH.REGISTER, {
        ...data,
        deviceInfo,
      });

      const { user, tokens, securityContext } = response.data;

      // Store tokens
      await tokenService.setTokens(tokens);

      // Initialize session
      await sessionService.initializeSession(user, deviceInfo);

      // Update security context
      if (securityContext) {
        store.dispatch(setSecurityContext(securityContext));
        await securityService.updateSecurityContext(securityContext);
      }

      // Update Redux store
      store.dispatch(setCredentials({ user }));

      return user;
    } catch (error) {
      this.logger.error("Registration failed", { error });
      store.dispatch(
        setAuthError(error.response?.data?.message || "Registration failed")
      );
      throw error;
    } finally {
      store.dispatch(setAuthLoading(false));
    }
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      store.dispatch(setAuthLoading(true));

      // Get device info for security context
      const deviceInfo = await securityService.getDeviceInfo();

      await axiosInstance.post(API_ROUTES.AUTH.FORGOT_PASSWORD, {
        email,
        deviceInfo,
      });
    } catch (error) {
      this.logger.error("Password reset request failed", { error });
      // Don't expose whether email exists or not for security
      // Just silently succeed even if email doesn't exist
    } finally {
      store.dispatch(setAuthLoading(false));
    }
  }

  async resetPassword(data: PasswordResetData): Promise<void> {
    try {
      store.dispatch(setAuthLoading(true));

      // Validate password strength
      if (!securityService.isPasswordStrong(data.password)) {
        throw new Error("PASSWORD_TOO_WEAK");
      }

      // Get device info for security context
      const deviceInfo = await securityService.getDeviceInfo();

      await axiosInstance.post(API_ROUTES.AUTH.RESET_PASSWORD, {
        ...data,
        deviceInfo,
      });
    } catch (error) {
      this.logger.error("Password reset failed", { error });
      store.dispatch(
        setAuthError(error.response?.data?.message || "Password reset failed")
      );
      throw error;
    } finally {
      store.dispatch(setAuthLoading(false));
    }
  }

  async verifyEmail(token: string): Promise<void> {
    try {
      store.dispatch(setAuthLoading(true));
      await axiosInstance.post(API_ROUTES.AUTH.VERIFY_EMAIL, { token });
    } catch (error) {
      this.logger.error("Email verification failed", { error });
      throw error;
    } finally {
      store.dispatch(setAuthLoading(false));
    }
  }

  async changePassword(
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      store.dispatch(setAuthLoading(true));

      // Validate password strength
      if (!securityService.isPasswordStrong(newPassword)) {
        throw new Error("PASSWORD_TOO_WEAK");
      }

      // Get device info for security context
      const deviceInfo = await securityService.getDeviceInfo();

      await axiosInstance.post(API_ROUTES.AUTH.CHANGE_PASSWORD, {
        oldPassword,
        newPassword,
        deviceInfo,
      });

      // Force token refresh after password change
      await this.refreshToken();
    } catch (error) {
      this.logger.error("Password change failed", { error });
      throw error;
    } finally {
      store.dispatch(setAuthLoading(false));
    }
  }

  async updateProfile(profileData: Partial<User>): Promise<User> {
    try {
      store.dispatch(setAuthLoading(true));

      const response = await axiosInstance.put(
        API_ROUTES.AUTH.UPDATE_PROFILE,
        profileData
      );
      const { user } = response.data;

      // Update Redux store
      store.dispatch(setCredentials({ user }));

      return user;
    } catch (error) {
      this.logger.error("Profile update failed", { error });
      throw error;
    } finally {
      store.dispatch(setAuthLoading(false));
    }
  }

  async setupTwoFactor(): Promise<{ secret: string; qrCode: string }> {
    try {
      store.dispatch(setAuthLoading(true));

      const response = await axiosInstance.post(API_ROUTES.AUTH.SETUP_2FA);
      return response.data;
    } catch (error) {
      this.logger.error("2FA setup failed", { error });
      throw error;
    } finally {
      store.dispatch(setAuthLoading(false));
    }
  }

  async verifyAndEnableTwoFactor(code: string): Promise<void> {
    try {
      store.dispatch(setAuthLoading(true));

      await axiosInstance.post(API_ROUTES.AUTH.VERIFY_AND_ENABLE_2FA, { code });

      // Update user profile to reflect 2FA status
      const response = await axiosInstance.get(API_ROUTES.AUTH.GET_PROFILE);
      store.dispatch(setCredentials({ user: response.data.user }));
    } catch (error) {
      this.logger.error("2FA verification failed", { error });
      throw error;
    } finally {
      store.dispatch(setAuthLoading(false));
    }
  }

  async disableTwoFactor(code: string): Promise<void> {
    try {
      store.dispatch(setAuthLoading(true));

      await axiosInstance.post(API_ROUTES.AUTH.DISABLE_2FA, { code });

      // Update user profile to reflect 2FA status
      const response = await axiosInstance.get(API_ROUTES.AUTH.GET_PROFILE);
      store.dispatch(setCredentials({ user: response.data.user }));
    } catch (error) {
      this.logger.error("2FA disable failed", { error });
      throw error;
    } finally {
      store.dispatch(setAuthLoading(false));
    }
  }

  async verifyDevice(token: string): Promise<void> {
    try {
      store.dispatch(setAuthLoading(true));

      const deviceInfo = await securityService.getDeviceInfo();

      await axiosInstance.post(API_ROUTES.AUTH.VERIFY_DEVICE, {
        token,
        deviceInfo,
      });
    } catch (error) {
      this.logger.error("Device verification failed", { error });
      throw error;
    } finally {
      store.dispatch(setAuthLoading(false));
    }
  }

  async getSessions(): Promise<any[]> {
    try {
      const response = await axiosInstance.get(API_ROUTES.AUTH.GET_SESSIONS);
      return response.data.sessions;
    } catch (error) {
      this.logger.error("Failed to get sessions", { error });
      throw error;
    }
  }

  async terminateSession(sessionId: string): Promise<void> {
    try {
      await axiosInstance.post(API_ROUTES.AUTH.TERMINATE_SESSION, {
        sessionId,
      });
    } catch (error) {
      this.logger.error("Failed to terminate session", { error });
      throw error;
    }
  }

  async terminateAllOtherSessions(): Promise<void> {
    try {
      await axiosInstance.post(API_ROUTES.AUTH.TERMINATE_ALL_OTHER_SESSIONS);
    } catch (error) {
      this.logger.error("Failed to terminate other sessions", { error });
      throw error;
    }
  }

  /**
   * Attempts to authenticate user in offline mode
   */
  private async tryOfflineAuthentication(
    credentials: LoginCredentials
  ): Promise<User | null> {
    // Check if offline auth is available
    if (!(await offlineAuthService.isOfflineAuthAvailable())) {
      return null;
    }

    // Try offline authentication
    const offlineUser = await offlineAuthService.authenticateOffline(
      credentials
    );
    if (!offlineUser) {
      return null;
    }

    // Set up offline session
    const offlineSession = await sessionService.createOfflineSession(
      offlineUser
    );

    // Update Redux store with offline user
    store.dispatch(
      setCredentials({
        user: offlineUser,
        isAuthenticated: true,
        isOfflineMode: true,
      })
    );

    return offlineUser;
  }

  /**
   * Handles network status changes
   */
  private async handleNetworkStatusChange(isOnline: boolean): Promise<void> {
    // Don't start/stop server status monitoring here
    // Just use the existing service
    
    if (isOnline) {
      // If we're coming back online and were in offline mode, sync data
      const state = store.getState();
      if (state.auth.isAuthenticated && state.auth.isOfflineMode) {
        await offlineAuthService.syncOfflineActions();

        // Try to refresh token to get back to online mode
        const success = await this.refreshToken();
        if (success) {
          // Update Redux store to indicate we're back online
          store.dispatch(
            setCredentials({
              ...state.auth,
              isOfflineMode: false,
            })
          );
        }
      }
    } else {
      // Going offline - prepare for offline use
      const state = store.getState();
      if (state.auth.isAuthenticated) {
        await offlineAuthService.prepareForOfflineUse();
      }
    }
  }

  // Add this helper method for getting device info
  private async getDeviceInfo(): Promise<DeviceInfo> {
    try {
      // Try to get device info from security service if available
      if (this.securityService && typeof this.securityService.getDeviceInfo === 'function') {
        return await this.securityService.getDeviceInfo();
      }
      
      // Fallback to basic device info
      return {
        userAgent: navigator.userAgent,
        fingerprint: Math.random().toString(36).substring(2),
        timestamp: new Date().toISOString(),
        ip: '0.0.0.0' // Will be replaced by server
      };
    } catch (error) {
      this.logger.warn('Failed to get device info', { error });
      
      // Return minimal device info
      return {
        userAgent: navigator.userAgent,
        fingerprint: Math.random().toString(36).substring(2),
        timestamp: new Date().toISOString(),
        ip: '0.0.0.0'
      };
    }
  }

  // Add this helper method for incrementing login attempts
  private incrementLoginAttempts(email: string): void {
    const attempts = this.loginAttempts.get(email) || 0;
    this.loginAttempts.set(email, attempts + 1);
  }

  /**
   * Store token expiration time
   */
  storeTokenExpiration(expiresIn: number, rememberMe: boolean): void {
    const expiresAt = Date.now() + expiresIn * 1000;
    localStorage.setItem('token_expires_at', expiresAt.toString());
    localStorage.setItem('remember_me', rememberMe ? 'true' : 'false');
  }

  /**
   * Restore user session from cookies or local storage
   */
  async restoreSession(): Promise<boolean> {
    try {
      const COMPONENT = 'AuthService';
      
      this.logger.info('Attempting to restore session', { component: COMPONENT });
      
      // Check if we have valid access token
      const hasValidToken = await tokenService.hasValidAccessToken();
      if (!hasValidToken) {
        this.logger.info('No valid token found or token expired', { component: COMPONENT });
        return false;
      }
      
      try {
        // Validate session with server
        const response = await axiosInstance.post(API_ROUTES.AUTH.VALIDATE_SESSION, {
          timestamp: Date.now() // Add timestamp to prevent caching
        });
        
        if (response.data.sessionValid && response.data.user) {
          this.logger.info('Session validated successfully', {
            userId: response.data.user.id,
            component: COMPONENT
          });
          
          // Store user data in Redux
          store.dispatch(
            setCredentials({
              user: response.data.user,
              isAuthenticated: true,
              isOfflineMode: !navigator.onLine,
            })
          );
          
          // Update stored auth state
          await authPersistenceService.saveAuthState({
            user: response.data.user,
            isAuthenticated: true
          });
          
          return true;
        }
      } catch (error) {
        this.logger.warn('Session validation failed', { 
          error: error.message,
          component: COMPONENT
        });
      }
      
      // If server validation fails, clear token data
      await tokenService.clearTokenData();
      return false;
    } catch (error) {
      this.logger.error('Session restoration failed', { 
        error: error.message,
        component: 'AuthService'
      });
      
      // Clear token data on error
      await tokenService.clearTokenData();
      return false;
    }
  }

  async checkServerConfiguration(): Promise<{
    corsConfigured: boolean;
    cookiesConfigured: boolean;
    csrfConfigured: boolean;
  }> {
    try {
      this.logger.info('Checking server configuration');
      
      // Test CORS with a simple OPTIONS request
      const corsCheck = await fetch(`${API_CONFIG.BASE_URL}/api/health`, {
        method: 'OPTIONS',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Origin': window.location.origin
        }
      });
      
      const corsConfigured = corsCheck.ok;
      
      // Test cookie setting
      const cookiesBefore = document.cookie;
      const cookieCheck = await fetch(`${API_CONFIG.BASE_URL}/api/auth/test-cookie`, {
        method: 'GET',
        credentials: 'include'
      });
      
      // Wait a moment for cookies to be set
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if cookie was set
      const cookiesAfter = document.cookie;
      const cookiesConfigured = cookieCheck.ok && 
                               (cookiesAfter.includes('test-cookie') || 
                                cookiesAfter !== cookiesBefore);
      
      // Test CSRF token
      const csrfCheck = await fetch(`${API_CONFIG.BASE_URL}${API_ROUTES.AUTH.CSRF_TOKEN}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      let csrfConfigured = false;
      if (csrfCheck.ok) {
        const csrfData = await csrfCheck.json();
        csrfConfigured = !!csrfData.csrfToken;
      }
      
      const results = {
        corsConfigured,
        cookiesConfigured,
        csrfConfigured
      };
      
      this.logger.info('Server configuration check results', results);
      
      return results;
    } catch (error) {
      this.logger.error('Server configuration check failed', { error: error.message });
      return {
        corsConfigured: false,
        cookiesConfigured: false,
        csrfConfigured: false
      };
    }
  }
}

export const authService = AuthService.getInstance();

// Add or update AuthResponse interface
export interface AuthResponse {
  success: boolean;
  user?: User;
  requiresTwoFactor: boolean;
  message?: string;
}
