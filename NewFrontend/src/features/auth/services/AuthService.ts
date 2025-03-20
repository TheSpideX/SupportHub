/**
 * AuthService
 * 
 * Core authentication logic including:
 * - Login/logout functionality
 * - User registration
 * - Password reset flow
 * - Session validation
 * - Optimistic authentication state updates
 */

import { logger } from '@/utils/logger';
import { TokenService } from './TokenService';
import { SessionService } from './SessionService';
import { SecurityService } from './SecurityService';
import { AUTH_CONSTANTS } from '../constants/auth.constants';
import { 
  createAuthError,
  extractUserData,
  isAuthStateValid
} from '../utils/auth.utils';
import { 
  AuthState,
  UserData,
  LoginCredentials,
  RegistrationData,
  PasswordResetData,
  AuthError,
  AUTH_ERROR_CODES,
  UserRole,
  User
} from '../types/auth.types';
import { apiClient } from '@/api/apiClient';
import { authApi } from '../api/auth-api';
import { debounce } from 'lodash';
import { setAuthState } from '../store/authSlice';

export interface AuthServiceConfig {
  apiBaseUrl: string;
  loginEndpoint: string;
  logoutEndpoint: string;
  registerEndpoint: string;
  passwordResetEndpoint: string;
  passwordResetConfirmEndpoint: string;
  userEndpoint: string;
  enableOptimisticUpdates: boolean;
  enableOfflineSupport: boolean;
}

const defaultConfig: AuthServiceConfig = {
  apiBaseUrl: '/api',
  loginEndpoint: '/auth/login',
  logoutEndpoint: '/auth/logout',
  registerEndpoint: '/auth/register',
  passwordResetEndpoint: '/auth/password-reset',
  passwordResetConfirmEndpoint: '/auth/password-reset-confirm',
  userEndpoint: '/auth/status',
  enableOptimisticUpdates: true,
  enableOfflineSupport: true
};

export class AuthService {
  private config: AuthServiceConfig;
  private tokenService: TokenService;
  private sessionService: SessionService;
  private securityService: SecurityService;
  private authState: AuthState;
  private stateChangeListeners: Array<(state: AuthState) => void> = [];
  private broadcastChannel: BroadcastChannel | null = null;
  // Add authApi as a class property
  private authApi: any; // Use proper type if available
  // Existing properties
  private initialized = false;
  private userFetchInProgress = false;
  private lastFetchTimestamp = 0;
  private fetchCooldown = 2000; // 2 seconds cooldown between fetches
  private debouncedFetchUser = debounce(async () => {
    if (this.userFetchInProgress) return;
    
    try {
      this.userFetchInProgress = true;
      logger.debug('Fetching user data (debounced)');
      
      // Use apiClient directly instead of authApi
      const response = await apiClient.get(
        `${this.config.apiBaseUrl}${this.config.userEndpoint}`
      );
      
      if (response.data.success) {
        this.updateAuthState({
          user: response.data.data,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
      }
    } catch (error) {
      logger.error('Failed to fetch user data', { error });
    } finally {
      this.userFetchInProgress = false;
    }
  }, 300);

  constructor(
    config: Partial<AuthServiceConfig> = {},
    tokenService: TokenService,
    sessionService: SessionService,
    securityService: SecurityService,
    private store?: any // Redux store
  ) {
    this.config = { ...defaultConfig, ...config };
    // Update default config to use correct endpoints
    this.config.userEndpoint = AUTH_CONSTANTS.ENDPOINTS.USER_INFO;
    
    this.tokenService = tokenService;
    this.sessionService = sessionService;
    this.securityService = securityService;
    
    // If store is not provided, try to get it from the global context
    if (!this.store) {
      try {
        // Import the store dynamically to avoid circular dependencies
        import('@/store').then(module => {
          this.store = module.store; // Use store instead of default
        }).catch(err => {
          logger.error('Failed to import store:', err);
        });
      } catch (error) {
        logger.error('Error initializing store in AuthService:', error);
      }
    }
    
    // Initialize authApi
    this.authApi = authApi;
    
    // Initialize auth state
    this.authState = {
      isAuthenticated: false,
      isLoading: true,
      isInitialized: false,
      user: null,
      error: null,
      sessionExpiry: undefined,
      twoFactorRequired: false,
      emailVerificationRequired: false,
      lastVerified: null  // Add the missing property
    };
    
    // Initialize cross-tab communication
    if (typeof BroadcastChannel !== 'undefined') {
      this.initCrossTabCommunication();
    }
    
    // Initialize auth state based on existing tokens
    this.initializeAuthState();
    
    logger.info('AuthService initialized');
  }

  /**
   * Initialize cross-tab communication
   */
  public initCrossTabCommunication(): void {
    // Prevent multiple initializations
    if (this.initialized) {
      logger.debug('Cross-tab communication already initialized for AuthService');
      return;
    }
    
    try {
      this.broadcastChannel = new BroadcastChannel('auth_channel');
      
      this.broadcastChannel.addEventListener('message', (event) => {
        const { type, payload } = event.data;
        
        switch (type) {
          case 'AUTH_STATE_CHANGE':
            // Update local auth state from another tab
            this.updateAuthState(payload.state, false);
            break;
            
          case 'LOGOUT':
            // Another tab logged out, update local state
            this.handleLogoutSync();
            break;
        }
      });
      
      this.initialized = true;
      logger.debug('Cross-tab communication initialized for AuthService');
    } catch (error) {
      logger.error('Failed to initialize cross-tab communication:', error);
    }
  }

  /**
   * Initialize auth state
   * Public method to initialize the authentication state
   */
  public initializeAuthState(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        // Check if we have tokens or HTTP-only cookies
        const hasTokens = this.tokenService.hasTokens();
        
        // Always validate session with backend when using HTTP-only cookies
        this.validateSession()
          .then(isValid => {
            if (isValid) {
              // Session is valid, keep user authenticated
              resolve();
            } else {
              // Handle invalid session
              this.tokenService.clearTokens();
              this.updateAuthState({
                isAuthenticated: false,
                isLoading: false,
                isInitialized: true,
                user: null,
                error: null
              });
              resolve();
            }
          })
          .catch(error => {
            // Handle invalid tokens
            logger.warn('Failed to initialize auth state', error);
            this.tokenService.clearTokens();
            this.updateAuthState({
              isAuthenticated: false,
              isLoading: false,
              isInitialized: true,
              user: null,
              error: null
            });
            resolve();
          });
      } catch (error) {
        // Error handling remains the same
        logger.error('Error initializing auth state', error);
        this.updateAuthState({
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true,
          user: null,
          error: error
        });
        reject(error);
      }
    });
  }

  /**
   * Process storage events for cross-tab communication
   */
  public processStorageEvent(event: StorageEvent): void {
    if (!event.key || !event.key.startsWith('auth_')) {
      return;
    }
    
    logger.debug('Processing storage event', { key: event.key });
    
    // Fix: Use the correct constant reference
    if (event.key === 'auth_tokens') {
      if (!event.newValue) {
        // Another tab logged out
        this.handleLogoutSync();
      } else if (event.newValue !== event.oldValue) {
        // Tokens updated in another tab
        this.tokenService.syncTokensFromStorage();
        this.refreshAuthState();
      }
    } else if (event.key === 'auth_security_context') {
      // Security context updated in another tab
      this.securityService.syncSecurityContextFromStorage();
    }
  }

  /**
   * Update auth state and notify listeners
   */
  private updateAuthState(newState: Partial<AuthState>, broadcast: boolean = true): void {
    this.authState = { ...this.authState, ...newState };
    
    // Notify all listeners
    this.stateChangeListeners.forEach(listener => {
      listener(this.authState);
    });
    
    // Broadcast to other tabs if needed
    if (broadcast && this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'AUTH_STATE_CHANGE',
        payload: {
          state: this.authState
        }
      });
    }
    
    logger.debug('Auth state updated', { isAuthenticated: this.authState.isAuthenticated });
  }

  /**
   * Subscribe to auth state changes
   */
  public subscribe(listener: (state: AuthState) => void): () => void {
    this.stateChangeListeners.push(listener);
    
    // Immediately notify with current state
    listener(this.authState);
    
    // Return unsubscribe function
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter(l => l !== listener);
    };
  }

  /**
   * Get current authentication state
   */
  public getAuthState(): AuthState {
    // Return a copy of the current auth state
    return { ...this.authState };
  }

  /**
   * Login with email and password
   */
  public async login(credentials: LoginCredentials, deviceInfo?: any): Promise<boolean> {
    try {
      // Set loading state
      this.updateAuthState({
        isLoading: true,
        error: null
      });
      
      // Call login API
      const response = await this.authApi.login(credentials, deviceInfo);
      
      // Check if login was successful
      if (response && response.success) {
        // Initialize token service after successful authentication
        TokenService.getInstance().initializeAfterAuthentication();
        
        // Update auth state with user data
        this.updateAuthState({
          isAuthenticated: true,
          user: response.data.user,
          isLoading: false,
          error: null
        });
        
        // Store session metadata for frontend tracking
        if (response.data.session) {
          // Store session metadata in a secure way
          this.storeSessionMetadata(response.data.session);
          
          // Start session tracking with the session ID from the response
          this.sessionService.startSessionTracking();
          logger.info('Session tracking started for session ID:', response.data.session.id);
        } else {
          logger.warn('No session ID in login response, session tracking not started');
        }
        
        logger.info('Login successful');
        return true;
      } else {
        // Handle unsuccessful login
        const errorMessage = response?.message || 'Invalid email or password';
        const error = createAuthError(
          AUTH_ERROR_CODES.INVALID_CREDENTIALS,
          errorMessage
        );
        
        this.updateAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error
        });
        
        throw error;
      }
    } catch (error) {
      // Log and handle login error
      logger.error('Login failed', { error });
      
      // Create and throw auth error
      const authError = createAuthError(
        AUTH_ERROR_CODES.LOGIN_FAILED,
        error instanceof Error ? error.message : 'Login failed'
      );
      
      this.updateAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: authError
      });
      
      throw authError;
    }
  }

  /**
   * Store session metadata for frontend tracking
   */
  private storeSessionMetadata(sessionData: any): void {
    try {
      // Store only non-sensitive session metadata
      const sessionMetadata = {
        id: sessionData.id,
        expiresAt: sessionData.expiresAt,
        lastActivity: sessionData.lastActivity || new Date().toISOString()
      };
      
      // Use sessionStorage for session data
      sessionStorage.setItem('session_metadata', JSON.stringify(sessionMetadata));
      logger.debug('Session metadata stored');
    } catch (error) {
      logger.error('Failed to store session metadata', { error });
    }
  }

  /**
   * Calculate default session expiry based on remember me setting
   */
  private calculateDefaultExpiry(rememberMe: boolean = false): number {
    const now = Date.now();
    // Return timestamp instead of Date object
    return rememberMe 
      ? now + (7 * 24 * 60 * 60 * 1000) // 7 days
      : now + (30 * 60 * 1000); // 30 minutes
  }

  /**
   * Logout user
   */
  public async logout(options: { everywhere?: boolean } = {}): Promise<boolean> {
    try {
      // Set loading state
      this.updateAuthState({
        ...this.authState,
        isLoading: true
      });
      
      // Make logout request if authenticated
      if (this.authState.isAuthenticated) {
        try {
          await apiClient.post(
            `${this.config.apiBaseUrl}${this.config.logoutEndpoint}`,
            { everywhere: options.everywhere }
          );
        } catch (error) {
          // Continue with local logout even if server request fails
          logger.warn('Server logout failed, continuing with local logout:', error);
        }
      }
      
      // Clear tokens
      this.tokenService.clearTokens();
      
      // Stop session tracking
      this.sessionService.stopSessionTracking();
      
      // Update auth state
      this.updateAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null
      });
      
      // Broadcast logout to other tabs
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'LOGOUT'
        });
      }
      
      // Trigger logout event
      this.dispatchEvent(AUTH_CONSTANTS.EVENTS.LOGOUT, {});
      
      return true;
    } catch (error) {
      logger.error('Logout failed:', error);
      
      // Update auth state
      this.updateAuthState({
        ...this.authState,
        isLoading: false,
        error: createAuthError('LOGOUT_FAILED', 'Logout failed')
      });
      
      return false;
    }
  }

  /**
   * Handle logout sync from other tabs
   */
  private handleLogoutSync(): void {
    // Clear tokens - use public method instead of private one
    this.tokenService.clearTokens();
    
    // Stop session tracking
    this.sessionService.stopSessionTracking();
    
    // Update auth state without broadcasting
    this.updateAuthState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      error: null
    }, false);
  }

  /**
   * Register new user
   */
  public async register(data: RegistrationData): Promise<boolean> {
    try {
      // Security check before registration
      if (this.securityService.isRateLimited('register')) {
        throw createAuthError('RATE_LIMITED', 'Too many registration attempts. Please try again later.');
      }
      
      // Set loading state
      this.updateAuthState({
        ...this.authState,
        isLoading: true,
        error: null
      });
      
      // Make registration request
      const response = await apiClient.post(
        `${this.config.apiBaseUrl}${this.config.registerEndpoint}`,
        data
      );
      
      // Process successful registration
      if (response.status === 201) {
        // If auto-login after registration
        if (response.data.autoLogin) {
          // Extract user data from response
          const userData = extractUserData(response.data);
          
          // Update auth state
          this.updateAuthState({
            isAuthenticated: true,
            isLoading: false,
            user: userData,
            error: null
          });
          
          // Start session tracking
          this.sessionService.startSessionTracking();
        } else {
          // Just update loading state
          this.updateAuthState({
            isLoading: false
          });
        }
        
        return true;
      } else {
        throw new Error('Registration failed with status: ' + response.status);
      }
    } catch (error) {
      logger.error('Registration failed:', error);
      
      // Format error
      const authError = error.response?.data?.error 
        ? createAuthError(error.response.data.error.code, error.response.data.error.message)
        : createAuthError('REGISTRATION_FAILED', 'Registration failed. Please try again.');
      
      // Update auth state
      this.updateAuthState({
        isLoading: false,
        error: authError
      });
      
      // Track failed attempt
      this.securityService.trackFailedAttempt('register', data.email);
      
      return false;
    }
  }

  /**
   * Request password reset
   */
  public async requestPasswordReset(email: string): Promise<boolean> {
    try {
      // Security check
      if (this.securityService.isRateLimited('passwordReset')) {
        throw createAuthError('RATE_LIMITED', 'Too many password reset attempts. Please try again later.');
      }
      
      // Set loading state
      this.updateAuthState({
        ...this.authState,
        isLoading: true,
        error: null
      });
      
      // Make password reset request
      const response = await apiClient.post(
        `${this.config.apiBaseUrl}${this.config.passwordResetEndpoint}`,
        { email }
      );
      
      // Update loading state
      this.updateAuthState({
        isLoading: false
      });
      
      return true;
    } catch (error) {
      logger.error('Password reset request failed:', error);
      
      // Format error
      const authError = createAuthError('PASSWORD_RESET_FAILED', 'Password reset request failed. Please try again.');
      
      // Update auth state
      this.updateAuthState({
        isLoading: false,
        error: authError
      });
      
      // Track failed attempt
      this.securityService.trackFailedAttempt('passwordReset', email);
      
      return false;
    }
  }

  /**
   * Confirm password reset
   */
  public async confirmPasswordReset(data: PasswordResetData): Promise<boolean> {
    try {
      // Set loading state
      this.updateAuthState({
        ...this.authState,
        isLoading: true,
        error: null
      });
      
      // Make password reset confirmation request
      const response = await apiClient.post(
        `${this.config.apiBaseUrl}${this.config.passwordResetConfirmEndpoint}`,
        data
      );
      
      // Update loading state
      this.updateAuthState({
        isLoading: false
      });
      
      return true;
    } catch (error) {
      logger.error('Password reset confirmation failed:', error);
      
      // Format error
      const authError = error.response?.data?.error 
        ? createAuthError(error.response.data.error.code, error.response.data.error.message)
        : createAuthError('PASSWORD_RESET_FAILED', 'Password reset failed. Please try again.');
      
      // Update auth state
      this.updateAuthState({
        isLoading: false,
        error: authError
      });
      
      return false;
    }
  }

  /**
   * Fetch current user data
   */
  public async fetchUserData(): Promise<UserData | null> {
    const now = Date.now();
    
    // If a fetch is already in progress or we fetched recently, return current user data
    if (this.userFetchInProgress || (now - this.lastFetchTimestamp < this.fetchCooldown)) {
      return this.authState.user; // Return the current user from authState instead of calling getUser()
    }
    
    try {
      this.userFetchInProgress = true;
      logger.debug('Fetching user data');
      
      // Use apiClient directly instead of authApi
      const response = await apiClient.get(this.config.userEndpoint);
      
      this.lastFetchTimestamp = Date.now();
      
      if (response.data.success) {
        const userData = response.data.data;
        this.updateAuthState({
          user: userData,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
        return userData;
      }
      return null;
    } catch (error) {
      logger.error('Failed to fetch user data', { error });
      return null;
    } finally {
      this.userFetchInProgress = false;
    }
  }

  /**
   * Alias for fetchUserData for consistency
   */
  public async fetchUser(): Promise<UserData | null> {
    return this.fetchUserData();
  }

  /**
   * Refresh user data
   * @returns User data object or null if not authenticated
   */
  public async refreshUserData(): Promise<UserData | null> {
    try {
      // Set loading state
      this.updateAuthState({
        ...this.authState,
        isLoading: true
      });
      
      const userData = await this.fetchUserData();
      
      if (userData) {
        // Update auth state
        this.updateAuthState({
          isLoading: false,
          user: userData
        });
        
        // Trigger user updated event
        this.dispatchEvent(AUTH_CONSTANTS.EVENTS.USER_UPDATED, { user: userData });
        
        return userData; // Return the user data object, not a boolean
      } else {
        throw new Error('Failed to fetch user data');
      }
    } catch (error) {
      logger.error('User data refresh failed:', error);
      
      // Update auth state
      this.updateAuthState({
        isLoading: false,
        error: createAuthError('USER_DATA_REFRESH_FAILED', 'Failed to refresh user data')
      });
      
      return null; // Return null instead of false
    }
  }

  /**
   * Check if user has specific permission
   */
  public hasPermission(permission: string): boolean {
    if (!this.authState.isAuthenticated || !this.authState.user) {
      return false;
    }
    
    return this.authState.user.permissions.includes(permission);
  }

  /**
   * Check if user has specific role
   */
  public hasRole(role: string): boolean {
    if (!this.authState.isAuthenticated || !this.authState.user) {
      return false;
    }
    
    return this.authState.user.role === role;
  }

  /**
   * Dispatch auth event
   */
  private dispatchEvent(eventName: string, data: any): void {
    // Create and dispatch custom event
    const event = new CustomEvent(eventName, {
      detail: data,
      bubbles: true,
      cancelable: true
    });
    
    document.dispatchEvent(event);
    
    logger.debug(`Auth event dispatched: ${eventName}`, data);
  }

  /**
   * Handle session expiration
   */
  public handleSessionExpiration(): void {
    // Clear tokens
    this.tokenService.clearTokens();
    
    // Update auth state
    this.updateAuthState({
      isAuthenticated: false,
      user: null,
      error: createAuthError('SESSION_EXPIRED', 'Your session has expired. Please log in again.')
    });
    
    // Trigger session expired event
    this.dispatchEvent(AUTH_CONSTANTS.EVENTS.SESSION_EXPIRED, {});
  }

  /**
   * Handle security violation
   */
  public handleSecurityViolation(violationType: string, details?: any): void {
    logger.warn(`Security violation detected: ${violationType}`, details);
    
    // Clear tokens
    this.tokenService.clearTokens();
    
    // Update auth state
    this.updateAuthState({
      isAuthenticated: false,
      user: null,
      error: createAuthError('SECURITY_VIOLATION', 'A security violation was detected. Please log in again.')
    });
    
    // Redirect to login page
    window.location.href = '/login';
    
    // Trigger security violation event
    this.dispatchEvent(AUTH_CONSTANTS.EVENTS.SECURITY_VIOLATION, { type: violationType, details });
  }

  /**
   * Reset password with provided data
   */
  public async resetPassword(data: PasswordResetData): Promise<boolean> {
    try {
      // Security check before password reset
      if (this.securityService.isRateLimited('password-reset')) {
        throw createAuthError('RATE_LIMITED', 'Too many password reset attempts. Please try again later.');
      }
      
      // Set loading state
      this.updateAuthState({
        ...this.authState,
        isLoading: true,
        error: null
      });
      
      // Call the password reset API endpoint
      const response = await apiClient.post(
        `${this.config.apiBaseUrl}${this.config.passwordResetEndpoint}`, 
        data
      );
      
      if (response.status === 200) {
        return true;
      } else {
        throw createAuthError('PASSWORD_RESET_FAILED', 'Password reset failed. Please try again.');
      }
    } catch (error: any) {
      // Handle error
      this.updateAuthState({
        ...this.authState,
        error: {
          code: error.code || AUTH_ERROR_CODES.PASSWORD_RESET_FAILED,
          message: error.message || 'Password reset failed. Please try again.'
        }
      });
      throw error;
    } finally {
      // Reset loading state
      this.updateAuthState({
        ...this.authState,
        isLoading: false
      });
    }
  }

  /**
   * Refresh the authentication state
   * This method fetches the latest user data and updates the auth state
   */
  private async refreshAuthState(): Promise<void> {
    try {
      // Set loading state
      this.updateAuthState({
        isLoading: true
      });
      
      // Fetch user data
      const userData = await this.fetchUserData();
      
      if (userData) {
        // Update auth state with fresh user data
        this.updateAuthState({
          isAuthenticated: true,
          isLoading: false,
          user: userData,
          error: null,
          sessionExpiry: this.sessionService.getSessionExpiry(),
          lastVerified: Date.now()
        });
      } else {
        // Handle case where user data couldn't be fetched
        this.updateAuthState({
          isLoading: false,
          error: createAuthError(AUTH_ERROR_CODES.USER_DATA_FETCH_FAILED, 'Failed to fetch user data')
        });
      }
    } catch (error) {
      logger.error('Failed to refresh auth state:', error);
      
      // Update auth state with error
      this.updateAuthState({
        isLoading: false,
        error: createAuthError(AUTH_ERROR_CODES.AUTH_REFRESH_FAILED, 'Failed to refresh authentication state')
      });
    }
  }

  /**
   * Check authentication status with the server
   * @returns Promise<boolean> True if authenticated
   */
  public async checkAuthStatus(): Promise<boolean> {
    try {
      const response = await apiClient.get('/auth/status', {
        withCredentials: true,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      // Update local state based on server response
      if (response.data.success) {
        if (response.data.isAuthenticated && response.data.user) {
          // Update the AuthService's internal state
          this.updateAuthState({
            isAuthenticated: response.data.isAuthenticated,
            user: response.data.user,
            isLoading: false,
            isInitialized: true,
            error: null
          });
        } else {
          // Clear auth state
          this.updateAuthState({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            isInitialized: true,
            error: null
          });
        }
        
        return response.data.isAuthenticated;
      }
      
      return false;
    } catch (error) {
      logger.error('Failed to check auth status', { 
        component: 'AuthService', 
        error: error.message 
      });
      
      // On error, clear auth state
      this.updateAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        isInitialized: true,
        error: createAuthError(AUTH_ERROR_CODES.UNKNOWN, 'Failed to check authentication status')
      });
      
      return false;
    }
  }

  /**
   * Validate current session
   */
  public async validateSession(): Promise<boolean> {
    try {
      // Call validate session API using the correct endpoint
      const response = await this.authApi.validateSession();
      
      // If session is valid, update auth state
      if (response && response.success && response.data) {
        // Update auth state with user data
        this.updateAuthState({
          isAuthenticated: true,
          user: response.data.user,
          sessionExpiry: response.data.session?.expiresAt
            ? new Date(response.data.session.expiresAt).getTime()
            : Date.now() + (30 * 60 * 1000)
        });
        
        // Update Redux store
        this.updateReduxStore(response.data.user);
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error validating session', { error });
      return false;
    }
  }

  /**
   * Update Redux store with authentication data
   */
  private updateReduxStore(userData: any): void {
    try {
      if (this.store && this.store.dispatch) {
        // Calculate session expiry time
        const expiryTime = this.authState.sessionExpiry || this.calculateDefaultExpiry(false);
        
        // Dispatch action to update Redux state
        this.store.dispatch(setAuthState({
          user: userData,
          isAuthenticated: true,
          sessionExpiry: expiryTime
        }));
        
        logger.debug('Redux store updated with auth state', {
          component: 'AuthService',
          hasUser: !!userData
        });
      }
    } catch (error) {
      logger.error('Error updating Redux store:', error);
    }
  }

  // Add method to check initialization status
  public isInitialized(): boolean {
    return this.authState.isInitialized;
  }

  /**
   * Initialize auth service
   */
  public async initialize(): Promise<boolean> {
    try {
      logger.info('Initializing auth service and checking for existing session');
      
      // Check for cookies first
      const hasCookies = document.cookie.includes('access_token') || document.cookie.includes('app_session');
      logger.info(`Cookie check: ${hasCookies ? 'Found auth cookies' : 'No auth cookies found'}`);
      
      // Validate session with backend
      logger.info('Attempting to validate session with backend');
      
      // Check if we have tokens
      const hasTokens = this.tokenService.hasTokens();
      
      if (hasTokens) {
        try {
          // Validate tokens
          await this.tokenService.validateTokens();
          
          // Fetch user data
          const userData = await this.fetchUserData();
          
          if (userData) {
            logger.info('Valid session found, restoring user session', { userId: userData.id });
            
            // Update auth state with user data
            this.updateAuthState({
              isAuthenticated: true,
              user: userData,
              sessionExpiry: this.sessionService.getSessionExpiry(),
              lastVerified: Date.now()
            });
            
            // Start session monitoring
            this.sessionService.startSessionTracking();
            
            logger.info('Session restored successfully');
            return true;
          }
        } catch (error) {
          logger.warn('Session validation failed', error);
        }
      }
      
      logger.info('No valid session found, initializing as unauthenticated');
      
      // Initialize with unauthenticated state
      this.updateAuthState({
        isAuthenticated: false,
        user: null,
        sessionExpiry: null
      });
      
      return false;
    } catch (error) {
      logger.error('Auth service initialization failed:', error);
      
      // Initialize with unauthenticated state on error
      this.updateAuthState({
        isAuthenticated: false,
        user: null,
        sessionExpiry: null
      });
      
      return false;
    }
  }

  /**
   * Restore session from storage
   */
  private async restoreSession(): Promise<boolean> {
    try {
      logger.debug('Attempting to restore session from storage');
      
      // Check if we have tokens
      const hasTokens = this.tokenService.hasTokens();
      
      if (hasTokens) {
        // Validate tokens and get user data
        try {
          await this.tokenService.validateTokens();
          const userData = await this.fetchUserData();
          
          if (userData) {
            logger.info('Valid session found, restoring user session', { userId: userData.id });
            
            // Update auth state with user data
            this.updateAuthState({
              isAuthenticated: true,
              user: userData,
              sessionExpiry: this.sessionService.getSessionExpiry(),
              lastVerified: Date.now()
            });
            
            // Start session monitoring
            this.sessionService.startSessionTracking();
            
            logger.info('Session restored successfully');
            return true;
          }
        } catch (tokenError) {
          logger.warn('Token validation failed during session restore', tokenError);
          // Continue to unauthenticated state
        }
      }
      
      logger.info('No valid session found, initializing as unauthenticated');
      
      // Initialize with unauthenticated state
      this.updateAuthState({
        isAuthenticated: false,
        user: null,
        sessionExpiry: null,
        lastVerified: null
      });
      
      return false;
    } catch (error) {
      logger.error('Error restoring session', error);
      
      // Initialize with unauthenticated state on error
      this.updateAuthState({
        isAuthenticated: false,
        user: null,
        error: createAuthError(AUTH_ERROR_CODES.SESSION_INVALID, 'Failed to restore session'),
        lastVerified: null
      });
      
      return false;
    }
  }

  // Add this helper function to the AuthService class
  private mapStringToUserRole(role: string): UserRole {
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
  }
}
