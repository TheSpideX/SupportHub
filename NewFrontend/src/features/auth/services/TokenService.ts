/**
 * TokenService
 * 
 * Handles all token-related operations including:
 * - Token storage in HTTP-only cookies
 * - Token validation
 * - Token expiration handling
 * - CSRF token management
 * - Background token refresh mechanism
 * - Cross-tab synchronization
 * - Offline support
 * - Advanced security measures
 */

import { logger } from '@/utils/logger';
import { jwtDecode } from 'jwt-decode';
import { 
  getCookie, 
  setCookie, 
  removeCookie,
  hasAuthTokens,
  getSessionMetadata
} from '../utils/storage.utils';
import { 
  isSessionExpired
} from '../utils/auth.utils';
import { 
  TokenData, 
  AuthError, 
  AUTH_ERROR_CODES,
  TokenRefreshQueueItem
} from '../types/auth.types';
import { apiClient } from '@/api/apiClient';

// Constants
const ACCESS_TOKEN_COOKIE = 'auth_access_token';
const REFRESH_TOKEN_COOKIE = 'auth_refresh_token';
const TOKEN_EXISTS_FLAG = 'auth_token_exists';
const CSRF_TOKEN_COOKIE = 'csrf_token';
const TOKEN_VERSION_KEY = 'token_version';
const FINGERPRINT_KEY = 'device_fingerprint';

export interface TokenServiceConfig {
  apiBaseUrl: string;
  tokenEndpoint: string;
  refreshEndpoint: string;
  cookieSecure: boolean;
  cookieDomain?: string;
  cookiePath: string;
  accessTokenMaxAge: number; // in seconds
  refreshTokenMaxAge: number; // in seconds
  csrfHeaderName: string;
  refreshThreshold: number; // seconds before expiry to refresh
  refreshRetryDelay: number; // ms between retries
  maxRefreshRetries: number;
  enableCrossTabs: boolean;
  enableOfflineSupport: boolean;
  enableFingerprinting: boolean;
  accessTokenName: string;
  refreshTokenName: string;
  csrfTokenName: string;
  tokenExpiryThreshold: number;
  logoutOnRefreshFailure: boolean;
}

const defaultConfig: TokenServiceConfig = {
  apiBaseUrl: '/api',
  tokenEndpoint: '/auth/token',
  refreshEndpoint: '/auth/refresh-token', // Ensure this matches backend
  cookieSecure: true,
  cookiePath: '/',
  accessTokenMaxAge: 15 * 60, // 15 minutes
  refreshTokenMaxAge: 7 * 24 * 60 * 60, // 7 days
  csrfHeaderName: 'X-CSRF-Token',
  refreshThreshold: 60, // Refresh 1 minute before expiry
  refreshRetryDelay: 5000, // 5 seconds
  maxRefreshRetries: 3,
  enableCrossTabs: true,
  enableOfflineSupport: true,
  enableFingerprinting: true,
  accessTokenName: ACCESS_TOKEN_COOKIE,
  refreshTokenName: REFRESH_TOKEN_COOKIE,
  csrfTokenName: CSRF_TOKEN_COOKIE,
  tokenExpiryThreshold: 60, // seconds
  logoutOnRefreshFailure: true,
};

export class TokenService {
  private config: TokenServiceConfig;
  private refreshPromise: Promise<boolean> | null = null;
  private refreshTimeoutId: number | null = null;
  private refreshRetryCount: number = 0;
  private operationQueue: TokenRefreshQueueItem[] = [];
  private broadcastChannel: BroadcastChannel | null = null;
  private tokenVersion: number = 0;
  private deviceFingerprint: string | null = null;
  private offlineTokenCache: Map<string, string> = new Map();
  private isRefreshing: boolean = false;

  // Add a static instance tracker
  private static instance: TokenService | null = null;

  constructor(config: Partial<TokenServiceConfig> = {}) {
    // Return existing instance if already created
    if (TokenService.instance) {
      logger.debug('TokenService already initialized, returning existing instance');
      return TokenService.instance;
    }
    
    this.config = { ...defaultConfig, ...config };
    logger.info('TokenService initialized');
    
    // Initialize cross-tab communication if enabled
    if (this.config.enableCrossTabs && typeof BroadcastChannel !== 'undefined') {
      this.initCrossTabCommunication();
    }
    
    // Generate device fingerprint if enabled
    if (this.config.enableFingerprinting) {
      this.generateDeviceFingerprint();
    }
    
    // Initialize token version
    this.initTokenVersion();
    
    // Schedule token refresh if tokens exist
    if (this.hasTokens()) {
      this.scheduleTokenRefresh();
    }
    
    // Listen for online/offline events
    if (this.config.enableOfflineSupport) {
      this.setupOfflineSupport();
    }

    // Store instance
    TokenService.instance = this;
  }

  /**
   * Initialize cross-tab communication
   */
  private initCrossTabCommunication(): void {
    try {
      this.broadcastChannel = new BroadcastChannel('auth_channel');
      
      this.broadcastChannel.addEventListener('message', (event) => {
        const { type, payload } = event.data;
        
        switch (type) {
          case 'TOKEN_REFRESH':
            // Another tab refreshed the token, update our state
            if (payload.success) {
              // Clear any scheduled refresh in this tab
              if (this.refreshTimeoutId) {
                clearTimeout(this.refreshTimeoutId);
                this.refreshTimeoutId = null;
              }
              
              // Schedule next refresh
              this.scheduleTokenRefresh();
            }
            break;
            
          case 'TOKEN_CLEARED':
            // Another tab cleared tokens, do the same here
            this.clearTokensLocally();
            break;
            
          case 'CSRF_UPDATED':
            // Another tab updated the CSRF token
            if (payload.token) {
              this.setCsrfToken(payload.token);
            }
            break;
        }
      });
      
      logger.info('Cross-tab communication initialized');
    } catch (error) {
      logger.error('Failed to initialize cross-tab communication:', error);
    }
  }

  /**
   * Generate a device fingerprint for token binding
   */
  private async generateDeviceFingerprint(): Promise<void> {
    try {
      // Simple fingerprinting based on available browser data
      // In production, you might want to use a more sophisticated approach
      const fingerprint = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        colorDepth: window.screen.colorDepth,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timestamp: Date.now()
      };
      
      // Create a hash of the fingerprint
      const fingerprintString = JSON.stringify(fingerprint);
      const encoder = new TextEncoder();
      const data = encoder.encode(fingerprintString);
      
      // Use SubtleCrypto if available, otherwise use a simple hash
      if (window.crypto && window.crypto.subtle) {
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        this.deviceFingerprint = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } else {
        // Simple hash function as fallback
        let hash = 0;
        for (let i = 0; i < fingerprintString.length; i++) {
          hash = ((hash << 5) - hash) + fingerprintString.charCodeAt(i);
          hash |= 0; // Convert to 32bit integer
        }
        this.deviceFingerprint = hash.toString(16);
      }
      
      // Store fingerprint in localStorage for persistence
      localStorage.setItem(FINGERPRINT_KEY, this.deviceFingerprint);
      
      logger.info('Device fingerprint generated');
    } catch (error) {
      logger.error('Failed to generate device fingerprint:', error);
      // Fallback to a simple random ID
      this.deviceFingerprint = Math.random().toString(36).substring(2, 15);
      localStorage.setItem(FINGERPRINT_KEY, this.deviceFingerprint);
    }
  }

  /**
   * Initialize token version for revocation support
   */
  private initTokenVersion(): void {
    try {
      const storedVersion = localStorage.getItem(TOKEN_VERSION_KEY);
      this.tokenVersion = storedVersion ? parseInt(storedVersion, 10) : 0;
    } catch (error) {
      logger.error('Failed to initialize token version:', error);
      this.tokenVersion = 0;
    }
  }

  /**
   * Increment token version (used for revocation)
   */
  public incrementTokenVersion(): void {
    this.tokenVersion += 1;
    try {
      localStorage.setItem(TOKEN_VERSION_KEY, this.tokenVersion.toString());
    } catch (error) {
      logger.error('Failed to store token version:', error);
    }
  }

  /**
   * Setup offline support
   */
  private setupOfflineSupport(): void {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Initialize offline cache if we're already offline
    if (!navigator.onLine && this.hasTokens()) {
      this.cacheTokensForOffline();
    }
  }

  /**
   * Handle coming back online
   */
  private async handleOnline(): Promise<void> {
    logger.info('Network connection restored');
    
    // If we have queued operations, process them
    if (this.operationQueue.length > 0) {
      await this.processOperationQueue();
    }
    
    // Refresh token if we have one
    if (this.hasTokens()) {
      await this.refreshToken();
    }
  }

  /**
   * Handle going offline
   */
  private handleOffline(): void {
    logger.info('Network connection lost');
    
    // Cache tokens for offline use
    if (this.hasTokens()) {
      this.cacheTokensForOffline();
    }
  }

  /**
   * Cache tokens for offline use
   */
  private cacheTokensForOffline(): void {
    // In a real implementation, you would securely cache token data
    // This is a simplified version
    try {
      // We don't store the actual tokens, just metadata
      const accessToken = getCookie(ACCESS_TOKEN_COOKIE);
      if (accessToken) {
        const decoded = this.decodeToken(accessToken);
        if (decoded) {
          this.offlineTokenCache.set('exp', decoded.exp.toString());
          this.offlineTokenCache.set('userId', decoded.userId);
          this.offlineTokenCache.set('role', decoded.role);
        }
      }
      logger.info('Tokens cached for offline use');
    } catch (error) {
      logger.error('Failed to cache tokens for offline use:', error);
    }
  }

  /**
   * Schedule token refresh based on expiration time
   */
  public scheduleTokenRefresh(): void {
    // Clear any existing timeout
    if (this.refreshTimeoutId) {
      clearTimeout(this.refreshTimeoutId);
      this.refreshTimeoutId = null;
    }
    
    try {
      // Get access token and decode it
      const accessToken = getCookie(ACCESS_TOKEN_COOKIE);
      if (!accessToken) return;
      
      const decoded = this.decodeToken(accessToken);
      if (!decoded || !decoded.exp) return;
      
      // Calculate time until refresh (expiry - threshold)
      const expiresAt = decoded.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilRefresh = expiresAt - now - (this.config.refreshThreshold * 1000);
      
      // Schedule refresh
      if (timeUntilRefresh > 0) {
        this.refreshTimeoutId = window.setTimeout(() => {
          this.refreshToken();
        }, timeUntilRefresh);
        
        logger.info(`Token refresh scheduled in ${Math.round(timeUntilRefresh / 1000)} seconds`);
      } else {
        // Token is already expired or close to expiry, refresh immediately
        this.refreshToken();
      }
    } catch (error) {
      logger.error('Failed to schedule token refresh:', error);
    }
  }

  /**
   * Add an operation to the queue (for use during token refresh)
   */
  public enqueueOperation(operation: TokenRefreshQueueItem): Promise<any> {
    return new Promise((resolve, reject) => {
      this.operationQueue.push({
        ...operation,
        resolve,
        reject
      });
      
      // If we're not currently refreshing, process the queue
      if (!this.isRefreshing) {
        this.processOperationQueue();
      }
    });
  }

  /**
   * Process the operation queue
   */
  private async processOperationQueue(): Promise<void> {
    // If queue is empty, do nothing
    if (this.operationQueue.length === 0) return;
    
    // If we need to refresh the token first, do that
    if (this.isTokenExpired() && navigator.onLine) {
      await this.refreshToken();
    }
    
    // Process each operation in the queue
    const operations = [...this.operationQueue];
    this.operationQueue = [];
    
    for (const operation of operations) {
      try {
        const result = await operation.operation();
        operation.resolve?.(result);
      } catch (error) {
        operation.reject?.(error);
      }
    }
  }

  /**
   * Stores authentication tokens in HTTP-only cookies with sliding expiration
   */
  public storeTokens(accessToken: string, refreshToken: string): boolean {
    try {
      // Store the actual tokens in HTTP-only cookies
      setCookie(ACCESS_TOKEN_COOKIE, accessToken, {
        httpOnly: true,
        secure: this.config.cookieSecure,
        sameSite: 'strict',
        path: this.config.cookiePath,
        domain: this.config.cookieDomain,
        maxAge: this.config.accessTokenMaxAge
      });

      setCookie(REFRESH_TOKEN_COOKIE, refreshToken, {
        httpOnly: true,
        secure: this.config.cookieSecure,
        sameSite: 'strict',
        path: this.config.cookiePath,
        domain: this.config.cookieDomain,
        maxAge: this.config.refreshTokenMaxAge
      });

      // Set a non-HTTP-only flag cookie to indicate token presence
      // This allows the client to know if tokens exist without accessing them
      setCookie(TOKEN_EXISTS_FLAG, 'true', {
        httpOnly: false,
        secure: this.config.cookieSecure,
        sameSite: 'strict',
        path: this.config.cookiePath,
        domain: this.config.cookieDomain,
        maxAge: this.config.accessTokenMaxAge
      });
      
      // Cache tokens for offline use if enabled
      if (this.config.enableOfflineSupport && !navigator.onLine) {
        this.cacheTokensForOffline();
      }
      
      // Schedule token refresh
      this.scheduleTokenRefresh();
      
      // Notify other tabs if cross-tab is enabled
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'TOKEN_REFRESH',
          payload: { success: true }
        });
      }

      return true;
    } catch (error) {
      logger.error('Failed to store tokens:', error);
      return false;
    }
  }

  /**
   * Clears all authentication tokens
   */
  public clearTokens(): boolean {
    try {
      this.clearTokensLocally();
      
      // Notify other tabs if cross-tab is enabled
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'TOKEN_CLEARED'
        });
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to clear tokens:', error);
      return false;
    }
  }
  
  /**
   * Clear tokens locally (without broadcasting)
   */
  private clearTokensLocally(): void {
    // Clear any scheduled refresh
    if (this.refreshTimeoutId) {
      clearTimeout(this.refreshTimeoutId);
      this.refreshTimeoutId = null;
    }
    
    // Clear cookies
    removeCookie(ACCESS_TOKEN_COOKIE);
    removeCookie(REFRESH_TOKEN_COOKIE);
    removeCookie(TOKEN_EXISTS_FLAG);
    removeCookie(CSRF_TOKEN_COOKIE);
    
    // Clear offline cache
    this.offlineTokenCache.clear();
  }

  // /**
  //  * Checks if authentication tokens exist
  //  */
  // public hasTokens(): boolean {
  //   return hasAuthTokens();
  // }

  /**
   * Validates the current token state
   */
  public isAuthenticated(): boolean {
    return this.hasTokens() && !this.isTokenExpired();
  }

  /**
   * Checks if the access token is expired
   * Note: Since we can't directly access HTTP-only cookies,
   * we rely on the token data stored in session metadata
   */
  public isTokenExpired(bufferSeconds: number = 60): boolean {
    // We can't directly check the token in HTTP-only cookies
    // Instead, we'll check the expiration time stored in session metadata
    const sessionData = getSessionMetadata();
    
    // If no session data exists, consider the token expired
    if (!sessionData) {
      return true;
    }
    
    // Check if the session is expired with the given buffer
    return isSessionExpired(sessionData);
  }

  /**
   * Gets the CSRF token for use in requests
   */
  public getCsrfToken(): string | null {
    // Get the CSRF token from cookies
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'csrf_token') {
        return decodeURIComponent(value);
      }
    }
    return null;
  }

  /**
   * Sets the CSRF token in a cookie
   */
  public setCsrfToken(token: string): boolean {
    try {
      setCookie(this.config.csrfTokenName, token, {
        path: this.config.cookiePath,
        secure: this.config.cookieSecure,
        domain: this.config.cookieDomain,
        maxAge: this.config.accessTokenMaxAge
      });
      
      logger.info('CSRF token set');
      return true;
    } catch (error) {
      logger.error('Failed to set CSRF token:', error);
      return false;
    }
  }

  /**
   * Rotates the CSRF token
   */
  public async rotateCsrfToken(): Promise<boolean> {
    try {
      // In a real implementation, you would make an API call to get a new CSRF token
      // This is a simplified version that generates a random token
      const buffer = new Uint8Array(32);
      window.crypto.getRandomValues(buffer);
      const token = Array.from(buffer)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      return this.setCsrfToken(token);
    } catch (error) {
      logger.error('Failed to rotate CSRF token:', error);
      return false;
    }
  }

  /**
   * Refreshes the access token using the refresh token
   */
  public async refreshToken(): Promise<boolean> {
    // If a refresh is already in progress, return that promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    
    // If we're offline, return false
    if (!navigator.onLine) {
      logger.warn('Token refresh failed: offline');
      return false;
    }

    // Create a new refresh promise
    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const result = await this.refreshPromise;
      
      // Reset retry count on success
      if (result) {
        this.refreshRetryCount = 0;
      }
      
      return result;
    } catch (error) {
      logger.error('Token refresh failed:', error);
      return false;
    } finally {
      // Clear the promise when done
      this.refreshPromise = null;
      this.isRefreshing = false;
      
      // Process any queued operations
      if (this.operationQueue.length > 0) {
        this.processOperationQueue();
      }
    }
  }

  /**
   * Performs the actual token refresh with retry logic
   */
  private async performTokenRefresh(): Promise<boolean> {
    try {
      // Include device fingerprint and token version in request
      const requestBody: Record<string, any> = {};
      
      if (this.deviceFingerprint) {
        requestBody.deviceFingerprint = this.deviceFingerprint;
      }
      
      if (this.tokenVersion > 0) {
        requestBody.tokenVersion = this.tokenVersion;
      }
      
      const response = await fetch(`${this.config.apiBaseUrl}${this.config.refreshEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [this.config.csrfHeaderName]: this.getCsrfToken() || ''
        },
        body: Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : undefined,
        credentials: 'include' // Important: This includes cookies in the request
      });

      if (!response.ok) {
        // If we get a 401 or 403, clear tokens and force re-login
        if (response.status === 401 || response.status === 403) {
          this.clearTokens();
          return false;
        }
        
        // For other errors, try to retry
        if (this.refreshRetryCount < this.config.maxRefreshRetries) {
          this.refreshRetryCount++;
          
          // Wait with exponential backoff
          const delay = this.config.refreshRetryDelay * Math.pow(2, this.refreshRetryCount - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Try again
          return this.performTokenRefresh();
        }
        
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Store the new tokens
      if (data.accessToken) {
        this.storeTokens(data.accessToken, data.refreshToken || '');
        
        // Update CSRF token if provided
        if (data.csrfToken) {
          this.setCsrfToken(data.csrfToken);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Token refresh failed:', error);
      
      // If we have retries left, try again
      if (this.refreshRetryCount < this.config.maxRefreshRetries) {
        this.refreshRetryCount++;
        
        // Wait with exponential backoff
        const delay = this.config.refreshRetryDelay * Math.pow(2, this.refreshRetryCount - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Try again
        return this.performTokenRefresh();
      }
      
      // If refresh fails and we're out of retries, clear tokens to force re-login
      this.clearTokens();
      return false;
    }
  }

  /**
   * Prepares headers for authenticated requests with CSRF protection
   */
  public getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // Add CSRF token if available
    const csrfToken = this.getCsrfToken();
    if (csrfToken) {
      headers[this.config.csrfHeaderName] = csrfToken;
    }
    
    // Add device fingerprint if available
    if (this.deviceFingerprint) {
      headers['X-Device-Fingerprint'] = this.deviceFingerprint;
    }
    
    // Add token version if available
    if (this.tokenVersion > 0) {
      headers['X-Token-Version'] = this.tokenVersion.toString();
    }
    
    return headers;
  }

  /**
   * Advanced security and token management features
   */

  /**
   * Validates token integrity and security context
   */
  public validateTokenSecurity(): boolean {
    try {
      const accessToken = getCookie(ACCESS_TOKEN_COOKIE);
      if (!accessToken) return false;
      
      const decoded = this.decodeToken(accessToken);
      if (!decoded) return false;
      
      // Validate device fingerprint if enabled
      if (this.config.enableFingerprinting && this.deviceFingerprint) {
        if (decoded.deviceFingerprint && decoded.deviceFingerprint !== this.deviceFingerprint) {
          logger.warn('Device fingerprint mismatch detected');
          return false;
        }
      }
      
      // Validate token version
      if (decoded.version && decoded.version < this.tokenVersion) {
        logger.warn('Token version is outdated');
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('Token security validation failed:', error);
      return false;
    }
  }

  /**
   * Implements token revocation by incrementing token version
   */
  public revokeAllTokens(): boolean {
    try {
      this.incrementTokenVersion();
      this.clearTokens();
      return true;
    } catch (error) {
      logger.error('Failed to revoke tokens:', error);
      return false;
    }
  }

  /**
   * Handles token security events (suspicious activity)
   */
  public handleSecurityEvent(eventType: string, data?: any): void {
    logger.warn(`Security event detected: ${eventType}`, data);
    
    switch (eventType) {
      case 'suspicious_activity':
        // Revoke tokens and force re-authentication
        this.revokeAllTokens();
        break;
      case 'location_change':
        // Require additional verification
        this.rotateCsrfToken();
        break;
      case 'multiple_failures':
        // Implement temporary lockout
        this.clearTokens();
        break;
      default:
        logger.info(`Unhandled security event: ${eventType}`);
    }
  }

  /**
   * Exports token metadata for analytics (no sensitive data)
   */
  public getTokenMetadata(): Record<string, any> {
    try {
      const accessToken = getCookie(ACCESS_TOKEN_COOKIE);
      if (!accessToken) return {};
      
      const decoded = this.decodeToken(accessToken);
      if (!decoded) return {};
      
      return {
        issuedAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : null,
        expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null,
        tokenVersion: this.tokenVersion,
        hasFingerprint: !!this.deviceFingerprint,
        crossTabEnabled: this.config.enableCrossTabs,
        offlineSupportEnabled: this.config.enableOfflineSupport
      };
    } catch (error) {
      logger.error('Failed to get token metadata:', error);
      return {};
    }
  }

  /**
   * Get access token
   * @returns {string|null} Access token or null
   */
  public getAccessToken(): string | null {
    // With HTTP-only cookies, we can't directly access the token
    // Instead, we'll check if we're authenticated by other means
    // For example, by checking if we have a CSRF token
    const csrfToken = this.getCsrfToken();
    
    // If we have a CSRF token, we're likely authenticated
    // The actual token is stored in HTTP-only cookies
    return csrfToken ? 'token-exists-in-http-only-cookie' : null;
  }

  /**
   * Decode token
   * @param {string} token - Token to decode
   * @returns {Object|null} Decoded token or null
   */
  public decodeToken(token: string | null): any {
    if (!token) {
      logger.debug('No token to decode');
      return null;
    }
    
    // If we're using HTTP-only cookies, we can't decode the token directly
    // Instead, we need to rely on the session data from the server
    if (token === 'token-exists-in-http-only-cookie') {
      // Return a placeholder object that indicates we're authenticated
      // The actual session data will be fetched from the server
      return {
        isAuthenticated: true,
        // Add other required fields with placeholder values
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        iat: Math.floor(Date.now() / 1000)
      };
    }
    
    try {
      return jwtDecode(token);
    } catch (error) {
      logger.error('Failed to decode token:', { error });
      return null;
    }
  }

  /**
   * Get the current user ID from the token
   * @returns User ID or null if not authenticated
   */
  public getUserId(): string | null {
    try {
      const accessToken = this.getAccessToken();
      if (!accessToken) {
        return null;
      }
      
      // Decode the token to get the user ID
      const tokenData = this.decodeToken(accessToken);
      return tokenData?.sub || null;
    } catch (error) {
      logger.error('Failed to get user ID from token:', error);
      return null;
    }
  }

  /**
   * Cleanup resources when service is destroyed
   */
  public destroy(): void {
    // Clear any scheduled refresh
    if (this.refreshTimeoutId) {
      clearTimeout(this.refreshTimeoutId);
      this.refreshTimeoutId = null;
    }
    
    // Close broadcast channel
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    
    // Remove event listeners
    if (this.config.enableOfflineSupport) {
      window.removeEventListener('online', this.handleOnline.bind(this));
      window.removeEventListener('offline', this.handleOffline.bind(this));
    }
  }

  /**
   * Get the current token service configuration
   * @returns The current configuration
   */
  public getConfig(): TokenServiceConfig {
    return { ...this.config };
  }

  /**
   * Set up CSRF protection
   */
  public setupCsrfProtection(): void {
    try {
      // Generate a new CSRF token
      const csrfToken = this.generateCsrfToken();
      
      // Store the token in a non-HttpOnly cookie for CSRF validation
      document.cookie = `XSRF-TOKEN=${csrfToken}; path=/; SameSite=Strict`;
      
      // Add an interceptor to add the CSRF token to all requests
      this.setupCsrfInterceptor(csrfToken);
      
      logger.info('CSRF protection initialized');
    } catch (error) {
      logger.error('Failed to set up CSRF protection:', error);
    }
  }

  /**
   * Generate a CSRF token
   */
  private generateCsrfToken(): string {
    // Generate a random string for CSRF token
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Set up CSRF interceptor for API requests
   */
  private setupCsrfInterceptor(token: string): void {
    // This would depend on your HTTP client
    // For example, with axios:
    /*
    axios.interceptors.request.use(config => {
      config.headers['X-CSRF-TOKEN'] = token;
      return config;
    });
    */
    
    // For fetch API, you might set up a wrapper function
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
      if (!init) {
        init = {};
      }
      if (!init.headers) {
        init.headers = {};
      }
      
      // Add CSRF token to headers
      init.headers['X-CSRF-TOKEN'] = token;
      
      return originalFetch(input, init);
    };
  }

  /**
   * Validate tokens and check if they're still valid
   */
  public async validateTokens(): Promise<boolean> {
    try {
      logger.debug('Validating authentication tokens');
      
      // First check if tokens exist
      if (!this.hasTokens()) {
        logger.debug('No tokens found during validation');
        return false;
      }
      
      // For HTTP-only cookies, we need to make a validation request to the server
      // since we can't directly access the token content
      const response = await apiClient.get('/api/auth/validate', {
        withCredentials: true,
        headers: {
          'X-CSRF-Token': this.getCsrfToken(),
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      const isValid = response.data?.valid === true;
      logger.debug(`Token validation result: ${isValid}`);
      
      if (isValid) {
        // Update the token existence cookie to extend its lifetime
        setCookie('auth_token_exists', 'true', {
          path: '/',
          secure: true,
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60 // 30 days
        });
      }
      
      return isValid;
    } catch (error) {
      logger.error('Token validation failed', error);
      return false;
    }
  }

  /**
   * Check if tokens exist
   * For HTTP-only cookies, we check indirectly
   */
  public hasTokens(): boolean {
    // Check for HTTP-only cookie existence indirectly
    return document.cookie.includes('access_token') || 
           localStorage.getItem('auth_initialized') === 'true';
  }

  /**
   * Sync tokens from storage
   * For HTTP-only cookies, this is handled by the browser automatically
   * but we need to update our local state
   */
  public syncTokensFromStorage(): void {
    // For HTTP-only cookies, we don't need to do anything special
    // The browser handles the cookie sync automatically
    // We just need to update our local state
    logger.debug('Tokens synced from storage (HTTP-only cookies)');
    
    // Update the session active flag
    if (localStorage.getItem('auth_session_active') === 'true') {
      // Validate the session is still active with the server
      this.validateTokens()
        .catch(error => {
          logger.warn('Failed to validate synced tokens', error);
          localStorage.removeItem('auth_session_active');
        });
    }
  }
}

// Export a singleton instance
export const tokenService = new TokenService();

// Export default for dependency injection in tests
export default TokenService;
