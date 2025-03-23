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
import EventEmitter from 'eventemitter3';
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
import { AUTH_CONSTANTS } from '../constants/auth.constants';
// import { toast } from '@/components/ui/toast';
// import { navigate } from '@/utils/navigation';
import { AuthService } from '@/features/auth/services/AuthService';

// Constants
const ACCESS_TOKEN_COOKIE = 'auth_access_token';
const REFRESH_TOKEN_COOKIE = 'auth_refresh_token';
const TOKEN_EXISTS_FLAG = 'auth_token_exists';
const CSRF_TOKEN_COOKIE = 'csrf_token';
const TOKEN_VERSION_KEY = 'token_version';
const FINGERPRINT_KEY = 'device_fingerprint';
const USER_ACTIVITY_KEY = 'last_user_activity';
const INACTIVITY_THRESHOLD = 30 * 60 * 1000; // 30 minutes
const INACTIVITY_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
const TOKEN_STATUS_CHECK_INTERVAL = 60 * 1000; // Check token status every minute
const TOKEN_REFRESH_THRESHOLD = 7 * 60 * 1000; // Refresh when 7 minutes remaining
const EXTENDED_INACTIVITY_THRESHOLD = 7 * 24 * 60 * 60 * 1000; // 7 days

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
}

const defaultConfig: TokenServiceConfig = {
  apiBaseUrl: '/api',
  tokenEndpoint: '/auth/token',
  refreshEndpoint: '/auth/token/refresh', // Update this to match your backend endpoint
  cookieSecure: true,
  cookiePath: '/',
  accessTokenMaxAge: 15 * 60, // 15 minutes
  refreshTokenMaxAge: 7 * 24 * 60 * 60, // 7 days
  csrfHeaderName: 'X-CSRF-Token',
  refreshThreshold: 5 * 60, // Update to 5 minutes (300 seconds) to match API_CONFIG
  refreshRetryDelay: 5000, // 5 seconds
  maxRefreshRetries: 3,
  enableCrossTabs: true,
  enableOfflineSupport: true,
  enableFingerprinting: true,
  accessTokenName: ACCESS_TOKEN_COOKIE,
  refreshTokenName: REFRESH_TOKEN_COOKIE,
  csrfTokenName: CSRF_TOKEN_COOKIE,
  tokenExpiryThreshold: 60, // seconds
};

export class TokenService {
  private config: TokenServiceConfig;
  private eventBus: EventEmitter;
  private heartbeatIntervalId: number | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private refreshTimeoutId: number | null = null;
  private refreshRetryCount: number = 0;
  private operationQueue: TokenRefreshQueueItem[] = [];
  private broadcastChannel: BroadcastChannel | null = null;
  private tokenVersion: number = 0;
  private deviceFingerprint: string | null = null;
  private offlineTokenCache: Map<string, string> = new Map();
  private isRefreshing: boolean = false;
  private lastRefreshTime: number | null = null;
  private refreshQueue: Promise<boolean> | null = null;
  private refreshing = false;
  private authChannel: BroadcastChannel | null = null;
  private readonly heartbeatInterval = 30 * 1000; // 1 minute
  private isInitialized: boolean = false;
  private activityListeners: boolean = false;
  private inactivityCheckerId: number | null = null;
  private inactivityMonitorId: number | null = null;
  private lastInactivityCheck: number | null = null;

  // Strengthen the singleton pattern
  public static instance: TokenService | null = null;
  
  // Add a static getInstance method
  public static getInstance(config: Partial<TokenServiceConfig> = {}): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService(config);
    }
    return TokenService.instance;
  }

  constructor(config: Partial<TokenServiceConfig> = {}) {
    // If an instance already exists, return it instead of creating a new one
    if (TokenService.instance) {
      logger.debug('TokenService already initialized, returning existing instance');
      return TokenService.instance;
    }
    
    // Initialize the instance
    this.config = { ...defaultConfig, ...config };
    this.eventBus = new EventEmitter();
    
    // Set heartbeat interval
    this.heartbeatInterval = Math.min(
      30 * 1000, // 30 seconds default
      (this.config.refreshThreshold * 1000) / 3 // Or 1/3 of refresh threshold
    );
    
    logger.info(`TokenService initialized with refresh threshold: ${this.config.refreshThreshold}s, heartbeat: ${this.heartbeatInterval/1000}s`);
    
    // Store the instance
    TokenService.instance = this;
    
    // Initialize other properties and start services
    this.initializeServices();
  }
  
  // Move initialization logic to a separate method
  private initializeServices(): void {
    // Only start token heartbeat if user is authenticated
    if (this.hasTokens()) {
      this.startTokenHeartbeat();
      this.setupActivityTracking();
      
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
      this.scheduleTokenRefresh();
      
      // Listen for online/offline events
      if (this.config.enableOfflineSupport) {
        this.setupOfflineSupport();
      }
      
      this.isInitialized = true;
      logger.info('TokenService fully initialized for authenticated user');
    } else {
      logger.info('TokenService initialized in standby mode (no authenticated user)');
    }
  }

  /**
   * Initialize cross-tab communication
   */
  private initCrossTabCommunication(): void {
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
      this.authChannel = new BroadcastChannel('auth_channel');
      
      this.authChannel.addEventListener('message', (event) => {
        if (event.data && event.data.type) {
          switch (event.data.type) {
            case 'SESSION_UPDATED':
              this.handleSessionUpdate(event.data.payload);
              break;
            case 'TOKEN_REFRESHED':
              this.handleTokenRefreshed(event.data.payload);
              break;
            case 'LOGOUT':
              this.handleLogout();
              break;
          }
        }
      });
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
    try {
      // We can't access HTTP-only cookies directly
      // Instead, use session metadata which should be synchronized with the token
      const sessionData = getSessionMetadata();
      if (sessionData) {
        this.offlineTokenCache.set('exp', sessionData.expiresAt.toString());
        this.offlineTokenCache.set('userId', sessionData.userId);
        
        logger.info('Token metadata cached for offline use');
      } else {
        logger.warn('No session metadata available for offline caching');
      }
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
      // With HTTP-only cookies, we can't access the token directly
      // Use session metadata instead
      const sessionData = getSessionMetadata();
      if (!sessionData || !sessionData.expiresAt) return;
      
      // Calculate time until refresh (expiry - threshold)
      const expiresAt = new Date(sessionData.expiresAt).getTime();
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

  /**
   * Check if authentication tokens exist
   * For HTTP-only cookies, we check the existence flag
   */
  public hasTokens(): boolean {
    // Check for the existence flag
    const hasFlag = !!getCookie(TOKEN_EXISTS_FLAG);
    
    // Log the token check for debugging
    logger.debug('Token existence check', { 
      hasFlag,
      cookies: document.cookie.split(';').map(c => c.trim().split('=')[0])
    });
    
    return hasFlag;
  }

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
    const expiresAt = new Date(sessionData.expiresAt).getTime();
    const now = Date.now();
    return expiresAt <= now + (bufferSeconds * 1000);
  }

  /**
   * Gets the CSRF token for use in requests
   */
  public getCsrfToken(): string | null {
    // Get the CSRF token from cookies (this is not HTTP-only)
    return getCookie(CSRF_TOKEN_COOKIE);
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
    // Check for user inactivity before attempting refresh
    if (this.isUserInactive()) {
      logger.warn('User inactive, logging out instead of refreshing token');
      this.logoutDueToInactivity();
      return false;
    }
    
    // If already refreshing, return the existing promise
    if (this.refreshing) {
      logger.debug('Token refresh already in progress');
      return this.refreshQueue || Promise.resolve(false);
    }
    
    this.refreshing = true;
    
    // Create a new promise for this refresh operation
    this.refreshQueue = new Promise<boolean>(async (resolve) => {
      try {
        logger.debug('Refreshing tokens');
        
        // Make refresh request with CSRF token
        const response = await fetch(`${this.config.apiBaseUrl}${this.config.refreshEndpoint}`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': this.getCsrfToken() || '',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        
        // Handle response
        if (response.ok) {
          const data = await response.json();
          
          // Update CSRF token if provided
          if (data.csrfToken) {
            this.setCsrfToken(data.csrfToken);
          }
          
          // Update session data if provided
          if (data.data && data.data.session) {
            this.updateSessionData(data.data.session);
          }
          
          // Reset retry count on success
          this.refreshRetryCount = 0;
          
          // Update last refresh time
          this.lastRefreshTime = Date.now();
          
          // Schedule next refresh
          this.scheduleTokenRefresh();
          
          // Broadcast token refreshed event to other tabs
          this.broadcastTokenRefreshed();
          
          // Emit token refreshed event
          this.emitTokenRefreshedEvent();
          
          logger.debug('Tokens refreshed successfully');
          resolve(true);
        } else {
          // Handle specific error responses
          const errorData = await response.json().catch(() => ({}));
          
          if (response.status === 401) {
            const errorCode = errorData.code || 'UNKNOWN_ERROR';
            
            // Handle specific error codes
            if (['REFRESH_TOKEN_EXPIRED', 'REFRESH_TOKEN_INVALID', 'SESSION_EXPIRED'].includes(errorCode)) {
              logger.warn(`Token refresh failed: ${errorCode}`, errorData);
              
              // Clear tokens and trigger logout
              this.clearTokens();
              
              // Emit auth error event
              this.emitAuthErrorEvent({
                code: errorCode,
                message: errorData.message || 'Your session has expired. Please log in again.'
              });
              
              // Force logout
              this.forceLogout(errorCode);
              
              resolve(false);
            }
          }
          
          // For other errors, retry if possible
          logger.error('Token refresh failed:', response.status, errorData);
          
          if (this.refreshRetryCount < this.config.maxRefreshRetries) {
            this.refreshRetryCount++;
            
            // Schedule retry
            setTimeout(() => {
              this.refreshPromise = null;
              this.refreshing = false;
              this.refreshToken().then(resolve);
            }, this.config.refreshRetryDelay);
          } else {
            // Max retries reached, clear tokens and emit error
            logger.error('Max refresh retries reached, forcing logout');
            
            this.clearTokens();
            this.emitAuthErrorEvent({
              code: 'MAX_REFRESH_RETRIES',
              message: 'Failed to refresh authentication. Please log in again.'
            });
            
            this.forceLogout('MAX_REFRESH_RETRIES');
            resolve(false);
          }
        }
      } catch (error) {
        logger.error('Token refresh error:', error);
        
        // Handle network errors
        if (this.refreshRetryCount < this.config.maxRefreshRetries) {
          this.refreshRetryCount++;
          
          // Schedule retry
          setTimeout(() => {
            this.refreshPromise = null;
            this.refreshing = false;
            this.refreshToken().then(resolve);
          }, this.config.refreshRetryDelay);
        } else {
          // Max retries reached, clear tokens
          this.clearTokens();
          this.emitAuthErrorEvent({
            code: 'REFRESH_NETWORK_ERROR',
            message: 'Network error during authentication refresh. Please log in again.'
          });
          
          this.forceLogout('REFRESH_NETWORK_ERROR');
          resolve(false);
        }
      } finally {
        // Clear promise and refreshing flag
        setTimeout(() => {
          this.refreshPromise = null;
          this.refreshing = false;
        }, 100);
      }
    });
    
    return this.refreshQueue;
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
      // With HTTP-only cookies, we can't access the token directly
      // Use session metadata instead
      const sessionData = getSessionMetadata();
      if (!sessionData) return {};
      
      const metadata: Record<string, any> = {
        expiresAt: new Date(sessionData.expiresAt).toISOString(),
        tokenVersion: this.tokenVersion,
        hasFingerprint: !!this.deviceFingerprint,
        crossTabEnabled: this.config.enableCrossTabs,
        offlineSupportEnabled: this.config.enableOfflineSupport,
        userId: sessionData.userId
      };

      return metadata;
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
    // Instead, we'll check if we have a token existence flag
    const hasToken = this.hasTokens();
    
    // If we have the flag, we're likely authenticated
    // The actual token is stored in HTTP-only cookies
    return hasToken ? 'token-exists-in-http-only-cookie' : null;
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
      const sessionData = getSessionMetadata();
      if (!sessionData) return null;
      
      // Return a placeholder object with session data
      return {
        isAuthenticated: true,
        exp: new Date(sessionData.expiresAt).getTime() / 1000,
        userId: sessionData.userId,
      };
    }
    
    // For non-HTTP-only tokens (should not happen in this implementation)
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      logger.error('Failed to decode token:', error);
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
    
    // Stop token heartbeat
    this.stopTokenHeartbeat();
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
   * Validate tokens with the backend
   */
  public async validateTokens(): Promise<boolean> {
    try {
      logger.debug('Validating tokens with backend');
      
      // Use the correct endpoint from constants
      const response = await apiClient.get(
        AUTH_CONSTANTS.ENDPOINTS.VALIDATE_SESSION
      );
      
      return response.data && response.data.success;
    } catch (error) {
      logger.error('Token validation failed', { error });
      return false;
    }
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

  /**
   * Check if a token refresh is currently in progress
   */
  public getRefreshingStatus(): boolean {
    return this.isRefreshing;
  }

  /**
   * Get the last refresh time
   */
  public getLastRefreshTime(): number {
    return this.lastRefreshTime || 0;
  }

  /**
   * Trigger a token refresh event
   */
  private emitTokenRefreshedEvent(): void {
    this.lastRefreshTime = Date.now();
    
    // Dispatch event for monitoring
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('token-refreshed'));
    }
  }

  /**
   * Get access token expiry date
   * @returns Date object representing expiry time or null if not available
   */
  public getAccessTokenExpiry(): Date | null {
    try {
      // For HTTP-only cookies, we need to rely on stored metadata
      const tokenMetadata = localStorage.getItem('auth_token_metadata');
      if (tokenMetadata) {
        const metadata = JSON.parse(tokenMetadata);
        return metadata.accessTokenExpiry ? new Date(metadata.accessTokenExpiry) : null;
      }
      return null;
    } catch (error) {
      logger.error('Error getting access token expiry', error);
      return null;
    }
  }

  /**
   * Get refresh token expiry date
   * @returns Date object representing expiry time or null if not available
   */
  public getRefreshTokenExpiry(): Date | null {
    try {
      // For HTTP-only cookies, we need to rely on stored metadata
      const tokenMetadata = localStorage.getItem('auth_token_metadata');
      if (tokenMetadata) {
        const metadata = JSON.parse(tokenMetadata);
        return metadata.refreshTokenExpiry ? new Date(metadata.refreshTokenExpiry) : null;
      }
      return null;
    } catch (error) {
      logger.error('Error getting refresh token expiry', error);
      return null;
    }
  }

  /**
   * Get device fingerprint
   */
  private getDeviceFingerprint(): string | null {
    return this.deviceFingerprint;
  }

  /**
   * Perform token refresh (internal implementation)
   */
  private async performTokenRefresh(): Promise<boolean> {
    try {
      // Get CSRF token if available
      const csrfToken = this.getCsrfToken();
      
      const response = await fetch(`${this.config.apiBaseUrl}/auth/token/refresh`, {
        method: 'POST',
        credentials: 'include', // Important for cookies
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
        },
        body: JSON.stringify({
          tokenVersion: this.tokenVersion
        })
      });
      
      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Update CSRF token if provided
      if (data.data?.csrfToken) {
        this.setCsrfToken(data.data.csrfToken);
      }
      
      // Notify listeners about token refresh
      this.notifyRefreshListeners(data.data?.session || {});
      
      return true;
    } catch (error) {
      // Handle retry logic
      if (this.refreshRetryCount < this.config.maxRefreshRetries) {
        this.refreshRetryCount++;
        const delay = this.config.refreshRetryDelay * Math.pow(2, this.refreshRetryCount - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.performTokenRefresh();
      }
      
      this.refreshRetryCount = 0;
      throw error;
    }
  }

  /**
   * Handle session update from another tab
   */
  private handleSessionUpdate(payload: any): void {
    logger.debug('Received session update from another tab', payload);
    // Update local session state based on the payload
    // This might involve updating Redux store or other state management
  }

  /**
   * Handle token refreshed event from another tab
   */
  private handleTokenRefreshed(payload: any): void {
    logger.debug('Received token refreshed event from another tab', payload);
    // Update local token state
    // No need to refresh tokens again since another tab already did it
    
    // Emit local event for components that might be listening
    this.emitTokenRefreshedEvent();
  }

  /**
   * Handle logout event from another tab
   */
  private handleLogout(): void {
    logger.debug('Received logout event from another tab');
    // Clear local tokens and state
    this.clearTokens();
    
    // Redirect to login page if needed
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  /**
   * Notify refresh listeners about token refresh
   */
  private notifyRefreshListeners(sessionData: any): void {
    logger.debug('Notifying token refresh listeners', { sessionData });
    
    // Update local storage with session metadata if needed
    if (sessionData) {
      try {
        localStorage.setItem('auth_token_metadata', JSON.stringify({
          accessTokenExpiry: sessionData.expiresAt,
          refreshTokenExpiry: sessionData.refreshExpiresAt,
          lastRefresh: Date.now()
        }));
      } catch (error) {
        logger.warn('Failed to update token metadata in storage', error);
      }
    }
    
    // Emit token refreshed event
    this.emitTokenRefreshedEvent();
    
    // Notify other tabs if cross-tab communication is enabled
    if (this.authChannel) {
      this.authChannel.postMessage({
        type: 'TOKEN_REFRESHED',
        payload: { timestamp: Date.now() }
      });
    }
  }

  /**
   * Initialize token refresh mechanism for HTTP-only cookies
   * This method doesn't rely on accessing the token directly
   */
  public initializeTokenRefresh(): void {
    // For HTTP-only cookies, we can't directly access the token
    // Instead, we'll rely on the server to tell us when to refresh
    
    // Set up a heartbeat to check token status
    this.startTokenHeartbeat();
    
    // Listen for token expiration events
    this.setupTokenExpirationListener();
    
    logger.info('Token refresh mechanism initialized for HTTP-only cookies');
  }

  /**
   * Start token heartbeat to periodically check token status with backend
   */
  private startTokenHeartbeat(): void {
    // Ensure we don't start multiple heartbeats
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
    
    // Use local variable instead of modifying readonly property
    const heartbeatInterval = TOKEN_STATUS_CHECK_INTERVAL;
    
    this.heartbeatIntervalId = window.setInterval(() => {
      fetch(`${this.config.apiBaseUrl}/auth/token-status`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'X-CSRF-Token': this.getCsrfToken() || '',
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
      .then(response => {
        if (response.status === 401) {
          // Token is expired, check for activity before refreshing
          if (!this.isUserInactive()) {
            logger.debug('Token expired according to backend, refreshing due to recent activity');
            this.refreshToken();
          } else {
            logger.debug('Token expired and user inactive, logging out');
            this.logoutDueToInactivity();
          }
          return null;
        } else if (response.ok) {
          return response.json();
        }
        return null;
      })
      .then(data => {
        if (data && typeof data.expiresIn === 'number') {
          logger.debug(`Token expires in ${data.expiresIn} seconds`);
          
          // Convert to milliseconds for comparison
          const expiresInMs = data.expiresIn * 1000;
          
          if (expiresInMs < TOKEN_REFRESH_THRESHOLD) {
            // Token expiring soon, check for activity
            if (!this.isUserInactive()) {
              logger.debug(`Token expiring soon (${data.expiresIn}s), refreshing due to recent activity`);
              this.refreshToken();
            } else {
              // Start monitoring for activity more frequently as token approaches expiry
              this.startInactivityMonitoring();
              logger.debug(`Token expiring soon (${data.expiresIn}s), but user inactive. Monitoring for activity.`);
            }
          }
        }
      })
      .catch(error => {
        logger.error('Token heartbeat check failed:', error);
      });
    }, heartbeatInterval);
    
    logger.debug(`Token heartbeat started with interval of ${heartbeatInterval}ms`);
  }

  /**
   * Stop token heartbeat when service is destroyed or user logs out
   */
  public stopTokenHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
      logger.debug('Token heartbeat stopped');
    }
  }

  /**
   * Set up listener for token expiration events
   * This is used with HTTP-only cookies where we can't directly access the token
   */
  private setupTokenExpirationListener(): void {
    // Listen for 401 responses from API calls
    document.addEventListener('auth:token-expired', () => {
      logger.debug('Token expiration event detected');
      this.refreshToken();
    });

    // Listen for visibility change to check token status when tab becomes visible
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.hasTokens()) {
          // Check token status when tab becomes visible
          this.checkTokenStatus();
        }
      });
    }

    logger.debug('Token expiration listener set up');
  }

  /**
   * Check token status with the server
   * Used with HTTP-only cookies where we can't directly access the token
   */
  private checkTokenStatus(): void {
    fetch('/api/auth/token-status', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': this.getCsrfToken() || ''
      }
    })
    .then(response => {
      if (response.status === 401) {
        // Token is expired, try to refresh if user is active
        if (!this.isUserInactive()) {
          this.refreshToken();
        } else {
          this.logoutDueToInactivity();
        }
      } else if (response.ok) {
        return response.json();
      }
    })
    .then(data => {
      if (data && data.expiresIn) {
        const expiresInMs = data.expiresIn * 1000;
        
        if (expiresInMs < TOKEN_REFRESH_THRESHOLD) {
          // Token will expire soon, refresh it if user is active
          if (!this.isUserInactive()) {
            this.refreshToken();
          } else {
            // Start intensive monitoring
            this.startInactivityMonitoring();
          }
        }
      }
    })
    .catch(error => {
      logger.error('Token status check failed:', error);
    });
  }

  /**
   * Force logout due to token/session issues
   */
  private forceLogout(reason: string): void {
    // Clear tokens
    this.clearTokens();
    
    // Clear auth state in localStorage
    localStorage.removeItem('auth_session_active');
    localStorage.removeItem('session_metadata');
    
    // Broadcast logout to other tabs
    if (this.authChannel) {
      this.authChannel.postMessage({
        type: 'LOGOUT',
        payload: { reason }
      });
    }
    
    // Emit logout event
    this.eventBus.emit('logout', { reason });
    
    // Dispatch custom event for global listeners
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent(AUTH_CONSTANTS.EVENTS.FORCED_LOGOUT, {
        detail: { reason }
      }));
    }
    
    logger.warn(`Forced logout due to: ${reason}`);
  }

  /**
   * Emit auth error event
   */
  private emitAuthErrorEvent(error: AuthError): void {
    this.eventBus.emit('authError', error);
    
    // Dispatch custom event for global listeners
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent(AUTH_CONSTANTS.EVENTS.AUTH_ERROR, {
        detail: error
      }));
    }
  }

  /**
   * Update session data
   * @param sessionData Session data from server
   */
  private updateSessionData(sessionData: any): void {
    logger.debug('Updating session data', sessionData);
    
    // Store session metadata if available
    if (sessionData && sessionData.id) {
      try {
        // Update session metadata in storage
        localStorage.setItem('session_metadata', JSON.stringify({
          id: sessionData.id,
          expiresAt: sessionData.expiresAt,
          lastActivity: sessionData.lastActivity || Date.now(),
          idleTimeout: sessionData.idleTimeout
        }));
        
        // Emit session updated event
        this.eventBus.emit('sessionUpdated', sessionData);
      } catch (error) {
        logger.error('Failed to update session data:', error);
      }
    }
  }

  /**
   * Broadcast token refreshed event to other tabs
   */
  private broadcastTokenRefreshed(): void {
    if (this.authChannel) {
      this.authChannel.postMessage({
        type: 'TOKEN_REFRESHED',
        payload: {
          timestamp: Date.now(),
          tokenVersion: this.tokenVersion
        }
      });
    }
  }

  /**
   * Set up activity tracking to detect user inactivity
   */
  private setupActivityTracking(): void {
    if (this.activityListeners) return;
    
    // Record initial activity timestamp
    this.recordUserActivity();
    
    // Set up event listeners for user activity
    if (typeof window !== 'undefined') {
      const activityEvents = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
      
      activityEvents.forEach(eventType => {
        window.addEventListener(eventType, this.handleUserActivity);
      });
      
      this.activityListeners = true;
      logger.debug('User activity tracking initialized');
    }
    
    // Set up periodic inactivity check
    this.setupInactivityCheck();
  }
  
  /**
   * Set up periodic check for inactivity
   */
  private setupInactivityCheck(): void {
    if (this.inactivityCheckerId) {
      clearInterval(this.inactivityCheckerId);
    }
    
    this.inactivityCheckerId = window.setInterval(() => {
      if (this.isUserInactive() && this.hasTokens()) {
        logger.warn('User inactive beyond threshold during periodic check, logging out');
        this.logoutDueToInactivity();
      }
    }, INACTIVITY_CHECK_INTERVAL) as unknown as number;
    
    logger.debug(`Inactivity check scheduled every ${INACTIVITY_CHECK_INTERVAL/1000} seconds`);
  }
  
  /**
   * Handle user activity event
   */
  private handleUserActivity = (): void => {
    const now = Date.now();
    const lastActivity = localStorage.getItem(USER_ACTIVITY_KEY);
    
    // Only update if significant time has passed (prevent excessive updates)
    if (!lastActivity || now - parseInt(lastActivity, 10) > 10000) { // 10 seconds
      this.recordUserActivity();
      
      // If we're in intensive monitoring mode, check if token needs refresh
      if (this.inactivityMonitorId) {
        // Get token status to see if refresh is needed
        this.checkTokenStatus();
      }
    }
  }
  
  /**
   * Record current user activity timestamp
   */
  private recordUserActivity(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(USER_ACTIVITY_KEY, Date.now().toString());
      this.lastInactivityCheck = Date.now(); // Reset the check time
    }
  }
  
  /**
   * Check if user has been inactive beyond the threshold
   */
  private isUserInactive(): boolean {
    const lastActivity = this.getLastActivity();
    const now = Date.now();
    const threshold = this.getInactivityThreshold();
    
    return (now - lastActivity) > threshold;
  }

  /**
   * Start monitoring for user activity when token is close to expiry
   */
  private startInactivityMonitoring(): void {
    // Clear any existing monitoring
    if (this.inactivityMonitorId) {
      clearInterval(this.inactivityMonitorId);
    }
    
    // Start monitoring for activity more frequently
    this.inactivityMonitorId = window.setInterval(() => {
      // Check if user has been active since last check
      const lastActivity = localStorage.getItem(USER_ACTIVITY_KEY);
      if (lastActivity) {
        const lastActivityTime = parseInt(lastActivity, 10);
        const timeSinceLastCheck = this.lastInactivityCheck ? 
          lastActivityTime - this.lastInactivityCheck : 0;
        
        // If there was activity since last check, refresh the token
        if (timeSinceLastCheck > 0) {
          logger.debug('Activity detected during inactivity monitoring, refreshing token');
          this.refreshToken();
          
          // Stop intensive monitoring after successful refresh
          if (this.inactivityMonitorId) {
            clearInterval(this.inactivityMonitorId);
            this.inactivityMonitorId = null;
          }
        }
      }
      
      // Update last check time
      this.lastInactivityCheck = Date.now();
    }, INACTIVITY_CHECK_INTERVAL);
    
    logger.debug('Started intensive inactivity monitoring');
  }

  /**
   * Initialize token service after successful authentication
   */
  public initializeAfterAuthentication(): void {
    if (this.isInitialized) {
      logger.debug('TokenService already initialized');
      return;
    }
    
    logger.info('Initializing TokenService after authentication');
    this.setupActivityTracking();
    this.startTokenHeartbeat();
    this.scheduleTokenRefresh();
    
    if (this.config.enableCrossTabs && typeof BroadcastChannel !== 'undefined') {
      this.initCrossTabCommunication();
    }
    
    if (this.config.enableFingerprinting) {
      this.generateDeviceFingerprint();
    }
    
    this.initTokenVersion();
    
    if (this.config.enableOfflineSupport) {
      this.setupOfflineSupport();
    }
    
    this.isInitialized = true;
  }

  /**
   * Handle logout due to inactivity
   */
  private logoutDueToInactivity(): void {
    logger.warn('Logging out due to user inactivity');
    
    // Import and use the auth service from the services index
    import('@/features/auth/services').then(({ getAuthServices }) => {
      const { authService } = getAuthServices();
      
      // Call logout with correct parameter structure
      authService.logout().catch(error => {
        logger.error('Failed to logout due to inactivity:', error);
        
        // Fallback: clear tokens directly if logout fails
        this.clearTokens();
        
        // Redirect to login page with inactivity reason
        if (typeof window !== 'undefined') {
          window.location.href = `/login?reason=inactivity&t=${Date.now()}`;
        }
      });
      
      // Dispatch a custom event to notify about inactivity logout
      if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent(AUTH_CONSTANTS.EVENTS.LOGOUT, {
          detail: { timestamp: Date.now() }
        }));
      }
    }).catch(error => {
      logger.error('Failed to import auth services:', error);
      this.forceLogout('inactivity');
    });
  }
  
  /**
   * Clean up activity tracking on logout
   */
  private cleanupActivityTracking(): void {
    if (!this.activityListeners) return;
    
    if (typeof window !== 'undefined') {
      const activityEvents = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
      
      activityEvents.forEach(eventType => {
        window.removeEventListener(eventType, this.handleUserActivity);
      });
      
      this.activityListeners = false;
    }
    
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(USER_ACTIVITY_KEY);
    }
    
    logger.debug('User activity tracking cleaned up');
  }
  
  // Modify clearTokens to also clean up activity tracking
  public clearTokens(): boolean {
    try {
      this.clearTokensLocally();
      
      // Clean up activity tracking
      this.cleanupActivityTracking();
      this.isInitialized = false;
      
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
   * Get the timestamp of the last user activity
   * @returns {number} Timestamp of last activity or current time
   */
  private getLastActivity(): number {
    const lastActivity = localStorage.getItem(USER_ACTIVITY_KEY);
    return lastActivity ? parseInt(lastActivity, 10) : Date.now();
  }

  private getInactivityThreshold(): number {
    // Check if "Remember me" was selected during login
    const rememberMe = localStorage.getItem('auth_remember_me') === 'true';
    
    // Use a longer threshold if "Remember me" is enabled
    return rememberMe 
      ? EXTENDED_INACTIVITY_THRESHOLD // e.g., 7 days in milliseconds
      : INACTIVITY_THRESHOLD; // Regular 30 minutes
  }
}

// Export a singleton instance
export const tokenService = new TokenService();

// Export default for dependency injection in tests
export default TokenService;
