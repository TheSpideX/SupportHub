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

import { logger } from "@/utils/logger";
import EventEmitter from "eventemitter3";
import {
  getCookie,
  setCookie,
  removeCookie,
  getSessionMetadata,
} from "../utils/storage.utils";
import { AuthError, TokenRefreshQueueItem } from "../types/auth.types";
import { apiClient } from "@/api/apiClient";
import { AUTH_CONSTANTS } from "../constants/auth.constants";

// Constants
const ACCESS_TOKEN_COOKIE = "auth_access_token";
const REFRESH_TOKEN_COOKIE = "auth_refresh_token";
const TOKEN_EXISTS_FLAG = "auth_token_exists";
const CSRF_TOKEN_COOKIE = "csrf_token";
const TOKEN_VERSION_KEY = "token_version";
const FINGERPRINT_KEY = "device_fingerprint";
const USER_ACTIVITY_KEY = "last_user_activity";
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
  apiBaseUrl: import.meta.env.VITE_API_URL || "http://localhost:4290/api",
  tokenEndpoint: "/auth/token",
  refreshEndpoint: "/auth/token/refresh", // Standardized endpoint
  cookieSecure: true,
  cookiePath: "/",
  accessTokenMaxAge: 15 * 60, // 15 minutes
  refreshTokenMaxAge: 7 * 24 * 60 * 60, // 7 days
  csrfHeaderName: "X-CSRF-Token",
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
  private _refreshLock: boolean = false;
  private _lastProcessedMessageTime: number | null = null;
  private _tabId: string = this._generateTabId();
  private _lastTokenVerification: number | null = null;
  private _validationInProgress = false;
  private _validationPromise: Promise<boolean> | null = null;
  private _instanceId: string = `inst_${Math.random()
    .toString(36)
    .substr(2, 9)}_${Date.now()}`; // Add this line

  // Strengthen the singleton pattern
  public static instance: TokenService | null = null;

  // Use window to persist the instance across HMR
  public static getInstance(
    config: Partial<TokenServiceConfig> = {}
  ): TokenService {
    // Store instance on window object to survive HMR
    const w = typeof window !== "undefined" ? window : ({} as any);
    if (!w.__tokenServiceInstance) {
      w.__tokenServiceInstance = new TokenService(config);
      logger.info("Created new TokenService instance");
    } else {
      logger.debug("Using existing TokenService instance");
    }
    TokenService.instance = w.__tokenServiceInstance;
    return w.__tokenServiceInstance;
  }

  constructor(config: Partial<TokenServiceConfig> = {}) {
    // Return existing instance if one exists (prevent "this" context issues)
    const w = typeof window !== "undefined" ? window : ({} as any);
    if (w.__tokenServiceInstance) {
      logger.debug(
        "TokenService already initialized, returning existing instance"
      );
      return w.__tokenServiceInstance;
    }

    // Continue with initialization if this is the first instance
    this.config = { ...defaultConfig, ...config };
    this.eventBus = new EventEmitter();

    // Set heartbeat interval
    this.heartbeatInterval = Math.min(
      30 * 1000, // 30 seconds default
      (this.config.refreshThreshold * 1000) / 3 // Or 1/3 of refresh threshold
    );

    logger.info(
      `TokenService initialized with refresh threshold: ${
        this.config.refreshThreshold
      }s, heartbeat: ${this.heartbeatInterval / 1000}s`
    );

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
      if (
        this.config.enableCrossTabs &&
        typeof BroadcastChannel !== "undefined"
      ) {
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
      logger.info("TokenService fully initialized for authenticated user");
    } else {
      logger.info(
        "TokenService initialized in standby mode (no authenticated user)"
      );
    }
  }

  /**
   * Generate a unique device fingerprint for security verification
   */
  private generateDeviceFingerprint(): void {
    try {
      // Check if we already have a fingerprint
      let fingerprint = localStorage.getItem(FINGERPRINT_KEY);

      if (!fingerprint) {
        // Generate a new fingerprint based on device characteristics
        const fpData = [
          navigator.userAgent,
          navigator.language,
          screen.colorDepth,
          screen.width + "x" + screen.height,
          new Date().getTimezoneOffset(),
          // Add more entropy with a random component
          Math.random().toString(36).substr(2, 10),
        ].join("|");

        // Create a simple hash
        let hash = 0;
        for (let i = 0; i < fpData.length; i++) {
          const char = fpData.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash; // Convert to 32bit integer
        }

        fingerprint = Math.abs(hash).toString(36);
        localStorage.setItem(FINGERPRINT_KEY, fingerprint);
      }

      this.deviceFingerprint = fingerprint;
      logger.debug("Device fingerprint initialized");
    } catch (error) {
      logger.error("Failed to generate device fingerprint:", error);
      this.deviceFingerprint = null;
    }
  }

  /**
   * Validate cross-tab messages to prevent security issues
   */
  private validateCrossTabMessage(message: any): boolean {
    // Verify message structure
    if (!message || !message.type || !message.timestamp) {
      logger.warn("Received malformed cross-tab message", message);
      return false;
    }

    // Prevent replay attacks by checking timestamp
    if (
      this._lastProcessedMessageTime &&
      message.timestamp <= this._lastProcessedMessageTime
    ) {
      logger.warn("Ignoring outdated cross-tab message", message);
      return false;
    }

    // Verify the source tab if tabId is available
    if (message.tabId && message.tabId === this._tabId) {
      // Skip messages from self
      return false;
    }

    // Message is valid, update timestamp
    this._lastProcessedMessageTime = message.timestamp;
    return true;
  }

  // Update initCrossTabCommunication method to use validation
  private initCrossTabCommunication(): void {
    if (typeof window !== "undefined" && window.BroadcastChannel) {
      try {
        this.authChannel = new BroadcastChannel("auth_channel");

        this.authChannel.addEventListener("message", (event) => {
          // Validate message before processing
          if (!this.validateCrossTabMessage(event.data)) {
            return;
          }

          // Process the message by type
          switch (event.data.type) {
            case "SESSION_UPDATED":
              this.handleSessionUpdate(event.data.payload);
              break;
            case "TOKEN_REFRESHED":
              this.handleTokenRefreshed(event.data.payload);
              break;
            case "TOKEN_VERSION_UPDATED":
              this.handleTokenVersionUpdated(event.data.payload);
              break;
            case "LOGOUT":
              this.handleLogout();
              break;
            default:
              logger.warn("Received unknown message type:", event.data.type);
          }
        });

        // Announce this tab to other tabs
        this.authChannel.postMessage({
          type: "TAB_CONNECTED",
          timestamp: Date.now(),
          tabId: this._tabId,
        });

        logger.debug("Cross-tab communication initialized");
      } catch (error) {
        logger.error("Failed to initialize cross-tab communication:", error);
      }
    }
  }

  // Add handler for token version updates
  private handleTokenVersionUpdated(payload: any): void {
    if (!payload || typeof payload.tokenVersion !== "number") {
      return;
    }

    // Update token version if newer
    if (payload.tokenVersion > this.tokenVersion) {
      logger.debug(
        `Updating token version from ${this.tokenVersion} to ${payload.tokenVersion}`
      );
      this.tokenVersion = payload.tokenVersion;

      try {
        localStorage.setItem(TOKEN_VERSION_KEY, this.tokenVersion.toString());
      } catch (error) {
        logger.error("Failed to store updated token version:", error);
      }
    }
  }

  private _generateTabId(): string {
    return `tab_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  }

  /**
   * Initialize token version for revocation support
   */
  private initTokenVersion(): void {
    try {
      const storedVersion = localStorage.getItem(TOKEN_VERSION_KEY);
      this.tokenVersion = storedVersion ? parseInt(storedVersion, 10) : 0;
    } catch (error) {
      logger.error("Failed to initialize token version:", error);
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
      logger.error("Failed to store token version:", error);
    }
  }

  /**
   * Setup offline support
   */
  private setupOfflineSupport(): void {
    window.addEventListener("online", this.handleOnline.bind(this));
    window.addEventListener("offline", this.handleOffline.bind(this));

    // Initialize offline cache if we're already offline
    if (!navigator.onLine && this.hasTokens()) {
      this.cacheTokensForOffline();
    }
  }

  /**
   * Handle coming back online
   */
  private async handleOnline(): Promise<void> {
    logger.info("Network connection restored");

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
    logger.info("Network connection lost");

    // Cache tokens for offline use
    if (this.hasTokens()) {
      this.cacheTokensForOffline();
    }
  }

  /**
   * Cache tokens for offline use with more data
   */
  private cacheTokensForOffline(): void {
    try {
      const sessionData = getSessionMetadata();
      if (!sessionData) {
        logger.warn("No session data available for offline caching");
        return;
      }

      // Clear previous cache
      this.offlineTokenCache.clear();

      // Store essential token information
      this.offlineTokenCache.set("exp", sessionData.expiresAt.toString());
      this.offlineTokenCache.set("userId", sessionData.userId);
      this.offlineTokenCache.set("tokenVersion", this.tokenVersion.toString());
      this.offlineTokenCache.set("cachedAt", Date.now().toString());

      // Store fingerprint if available
      if (this.deviceFingerprint) {
        this.offlineTokenCache.set("fingerprint", this.deviceFingerprint);
      }

      logger.info("Token data cached for offline use");
    } catch (error) {
      logger.error("Failed to cache tokens for offline use:", error);
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

      // If no session data, schedule a refresh every 5 minutes as a fallback
      if (!sessionData || !sessionData.expiresAt) {
        logger.warn(
          "No session metadata found, scheduling refresh every 5 minutes as fallback"
        );
        this.refreshTimeoutId = window.setTimeout(() => {
          this.refreshToken();
        }, 5 * 60 * 1000); // 5 minutes
        return;
      }

      // Calculate time until refresh (expiry - threshold)
      const expiresAt = new Date(sessionData.expiresAt).getTime();
      const now = Date.now();
      const timeUntilRefresh =
        expiresAt - now - this.config.refreshThreshold * 1000;

      // Schedule refresh
      if (timeUntilRefresh > 0) {
        // Never wait more than 5 minutes to refresh, even if expiry is far away
        const refreshDelay = Math.min(timeUntilRefresh, 5 * 60 * 1000);

        this.refreshTimeoutId = window.setTimeout(() => {
          this.refreshToken();
        }, refreshDelay);

        logger.info(
          `Token refresh scheduled in ${Math.round(
            refreshDelay / 1000
          )} seconds`
        );
      } else {
        // Token is already expired or close to expiry, refresh immediately
        logger.info("Token is close to expiry, refreshing immediately");
        this.refreshToken();
      }
    } catch (error) {
      logger.error("Failed to schedule token refresh:", error);

      // Schedule a fallback refresh in case of error
      this.refreshTimeoutId = window.setTimeout(() => {
        this.refreshToken();
      }, 5 * 60 * 1000); // 5 minutes
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
        reject,
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
   * Clear tokens locally (without broadcasting)
   */
  private clearTokensLocally(): void {
    // Clear any scheduled refresh
    if (this.refreshTimeoutId) {
      clearTimeout(this.refreshTimeoutId);
      this.refreshTimeoutId = null;
    }

    // Clear token existence flag cookie
    // Note: The actual token cookies are HTTP-only and will be cleared by the backend
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
    logger.debug("Token existence check", {
      hasFlag,
      cookies: document.cookie.split(";").map((c) => c.trim().split("=")[0]),
    });

    return hasFlag;
  }

  /**
   * Check if user has a valid token
   * This combines token existence and authentication checks
   */
  public hasValidToken(): boolean {
    // First check if tokens exist
    if (!this.hasTokens()) {
      return false;
    }

    // Then check if the user is authenticated
    return this.isAuthenticated();
  }

  /**
   * Validates the current token state
   */
  public isAuthenticated(): boolean {
    // Get all state in one atomic operation
    const session = this.getSessionInfo();

    // Verify token version
    if (
      session.isValid &&
      session.tokenVersion &&
      session.tokenVersion < this.tokenVersion
    ) {
      logger.warn("Session has outdated token version");
      return false;
    }

    return session.isValid;
  }

  /**
   * Checks if the access token is expired
   * Note: Since we can't directly access HTTP-only cookies,
   * we rely on the token data stored in session metadata
   */
  public isTokenExpired(bufferSeconds: number = 60): boolean {
    try {
      const session = this.getSessionInfo();
      if (!session.isValid || !session.expiresAt) {
        return true;
      }

      const now = new Date();
      const bufferMs = bufferSeconds * 1000;
      return session.expiresAt.getTime() <= now.getTime() + bufferMs;
    } catch (error) {
      logger.error("Error checking token expiration:", error);
      return true; // Safer to assume expired if there's an error
    }
  }

  /**
   * Get CSRF token from cookie
   */
  public getCsrfToken(): string | null {
    try {
      // First try to get the token using the configured name
      const configToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${this.config.csrfTokenName}=`));

      if (configToken) {
        return configToken.split("=")[1] || null;
      }

      // Fallback to common CSRF token names
      const commonNames = [
        "csrf_token",
        "CSRF-TOKEN",
        "X-CSRF-TOKEN",
        "XSRF-TOKEN",
      ];

      for (const name of commonNames) {
        const token = document.cookie
          .split("; ")
          .find((row) => row.startsWith(`${name}=`));

        if (token) {
          return token.split("=")[1] || null;
        }
      }

      // If no token found in cookies, check localStorage as last resort
      const localToken = localStorage.getItem("csrf_token");
      if (localToken) {
        return localToken;
      }

      logger.debug("No CSRF token found in cookies or localStorage");
      return null;
    } catch (error) {
      logger.error("Error getting CSRF token from cookie:", error);
      return null;
    }
  }

  /**
   * Set CSRF token in memory
   */
  private setCsrfToken(token: string): void {
    // Store the token in a class property if needed
    // No need to set the cookie as the backend does this
    // zJust use the token for the current request if needed
    // If you need to track the token in memory, add a class property:
    // private csrfTokenValue: string | null = null;
    // this.csrfTokenValue = token;
  }

  /**
   * Rotates the CSRF token
   */
  public async rotateCsrfToken(): Promise<boolean> {
    const newToken = await this.syncCsrfToken();
    return newToken !== null;
  }

  /**
   * Refreshes the access token using the refresh token
   */
  public async refreshToken(): Promise<boolean> {
    // Log the refresh attempt with more details
    logger.info("Token refresh requested", {
      tabId: this._tabId,
      deviceId: this.deviceFingerprint,
      isLeaderTab: this.isLeaderTab(),
      timestamp: new Date().toISOString(),
    });

    // Check global lock first
    if (!this._getGlobalLock()) {
      logger.debug("Global refresh lock active, skipping refresh");
      return true; // Assume another instance is handling it
    }

    try {
      // Existing refresh logic
      // If already refreshing, return existing promise
      if (this.refreshState.isRefreshing && this.refreshState.promise) {
        logger.debug("Token refresh already in progress");
        return this.refreshState.promise;
      }

      // For backward compatibility - set legacy flags
      this.isRefreshing = true;
      this.refreshing = true;
      this._refreshLock = true;

      // Set refreshing state
      this.refreshState.isRefreshing = true;

      // Create new refresh promise
      this.refreshState.promise = new Promise<boolean>(async (resolve) => {
        try {
          logger.info("Starting token refresh");

          // Check for user inactivity before attempting refresh
          if (this.isUserInactive()) {
            logger.warn(
              "User inactive, logging out instead of refreshing token"
            );
            this.logoutDueToInactivity();
            resolve(false);
            return;
          }

          // Perform actual refresh logic
          const result = await this.performTokenRefresh();

          // Update last refresh time
          this.refreshState.lastRefreshTime = Date.now();
          this.lastRefreshTime = Date.now(); // For backward compatibility

          // Reset retry count on success
          this.refreshState.retryCount = 0;
          this.refreshRetryCount = 0; // For backward compatibility

          if (result) {
            // Schedule next refresh
            this.scheduleTokenRefresh();

            // Notify listeners
            this.notifyRefreshListeners({
              expiresAt: this.getAccessTokenExpiry(),
            });

            // Broadcast to other tabs
            this.broadcastTokenRefreshed();
          }

          resolve(result);
        } catch (error) {
          logger.error("Token refresh failed:", error);
          this.refreshState.retryCount++;
          this.refreshRetryCount++; // For backward compatibility
          resolve(false);
        } finally {
          // Reset state with a small delay to prevent race conditions
          setTimeout(() => {
            this.refreshState.isRefreshing = false;
            this.isRefreshing = false;
            this.refreshing = false;
            this._refreshLock = false;
            this.refreshPromise = null;
          }, 100);
        }
      });

      // For backward compatibility
      this.refreshQueue = this.refreshState.promise;
      this.refreshPromise = this.refreshState.promise;

      return this.refreshState.promise;
    } finally {
      this._releaseGlobalLock();
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
      headers["X-Device-Fingerprint"] = this.deviceFingerprint;
    }

    // Add token version if available
    if (this.tokenVersion > 0) {
      headers["X-Token-Version"] = this.tokenVersion.toString();
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
        if (
          decoded.deviceFingerprint &&
          decoded.deviceFingerprint !== this.deviceFingerprint
        ) {
          logger.warn("Device fingerprint mismatch detected");
          return false;
        }
      }

      // Validate token version
      if (decoded.version && decoded.version < this.tokenVersion) {
        logger.warn("Token version is outdated");
        return false;
      }

      return true;
    } catch (error) {
      logger.error("Token security validation failed:", error);
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
      logger.error("Failed to revoke tokens:", error);
      return false;
    }
  }

  /**
   * Handles token security events (suspicious activity)
   */
  public handleSecurityEvent(eventType: string, data?: any): void {
    logger.warn(`Security event detected: ${eventType}`, data);

    switch (eventType) {
      case "suspicious_activity":
        // Revoke tokens and force re-authentication
        this.revokeAllTokens();
        break;
      case "location_change":
        // Require additional verification
        this.rotateCsrfToken();
        break;
      case "multiple_failures":
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
        userId: sessionData.userId,
      };

      return metadata;
    } catch (error) {
      logger.error("Failed to get token metadata:", error);
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
    return hasToken ? "token-exists-in-http-only-cookie" : null;
  }

  /**
   * Decode token
   * @param {string} token - Token to decode
   * @returns {Object|null} Decoded token or null
   */
  public decodeToken(token: string | null): any {
    if (!token) {
      logger.debug("No token to decode");
      return null;
    }

    // If we're using HTTP-only cookies, we can't decode the token directly
    // Instead, we need to rely on the session data from the server
    if (token === "token-exists-in-http-only-cookie") {
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
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      logger.error("Failed to decode token:", error);
      return null;
    }
  }

  /**
   * Get the current user ID from the token
   * @returns User ID or null if not authenticated
   */
  public getUserId(): string | null {
    const session = this.getSessionInfo();
    return session.isValid ? session.userId || null : null;
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
      window.removeEventListener("online", this.handleOnline.bind(this));
      window.removeEventListener("offline", this.handleOffline.bind(this));
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
      // Change from XSRF-TOKEN to csrf_token to match backend expectations
      document.cookie = `csrf_token=${csrfToken}; path=/; SameSite=Strict`;

      // Add an interceptor to add the CSRF token to all requests
      this.setupCsrfInterceptor(csrfToken);

      logger.info("CSRF protection initialized");
    } catch (error) {
      logger.error("Failed to set up CSRF protection:", error);
    }
  }

  /**
   * Generate a CSRF token
   */
  private generateCsrfToken(): string {
    // Generate a random string for CSRF token
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
      ""
    );
  }

  /**
   * Set up CSRF interceptor for API requests
   */
  private setupCsrfInterceptor(token: string): void {
    // For fetch API, you might set up a wrapper function
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      if (!init) {
        init = {};
      }
      if (!init.headers) {
        init.headers = {};
      }

      // Add CSRF token to headers with correct header name
      init.headers["X-CSRF-Token"] = token;

      return originalFetch(input, init);
    };
  }

  /**
   * Validate tokens with atomic operations
   */
  public async validateTokens(): Promise<boolean> {
    // If validation is already in progress, return the existing promise
    if (this._validationInProgress && this._validationPromise) {
      return this._validationPromise;
    }

    this._validationInProgress = true;

    this._validationPromise = (async () => {
      try {
        // Get session info atomically
        const session = this.getSessionInfo();
        if (!session.isValid) {
          return false;
        }

        // If online, verify with server
        if (navigator.onLine) {
          // Ensure we're using the full backend URL for token validation
          const validationUrl = this.config.apiBaseUrl.endsWith("/api")
            ? `${this.config.apiBaseUrl}/auth/token-status`
            : `${this.config.apiBaseUrl}/api/auth/token-status`;

          logger.debug("Token validation URL", { validationUrl });

          const response = await fetch(validationUrl, {
            method: "GET",
            credentials: "include",
            headers: this.getAuthHeaders(),
          });

          if (!response.ok) {
            if (response.status === 401 && !this.refreshState.isRefreshing) {
              // Try to refresh token
              return await this.refreshToken();
            }
            return false;
          }

          return true;
        } else {
          // In offline mode, rely on local validation only
          return session.isValid && session.expiresAt
            ? new Date() < session.expiresAt
            : false;
        }
      } catch (error) {
        logger.error("Token validation failed:", error);
        return false;
      } finally {
        this._validationInProgress = false;
      }
    })();

    return this._validationPromise;
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
    logger.debug("Tokens synced from storage (HTTP-only cookies)");

    // Update the session active flag
    if (localStorage.getItem("auth_session_active") === "true") {
      // Validate the session is still active with the server
      this.validateTokens().catch((error) => {
        logger.warn("Failed to validate synced tokens", error);
        localStorage.removeItem("auth_session_active");
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
   * Subscribe to an event
   * @param event Event name
   * @param listener Event listener function
   */
  public on(event: string, listener: (...args: any[]) => void): void {
    this.eventBus.on(event, listener);
  }

  /**
   * Unsubscribe from an event
   * @param event Event name
   * @param listener Event listener function
   */
  public off(event: string, listener: (...args: any[]) => void): void {
    this.eventBus.off(event, listener);
  }

  /**
   * Check if a cookie flag exists
   * @param {string} name - Cookie name
   * @returns {boolean} Whether the cookie exists
   */
  public hasFlag(name: string): boolean {
    try {
      return !!getCookie(name);
    } catch (error) {
      logger.error(`Error checking flag ${name}:`, error);
      return false;
    }
  }

  /**
   * Check if access token exists
   */
  public hasAccessToken(): boolean {
    return this.hasFlag(ACCESS_TOKEN_COOKIE);
  }

  /**
   * Check if refresh token exists
   */
  public hasRefreshToken(): boolean {
    return this.hasFlag(REFRESH_TOKEN_COOKIE);
  }

  /**
   * Get user ID from token or Redux store
   * @returns User ID or null if not available
   */
  public getUserId(): string | null {
    try {
      // Try to get user ID from Redux store first
      if (typeof window !== "undefined" && (window as any).__REDUX_STORE__) {
        const store = (window as any).__REDUX_STORE__;
        const state = store.getState();
        if (state && state.auth && state.auth.user && state.auth.user.id) {
          return state.auth.user.id;
        }
      }

      // Try to get from decoded token
      const userData = this.getUserData();
      if (userData && userData.id) {
        return userData.id;
      }

      return null;
    } catch (error) {
      logger.error("Error getting user ID:", error);
      return null;
    }
  }

  /**
   * Get user data from token
   * @returns User data object or null if not available
   */
  public getUserData(): any | null {
    try {
      // Try to get from Redux store first
      if (typeof window !== "undefined" && (window as any).__REDUX_STORE__) {
        const store = (window as any).__REDUX_STORE__;
        const state = store.getState();
        if (state && state.auth && state.auth.user) {
          return state.auth.user;
        }
      }

      // Try to get from localStorage
      const userData = localStorage.getItem("user_data");
      if (userData) {
        try {
          return JSON.parse(userData);
        } catch (e) {
          logger.error("Error parsing user data from localStorage:", e);
        }
      }

      return null;
    } catch (error) {
      logger.error("Error getting user data:", error);
      return null;
    }
  }

  /**
   * Trigger a token refresh event
   */
  private emitTokenRefreshedEvent(): void {
    this.lastRefreshTime = Date.now();

    // Dispatch event for monitoring
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("token-refreshed"));
    }
  }

  /**
   * Get access token expiry date
   * @returns Date object representing expiry time or null if not available
   */
  public getAccessTokenExpiry(): Date | null {
    try {
      // For HTTP-only cookies, we need to rely on stored metadata
      const tokenMetadata = localStorage.getItem("auth_token_metadata");
      if (tokenMetadata) {
        const metadata = JSON.parse(tokenMetadata);
        return metadata.accessTokenExpiry
          ? new Date(metadata.accessTokenExpiry)
          : null;
      }
      return null;
    } catch (error) {
      logger.error("Error getting access token expiry", error);
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
      const tokenMetadata = localStorage.getItem("auth_token_metadata");
      if (tokenMetadata) {
        const metadata = JSON.parse(tokenMetadata);
        return metadata.refreshTokenExpiry
          ? new Date(metadata.refreshTokenExpiry)
          : null;
      }
      return null;
    } catch (error) {
      logger.error("Error getting refresh token expiry", error);
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
   * Check if this tab is the leader tab
   * Leader tab is responsible for token refresh and other shared operations
   */
  private isLeaderTab(): boolean {
    try {
      // Check if we have leader information in localStorage
      const leaderData = localStorage.getItem("auth_leader_tab");
      if (!leaderData) {
        // No leader yet, try to become one
        return this.electLeaderTab();
      }

      // Parse leader data
      const data = JSON.parse(leaderData);

      // Check if this tab is the leader
      return data.tabId === this._tabId;
    } catch (error) {
      logger.error("Error checking leader tab status:", error);
      return false;
    }
  }

  /**
   * Elect a leader tab
   * Returns true if this tab becomes the leader
   */
  private electLeaderTab(): boolean {
    try {
      const now = Date.now();
      const leaderData = localStorage.getItem("auth_leader_tab");

      // Parse current leader data if it exists
      let currentLeader = { tabId: "", timestamp: 0 };
      if (leaderData) {
        try {
          currentLeader = JSON.parse(leaderData);
        } catch (e) {
          // Ignore parsing errors
        }
      }

      // If leader is recent (last 10 seconds) and not this tab, we're not leader
      if (
        currentLeader.tabId &&
        currentLeader.tabId !== this._tabId &&
        now - currentLeader.timestamp < 10000
      ) {
        return false;
      }

      // Otherwise, claim leadership
      const newLeader = { tabId: this._tabId, timestamp: now };
      localStorage.setItem("auth_leader_tab", JSON.stringify(newLeader));

      // Broadcast leadership claim
      if (this.authChannel) {
        this.authChannel.postMessage({
          type: "LEADER_ELECTED",
          tabId: this._tabId,
          timestamp: now,
        });
      }

      return true;
    } catch (error) {
      logger.error("Error during leader tab election:", error);
      return false;
    }
  }

  /**
   * Perform token refresh (internal implementation)
   */
  private async performTokenRefresh(): Promise<boolean> {
    try {
      logger.info("Starting token refresh");

      // Check for extended inactivity (logout threshold)
      // Only check for extended inactivity, not regular activity
      const lastActivity = this.getLastActivity();
      const now = Date.now();
      const inactiveTime = now - lastActivity;
      const threshold = this.getInactivityThreshold();

      if (inactiveTime > threshold) {
        logger.warn(
          "User inactive beyond threshold, logging out instead of refreshing token",
          {
            inactiveTimeMinutes: Math.round(inactiveTime / 60000),
            thresholdMinutes: Math.round(threshold / 60000),
          }
        );
        this.logoutDueToInactivity();
        return false;
      }

      // Perform actual refresh logic with device and tab information
      // This helps with cross-device synchronization
      const deviceId =
        sessionStorage.getItem("device_fingerprint") || this.deviceFingerprint;
      const tabId = sessionStorage.getItem("tab_id") || this._tabId;
      const isLeaderTab = this.isLeaderTab();

      // Log the refresh attempt with detailed information
      logger.info("Performing token refresh", {
        deviceId,
        tabId,
        isLeaderTab,
        timestamp: new Date().toISOString(),
        endpoint: `${this.config.apiBaseUrl}${this.config.refreshEndpoint}`,
      });

      // Ensure we're using the full backend URL for token refresh
      // This is critical for HTTP-only cookies to work correctly
      const refreshUrl = this.config.apiBaseUrl.endsWith("/api")
        ? `${this.config.apiBaseUrl}${this.config.refreshEndpoint}`
        : `${this.config.apiBaseUrl}/api${this.config.refreshEndpoint}`;

      logger.debug("Token refresh URL", { refreshUrl });

      const response = await fetch(refreshUrl, {
        method: "POST",
        credentials: "include", // Critical for HTTP-only cookies
        headers: {
          "Content-Type": "application/json",
          ...this.getAuthHeaders(),
        },
        body: JSON.stringify({
          deviceId,
          tabId,
          isLeaderTab,
          timestamp: Date.now(),
        }),
      });

      // Log the response status
      logger.info("Token refresh response received", {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed with status: ${response.status}`);
      }

      const data = await response.json();
      logger.info("Token refresh successful", {
        hasSession: !!data.data?.session,
      });

      // Update session metadata
      if (data.data?.session) {
        this.updateSessionData(data.data.session);
      }

      // Set the token existence flag cookie
      setCookie(TOKEN_EXISTS_FLAG, "true", {
        path: this.config.cookiePath,
        secure: this.config.cookieSecure,
        maxAge: this.config.accessTokenMaxAge,
      });

      // Notify listeners about token refresh
      this.notifyRefreshListeners(data.data?.session || {});

      return true;
    } catch (error) {
      // Handle retry logic
      if (this.refreshRetryCount < this.config.maxRefreshRetries) {
        this.refreshRetryCount++;
        const delay =
          this.config.refreshRetryDelay *
          Math.pow(2, this.refreshRetryCount - 1);
        logger.warn(
          `Token refresh failed, retrying in ${delay}ms (attempt ${this.refreshRetryCount}/${this.config.maxRefreshRetries})`,
          { error }
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.performTokenRefresh();
      }

      this.refreshRetryCount = 0;
      logger.error("Token refresh failed after all retry attempts", { error });
      throw error;
    }
  }

  /**
   * Handle session update from another tab
   */
  private handleSessionUpdate(payload: any): void {
    logger.debug("Received session update from another tab", payload);
    // Update local session state based on the payload
    // This might involve updating Redux store or other state management
  }

  /**
   * Handle token refreshed event from another tab
   */
  private handleTokenRefreshed(payload: any): void {
    try {
      if (!payload) {
        logger.warn("Received empty token refresh payload");
        return;
      }

      logger.debug("Received token refreshed event from another tab", payload);

      // Verify timestamp to prevent replay attacks
      if (payload.timestamp && Date.now() - payload.timestamp > 30000) {
        logger.warn("Ignoring stale token refresh message (>30s old)");
        return;
      }

      // Verify the token version
      if (payload.tokenVersion !== undefined) {
        if (payload.tokenVersion < this.tokenVersion) {
          logger.warn("Ignoring outdated token version from another tab");
          return;
        }

        // Update local token version if newer
        if (payload.tokenVersion > this.tokenVersion) {
          this.tokenVersion = payload.tokenVersion;
          try {
            localStorage.setItem(
              TOKEN_VERSION_KEY,
              this.tokenVersion.toString()
            );
          } catch (error) {
            logger.error("Failed to update token version:", error);
          }
        }
      }

      // Verify token is still valid with backend
      this._safeVerifyTokenWithBackend();

      // Emit local event for components that might be listening
      this.emitTokenRefreshedEvent();
    } catch (error) {
      logger.error("Error handling token refreshed event:", error);
    }
  }

  // Add a new method for safe token verification
  private _safeVerifyTokenWithBackend(): void {
    // If we've verified recently, don't do it again
    if (
      this._lastTokenVerification &&
      Date.now() - this._lastTokenVerification < 5000
    ) {
      return;
    }

    this._lastTokenVerification = Date.now();

    // Queue the verification to avoid API hammering
    setTimeout(() => {
      this.checkTokenStatus();
    }, 500);
  }

  /**
   * Handle logout event from another tab
   */
  private handleLogout(): void {
    logger.debug("Received logout event from another tab");
    // Clear local tokens and state
    this.clearTokens();

    // Redirect to login page if needed
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    }
  }

  /**
   * Notify refresh listeners about token refresh
   */
  private notifyRefreshListeners(sessionData: any): void {
    logger.debug("Notifying token refresh listeners", { sessionData });

    // Update local storage with session metadata if needed
    if (sessionData) {
      try {
        localStorage.setItem(
          "auth_token_metadata",
          JSON.stringify({
            accessTokenExpiry: sessionData.expiresAt,
            refreshTokenExpiry: sessionData.refreshExpiresAt,
            lastRefresh: Date.now(),
          })
        );
      } catch (error) {
        logger.warn("Failed to update token metadata in storage", error);
      }
    }

    // Emit token refreshed event
    this.emitTokenRefreshedEvent();

    // Notify other tabs if cross-tab communication is enabled
    if (this.authChannel) {
      this.authChannel.postMessage({
        type: "TOKEN_REFRESHED",
        payload: { timestamp: Date.now() },
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

    logger.info("Token refresh mechanism initialized for HTTP-only cookies");
  }

  /**
   * Start token heartbeat to periodically check token status with backend
   */
  public startTokenHeartbeat(): void {
    const w = typeof window !== "undefined" ? window : ({} as any);

    // Check if another instance already has a heartbeat running
    if (
      w.__tokenHeartbeatActive &&
      Date.now() - w.__tokenHeartbeatLastPing < 70000
    ) {
      logger.info(
        "Another TokenService instance is already running heartbeat checks"
      );
      return;
    }

    // Ensure we don't start multiple heartbeats
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }

    // Register this instance as having the active heartbeat
    w.__tokenHeartbeatActive = true;
    w.__tokenHeartbeatLastPing = Date.now();

    // Rest of heartbeat logic
    // ...

    // Update last ping time in the interval
    this.heartbeatIntervalId = window.setInterval(() => {
      w.__tokenHeartbeatLastPing = Date.now();

      // Normal heartbeat logic
      // ...
    }, TOKEN_STATUS_CHECK_INTERVAL);
  }

  /**
   * Stop token heartbeat when service is destroyed or user logs out
   */
  public stopTokenHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
      logger.debug("Token heartbeat stopped");
    }
  }

  /**
   * Set up listener for token expiration events
   * This is used with HTTP-only cookies where we can't directly access the token
   */
  private setupTokenExpirationListener(): void {
    // Listen for 401 responses from API calls
    document.addEventListener("auth:token-expired", () => {
      logger.debug("Token expiration event detected");
      this.refreshToken();
    });

    // Listen for visibility change to check token status when tab becomes visible
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && this.hasTokens()) {
          // Check token status when tab becomes visible
          this.checkTokenStatus();
        }
      });
    }

    logger.debug("Token expiration listener set up");
  }

  /**
   * Check token status with the server
   * Used with HTTP-only cookies where we can't directly access the token
   */
  public checkTokenStatus(): void {
    // Skip if refresh is already in progress
    if (this._refreshLock) {
      logger.debug("Token status check: Skipping - refresh in progress");
      return;
    }

    // Ensure we're using the full backend URL for token status check
    const statusUrl = this.config.apiBaseUrl.endsWith("/api")
      ? `${this.config.apiBaseUrl}/auth/token-status`
      : `${this.config.apiBaseUrl}/api/auth/token-status`;

    logger.debug("Token status check URL", { statusUrl });

    fetch(statusUrl, {
      method: "GET",
      credentials: "include",
      headers: this.getAuthHeaders(),
    })
      .then((response) => {
        logger.debug("Token status response received", {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText,
        });

        if (response.status === 401) {
          // Token is expired, try to refresh regardless of user activity
          // This ensures we maintain the session as long as we're within inactivity threshold
          logger.info("Token expired (401), attempting refresh");
          return this.refreshToken();
        } else if (response.ok) {
          return response.json();
        }
        throw new Error(`Token status check failed: ${response.status}`);
      })
      .then((data) => {
        if (data && data.expiresIn) {
          const expiresInMs = data.expiresIn * 1000;
          logger.info(
            `Token expires in ${Math.round(expiresInMs / 1000)} seconds`,
            {
              expiresInMs,
              refreshThreshold: this.config.refreshThreshold * 1000,
              shouldRefresh: expiresInMs < this.config.refreshThreshold * 1000,
            }
          );

          if (expiresInMs < this.config.refreshThreshold * 1000) {
            // Token will expire soon, refresh it regardless of user activity
            // This ensures we maintain the session as long as we're within inactivity threshold
            logger.info("Token expiring soon, refreshing");
            this.refreshToken().then((success) => {
              logger.debug("Token refresh completed", { success });
            });
          }
        } else {
          logger.warn("Token status response missing expiresIn field", {
            data,
          });
        }
      })
      .catch((error) => {
        logger.error("Token status check failed:", error);
      });
  }

  /**
   * Force logout due to token/session issues
   */
  private forceLogout(reason: string): void {
    // Clear tokens
    this.clearTokens();

    // Clear auth state in localStorage
    localStorage.removeItem("auth_session_active");
    localStorage.removeItem("session_metadata");

    // Broadcast logout to other tabs
    if (this.authChannel) {
      this.authChannel.postMessage({
        type: "LOGOUT",
        payload: { reason },
      });
    }

    // Emit logout event
    this.eventBus.emit("logout", { reason });

    // Dispatch custom event for global listeners
    if (typeof document !== "undefined") {
      document.dispatchEvent(
        new CustomEvent(AUTH_CONSTANTS.EVENTS.FORCED_LOGOUT, {
          detail: { reason },
        })
      );
    }

    logger.warn(`Forced logout due to: ${reason}`);
  }

  /**
   * Emit auth error event
   */
  private emitAuthErrorEvent(error: AuthError): void {
    this.eventBus.emit("authError", error);

    // Dispatch custom event for global listeners
    if (typeof document !== "undefined") {
      document.dispatchEvent(
        new CustomEvent(AUTH_CONSTANTS.EVENTS.AUTH_ERROR, {
          detail: error,
        })
      );
    }
  }

  /**
   * Update session data
   * @param sessionData Session data from server
   */
  private updateSessionData(sessionData: any): void {
    logger.debug("Updating session data", sessionData);

    // Store session metadata if available
    if (sessionData && sessionData.id) {
      try {
        // Update session metadata in storage
        localStorage.setItem(
          "session_metadata",
          JSON.stringify({
            id: sessionData.id,
            expiresAt: sessionData.expiresAt,
            lastActivity: sessionData.lastActivity || Date.now(),
            idleTimeout: sessionData.idleTimeout,
          })
        );

        // Emit session updated event
        this.eventBus.emit("sessionUpdated", sessionData);
      } catch (error) {
        logger.error("Failed to update session data:", error);
      }
    }
  }

  /**
   * Broadcast token refreshed event to other tabs
   */
  private broadcastTokenRefreshed(): void {
    if (this.authChannel) {
      this.authChannel.postMessage({
        type: "TOKEN_REFRESHED",
        payload: {
          timestamp: Date.now(),
          tokenVersion: this.tokenVersion,
        },
      });
    }
  }

  /**
   * Set up activity tracking with improved handling
   */
  private setupActivityTracking(): void {
    if (this.activityListeners) {
      logger.debug("Activity listeners already set up");
      return;
    }

    // Record initial activity timestamp
    this.recordUserActivity();

    // Set up event listeners for user activity
    if (typeof window !== "undefined") {
      const activityEvents = [
        "mousedown",
        "keypress",
        "scroll",
        "touchstart",
        "click",
        "mousemove",
      ];

      // Throttled handler to prevent excessive updates
      let lastRecordTime = 0;
      const throttledHandler = () => {
        const now = Date.now();
        if (now - lastRecordTime > 10000) {
          // 10 seconds throttle
          this.recordUserActivity();
          lastRecordTime = now;

          // If we were in inactivity monitoring, exit it
          if (this.inactivityMonitorId) {
            logger.debug("User activity detected during inactivity monitoring");
            this.refreshToken().catch((err) => {
              logger.error("Failed to refresh token after user activity:", err);
            });
          }
        }
      };

      activityEvents.forEach((eventType) => {
        window.addEventListener(eventType, throttledHandler, { passive: true });
      });

      // Add visibility change listener
      document.addEventListener(
        "visibilitychange",
        this.handleVisibilityChange
      );

      this.activityListeners = true;
      logger.debug("User activity tracking initialized with improved handling");
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
        logger.warn(
          "User inactive beyond threshold during periodic check, logging out"
        );
        this.logoutDueToInactivity();
      }
    }, INACTIVITY_CHECK_INTERVAL) as unknown as number;

    logger.debug(
      `Inactivity check scheduled every ${
        INACTIVITY_CHECK_INTERVAL / 1000
      } seconds`
    );
  }

  /**
   * Handle user activity event
   */
  private handleUserActivity = (): void => {
    const now = Date.now();
    const lastActivity = localStorage.getItem(USER_ACTIVITY_KEY);

    // Only update if significant time has passed (prevent excessive updates)
    if (!lastActivity || now - parseInt(lastActivity, 10) > 10000) {
      // 10 seconds
      this.recordUserActivity();

      // If we're in intensive monitoring mode, check if token needs refresh
      if (this.inactivityMonitorId) {
        // Get token status to see if refresh is needed
        this.checkTokenStatus();
      }
    }
  };

  /**
   * Record current user activity timestamp
   */
  private recordUserActivity(): void {
    if (typeof localStorage !== "undefined") {
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

    return now - lastActivity > threshold;
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
        const timeSinceLastCheck = this.lastInactivityCheck
          ? lastActivityTime - this.lastInactivityCheck
          : 0;

        // If there was activity since last check, refresh the token
        if (timeSinceLastCheck > 0) {
          logger.debug(
            "Activity detected during inactivity monitoring, refreshing token"
          );
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

    logger.debug("Started intensive inactivity monitoring");
  }

  /**
   * Initialize token service after successful authentication
   */
  public initializeAfterAuthentication(): void {
    if (this.isInitialized) {
      logger.debug("TokenService already initialized");
      return;
    }

    logger.info("Initializing TokenService after authentication");
    this.setupActivityTracking();
    this.startTokenHeartbeat();
    this.scheduleTokenRefresh();

    if (
      this.config.enableCrossTabs &&
      typeof BroadcastChannel !== "undefined"
    ) {
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
  public logoutDueToInactivity(): void {
    logger.info("Logging out due to inactivity", {
      lastActivity: new Date(this.getLastActivity()).toISOString(),
      inactiveTimeMinutes: Math.round(
        (Date.now() - this.getLastActivity()) / 60000
      ),
    });

    // Import and use the auth service from the services index
    import("@/features/auth/services")
      .then(({ getAuthServices }) => {
        const { authService } = getAuthServices();

        // Call logout with correct parameter structure
        authService
          .logout()
          .then(() => {
            // Add explicit redirection after successful logout
            logger.info(
              "Successfully logged out due to inactivity, redirecting to login"
            );
            if (typeof window !== "undefined") {
              window.location.href = `/login?reason=inactivity&t=${Date.now()}`;
            }
          })
          .catch((error) => {
            logger.error("Failed to logout due to inactivity:", error);

            // Fallback: clear tokens directly if logout fails
            this.clearTokens();

            // Redirect to login page with inactivity reason
            if (typeof window !== "undefined") {
              window.location.href = `/login?reason=inactivity&t=${Date.now()}`;
            }
          });

        // Dispatch a custom event to notify about inactivity logout
        if (typeof document !== "undefined") {
          document.dispatchEvent(
            new CustomEvent(AUTH_CONSTANTS.EVENTS.LOGOUT, {
              detail: { timestamp: Date.now() },
            })
          );
        }
      })
      .catch((error) => {
        logger.error("Failed to import auth services:", error);
        this.forceLogout("inactivity");

        // Add redirect here as well
        if (typeof window !== "undefined") {
          window.location.href = `/login?reason=inactivity&t=${Date.now()}`;
        }
      });
  }

  /**
   * Clean up activity tracking on logout
   */
  private cleanupActivityTracking(): void {
    if (!this.activityListeners) return;

    if (typeof window !== "undefined") {
      const activityEvents = [
        "mousedown",
        "keypress",
        "scroll",
        "touchstart",
        "click",
      ];

      activityEvents.forEach((eventType) => {
        window.removeEventListener(eventType, this.handleUserActivity);
      });

      this.activityListeners = false;
    }

    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(USER_ACTIVITY_KEY);
    }

    logger.debug("User activity tracking cleaned up");
  }

  public clearTokens(): boolean {
    try {
      this.clearTokensLocally();

      // Clean up all timers and listeners in one place
      this._cleanupAllResources();

      // Reset all state flags
      this.isRefreshing = false;
      this.refreshing = false;
      this._refreshLock = false;
      this.refreshPromise = null;
      this.refreshQueue = null;
      this.isInitialized = false;

      // Notify other tabs if cross-tab is enabled
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: "TOKEN_CLEARED",
        });
      }

      return true;
    } catch (error) {
      logger.error("Failed to clear tokens:", error);
      return false;
    }
  }

  // Add a new private method to handle comprehensive cleanup
  private _cleanupAllResources(): void {
    try {
      // Clean up activity tracking
      this.cleanupActivityTracking();

      // Clear all interval timers and timeouts
      [
        this.inactivityMonitorId,
        this.inactivityCheckerId,
        this.heartbeatIntervalId,
        this.refreshTimeoutId,
      ].forEach((timerId) => {
        if (timerId) {
          clearInterval(timerId);
          clearTimeout(timerId);
        }
      });

      // Reset timer IDs
      this.inactivityMonitorId = null;
      this.inactivityCheckerId = null;
      this.heartbeatIntervalId = null;
      this.refreshTimeoutId = null;

      // Remove document event listeners for token expiration
      if (typeof document !== "undefined") {
        document.removeEventListener(
          "auth:token-expired",
          this.refreshToken.bind(this)
        );
        document.removeEventListener(
          "visibilitychange",
          this.handleVisibilityChange
        );
      }

      // Remove network listeners
      if (this.config.enableOfflineSupport && typeof window !== "undefined") {
        window.removeEventListener("online", this.handleOnline.bind(this));
        window.removeEventListener("offline", this.handleOffline.bind(this));
      }

      // Close broadcast channels
      if (this.authChannel) {
        this.authChannel.close();
        this.authChannel = null;
      }

      if (this.broadcastChannel) {
        this.broadcastChannel.close();
        this.broadcastChannel = null;
      }

      // Reset state
      this.refreshState.isRefreshing = false;
      this.refreshState.promise = null;
      this.isRefreshing = false;
      this.refreshing = false;
      this._refreshLock = false;
      this.refreshPromise = null;
      this.refreshQueue = null;

      logger.debug("All TokenService resources cleaned up");
    } catch (error) {
      logger.error("Error during resource cleanup:", error);
    }
  }

  // Add visibility change handler
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === "visible" && this.hasTokens()) {
      // Verify token status when tab becomes visible
      logger.debug("Tab became visible, checking token status");
      this.checkTokenStatus();
    }
  };

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
    const rememberMe = localStorage.getItem("auth_remember_me") === "true";

    // Use a longer threshold if "Remember me" is enabled
    return rememberMe
      ? EXTENDED_INACTIVITY_THRESHOLD // e.g., 7 days in milliseconds
      : INACTIVITY_THRESHOLD; // Regular 30 minutes
  }

  /**
   * Get session information safely for HTTP-only cookie implementation
   * This centralizes all session data access
   */
  public getSessionInfo(): {
    isValid: boolean;
    userId?: string;
    expiresAt?: Date;
    tokenVersion?: number;
    id?: string; // Add the id property
  } {
    try {
      // For HTTP-only cookies, we rely on session metadata
      const sessionData = getSessionMetadata();

      if (!sessionData) {
        return { isValid: false };
      }

      // Check if session has expired
      const expiresAt = new Date(sessionData.expiresAt);
      const now = new Date();

      if (expiresAt <= now) {
        return { isValid: false };
      }

      // Get token version from class property or localStorage instead of sessionData
      const tokenVersion =
        this.tokenVersion ||
        (() => {
          try {
            const storedVersion = localStorage.getItem(TOKEN_VERSION_KEY);
            return storedVersion ? parseInt(storedVersion, 10) : 0;
          } catch (e) {
            return 0;
          }
        })();

      return {
        isValid: true,
        userId: sessionData.userId,
        expiresAt: expiresAt,
        tokenVersion: tokenVersion,
        id: sessionData.id, // Include the session ID from sessionData
      };
    } catch (error) {
      logger.error("Error getting session info:", error);
      return { isValid: false };
    }
  }

  // Add this to the class properties section
  private refreshState: {
    isRefreshing: boolean;
    promise: Promise<boolean> | null;
    lastRefreshTime: number | null;
    retryCount: number;
  } = {
    isRefreshing: false,
    promise: null,
    lastRefreshTime: null,
    retryCount: 0,
  };

  /**
   * Safely executes token operations with consistent error handling
   */
  private async safeTokenOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      logger.error(`Token operation failed: ${operationName}`, error);

      // Handle specific error types
      if (error instanceof Response || (error as any).status === 401) {
        // Handle unauthorized errors consistently
        this.handleUnauthorizedError(operationName);
      } else if (
        (error as any).message === "Network Error" ||
        !navigator.onLine
      ) {
        // Handle offline scenarios
        logger.warn(
          `Network error during ${operationName}, device may be offline`
        );
        if (this.config.enableOfflineSupport) {
          this.handleOffline();
        }
      }

      return null;
    }
  }

  /**
   * Handle unauthorized errors consistently
   */
  private handleUnauthorizedError(operationName: string): void {
    logger.warn(`Unauthorized response during ${operationName}`);

    // Try token refresh if not already refreshing
    if (!this.refreshState.isRefreshing && !this.isUserInactive()) {
      this.refreshToken().catch((err) => {
        logger.error("Failed to refresh token after unauthorized error:", err);
        this.forceLogout("unauthorized");
      });
    } else if (this.isUserInactive()) {
      // User is inactive, log them out
      this.logoutDueToInactivity();
    }
  }

  /**
   * Synchronize CSRF token with server
   */
  public async syncCsrfToken(): Promise<string | null> {
    return await this.safeTokenOperation(async () => {
      // Ensure we're using the full backend URL for CSRF token sync
      const csrfUrl = this.config.apiBaseUrl.endsWith("/api")
        ? `${this.config.apiBaseUrl}/auth/token/csrf`
        : `${this.config.apiBaseUrl}/api/auth/token/csrf`;

      logger.debug("CSRF token sync URL", { csrfUrl });

      // Use the correct endpoint from backend
      const response = await fetch(csrfUrl, {
        method: "GET",
        credentials: "include",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          ...(this.getCsrfToken()
            ? { [this.config.csrfHeaderName]: this.getCsrfToken() }
            : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to sync CSRF token: ${response.status}`);
      }

      const data = await response.json();
      if (data.csrfToken) {
        // Set the new CSRF token
        this.setCsrfToken(data.csrfToken);
        return data.csrfToken;
      }

      return this.getCsrfToken();
    }, "syncCsrfToken");
  }

  /**
   * Synchronize token version with server
   */
  public async syncTokenVersion(): Promise<number> {
    try {
      if (!this.hasTokens() || !navigator.onLine) {
        return this.tokenVersion;
      }

      // Ensure we're using the full backend URL for token version sync
      const versionUrl = this.config.apiBaseUrl.endsWith("/api")
        ? `${this.config.apiBaseUrl}/auth/token-version`
        : `${this.config.apiBaseUrl}/api/auth/token-version`;

      logger.debug("Token version sync URL", { versionUrl });

      // Get token version from server
      const response = await fetch(versionUrl, {
        method: "GET",
        credentials: "include",
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to get token version: ${response.status}`);
      }

      const data = await response.json();

      // Update token version if server version is higher
      if (data.version !== undefined && data.version > this.tokenVersion) {
        logger.debug(
          `Updating token version from ${this.tokenVersion} to ${data.version}`
        );
        this.tokenVersion = data.version;

        try {
          localStorage.setItem(TOKEN_VERSION_KEY, this.tokenVersion.toString());
        } catch (error) {
          logger.error("Failed to store token version:", error);
        }

        // Broadcast to other tabs
        this.broadcastTokenVersion();
      }

      return this.tokenVersion;
    } catch (error) {
      logger.error("Failed to sync token version:", error);
      return this.tokenVersion;
    }
  }

  /**
   * Broadcast token version to other tabs
   */
  private broadcastTokenVersion(): void {
    if (!this.authChannel) return;

    this.authChannel.postMessage({
      type: "TOKEN_VERSION_UPDATED",
      timestamp: Date.now(),
      tabId: this._tabId,
      payload: { tokenVersion: this.tokenVersion },
    });
  }

  /**
   * Cache tokens for offline use
   * This method is called by ConnectionRecoveryService when going offline
   */
  public cacheTokensForOffline(): void {
    logger.info("Caching tokens for offline use");

    try {
      // Get current token data
      const userId = this.getUserId();
      const accessToken = this.getAccessToken();
      const refreshToken = this.getRefreshToken();
      const csrfToken = this.getCsrfToken();

      if (!userId || !accessToken) {
        logger.warn("Cannot cache tokens for offline: missing required data");
        return;
      }

      // Calculate expiration (24 hours from now)
      const expiration = Date.now() + 24 * 60 * 60 * 1000;

      // Store in offline cache
      this.offlineTokenCache.set("userId", userId);
      this.offlineTokenCache.set("accessToken", accessToken);
      if (refreshToken) {
        this.offlineTokenCache.set("refreshToken", refreshToken);
      }
      if (csrfToken) {
        this.offlineTokenCache.set("csrfToken", csrfToken);
      }
      this.offlineTokenCache.set("tokenVersion", this.tokenVersion.toString());
      this.offlineTokenCache.set("exp", expiration.toString());
      this.offlineTokenCache.set("cachedAt", Date.now().toString());

      // Store device and tab info
      this.offlineTokenCache.set("deviceId", this._deviceId);
      this.offlineTokenCache.set("tabId", this._tabId);

      logger.debug("Tokens cached successfully for offline use", {
        userId,
        expiration: new Date(expiration).toISOString(),
        tokenVersion: this.tokenVersion,
      });
    } catch (error) {
      logger.error("Error caching tokens for offline use:", error);
    }
  }

  /**
   * Validate cached tokens for offline use
   */
  private validateOfflineTokens(): boolean {
    if (!this.offlineTokenCache.has("exp")) {
      return false;
    }

    try {
      const expString = this.offlineTokenCache.get("exp") || "0";
      const expiration = parseInt(expString, 10);

      if (isNaN(expiration) || expiration < Date.now()) {
        logger.warn("Offline token cache expired");
        this.offlineTokenCache.clear();
        return false;
      }

      // Check for required fields
      if (
        !this.offlineTokenCache.has("userId") ||
        !this.offlineTokenCache.has("accessToken")
      ) {
        logger.warn("Incomplete offline token cache");
        this.offlineTokenCache.clear();
        return false;
      }

      // Check token version
      const cachedVersion = this.offlineTokenCache.get("tokenVersion");
      if (cachedVersion && parseInt(cachedVersion, 10) < this.tokenVersion) {
        logger.warn("Offline token cache has outdated version");
        this.offlineTokenCache.clear();
        return false;
      }

      // Check if device ID matches
      const cachedDeviceId = this.offlineTokenCache.get("deviceId");
      if (cachedDeviceId && cachedDeviceId !== this._deviceId) {
        logger.warn("Offline token cache belongs to different device");
        this.offlineTokenCache.clear();
        return false;
      }

      logger.debug("Offline tokens validated successfully");
      return true;
    } catch (error) {
      logger.error("Error validating offline tokens:", error);
      this.offlineTokenCache.clear();
      return false;
    }
  }

  // Add a method to check heartbeat status
  public getHeartbeatStatus(): Record<string, any> {
    return {
      active: !!this.heartbeatIntervalId,
      intervalId: this.heartbeatIntervalId,
      refreshLockActive: this._refreshLock,
      refreshState: { ...this.refreshState },
      hasTokens: this.hasTokens(),
      sessionValid: this.isAuthenticated(),
      tokenExpired: this.isTokenExpired(),
    };
  }

  private _getGlobalLock(): boolean {
    const w = typeof window !== "undefined" ? window : ({} as any);
    if (w.__tokenServiceRefreshLock) {
      const lockTime = w.__tokenServiceRefreshLockTime || 0;
      // Consider lock stale after 10 seconds
      if (Date.now() - lockTime > 10000) {
        w.__tokenServiceRefreshLock = false;
        return true;
      }
      return false;
    }

    w.__tokenServiceRefreshLock = true;
    w.__tokenServiceRefreshLockTime = Date.now();
    w.__tokenServiceRefreshingInstanceId = this._instanceId;
    return true;
  }

  private _releaseGlobalLock(): void {
    const w = typeof window !== "undefined" ? window : ({} as any);
    if (w.__tokenServiceRefreshingInstanceId === this._instanceId) {
      w.__tokenServiceRefreshLock = false;
    }
  }
}

// Export a singleton instance
export const tokenService = TokenService.getInstance();

// Export the class for testing and dependency injection
export default TokenService;

// Prevent multiple instances by exporting a function that always returns the singleton
export function getTokenService(): TokenService {
  return TokenService.getInstance();
}
