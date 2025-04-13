/**
 * AuthMonitorService
 *
 * Monitors authentication state and provides resilient authentication services
 * - Integrates TokenService, PrimusAuthService, ConnectionRecoveryService, and FallbackApiService
 * - Provides a unified interface for authentication monitoring
 * - Handles cross-tab synchronization and device management
 * - Ensures authentication resilience across network interruptions
 */

import { logger } from "@/utils/logger";
import { TokenService } from "./TokenService";
import { PrimusAuthService } from "./PrimusAuthService";
import {
  getConnectionRecoveryService,
  RecoveryEvent,
  RecoveryState,
} from "./ConnectionRecoveryService";
import { getFallbackApiService } from "./FallbackApiService";
import { EventEmitter } from "@/utils/EventEmitter";
import { AuthEventType } from "@/types/auth";
import { SOCKET_CONFIG } from "@/config/socket";

export enum AuthMonitorStatus {
  INITIALIZING = "initializing",
  CONNECTED = "connected",
  RECONNECTING = "reconnecting",
  FALLBACK = "fallback",
  OFFLINE = "offline",
  ERROR = "error",
}

export class AuthMonitorService {
  private tokenService: TokenService;
  private primusService: PrimusAuthService;
  private eventEmitter: EventEmitter;
  private status: AuthMonitorStatus = AuthMonitorStatus.INITIALIZING;
  private deviceId: string = "";
  private tabId: string = "";
  private isLeaderTab: boolean = false;
  private recoveryService: any = null; // Will be initialized later
  private fallbackService: any = null; // Will be initialized later
  private visibilityChangeHandler: any = null;
  private onlineHandler: any = null;
  private offlineHandler: any = null;
  private sessionCheckIntervalId: number | null = null;
  private lastActivity: number = Date.now();
  private isDestroyed: boolean = false;

  constructor(tokenService: TokenService, primusService: PrimusAuthService) {
    // Store instance in window for global access
    if (typeof window !== "undefined") {
      if ((window as any).__authMonitorService) {
        logger.debug(
          "AuthMonitorService already initialized, returning existing instance"
        );
        return (window as any).__authMonitorService;
      }
      (window as any).__authMonitorService = this;
    }

    this.tokenService = tokenService;
    this.primusService = primusService;
    this.eventEmitter = new EventEmitter();

    // Initialize device and tab IDs
    this.deviceId =
      sessionStorage.getItem("device_fingerprint") ||
      localStorage.getItem("device_fingerprint") ||
      `device_${Math.random().toString(36).substring(2, 10)}`;

    this.tabId =
      sessionStorage.getItem("tab_id") ||
      `tab_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;

    // Store IDs for future use
    sessionStorage.setItem("device_fingerprint", this.deviceId);
    sessionStorage.setItem("tab_id", this.tabId);

    // Check if this is the leader tab
    this.checkLeaderStatus();

    // Initialize services
    this.initializeServices();

    // Set up event listeners
    this.setupEventListeners();

    // Set up visibility change handler
    this.setupVisibilityHandler();

    // Set up online/offline handlers
    this.setupOnlineOfflineHandlers();

    // Start session check interval
    this.startSessionCheck();

    logger.info("Auth monitor service initialized", {
      deviceId: this.deviceId,
      tabId: this.tabId,
      isLeaderTab: this.isLeaderTab,
    });
  }

  /**
   * Initialize services
   */
  private initializeServices(): void {
    try {
      // Initialize ConnectionRecoveryService
      this.recoveryService = getConnectionRecoveryService(
        this.tokenService,
        this.primusService
      );

      // Initialize FallbackApiService
      this.fallbackService = getFallbackApiService(
        this.tokenService,
        this.eventEmitter
      );

      logger.debug("Auth monitor services initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize auth monitor services", error);
    }
  }

  /**
   * Check if this tab is the leader tab
   * Enhanced with stale leader detection
   */
  // Flag to prevent multiple elections at once
  private isElectionInProgress: boolean = false;

  private checkLeaderStatus(): void {
    try {
      const leaderData = localStorage.getItem("auth_leader_tab");
      if (!leaderData) {
        // No leader exists, check if we're the only tab
        this.isLeaderTab = false;
        logger.debug("No leader tab information found in localStorage", {
          tabId: this.tabId,
          deviceId: this.deviceId,
        });

        // If we're not already forcing an election, do it now
        if (!this.isElectionInProgress) {
          this.isElectionInProgress = true;

          // Force a leader election
          logger.info("No leader found, forcing election", {
            tabId: this.tabId,
            deviceId: this.deviceId,
          });

          this.forceLeaderElection();

          // Reset the election flag after a delay
          setTimeout(() => {
            this.isElectionInProgress = false;
          }, 10000); // 10 seconds
        }

        return;
      }

      const data = JSON.parse(leaderData);

      // Check if leader data is stale (older than 30 seconds)
      const now = Date.now();
      const leaderTimestamp = data.timestamp || 0;
      const isStaleLeader = now - leaderTimestamp > 30000; // 30 seconds

      if (isStaleLeader) {
        // Leader is stale, remove it and force new election
        logger.warn(
          "Detected stale leader, removing and forcing new election",
          {
            staleLeaderId: data.tabId,
            timestamp: new Date(leaderTimestamp).toISOString(),
            age: (now - leaderTimestamp) / 1000 + " seconds",
            tabId: this.tabId,
            deviceId: this.deviceId,
          }
        );

        // Remove stale leader
        localStorage.removeItem("auth_leader_tab");

        // Force new election by setting this tab as leader
        if (!this.isElectionInProgress) {
          this.isElectionInProgress = true;

          if (
            this.primusService &&
            typeof this.primusService.forceLeaderElection === "function"
          ) {
            this.primusService.forceLeaderElection();
          } else {
            // Fallback to our own implementation
            this.forceLeaderElection();
          }

          // Reset the election flag after a delay
          setTimeout(() => {
            this.isElectionInProgress = false;
          }, 10000); // 10 seconds
        }

        this.isLeaderTab = false;
        return;
      }

      // Ensure both values are strings for comparison
      const storedTabId = String(data.tabId || "");
      const currentTabId = String(this.tabId || "");

      // Compare as strings
      this.isLeaderTab = storedTabId === currentTabId;

      logger.debug(
        `Leader status checked: ${
          this.isLeaderTab ? "Leader" : "Follower"
        } tab`,
        {
          tabId: currentTabId,
          leaderId: storedTabId,
          comparison: `'${storedTabId}' === '${currentTabId}' is ${
            storedTabId === currentTabId
          }`,
          timestamp: new Date(data.timestamp).toISOString(),
          age: (now - leaderTimestamp) / 1000 + " seconds",
          deviceId: this.deviceId,
        }
      );

      // If there's a mismatch, log detailed comparison
      if (!this.isLeaderTab) {
        logger.debug("Tab ID comparison details:", {
          storedTabIdLength: storedTabId.length,
          currentTabIdLength: currentTabId.length,
          storedTabIdType: typeof storedTabId,
          currentTabIdType: typeof currentTabId,
        });
      }
    } catch (error) {
      this.isLeaderTab = false;
      logger.error("Error checking leader status", error);
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Listen for recovery events
    if (this.recoveryService && typeof this.recoveryService.on === "function") {
      this.recoveryService.on(
        RecoveryEvent.CONNECTION_LOST,
        this.handleConnectionLost.bind(this)
      );
      this.recoveryService.on(
        RecoveryEvent.RECONNECTING,
        this.handleReconnecting.bind(this)
      );
      this.recoveryService.on(
        RecoveryEvent.RECONNECTED,
        this.handleReconnected.bind(this)
      );
      this.recoveryService.on(
        RecoveryEvent.FALLBACK_ACTIVATED,
        this.handleFallbackActivated.bind(this)
      );
      this.recoveryService.on(
        RecoveryEvent.RECOVERY_FAILED,
        this.handleRecoveryFailed.bind(this)
      );
      this.recoveryService.on(
        RecoveryEvent.OFFLINE_MODE,
        this.handleOfflineMode.bind(this)
      );
      this.recoveryService.on(
        RecoveryEvent.ONLINE_RESTORED,
        this.handleOnlineRestored.bind(this)
      );
    }

    // Listen for Primus events
    if (this.primusService && typeof this.primusService.on === "function") {
      this.primusService.on(
        AuthEventType.CONNECTED,
        this.handlePrimusConnected.bind(this)
      );
      this.primusService.on(
        AuthEventType.DISCONNECTED,
        this.handlePrimusDisconnected.bind(this)
      );
      this.primusService.on(
        AuthEventType.AUTH_ERROR,
        this.handlePrimusAuthError.bind(this)
      );
      this.primusService.on(
        AuthEventType.TOKEN_EXPIRING,
        this.handleTokenExpiring.bind(this)
      );
      this.primusService.on(
        AuthEventType.SESSION_EXPIRED,
        this.handleSessionExpired.bind(this)
      );
      // Add handler for leader election
      this.primusService.on(
        AuthEventType.LEADER_ELECTED,
        this.handleLeaderElected.bind(this)
      );
    } else {
      logger.warn(
        "PrimusService does not have on method, event listeners not set up"
      );
    }

    // Listen for token events
    if (this.tokenService && typeof this.tokenService.on === "function") {
      this.tokenService.on(
        "tokenRefreshed",
        this.handleTokenRefreshed.bind(this)
      );
      this.tokenService.on(
        "tokenRefreshError",
        this.handleTokenRefreshError.bind(this)
      );
      this.tokenService.on(
        "tokensCleared",
        this.handleTokensCleared.bind(this)
      );
    } else {
      logger.warn(
        "TokenService does not have on method, event listeners not set up"
      );
    }
  }

  /**
   * Set up visibility change handler
   */
  private setupVisibilityHandler(): void {
    this.visibilityChangeHandler = () => {
      if (document.visibilityState === "visible") {
        this.handleVisibilityVisible();
      } else {
        this.handleVisibilityHidden();
      }
    };

    document.addEventListener("visibilitychange", this.visibilityChangeHandler);
  }

  /**
   * Set up online/offline handlers
   */
  private setupOnlineOfflineHandlers(): void {
    this.onlineHandler = () => {
      this.handleOnline();
    };

    this.offlineHandler = () => {
      this.handleOffline();
    };

    window.addEventListener("online", this.onlineHandler);
    window.addEventListener("offline", this.offlineHandler);
  }

  /**
   * Start session check interval
   */
  private startSessionCheck(): void {
    // Clear any existing interval
    if (this.sessionCheckIntervalId) {
      clearInterval(this.sessionCheckIntervalId);
    }

    // Set up session check interval (every 5 minutes)
    this.sessionCheckIntervalId = window.setInterval(() => {
      this.checkSession();
    }, 5 * 60 * 1000);
  }

  /**
   * Check session
   */
  private async checkSession(): Promise<void> {
    // Skip if not the leader tab
    this.checkLeaderStatus();
    if (!this.isLeaderTab) return;

    // Skip if offline
    if (!navigator.onLine) return;

    // Skip if destroyed
    if (this.isDestroyed) return;

    try {
      // Check if we have tokens
      if (!this.tokenService.hasTokens()) {
        logger.debug("Skipping session check - no tokens");
        return;
      }

      // Check session based on current status
      if (this.status === AuthMonitorStatus.CONNECTED) {
        // If connected, use Primus
        this.primusService.checkSession();
      } else if (this.status === AuthMonitorStatus.FALLBACK) {
        // If in fallback mode, use fallback service
        const isValid = await this.fallbackService.validateSession();
        if (!isValid) {
          this.handleSessionExpired({
            timestamp: Date.now(),
            reason: "session_check_failed",
            source: "fallback_service",
          });
        }
      } else if (this.status === AuthMonitorStatus.OFFLINE) {
        // If offline, check if we're actually online now
        if (navigator.onLine) {
          this.handleOnline();
        }
      }
    } catch (error) {
      logger.error("Error checking session", error);
    }
  }

  /**
   * Handle connection lost
   */
  private handleConnectionLost(data: any): void {
    logger.warn("Connection lost", data);

    // Update status
    this.setStatus(AuthMonitorStatus.RECONNECTING);

    // Emit event
    this.eventEmitter.emit(AuthEventType.DISCONNECTED, {
      timestamp: Date.now(),
      reason: "connection_lost",
      data,
    });
  }

  /**
   * Handle reconnecting
   */
  private handleReconnecting(data: any): void {
    logger.info("Reconnecting", data);

    // Update status
    this.setStatus(AuthMonitorStatus.RECONNECTING);

    // Emit event
    this.eventEmitter.emit(AuthEventType.RECONNECTING, {
      timestamp: Date.now(),
      attempt: data.recoveryAttempts,
      data,
    });
  }

  /**
   * Handle reconnected
   */
  private handleReconnected(data: any): void {
    logger.info("Reconnected", data);

    // Update status
    this.setStatus(AuthMonitorStatus.CONNECTED);

    // Emit event
    this.eventEmitter.emit(AuthEventType.CONNECTED, {
      timestamp: Date.now(),
      data,
    });

    // Stop fallback polling if active
    if (this.fallbackService) {
      this.fallbackService.stopPolling();
    }
  }

  /**
   * Handle fallback activated
   */
  private handleFallbackActivated(data: any): void {
    logger.info("Fallback mode activated", data);

    // Update status
    this.setStatus(AuthMonitorStatus.FALLBACK);

    // Emit event
    this.eventEmitter.emit(AuthEventType.FALLBACK_ACTIVATED, {
      timestamp: Date.now(),
      data,
    });

    // Start fallback polling
    if (this.fallbackService) {
      this.fallbackService.startPolling();
    }
  }

  /**
   * Handle recovery failed
   */
  private handleRecoveryFailed(data: any): void {
    logger.error("Recovery failed", data);

    // Update status
    this.setStatus(AuthMonitorStatus.ERROR);

    // Emit event
    this.eventEmitter.emit(AuthEventType.RECOVERY_FAILED, {
      timestamp: Date.now(),
      data,
    });
  }

  /**
   * Handle offline mode
   */
  private handleOfflineMode(data: any): void {
    logger.info("Offline mode activated", data);

    // Update status
    this.setStatus(AuthMonitorStatus.OFFLINE);

    // Emit event
    this.eventEmitter.emit(AuthEventType.OFFLINE_MODE, {
      timestamp: Date.now(),
      data,
    });

    // Cache tokens for offline use
    if (this.tokenService.hasTokens()) {
      this.tokenService.cacheTokensForOffline();
    }
  }

  /**
   * Handle online restored
   */
  private handleOnlineRestored(data: any): void {
    logger.info("Online connection restored", data);

    // Update status based on recovery service state
    if (this.recoveryService) {
      const recoveryState = this.recoveryService.getState();

      if (recoveryState === RecoveryState.CONNECTED) {
        this.setStatus(AuthMonitorStatus.CONNECTED);
      } else if (recoveryState === RecoveryState.RECONNECTING) {
        this.setStatus(AuthMonitorStatus.RECONNECTING);
      } else if (recoveryState === RecoveryState.FALLBACK) {
        this.setStatus(AuthMonitorStatus.FALLBACK);
      } else {
        this.setStatus(AuthMonitorStatus.INITIALIZING);
      }
    } else {
      this.setStatus(AuthMonitorStatus.INITIALIZING);
    }

    // Emit event
    this.eventEmitter.emit(AuthEventType.ONLINE_RESTORED, {
      timestamp: Date.now(),
      data,
    });
  }

  /**
   * Handle Primus connected
   */
  private handlePrimusConnected(data: any): void {
    logger.info("Primus connected", data);

    // Update status
    this.setStatus(AuthMonitorStatus.CONNECTED);

    // Emit event
    this.eventEmitter.emit(AuthEventType.CONNECTED, {
      timestamp: Date.now(),
      source: "primus",
      data,
    });

    // Stop fallback polling if active
    if (this.fallbackService) {
      this.fallbackService.stopPolling();
    }
  }

  /**
   * Handle Primus disconnected
   */
  private handlePrimusDisconnected(data: any): void {
    logger.info("Primus disconnected", data);

    // Let recovery service handle reconnection
    if (
      this.recoveryService &&
      this.recoveryService.getState() === RecoveryState.CONNECTED
    ) {
      this.recoveryService.forceReconnect();
    }
  }

  /**
   * Handle Primus auth error
   */
  private handlePrimusAuthError(data: any): void {
    logger.error("Primus auth error", data);

    // Let recovery service handle reconnection
    if (
      this.recoveryService &&
      this.recoveryService.getState() === RecoveryState.CONNECTED
    ) {
      this.recoveryService.forceReconnect();
    }
  }

  /**
   * Handle token expiring
   */
  private handleTokenExpiring(data: any): void {
    logger.info("Token expiring", data);

    // Only the leader tab should refresh the token
    this.checkLeaderStatus();
    if (!this.isLeaderTab) return;

    // Refresh token
    this.tokenService
      .refreshToken()
      .then((success) => {
        logger.info("Token refresh after expiring notification", { success });
      })
      .catch((error) => {
        logger.error(
          "Failed to refresh token after expiring notification",
          error
        );
      });
  }

  /**
   * Handle session expired
   */
  private handleSessionExpired(data: any): void {
    logger.warn("Session expired", data);

    // Clear tokens
    this.tokenService.clearTokens();

    // Emit event
    this.eventEmitter.emit(AuthEventType.SESSION_EXPIRED, {
      timestamp: Date.now(),
      data,
    });

    // Redirect to login
    window.location.href = `/login?reason=session_expired&t=${Date.now()}`;
  }

  /**
   * Handle token refreshed
   */
  private handleTokenRefreshed(data: any): void {
    logger.info("Token refreshed", data);

    // Emit event
    this.eventEmitter.emit(AuthEventType.TOKEN_REFRESHED, {
      timestamp: Date.now(),
      data,
    });
  }

  /**
   * Handle token refresh error
   */
  private handleTokenRefreshError(data: any): void {
    logger.error("Token refresh error", data);

    // Emit event
    this.eventEmitter.emit(AuthEventType.TOKEN_REFRESH_ERROR, {
      timestamp: Date.now(),
      data,
    });
  }

  /**
   * Handle tokens cleared
   */
  private handleTokensCleared(data: any): void {
    logger.info("Tokens cleared", data);

    // Emit event
    this.eventEmitter.emit(AuthEventType.TOKENS_CLEARED, {
      timestamp: Date.now(),
      data,
    });
  }

  /**
   * Handle leader elected event from backend
   * This is called when the backend elects a leader tab
   */
  private handleLeaderElected(data: any): void {
    // Extract tabId from the data
    const electedTabId = data.tabId || data.leaderId;

    if (!electedTabId) {
      logger.warn("Leader elected event received without tabId", data);
      return;
    }

    // Update leader status based on whether this tab was elected
    const wasLeader = this.isLeaderTab;
    this.isLeaderTab = electedTabId === this.tabId;

    // Log the leader election
    logger.info(
      `Leader elected: ${electedTabId} (this tab: ${
        this.isLeaderTab ? "is leader" : "is follower"
      })`,
      {
        electedTabId,
        thisTabId: this.tabId,
        wasLeader,
        isLeader: this.isLeaderTab,
        deviceId: this.deviceId,
      }
    );

    // Store leader info in localStorage for cross-tab awareness
    try {
      localStorage.setItem(
        "auth_leader_tab",
        JSON.stringify({
          tabId: electedTabId,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      logger.error("Error storing leader info in localStorage", error);
    }

    // Emit event for other components
    this.eventEmitter.emit(AuthEventType.LEADER_ELECTED, {
      tabId: electedTabId,
      isLeader: this.isLeaderTab,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle visibility visible
   */
  private handleVisibilityVisible(): void {
    logger.debug("Tab became visible");

    // Update last activity
    this.lastActivity = Date.now();

    // Check session
    this.checkSession();
  }

  /**
   * Handle visibility hidden
   */
  private handleVisibilityHidden(): void {
    logger.debug("Tab became hidden");

    // Update last activity
    this.lastActivity = Date.now();
  }

  /**
   * Handle online
   */
  private handleOnline(): void {
    logger.info("Browser went online");

    // Let recovery service handle reconnection
    if (this.recoveryService) {
      const recoveryState = this.recoveryService.getState();

      if (recoveryState === RecoveryState.OFFLINE) {
        this.recoveryService.forceReconnect();
      }
    }
  }

  /**
   * Handle offline
   */
  private handleOffline(): void {
    logger.info("Browser went offline");

    // Let recovery service handle offline mode
    if (
      this.recoveryService &&
      this.recoveryService.getState() !== RecoveryState.OFFLINE
    ) {
      // Force offline mode
      this.recoveryService.forceOfflineMode();
    }
  }

  /**
   * Set status
   */
  private setStatus(status: AuthMonitorStatus): void {
    const previousStatus = this.status;
    this.status = status;

    // Log status change
    logger.info(`Auth monitor status changed: ${previousStatus} -> ${status}`, {
      deviceId: this.deviceId,
      tabId: this.tabId,
      isLeader: this.isLeaderTab,
    });

    // Emit status change event
    this.eventEmitter.emit(AuthEventType.STATUS_CHANGED, {
      previousStatus,
      currentStatus: status,
      timestamp: Date.now(),
    });
  }

  /**
   * Get status
   */
  public getStatus(): AuthMonitorStatus {
    return this.status;
  }

  /**
   * Force a new leader election
   * This is called when a stale leader is detected
   */
  public forceLeaderElection(): void {
    logger.info("Forcing new leader election", {
      tabId: this.tabId,
      deviceId: this.deviceId,
    });

    // Clear any stored leader information
    try {
      localStorage.removeItem("auth_leader_tab");
    } catch (error) {
      logger.error("Error removing leader info from localStorage", error);
    }

    // Use PrimusAuthService to force election if available
    if (
      this.primusService &&
      typeof this.primusService.forceLeaderElection === "function"
    ) {
      this.primusService.forceLeaderElection();
    } else {
      logger.warn("PrimusAuthService.forceLeaderElection not available");

      // Set this tab as leader as fallback
      try {
        localStorage.setItem(
          "auth_leader_tab",
          JSON.stringify({
            tabId: this.tabId,
            timestamp: Date.now(),
            reason: "forced_election_fallback",
          })
        );

        // Update leader status
        this.isLeaderTab = true;

        // Emit event
        this.eventEmitter.emit(AuthEventType.LEADER_ELECTED, {
          tabId: this.tabId,
          isLeader: true,
          timestamp: Date.now(),
          reason: "forced_election_fallback",
        });

        logger.info("Set this tab as leader through fallback mechanism", {
          tabId: this.tabId,
          deviceId: this.deviceId,
        });
      } catch (error) {
        logger.error("Error setting leader info in localStorage", error);
      }
    }
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.status === AuthMonitorStatus.CONNECTED;
  }

  /**
   * Check if offline
   */
  public isOffline(): boolean {
    return this.status === AuthMonitorStatus.OFFLINE;
  }

  /**
   * Check if in fallback mode
   */
  public isFallback(): boolean {
    return this.status === AuthMonitorStatus.FALLBACK;
  }

  /**
   * Add event listener
   */
  public on(event: string, callback: Function): void {
    this.eventEmitter.on(event, callback);
  }

  /**
   * Remove event listener
   */
  public off(event: string, callback: Function): void {
    this.eventEmitter.off(event, callback);
  }

  /**
   * Force reconnection
   */
  public forceReconnect(): void {
    logger.info("Forcing reconnection");

    if (this.recoveryService) {
      this.recoveryService.forceReconnect();
    } else {
      // Fallback to direct Primus reconnection
      this.primusService.reconnect();
    }
  }

  /**
   * Force fallback mode
   */
  public forceFallback(): void {
    logger.info("Forcing fallback mode");

    if (this.recoveryService) {
      this.recoveryService.forceFallbackMode();
    }
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.isDestroyed = true;

    // Remove event listeners
    if (this.visibilityChangeHandler) {
      document.removeEventListener(
        "visibilitychange",
        this.visibilityChangeHandler
      );
    }

    if (this.onlineHandler) {
      window.removeEventListener("online", this.onlineHandler);
    }

    if (this.offlineHandler) {
      window.removeEventListener("offline", this.offlineHandler);
    }

    // Clear intervals
    if (this.sessionCheckIntervalId) {
      clearInterval(this.sessionCheckIntervalId);
      this.sessionCheckIntervalId = null;
    }

    // Destroy services
    if (this.recoveryService) {
      this.recoveryService.destroy();
    }

    if (this.fallbackService) {
      this.fallbackService.destroy();
    }

    logger.info("Auth monitor service destroyed");
  }
}

// Create singleton instance
let authMonitorService: AuthMonitorService | null = null;

export function getAuthMonitorService(
  tokenService?: TokenService,
  primusService?: PrimusAuthService
): AuthMonitorService {
  // If we already have an instance, return it
  if (authMonitorService) {
    return authMonitorService;
  }

  // If we don't have an instance but have the required services, create one
  if (tokenService && primusService) {
    authMonitorService = new AuthMonitorService(tokenService, primusService);
    return authMonitorService;
  }

  // If we're called without parameters but have a window global instance, use that
  if (typeof window !== "undefined" && (window as any).__authMonitorService) {
    return (window as any).__authMonitorService;
  }

  // If we still don't have an instance, throw an error
  throw new Error(
    "AuthMonitorService not initialized - provide tokenService and primusService"
  );
}
