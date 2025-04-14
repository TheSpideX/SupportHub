/**
 * PrimusAuthService
 * Replaces WebSocketAuthService with Primus for bidirectional communication
 * Enhanced with improved resilience and recovery mechanisms
 */

import { EventEmitter } from "@/utils/EventEmitter";
import { logger } from "@/utils/logger";
import { TokenService } from "./TokenService";
import { SecurityService } from "./SecurityService";
import { SOCKET_CONFIG } from "@/config/socket";
import {
  getConnectionRecoveryService,
  RecoveryEvent,
  RecoveryState,
} from "./ConnectionRecoveryService";

// Event types
export enum AuthEventType {
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  AUTH_SUCCESS = "auth:success",
  AUTH_ERROR = "auth:error",
  SESSION_EXPIRED = "session:expired",
  SESSION_TIMEOUT_WARNING = "session:timeout_warning",
  TOKEN_REFRESHED = "token:refreshed",
  TOKEN_REFRESH_ERROR = "token:refresh_error",
  TOKEN_EXPIRING = "token:expiring",
  USER_ACTIVITY = "user:activity",
  LEADER_ELECTED = "leader:elected",
  LEADER_FAILED = "leader:failed",
  DEVICE_CONNECTED = "device:connected",
  DEVICE_DISCONNECTED = "device:disconnected",
  ROOM_JOINED = "room:joined",
  SECURITY_EVENT = "security:event",
  TAB_REGISTERED = "tab:registered",

  // Custom events for session management
  SESSION_UPDATE = "session:update",
  ACTIVITY_UPDATE = "activity:update",
}

// Room types
export enum RoomType {
  USER = 0,
  DEVICE = 1,
  SESSION = 2,
  TAB = 3,
}

// Service configuration
interface PrimusAuthServiceConfig {
  url: string;
  path: string;
  autoConnect: boolean;
  reconnection: boolean;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  reconnectionDelayMax: number;
  timeout: number;
  withCredentials: boolean;
}

// Default configuration
const defaultConfig: PrimusAuthServiceConfig = {
  url: SOCKET_CONFIG.SERVER.URL,
  path: SOCKET_CONFIG.SERVER.PATH,
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
  withCredentials: true,
};

/**
 * PrimusAuthService class
 * Handles WebSocket authentication using Primus
 */
export class PrimusAuthService {
  private static instance: PrimusAuthService | null = null;
  private config: PrimusAuthServiceConfig;
  private primus: any | null = null;
  private tokenService: TokenService | null = null;
  private securityService: SecurityService | null = null;
  private eventEmitter: EventEmitter;
  private deviceId: string = "";
  private tabId: string = "";
  private csrfToken: string = "";
  private isLeaderTab: boolean = false;
  private status: string = "disconnected";
  private reconnectAttempts: number = 0;
  // No heartbeat interval in event-based system
  private leaderPingInterval: any = null;
  private lastLeaderPingAck: number = 0;
  private rooms: Record<RoomType, string | null> = {
    [RoomType.USER]: null,
    [RoomType.DEVICE]: null,
    [RoomType.SESSION]: null,
    [RoomType.TAB]: null,
  };

  /**
   * Get singleton instance
   */
  public static getInstance(
    config?: Partial<PrimusAuthServiceConfig>,
    tokenService?: TokenService,
    securityService?: SecurityService
  ): PrimusAuthService {
    if (!PrimusAuthService.instance) {
      PrimusAuthService.instance = new PrimusAuthService(
        config,
        tokenService,
        securityService
      );
    }
    return PrimusAuthService.instance;
  }

  /**
   * Constructor
   */
  private constructor(
    config?: Partial<PrimusAuthServiceConfig>,
    tokenService?: TokenService,
    securityService?: SecurityService
  ) {
    this.config = { ...defaultConfig, ...config };
    this.eventEmitter = new EventEmitter();
    this.tokenService = tokenService || null;
    this.securityService = securityService || null;

    // Get existing tab ID from sessionStorage or create a new one
    const storedTabId = sessionStorage.getItem("tab_id");
    if (storedTabId) {
      this.tabId = storedTabId;
      logger.debug("Using existing tab ID from sessionStorage", {
        tabId: this.tabId,
        component: "PrimusAuthService",
      });
    } else {
      this.tabId = `tab_${Math.random()
        .toString(36)
        .substring(2, 9)}_${Date.now()}`;
      // Store the tab ID in sessionStorage for persistence across page reloads
      sessionStorage.setItem("tab_id", this.tabId);
      logger.debug("Generated new tab ID and stored in sessionStorage", {
        tabId: this.tabId,
        component: "PrimusAuthService",
      });
    }

    // Initialize device ID
    this.initializeDeviceId();

    // Set up cross-tab communication
    this.setupCrossTabCommunication();

    // Load Primus client library
    this.loadPrimusLibrary();

    // Set up auth state change listener
    this.setupAuthStateListener();
  }

  /**
   * Initialize device ID
   */
  private async initializeDeviceId(): Promise<void> {
    // First, check if we have a device ID in localStorage
    const storedDeviceId = localStorage.getItem("device_fingerprint");

    if (storedDeviceId) {
      this.deviceId = storedDeviceId;
      logger.debug("Using existing device ID from localStorage", {
        deviceId: this.deviceId,
        component: "PrimusAuthService",
      });
      return;
    }

    // If no stored device ID, try to get one from the security service
    if (this.securityService) {
      try {
        this.deviceId = await this.securityService.getDeviceFingerprint();
        // Store the device ID for future use
        localStorage.setItem("device_fingerprint", this.deviceId);
        logger.debug(
          "Got device ID from security service and stored in localStorage",
          {
            deviceId: this.deviceId,
            component: "PrimusAuthService",
          }
        );
      } catch (error) {
        logger.error("Failed to get device fingerprint", {
          error,
          component: "PrimusAuthService",
        });
        this.generateFallbackDeviceId();
      }
    } else {
      this.generateFallbackDeviceId();
    }
  }

  /**
   * Generate a fallback device ID and store it
   */
  private generateFallbackDeviceId(): void {
    // Generate a fallback device ID that's stable across page reloads
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.colorDepth,
      screen.width + "x" + screen.height,
      new Date().getTimezoneOffset(),
    ].join("|");

    // Create a simple hash
    let hash = 0;
    for (let i = 0; i < components.length; i++) {
      const char = components.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    this.deviceId = `device_${Math.abs(hash).toString(36)}`;

    // Store the device ID for future use
    localStorage.setItem("device_fingerprint", this.deviceId);

    logger.debug("Generated fallback device ID and stored in localStorage", {
      deviceId: this.deviceId,
      component: "PrimusAuthService",
    });
  }

  /**
   * Set up cross-tab communication using localStorage events
   * This is a key part of the event-based system for cross-tab synchronization
   */
  private setupCrossTabCommunication(): void {
    // Listen for storage events from other tabs
    window.addEventListener("storage", (event) => {
      // Handle leader tab changes
      if (event.key === `auth_leader_tab_${this.deviceId}`) {
        this.handleLeaderStorageChange(event);
      }

      // Handle auth state changes
      if (event.key === `auth_state_${this.deviceId}`) {
        this.handleAuthStateStorageChange(event);
      }

      // Handle cross-tab events
      if (event.key === `auth_event_${this.deviceId}`) {
        this.handleCrossTabEvent(event);
      }
    });

    // Set up visibility change detection
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        this.handleVisibilityChange();
      });
    }

    logger.debug("Cross-tab communication set up", {
      component: "PrimusAuthService",
      tabId: this.tabId,
      deviceId: this.deviceId,
    });
  }

  /**
   * Load Primus client library
   */
  private loadPrimusLibrary(): void {
    // Check if Primus is available in the window object
    if (typeof window !== "undefined") {
      if (!(window as any).Primus) {
        logger.error(
          "Primus client library not found. Make sure to include it in your HTML.",
          {
            component: "PrimusAuthService",
          }
        );

        // Add a listener to check when Primus becomes available
        const checkPrimus = setInterval(() => {
          if ((window as any).Primus) {
            logger.info("Primus client library now available", {
              component: "PrimusAuthService",
            });
            clearInterval(checkPrimus);
          }
        }, 1000);
      } else {
        logger.info("Primus client library found", {
          component: "PrimusAuthService",
        });
      }
    }
  }

  /**
   * Check if user is authenticated by checking the Redux store
   * @returns {boolean} Whether the user is authenticated
   */
  private isUserAuthenticated(): boolean {
    try {
      // Check if Redux store is available
      if (typeof window !== "undefined" && (window as any).__REDUX_STORE__) {
        const store = (window as any).__REDUX_STORE__;
        const state = store.getState();

        // Check if auth state exists and user is authenticated
        if (state && state.auth) {
          const isAuthenticated = state.auth.isAuthenticated;

          logger.debug("Checked authentication state from Redux store", {
            isAuthenticated,
            component: "PrimusAuthService",
          });

          return !!isAuthenticated;
        }
      }

      // If we can't access the store, check if we have a token as fallback
      if (this.tokenService) {
        const hasToken = this.tokenService.hasValidToken();
        logger.debug("Fallback authentication check using TokenService", {
          hasToken,
          component: "PrimusAuthService",
        });
        return hasToken;
      }

      // Default to false if we can't determine auth state
      return false;
    } catch (error) {
      logger.error("Error checking authentication state", {
        error,
        component: "PrimusAuthService",
      });
      return false;
    }
  }

  /**
   * Connect to the server
   */
  public connect(): void {
    // First check if the user is authenticated
    if (!this.isUserAuthenticated()) {
      logger.warn("Cannot connect: User is not authenticated", {
        component: "PrimusAuthService",
      });
      return;
    }

    if (this.primus && this.status === "connected") {
      logger.debug("Already connected", {
        component: "PrimusAuthService",
      });
      return;
    }

    // Get CSRF token if available
    if (this.tokenService) {
      try {
        // Check if getCsrfToken method exists
        if (typeof this.tokenService.getCsrfToken === "function") {
          this.csrfToken = this.tokenService.getCsrfToken() || "";
        } else {
          // Fallback: try to get CSRF token from cookies directly
          logger.warn(
            "TokenService.getCsrfToken is not a function, using fallback"
          );
          this.csrfToken =
            document.cookie
              .split("; ")
              .find((row) => row.startsWith("csrf_token="))
              ?.split("=")[1] || "";
        }
      } catch (error) {
        logger.error("Error getting CSRF token", error);
        // Fallback: try to get CSRF token from cookies directly
        this.csrfToken =
          document.cookie
            .split("; ")
            .find((row) => row.startsWith("csrf_token="))
            ?.split("=")[1] || "";
      }
    }

    // Get security context if available
    if (this.securityService) {
      // We'll use this in the future if needed
      this.securityService.getSecurityContext();
    }

    const url = this.config.url;

    // Add more detailed logging for debugging
    logger.info("Primus connection details", {
      url: url,
      path: this.config.path,
      withCredentials: this.config.withCredentials,
      deviceId: this.deviceId,
      tabId: this.tabId,
      hasCsrfToken: !!this.csrfToken,
      component: "PrimusAuthService",
    });

    // Check if Primus is available
    if (typeof window === "undefined" || !(window as any).Primus) {
      logger.error("Cannot connect: Primus client library not available", {
        component: "PrimusAuthService",
      });
      return;
    }

    // Create Primus connection
    try {
      // Create connection options
      const options = {
        pathname: this.config.path,
        reconnect: {
          max: this.config.reconnectionAttempts,
          min: this.config.reconnectionDelay,
          retries: this.config.reconnectionAttempts,
          factor: 1.5,
        },
        timeout: this.config.timeout,
        strategy: ["websocket", "polling"],
        manual: !this.config.autoConnect,
        withCredentials: this.config.withCredentials,
        transport: {
          headers: {
            [SOCKET_CONFIG.CONNECTION.SECURITY.CSRF_HEADER]:
              this.csrfToken || "",
            [SOCKET_CONFIG.CONNECTION.SECURITY.DEVICE_ID_HEADER]:
              this.deviceId || "",
            [SOCKET_CONFIG.CONNECTION.SECURITY.TAB_ID_HEADER]: this.tabId,
            [SOCKET_CONFIG.CONNECTION.SECURITY.TIMESTAMP_HEADER]:
              Date.now().toString(),
          },
        },
      };

      // Log connection attempt
      logger.debug("Creating Primus connection with options", {
        url,
        options,
        component: "PrimusAuthService",
      });

      // Create connection
      this.primus = new (window as any).Primus(url, options);

      // Set up event handlers
      this.setupEventHandlers();

      // Open the connection if not auto-connecting
      if (!this.config.autoConnect) {
        this.primus.open();
      }

      // Send auth data
      this.authenticate();

      // Start heartbeat
      this.startHeartbeat();
    } catch (error) {
      logger.error("Failed to create Primus connection", {
        error,
        component: "PrimusAuthService",
      });

      // Try to reconnect after a delay
      setTimeout(() => {
        logger.info("Attempting to reconnect after connection failure", {
          component: "PrimusAuthService",
        });
        this.connect();
      }, 5000);
    }
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    if (!this.primus) return;

    // Add debug logging for all events
    const originalOn = this.primus.on;
    this.primus.on = (event: string, listener: any) => {
      const wrappedListener = (...args: any[]) => {
        logger.debug(`Primus event received: ${event}`, {
          args:
            args.length > 0
              ? JSON.stringify(args[0]).substring(0, 200)
              : "none",
          component: "PrimusAuthService",
        });
        return listener(...args);
      };
      return originalOn.call(this.primus, event, wrappedListener);
    };

    // Connection events
    this.primus.on("open", this.handleConnect.bind(this));
    this.primus.on("end", this.handleDisconnect.bind(this));
    this.primus.on("error", (error: any) => {
      // Enhanced error logging
      logger.error("Primus connection error", {
        error: error.message || String(error),
        type: error.type || "unknown",
        details: JSON.stringify(error),
        component: "PrimusAuthService",
      });
      this.handleConnectError(error);
    });

    // Authentication events
    this.primus.on("auth:success", this.handleAuthSuccess.bind(this));
    this.primus.on("auth:error", (error: any) => {
      // Enhanced auth error logging
      logger.error("Primus authentication error", {
        error:
          typeof error === "string" ? error : error.message || String(error),
        code: error.code || "unknown",
        details: JSON.stringify(error),
        component: "PrimusAuthService",
      });
      this.handleAuthError(error);
    });

    // Session events
    this.primus.on("session:expired", this.handleSessionExpired.bind(this));
    this.primus.on(
      "session:timeout_warning",
      this.handleSessionTimeoutWarning.bind(this)
    );

    // Token events
    this.primus.on("token:refreshed", this.handleTokenRefreshed.bind(this));
    this.primus.on("token:expiring", this.handleTokenExpiring.bind(this));
    this.primus.on(
      "token:refresh_error",
      this.handleTokenRefreshError.bind(this)
    );

    // Room events
    this.primus.on("room:joined", this.handleRoomJoined.bind(this));

    // Leader election events
    this.primus.on("leader:elected", this.handleLeaderElected.bind(this));
    this.primus.on("leader:failed", this.handleLeaderFailed.bind(this));
    this.primus.on(
      "leader:ping_request",
      this.handleLeaderPingRequest.bind(this)
    );

    // Registration events
    this.primus.on(
      "auth:retry_registration",
      this.handleRetryRegistration.bind(this)
    );
    this.primus.on("auth:tab_registered", this.handleTabRegistered.bind(this));

    // Device events
    this.primus.on("device:info", this.handleDeviceInfo.bind(this));

    // Heartbeat
    this.primus.on("heartbeat", this.handleHeartbeat.bind(this));

    // Leader election events
    this.primus.on("leader:ping_ack", this.handleLeaderPingAck.bind(this));
    this.primus.on("leader:active", this.handleLeaderActive.bind(this));

    // Security events
    this.primus.on("security:event", this.handleSecurityEvent.bind(this));

    // Add a catch-all event handler for debugging
    if (typeof this.primus.on === "function") {
      this.primus.on("data", (data: any) => {
        logger.debug(
          `Primus data received: ${JSON.stringify(data).substring(0, 200)}`,
          {
            component: "PrimusAuthService",
          }
        );
      });
    }
  }

  /**
   * Authenticate with the server
   */
  private authenticate(): void {
    if (!this.primus || this.status !== "connected") {
      return;
    }

    // Send authentication data
    this.primus.write({
      event: "auth",
      payload: {
        deviceId: this.deviceId,
        tabId: this.tabId,
        isLeader: this.isLeaderTab,
        timestamp: Date.now(),
        csrfToken: this.csrfToken,
        // Add token as fallback (will be used if cookies fail)
        token: this.getAccessTokenFromCookie(),
      },
    });
  }

  /**
   * Handle connect event
   */
  private handleConnect(): void {
    logger.info("✅ Primus connection established successfully", {
      component: "PrimusAuthService",
      socketId: this.primus?.id || "unknown",
      deviceId: this.deviceId,
      tabId: this.tabId,
      timestamp: new Date().toISOString(),
      url: this.config.url,
      status: "connected",
    });

    // Update status
    this.status = "connected";
    this.reconnectAttempts = 0;

    // Emit event
    this.eventEmitter.emit(AuthEventType.CONNECTED, {
      timestamp: Date.now(),
    });

    // Authenticate
    this.authenticate();

    // Log connection details to console for visibility
    console.log(
      "%c✅ Primus WebSocket Connected",
      "color: green; font-weight: bold",
      {
        socketId: this.primus?.id,
        deviceId: this.deviceId,
        tabId: this.tabId,
        url: this.config.url,
      }
    );
  }

  /**
   * Handle disconnect event
   */
  private handleDisconnect(reason: string): void {
    logger.info(`Primus disconnected: ${reason}`, {
      component: "PrimusAuthService",
    });

    // Update status
    this.status = "disconnected";

    // Emit event
    this.eventEmitter.emit(AuthEventType.DISCONNECTED, {
      reason,
      timestamp: Date.now(),
    });

    // Clear rooms
    this.rooms = {
      [RoomType.USER]: null,
      [RoomType.DEVICE]: null,
      [RoomType.SESSION]: null,
      [RoomType.TAB]: null,
    };
  }

  /**
   * Handle connect error
   */
  private handleConnectError(error: Error): void {
    // Update status
    this.status = "error";
    this.reconnectAttempts++;

    // Emit event
    this.eventEmitter.emit(AuthEventType.AUTH_ERROR, {
      error,
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.reconnectionAttempts,
      timestamp: Date.now(),
    });

    // Check if the error is related to authentication
    const errorMsg = error.message.toLowerCase();
    const isAuthError =
      errorMsg.includes("authentication") ||
      errorMsg.includes("token") ||
      errorMsg.includes("unauthorized") ||
      errorMsg.includes("missing_token") ||
      errorMsg.includes("auth");

    // Use ConnectionRecoveryService to handle reconnection
    try {
      // Initialize ConnectionRecoveryService if not already done
      const recoveryService = getConnectionRecoveryService(
        this.tokenService,
        this
      );

      if (isAuthError) {
        logger.warn("Authentication error detected in Primus connection", {
          message: error.message,
          attempt: this.reconnectAttempts,
          component: "PrimusAuthService",
        });

        // Check if we've exceeded max reconnect attempts
        if (this.reconnectAttempts >= this.config.reconnectionAttempts) {
          logger.error(
            `Maximum reconnect attempts (${this.config.reconnectionAttempts}) reached`,
            {
              component: "PrimusAuthService",
            }
          );

          // Let ConnectionRecoveryService handle fallback
          recoveryService.on(RecoveryEvent.RECONNECTED, () => {
            // Try to reconnect after recovery
            setTimeout(() => this.connect(), 1000);
          });

          return;
        }

        // Try to refresh the token
        if (this.tokenService) {
          // Calculate backoff delay
          const backoffDelay = Math.min(
            this.config.reconnectionDelay *
              Math.pow(2, this.reconnectAttempts - 1),
            this.config.reconnectionDelayMax
          );

          logger.info(`Will attempt to refresh token in ${backoffDelay}ms`, {
            component: "PrimusAuthService",
          });

          // Add a delay before refreshing to avoid rapid retries
          setTimeout(() => {
            this.tokenService
              ?.refreshToken()
              .then(() => {
                logger.info("Token refreshed successfully, reconnecting", {
                  component: "PrimusAuthService",
                });

                // Wait a moment before reconnecting
                setTimeout(() => {
                  this.connect();
                }, 1000);
              })
              .catch((refreshError) => {
                logger.error("Failed to refresh token", {
                  error: refreshError,
                  component: "PrimusAuthService",
                });

                // Let ConnectionRecoveryService handle fallback
                if (recoveryService.getState() === RecoveryState.CONNECTED) {
                  recoveryService.forceReconnect();
                }
              });
          }, backoffDelay);
        } else {
          logger.error("Cannot refresh token: TokenService not available", {
            component: "PrimusAuthService",
          });

          // Let ConnectionRecoveryService handle fallback
          recoveryService.forceReconnect();
        }
      } else {
        // For non-auth errors, log the error and let ConnectionRecoveryService handle it
        logger.error("Primus connection error (non-auth)", {
          message: error.message,
          component: "PrimusAuthService",
        });

        // Let ConnectionRecoveryService handle reconnection
        if (recoveryService.getState() === RecoveryState.CONNECTED) {
          recoveryService.forceReconnect();
        }
      }
    } catch (recoveryError) {
      // If ConnectionRecoveryService fails, fall back to original behavior
      logger.error("Failed to use ConnectionRecoveryService", {
        error: recoveryError,
        component: "PrimusAuthService",
      });

      // Original fallback behavior
      if (isAuthError && this.tokenService) {
        setTimeout(() => {
          this.tokenService
            ?.refreshToken()
            .then(() => setTimeout(() => this.connect(), 1000))
            .catch((e) => logger.error("Token refresh failed in fallback", e));
        }, 5000);
      }
    }
  }

  /**
   * Handle authentication success
   */
  private handleAuthSuccess(data: any): void {
    logger.info("✅ Primus authentication successful", {
      component: "PrimusAuthService",
      socketId: this.primus?.id || "unknown",
      deviceId: this.deviceId,
      tabId: this.tabId,
      timestamp: new Date().toISOString(),
      userId: data?.userId || "unknown",
      sessionId: data?.sessionId || "unknown",
      status: "authenticated",
    });

    // Store auth data in Primus instance for future reference
    if (this.primus && data) {
      this.primus.auth = data;

      // If we have a user ID, store it for future use
      if (data.userId) {
        // Try to update Redux store if available
        try {
          if (
            typeof window !== "undefined" &&
            (window as any).__REDUX_STORE__
          ) {
            const store = (window as any).__REDUX_STORE__;
            const state = store.getState();

            // Only update if we don't already have a user ID
            if (
              state &&
              state.auth &&
              (!state.auth.user || !state.auth.user.id)
            ) {
              store.dispatch({
                type: "auth/setUser",
                payload: { id: data.userId, ...data.user },
              });

              logger.debug(
                "Updated Redux store with user ID from auth success",
                {
                  userId: data.userId,
                }
              );
            }
          }
        } catch (error) {
          logger.error("Error updating Redux store with user ID", error);
        }
      }
    }

    // Emit event
    this.eventEmitter.emit(AuthEventType.AUTH_SUCCESS, {
      ...data,
      timestamp: Date.now(),
    });

    // Join rooms
    this.joinRooms();

    // Wait a short time to ensure authentication is fully processed on the server
    // before registering the tab for leader election
    setTimeout(() => {
      logger.debug("Registering tab for leader election after auth success", {
        component: "PrimusAuthService",
        tabId: this.tabId,
        deviceId: this.deviceId,
      });

      // Check if there's already a leader for this device
      try {
        const leaderData = localStorage.getItem(
          `auth_leader_tab_${this.deviceId}`
        );
        let forceElection = false;

        if (!leaderData) {
          // No leader exists for this device, force election for this tab
          forceElection = true;
          logger.info(
            "No leader exists for this device, forcing election for this tab",
            {
              component: "PrimusAuthService",
              tabId: this.tabId,
              deviceId: this.deviceId,
            }
          );
        } else {
          // Check if leader data is stale
          try {
            const leader = JSON.parse(leaderData);
            const now = Date.now();
            const leaderTimestamp = leader.timestamp || 0;
            const isStaleLeader = now - leaderTimestamp > 30000; // 30 seconds

            if (isStaleLeader) {
              // Leader is stale, force election
              forceElection = true;
              logger.info("Stale leader detected, forcing election", {
                component: "PrimusAuthService",
                staleLeaderId: leader.tabId,
                deviceId: this.deviceId,
                age: (now - leaderTimestamp) / 1000 + " seconds",
              });
            }
          } catch (parseError) {
            // Invalid JSON, force election
            forceElection = true;
            logger.error(
              "Invalid leader data in localStorage, forcing election",
              {
                component: "PrimusAuthService",
                error: parseError,
              }
            );
          }
        }

        // Register with or without force election
        this.registerTabForLeaderElection(forceElection);

        // If we're forcing election, also set a timeout to check if it worked
        if (forceElection) {
          setTimeout(() => {
            // Check if we've been elected as leader
            try {
              const currentLeaderData = localStorage.getItem("auth_leader_tab");
              if (!currentLeaderData) {
                // Still no leader, force election again with higher priority
                logger.warn(
                  "No leader elected after forced election, trying again",
                  {
                    component: "PrimusAuthService",
                    tabId: this.tabId,
                  }
                );
                this.forceLeaderElection();
              } else {
                const currentLeader = JSON.parse(currentLeaderData);
                if (currentLeader.tabId !== this.tabId) {
                  // We're not the leader, but there is one - that's fine
                  logger.debug("Another tab was elected as leader", {
                    component: "PrimusAuthService",
                    leaderId: currentLeader.tabId,
                    thisTabId: this.tabId,
                  });
                }
              }
            } catch (error) {
              logger.error(
                "Error checking leader status after forced election",
                {
                  component: "PrimusAuthService",
                  error,
                }
              );
            }
          }, 5000); // Check after 5 seconds
        }
      } catch (error) {
        // If there's an error, just register normally
        logger.error("Error checking leader status before registration", {
          component: "PrimusAuthService",
          error,
        });
        this.registerTabForLeaderElection();
      }
    }, 1000); // Wait 1 second to ensure auth is fully processed

    // Log authentication success to console for visibility
    console.log(
      "%c✅ Primus Authentication Successful",
      "color: green; font-weight: bold",
      {
        socketId: this.primus?.id,
        userId: data?.userId || "unknown",
        sessionId: data?.sessionId || "unknown",
        deviceId: this.deviceId,
        tabId: this.tabId,
      }
    );
  }

  /**
   * Handle authentication error
   */
  private handleAuthError(error: any): void {
    logger.error("Authentication error", {
      error,
      component: "PrimusAuthService",
    });

    // Emit event
    this.eventEmitter.emit(AuthEventType.AUTH_ERROR, {
      error,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle session expired
   */
  private handleSessionExpired(data: any): void {
    logger.warn("Session expired", {
      data,
      component: "PrimusAuthService",
    });

    // Emit event
    this.eventEmitter.emit(AuthEventType.SESSION_EXPIRED, {
      ...data,
      timestamp: Date.now(),
    });

    // Broadcast to other tabs
    this.broadcastAuthStateChange("session_expired", data);
  }

  /**
   * Handle session timeout warning
   */
  private handleSessionTimeoutWarning(data: any): void {
    logger.warn("Session timeout warning", {
      data,
      component: "PrimusAuthService",
    });

    // Emit event
    this.eventEmitter.emit(AuthEventType.SESSION_TIMEOUT_WARNING, {
      ...data,
      timestamp: Date.now(),
    });

    // Broadcast to other tabs
    this.broadcastCrossTabEvent("session_timeout_warning", data);
  }

  /**
   * Handle tab registered event from server
   */
  private handleTabRegistered(data: any): void {
    logger.debug("Tab registered with server", {
      component: "PrimusAuthService",
      tabId: this.tabId,
      deviceId: this.deviceId,
      forceElection: data.forceElection,
    });

    // If this is a forced election, we might want to set ourselves as leader
    // if the server doesn't respond quickly
    if (data.forceElection) {
      // Set a timeout to check if we've been elected leader
      setTimeout(() => {
        try {
          // Check if there's a leader in localStorage for this device
          const leaderData = localStorage.getItem(
            `auth_leader_tab_${this.deviceId}`
          );
          let currentLeader = null;

          if (leaderData) {
            try {
              currentLeader = JSON.parse(leaderData);
            } catch (parseError) {
              // Invalid JSON, ignore
              logger.error("Error parsing leader data", {
                component: "PrimusAuthService",
                error: parseError,
              });
            }
          }

          // If we're still not the leader or there's no leader, force it
          if (!this.isLeaderTab || !currentLeader) {
            logger.warn(
              "Forced election didn't result in leadership, setting as leader locally",
              {
                component: "PrimusAuthService",
                tabId: this.tabId,
                deviceId: this.deviceId,
                currentLeader: currentLeader ? currentLeader.tabId : "none",
              }
            );

            // Set as leader locally
            this.handleLeaderElected({
              leaderId: this.tabId,
              timestamp: Date.now(),
              reason: "forced_local_election",
            });
          }
        } catch (error) {
          logger.error("Error in tab registration fallback", {
            component: "PrimusAuthService",
            error,
          });
        }
      }, 3000); // Wait 3 seconds for server to elect a leader
    }
  }

  /**
   * Handle token refreshed
   */
  private handleTokenRefreshed(data: any): void {
    logger.info("Token refreshed", {
      component: "PrimusAuthService",
    });

    // Emit event
    this.eventEmitter.emit(AuthEventType.TOKEN_REFRESHED, {
      ...data,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle token expiring notification
   */
  private handleTokenExpiring(data: any): void {
    logger.warn("Token expiring notification received", {
      expiresIn: data.expiresIn,
      sessionId: data.sessionId,
      component: "PrimusAuthService",
      event: data.event,
      timestamp: new Date().toISOString(),
    });

    // Check if this is the leader tab
    if (this.isLeaderTab) {
      logger.info("Leader tab will refresh the token immediately", {
        component: "PrimusAuthService",
        tabId: this.tabId,
        deviceId: this.deviceId,
      });

      // Refresh token immediately if we're the leader tab
      if (this.tokenService) {
        // Add a small delay to avoid race conditions
        setTimeout(() => {
          this.tokenService
            ?.refreshToken()
            .then((success) => {
              logger.info(
                "Token refresh initiated by expiration notification",
                {
                  success,
                  component: "PrimusAuthService",
                  tabId: this.tabId,
                  deviceId: this.deviceId,
                }
              );
            })
            .catch((error) => {
              logger.error(
                "Failed to refresh token after expiration notification",
                {
                  error,
                  component: "PrimusAuthService",
                }
              );

              // Try again after a short delay
              setTimeout(() => {
                this.tokenService
                  ?.refreshToken()
                  .then((success) => {
                    logger.info("Second attempt to refresh token succeeded", {
                      success,
                      component: "PrimusAuthService",
                    });
                  })
                  .catch((retryError) => {
                    logger.error("Second attempt to refresh token failed", {
                      error: retryError,
                      component: "PrimusAuthService",
                    });
                  });
              }, 2000); // 2 second delay before retry
            });
        }, 100); // Small delay to avoid race conditions
      } else {
        logger.error("Cannot refresh token: TokenService not available", {
          component: "PrimusAuthService",
        });
      }
    } else {
      logger.info("Non-leader tab received token expiring notification", {
        component: "PrimusAuthService",
        tabId: this.tabId,
        deviceId: this.deviceId,
        isLeaderTab: this.isLeaderTab,
      });
    }

    // Emit event for other components to react
    this.eventEmitter.emit(AuthEventType.TOKEN_EXPIRING, {
      ...data,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle token refresh error
   */
  private handleTokenRefreshError(error: any): void {
    logger.error("Token refresh error", {
      error,
      component: "PrimusAuthService",
    });

    // Emit event
    this.eventEmitter.emit(AuthEventType.TOKEN_REFRESH_ERROR, {
      error,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle room joined
   */
  private handleRoomJoined(data: any): void {
    logger.info("✅ Primus room joined successfully", {
      component: "PrimusAuthService",
      room: data.room,
      socketId: this.primus?.id || "unknown",
      deviceId: this.deviceId,
      tabId: this.tabId,
      timestamp: new Date().toISOString(),
    });

    // Update room info
    if (data.room.startsWith("user:")) {
      this.rooms[RoomType.USER] = data.room;
    } else if (data.room.startsWith("device:")) {
      this.rooms[RoomType.DEVICE] = data.room;
    } else if (data.room.startsWith("session:")) {
      this.rooms[RoomType.SESSION] = data.room;
    } else if (data.room.startsWith("tab:")) {
      this.rooms[RoomType.TAB] = data.room;
    }

    // Emit event
    this.eventEmitter.emit(AuthEventType.ROOM_JOINED, {
      ...data,
      timestamp: Date.now(),
    });

    // Log room joined to console for visibility
    console.log("%c✅ Primus Room Joined", "color: green; font-weight: bold", {
      room: data.room,
      socketId: this.primus?.id,
      deviceId: this.deviceId,
      tabId: this.tabId,
    });
  }

  /**
   * Register this tab for leader election with the backend
   * @param {boolean} forceElection - Whether to force a new election
   */
  private registerTabForLeaderElection(forceElection: boolean = false): void {
    if (!this.primus || this.status !== "connected") {
      logger.warn("Cannot register for leader election - not connected", {
        component: "PrimusAuthService",
        status: this.status,
      });
      return;
    }

    try {
      // Get tab visibility state
      const isVisible =
        typeof document !== "undefined"
          ? document.visibilityState === "visible"
          : true;

      // Get additional tab info
      const tabInfo = {
        url: typeof window !== "undefined" ? window.location.href : "",
        title: typeof document !== "undefined" ? document.title : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        lastActivity: Date.now(),
      };

      // Send registration to backend with enhanced information
      this.primus.write({
        event: "auth:register_tab",
        tabId: this.tabId,
        deviceId: this.deviceId,
        isVisible: isVisible,
        isLeader: this.isLeaderTab,
        forceElection: forceElection, // Add force election flag
        info: tabInfo,
        timestamp: Date.now(),
      });

      logger.debug(
        `Registered tab for leader election${forceElection ? " (forced)" : ""}`,
        {
          component: "PrimusAuthService",
          tabId: this.tabId,
          deviceId: this.deviceId,
          isVisible: isVisible,
          forceElection: forceElection,
        }
      );
    } catch (error) {
      logger.error("Error registering tab for leader election", {
        component: "PrimusAuthService",
        error,
      });
    }
  }

  /**
   * Force a new leader election
   * This is called when a stale leader is detected
   */
  public forceLeaderElection(): void {
    logger.info("Forcing new leader election", {
      component: "PrimusAuthService",
      tabId: this.tabId,
      deviceId: this.deviceId,
    });

    // Clear any stored leader information for this device
    try {
      localStorage.removeItem(`auth_leader_tab_${this.deviceId}`);
    } catch (error) {
      logger.error("Error removing leader info from localStorage", error);
    }

    // Register with force election flag
    this.registerTabForLeaderElection(true);

    // Set a timeout to check if the election worked
    setTimeout(() => {
      try {
        const leaderData = localStorage.getItem("auth_leader_tab");

        // If there's still no leader after 5 seconds, elect ourselves as a fallback
        if (!leaderData) {
          logger.warn(
            "No leader elected after 5 seconds, using fallback mechanism",
            {
              component: "PrimusAuthService",
              tabId: this.tabId,
            }
          );

          // Set this tab as leader as fallback
          localStorage.setItem(
            "auth_leader_tab",
            JSON.stringify({
              tabId: this.tabId,
              timestamp: Date.now(),
              reason: "fallback_self_election",
            })
          );

          // Update leader status
          this.isLeaderTab = true;

          // Emit event
          this.eventEmitter.emit(AuthEventType.LEADER_ELECTED, {
            tabId: this.tabId,
            isLeader: true,
            timestamp: Date.now(),
            reason: "fallback_self_election",
          });

          logger.info("Set this tab as leader through fallback mechanism", {
            component: "PrimusAuthService",
            tabId: this.tabId,
            deviceId: this.deviceId,
          });
        }
      } catch (error) {
        logger.error("Error in leader election fallback", {
          component: "PrimusAuthService",
          error,
        });
      }
    }, 5000); // Wait 5 seconds for backend to elect a leader
  }

  /**
   * Handle leader elected
   */
  private handleLeaderElected(data: any): void {
    // Extract tabId from the data (handle different formats from backend)
    const electedTabId = data.tabId || data.leaderId;

    if (!electedTabId) {
      logger.warn("Leader elected event received without tabId", {
        data,
        component: "PrimusAuthService",
      });
      return;
    }

    // Update leader status
    const wasLeader = this.isLeaderTab;

    // Ensure both values are strings for comparison
    const storedTabId = String(electedTabId || "");
    const currentTabId = String(this.tabId || "");

    // Compare as strings
    this.isLeaderTab = storedTabId === currentTabId;

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
        component: "PrimusAuthService",
      }
    );

    // Store leader info in localStorage for cross-tab awareness
    try {
      // Get current timestamp for freshness
      const now = Date.now();

      // Check if there's existing leader info for this device
      const existingLeaderData = localStorage.getItem(
        `auth_leader_tab_${this.deviceId}`
      );
      let existingLeader = null;

      if (existingLeaderData) {
        try {
          existingLeader = JSON.parse(existingLeaderData);
        } catch (parseError) {
          // Invalid JSON, ignore
        }
      }

      // Only update if:
      // 1. No existing leader, or
      // 2. Different leader, or
      // 3. Same leader but old timestamp (refresh)
      if (
        !existingLeader ||
        existingLeader.tabId !== electedTabId ||
        now - (existingLeader.timestamp || 0) > 10000
      ) {
        // 10 seconds

        localStorage.setItem(
          `auth_leader_tab_${this.deviceId}`,
          JSON.stringify({
            tabId: electedTabId,
            deviceId: this.deviceId,
            timestamp: now,
            reason: data.reason || "election",
            previousLeaderId: data.previousLeaderId || null,
          })
        );

        logger.debug("Updated leader info in localStorage", {
          component: "PrimusAuthService",
          leaderId: electedTabId,
          timestamp: now,
          reason: data.reason || "election",
        });
      }
    } catch (error) {
      logger.error("Error storing leader info in localStorage", error);
    }

    // Get additional information from the event
    const reason = data.reason || "unknown";
    const previousLeaderId = data.previousLeaderId || null;
    const electionTimestamp = data.timestamp || Date.now();

    // Emit event with enhanced information
    this.eventEmitter.emit(AuthEventType.LEADER_ELECTED, {
      tabId: electedTabId,
      leaderId: electedTabId,
      isLeader: this.isLeaderTab,
      wasLeader,
      reason,
      previousLeaderId,
      electionTimestamp,
      timestamp: Date.now(),
    });

    // If this tab became the leader, register for leader-specific events
    if (this.isLeaderTab && !wasLeader) {
      this.registerAsLeader();
    }

    // If this tab is no longer the leader, unregister from leader-specific events
    if (!this.isLeaderTab && wasLeader) {
      this.unregisterAsLeader();
    }

    // Log to console for visibility
    console.log(
      `%c${
        this.isLeaderTab
          ? "👑 This tab is now the LEADER"
          : "👤 This tab is a FOLLOWER"
      }`,
      `color: ${this.isLeaderTab ? "green" : "blue"}; font-weight: bold`,
      {
        electedTabId,
        thisTabId: this.tabId,
        deviceId: this.deviceId,
        comparison: `${electedTabId} === ${this.tabId} is ${
          electedTabId === this.tabId
        }`,
        tabIdType: typeof this.tabId,
        electedTabIdType: typeof electedTabId,
      }
    );

    // Debug: Check if the tabId comparison is working correctly
    if (electedTabId === this.tabId) {
      console.log(
        "%c✅ MATCH: Tab IDs match exactly!",
        "color: green; font-weight: bold"
      );
    } else {
      console.log(
        "%c❌ NO MATCH: Tab IDs do not match!",
        "color: red; font-weight: bold"
      );
      console.log("electedTabId:", JSON.stringify(electedTabId));
      console.log("this.tabId:", JSON.stringify(this.tabId));
      console.log("Character by character comparison:");
      for (
        let i = 0;
        i < Math.max(electedTabId?.length || 0, this.tabId?.length || 0);
        i++
      ) {
        const eChar = electedTabId?.[i] || "";
        const tChar = this.tabId?.[i] || "";
        console.log(
          `Position ${i}: '${eChar}' (${
            eChar.charCodeAt(0) || "N/A"
          }) vs '${tChar}' (${tChar.charCodeAt(0) || "N/A"}) - ${
            eChar === tChar ? "Match" : "Different"
          }`
        );
      }
    }
  }

  /**
   * Handle device info
   */
  private handleDeviceInfo(data: any): void {
    logger.debug("Device info", {
      data,
      component: "PrimusAuthService",
    });

    // Emit event
    this.eventEmitter.emit(AuthEventType.DEVICE_CONNECTED, {
      ...data,
      timestamp: Date.now(),
    });
  }

  /**
   * Start tab presence monitoring
   * This is a more efficient approach than using heartbeats
   */
  private startHeartbeat(): void {
    // We're keeping the method name for compatibility, but changing the implementation
    // to be event-driven instead of interval-based

    // Register tab immediately
    this.registerTabForLeaderElection();

    // Set up visibility change listener to update backend when tab becomes visible/hidden
    if (typeof document !== "undefined") {
      document.addEventListener(
        "visibilitychange",
        this.handleVisibilityChange.bind(this)
      );

      // Initial visibility state
      this.updateTabVisibility();
    }

    // Set up beforeunload listener to notify backend when tab is closing
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", this.handleTabClosing.bind(this));
    }

    logger.debug("Tab presence monitoring started", {
      component: "PrimusAuthService",
      tabId: this.tabId,
      deviceId: this.deviceId,
      isVisible: document?.visibilityState === "visible",
    });
  }

  /**
   * Handle heartbeat from server
   * This is a no-op in the pure event-based system
   */
  private handleHeartbeat(_data: any): void {
    // No-op in the pure event-based system
    // We don't need heartbeats anymore
    logger.debug("Heartbeat handling disabled in pure event-based system", {
      component: "PrimusAuthService",
      tabId: this.tabId,
    });
  }

  /**
   * Handle visibility change event
   * This is called when the tab becomes visible or hidden
   */
  private handleVisibilityChange(): void {
    this.updateTabVisibility();
  }

  /**
   * Update tab visibility status with the backend
   */
  private updateTabVisibility(): void {
    if (!this.primus || this.status !== "connected") {
      return;
    }

    const isVisible = document.visibilityState === "visible";

    // Notify backend about visibility change
    this.primus.write({
      event: "auth:tab_visibility",
      tabId: this.tabId,
      deviceId: this.deviceId,
      isVisible: isVisible,
      timestamp: Date.now(),
    });

    logger.debug(
      `Tab visibility changed: ${isVisible ? "visible" : "hidden"}`,
      {
        component: "PrimusAuthService",
        tabId: this.tabId,
        deviceId: this.deviceId,
        isVisible: isVisible,
      }
    );
  }

  /**
   * Handle tab closing event
   * This is called when the tab is about to be closed
   * We use the synchronous version of the Primus write to ensure the message is sent
   * before the tab is closed
   */
  private handleTabClosing(event?: BeforeUnloadEvent): void {
    if (!this.primus || this.status !== "connected") {
      return;
    }

    try {
      // If this is the leader tab, we need to notify the backend immediately
      // so it can elect a new leader
      if (this.isLeaderTab) {
        // Clean up localStorage if this is the leader tab
        try {
          const leaderData = localStorage.getItem(
            `auth_leader_tab_${this.deviceId}`
          );
          if (leaderData) {
            const data = JSON.parse(leaderData);
            if (data.tabId === this.tabId) {
              // This tab is the leader, mark it as closing
              localStorage.setItem(
                `auth_leader_tab_${this.deviceId}`,
                JSON.stringify({
                  tabId: this.tabId,
                  deviceId: this.deviceId,
                  timestamp: Date.now(),
                  status: "closing",
                  reason: "tab_closing",
                })
              );

              logger.debug(
                "Updated leader info in localStorage for closing tab",
                {
                  component: "PrimusAuthService",
                  tabId: this.tabId,
                }
              );
            }
          }
        } catch (storageError) {
          logger.error("Error updating leader info in localStorage", {
            component: "PrimusAuthService",
            error: storageError,
          });
        }

        // We'll rely on Primus for tab closing notification
        // No need for beacon API anymore - simplifying the approach
      }

      // Also try to send via Primus
      // This uses the synchronous version of write if available
      if (this.primus.write) {
        this.primus.write({
          event: "auth:tab_closing",
          tabId: this.tabId,
          deviceId: this.deviceId,
          isLeader: this.isLeaderTab,
          timestamp: Date.now(),
        });

        logger.debug("Tab closing notification sent via Primus", {
          component: "PrimusAuthService",
          tabId: this.tabId,
          deviceId: this.deviceId,
          isLeader: this.isLeaderTab,
        });
      }

      // If this is the leader tab, we might want to delay the tab closing slightly
      // to give the backend time to elect a new leader
      if (this.isLeaderTab && event) {
        // This might not work in all browsers, but it's worth a try
        event.preventDefault();

        // Show a message to the user
        event.returnValue = "";

        // Set a short timeout to allow the backend to process the notification
        setTimeout(() => {
          window.close();
        }, 100);
      }
    } catch (error) {
      logger.error("Error sending tab closing notification", {
        component: "PrimusAuthService",
        error,
      });
    }
  }

  /**
   * Register this tab as the leader
   * Called when this tab becomes the leader
   */
  private registerAsLeader(): void {
    if (!this.primus || this.status !== "connected") {
      return;
    }

    // Notify backend that this tab is ready to be the leader
    this.primus.write({
      event: "auth:leader_ready",
      tabId: this.tabId,
      deviceId: this.deviceId,
      timestamp: Date.now(),
    });

    logger.debug("Registered as leader tab", {
      component: "PrimusAuthService",
      tabId: this.tabId,
      deviceId: this.deviceId,
    });

    // In a pure event-based system, we don't need leader pings
    // The leader status is maintained through events like tab closing and leader election
  }

  /**
   * Start sending periodic leader pings
   * This method is now a no-op in the pure event-based system
   */
  private startLeaderPings(): void {
    // No-op in the pure event-based system
    // We don't need leader pings anymore
    logger.debug("Leader pings disabled in pure event-based system", {
      component: "PrimusAuthService",
      tabId: this.tabId,
    });
  }

  /**
   * Send a leader ping to the server
   * This method is now a no-op in the pure event-based system
   */
  private sendLeaderPing(): void {
    // No-op in the pure event-based system
    // We don't need leader pings anymore
  }

  /**
   * Stop sending leader pings
   * This method is now a no-op in the pure event-based system
   */
  private stopLeaderPings(): void {
    // No-op in the pure event-based system
    // We don't need leader pings anymore

    // Clear any existing interval for safety
    if (this.leaderPingInterval) {
      clearInterval(this.leaderPingInterval);
      this.leaderPingInterval = null;
    }
  }

  /**
   * Unregister this tab as the leader
   * Called when this tab is no longer the leader
   */
  private unregisterAsLeader(): void {
    // Stop leader pings
    this.stopLeaderPings();

    if (!this.primus || this.status !== "connected") {
      return;
    }

    // Notify backend that this tab is no longer the leader
    this.primus.write({
      event: "auth:leader_resigned",
      tabId: this.tabId,
      deviceId: this.deviceId,
      timestamp: Date.now(),
    });

    logger.debug("Unregistered as leader tab", {
      component: "PrimusAuthService",
      tabId: this.tabId,
      deviceId: this.deviceId,
    });
  }

  /**
   * Handle leader ping request from server
   * This method is now a no-op in the pure event-based system
   */
  private handleLeaderPingRequest(data: any): void {
    // No-op in the pure event-based system
    // We don't need leader pings anymore
    logger.debug("Leader ping requests disabled in pure event-based system", {
      component: "PrimusAuthService",
      tabId: this.tabId,
      requestId: data?.requestId || null,
    });
  }

  /**
   * Handle retry registration event
   * This is called when the server asks us to retry tab registration after authentication
   */
  private handleRetryRegistration(data: any): void {
    logger.debug("Received retry registration request", {
      data,
      component: "PrimusAuthService",
    });

    // If we're authenticated now, retry registration
    if (this.status === "authenticated") {
      logger.info("Retrying tab registration after authentication", {
        component: "PrimusAuthService",
        tabId: this.tabId,
        deviceId: this.deviceId,
      });

      // Retry registration
      this.registerTabForLeaderElection();
    } else {
      // Schedule a retry after a short delay
      setTimeout(() => {
        if (this.status === "authenticated") {
          this.registerTabForLeaderElection();
        }
      }, 1000);
    }
  }

  /**
   * Handle tab registered event
   * This is called when the server confirms our tab registration
   */
  private handleTabRegistered(data: any): void {
    logger.info("Tab registration confirmed by server", {
      data,
      component: "PrimusAuthService",
      tabId: this.tabId,
      deviceId: this.deviceId,
    });

    // Emit event
    this.eventEmitter.emit(AuthEventType.TAB_REGISTERED, {
      ...data,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle leader ping acknowledgment
   * Part of the event-based leader election system
   */
  private handleLeaderPingAck(data: any): void {
    if (!data || !data.tabId) return;

    // Only process if this is for our tab
    if (data.tabId === this.tabId) {
      logger.debug("Received leader ping acknowledgment", {
        component: "PrimusAuthService",
        tabId: this.tabId,
        deviceId: this.deviceId,
        timestamp: data.timestamp,
      });

      // Update last acknowledged timestamp
      this.lastLeaderPingAck = Date.now();
    }
  }

  /**
   * Handle leader active notification
   * Part of the event-based leader election system
   */
  private handleLeaderActive(data: any): void {
    if (!data || !data.leaderId) return;

    // Only process if this is not our tab (we already know we're active)
    if (data.leaderId !== this.tabId) {
      logger.debug("Received leader active notification", {
        component: "PrimusAuthService",
        leaderId: data.leaderId,
        deviceId: data.deviceId,
        timestamp: data.timestamp,
      });

      // Update our knowledge of the active leader
      try {
        // Only update if this is for our device
        if (data.deviceId === this.deviceId) {
          localStorage.setItem(
            `auth_leader_tab_${this.deviceId}`,
            JSON.stringify({
              tabId: data.leaderId,
              deviceId: this.deviceId,
              timestamp: Date.now(),
              reason: "leader_active_notification",
            })
          );
        }
      } catch (error) {
        logger.error("Error updating leader info in localStorage", {
          component: "PrimusAuthService",
          error,
        });
      }
    }
  }

  /**
   * Handle leader storage change event
   * This is triggered when another tab updates the leader information in localStorage
   */
  private handleLeaderStorageChange(event: StorageEvent): void {
    try {
      // Get the new leader data
      const leaderData = event.newValue ? JSON.parse(event.newValue) : null;

      // If there's no leader data, we're not the leader
      if (!leaderData) {
        if (this.isLeaderTab) {
          // We were the leader but now there's no leader
          this.isLeaderTab = false;

          // Emit event
          this.eventEmitter.emit(AuthEventType.LEADER_CHANGED, {
            isLeader: false,
            tabId: this.tabId,
            deviceId: this.deviceId,
            timestamp: Date.now(),
            reason: "leader_removed",
          });

          logger.info("No longer the leader tab", {
            component: "PrimusAuthService",
            tabId: this.tabId,
            deviceId: this.deviceId,
          });
        }
        return;
      }

      // Check if we're the leader
      const wasLeader = this.isLeaderTab;
      this.isLeaderTab = leaderData.tabId === this.tabId;

      // If our leader status changed, emit an event
      if (wasLeader !== this.isLeaderTab) {
        this.eventEmitter.emit(AuthEventType.LEADER_CHANGED, {
          isLeader: this.isLeaderTab,
          tabId: this.tabId,
          deviceId: this.deviceId,
          timestamp: Date.now(),
          reason: leaderData.reason || "storage_change",
        });

        logger.info(
          `Leader status changed: ${
            this.isLeaderTab ? "Now leader" : "No longer leader"
          }`,
          {
            component: "PrimusAuthService",
            tabId: this.tabId,
            deviceId: this.deviceId,
            leaderId: leaderData.tabId,
            reason: leaderData.reason || "storage_change",
          }
        );

        // If we became the leader, register with the server
        if (this.isLeaderTab) {
          this.registerAsLeader();
        }
      }
    } catch (error) {
      logger.error("Error handling leader storage change", {
        component: "PrimusAuthService",
        error,
        event,
      });
    }
  }

  /**
   * Handle auth state storage change event
   * This is triggered when another tab updates the auth state in localStorage
   */
  private handleAuthStateStorageChange(event: StorageEvent): void {
    try {
      // Get the new auth state data
      const authStateData = event.newValue ? JSON.parse(event.newValue) : null;

      // If there's no auth state data, ignore
      if (!authStateData) return;

      // Process the auth state change
      switch (authStateData.type) {
        case "login":
          // Another tab logged in, update our state
          this.eventEmitter.emit(AuthEventType.LOGIN, {
            userId: authStateData.userId,
            timestamp: authStateData.timestamp,
            source: "other_tab",
          });
          break;

        case "logout":
          // Another tab logged out, update our state
          this.eventEmitter.emit(AuthEventType.LOGOUT, {
            timestamp: authStateData.timestamp,
            source: "other_tab",
          });
          break;

        case "session_expired":
          // Session expired in another tab, update our state
          this.eventEmitter.emit(AuthEventType.SESSION_EXPIRED, {
            timestamp: authStateData.timestamp,
            source: "other_tab",
          });
          break;
      }

      logger.debug("Processed auth state change from another tab", {
        component: "PrimusAuthService",
        type: authStateData.type,
        timestamp: authStateData.timestamp,
      });
    } catch (error) {
      logger.error("Error handling auth state storage change", {
        component: "PrimusAuthService",
        error,
        event,
      });
    }
  }

  /**
   * Handle cross-tab event
   * This is triggered when another tab sends a custom event via localStorage
   */
  private handleCrossTabEvent(event: StorageEvent): void {
    try {
      // Get the event data
      const eventData = event.newValue ? JSON.parse(event.newValue) : null;

      // If there's no event data, ignore
      if (!eventData || !eventData.type) return;

      // Process the event based on its type
      switch (eventData.type) {
        case "token_refresh":
          // Another tab refreshed the tokens, we should update our state
          if (this.tokenService) {
            this.tokenService.notifyTokenRefreshed();
          }
          break;

        case "security_event":
          // Security event from another tab
          this.eventEmitter.emit(AuthEventType.SECURITY_EVENT, {
            ...eventData.data,
            source: "other_tab",
            timestamp: eventData.timestamp,
          });
          break;
      }

      logger.debug("Processed cross-tab event", {
        component: "PrimusAuthService",
        type: eventData.type,
        timestamp: eventData.timestamp,
      });
    } catch (error) {
      logger.error("Error handling cross-tab event", {
        component: "PrimusAuthService",
        error,
        event,
      });
    }
  }

  /**
   * Handle visibility change event
   * This is triggered when the tab becomes visible or hidden
   */
  private handleVisibilityChange(): void {
    if (typeof document === "undefined") return;

    const isVisible = document.visibilityState === "visible";

    logger.debug(
      `Tab visibility changed: ${isVisible ? "visible" : "hidden"}`,
      {
        component: "PrimusAuthService",
        tabId: this.tabId,
        deviceId: this.deviceId,
      }
    );

    // If this tab became visible and we're the leader, notify the server
    if (
      isVisible &&
      this.isLeaderTab &&
      this.primus &&
      this.status === "connected"
    ) {
      this.primus.write({
        event: "auth:tab_visible",
        tabId: this.tabId,
        deviceId: this.deviceId,
        timestamp: Date.now(),
      });
    }

    // Emit event for other components to react to visibility change
    this.eventEmitter.emit(AuthEventType.VISIBILITY_CHANGED, {
      isVisible,
      tabId: this.tabId,
      deviceId: this.deviceId,
      timestamp: Date.now(),
    });
  }

  private handleSecurityEvent(data: any): void {
    logger.warn("Security event", {
      data,
      component: "PrimusAuthService",
    });

    // Emit event
    this.eventEmitter.emit(AuthEventType.SECURITY_EVENT, {
      ...data,
      timestamp: Date.now(),
    });

    // Broadcast to other tabs
    this.broadcastCrossTabEvent("security_event", data);
  }

  /**
   * Broadcast auth state change to other tabs
   * @param type - Type of auth state change (login, logout, session_expired)
   * @param data - Additional data for the event
   */
  private broadcastAuthStateChange(type: string, data: any = {}): void {
    try {
      localStorage.setItem(
        `auth_state_${this.deviceId}`,
        JSON.stringify({
          type,
          ...data,
          timestamp: Date.now(),
        })
      );

      logger.debug(`Broadcasted auth state change: ${type}`, {
        component: "PrimusAuthService",
        tabId: this.tabId,
        deviceId: this.deviceId,
      });
    } catch (error) {
      logger.error("Error broadcasting auth state change", {
        component: "PrimusAuthService",
        error,
        type,
      });
    }
  }

  /**
   * Broadcast cross-tab event
   * @param type - Type of event
   * @param data - Event data
   */
  private broadcastCrossTabEvent(type: string, data: any = {}): void {
    try {
      localStorage.setItem(
        `auth_event_${this.deviceId}`,
        JSON.stringify({
          type,
          data,
          timestamp: Date.now(),
        })
      );

      logger.debug(`Broadcasted cross-tab event: ${type}`, {
        component: "PrimusAuthService",
        tabId: this.tabId,
        deviceId: this.deviceId,
      });
    } catch (error) {
      logger.error("Error broadcasting cross-tab event", {
        component: "PrimusAuthService",
        error,
        type,
      });
    }
  }

  /**
   * Join rooms
   */
  private joinRooms(): void {
    if (!this.primus || this.status !== "connected") {
      return;
    }

    // Get user ID if available
    let userId = null;

    // Try to get user ID from Redux store first
    try {
      if (typeof window !== "undefined" && (window as any).__REDUX_STORE__) {
        const store = (window as any).__REDUX_STORE__;
        const state = store.getState();
        if (state && state.auth && state.auth.user && state.auth.user.id) {
          userId = state.auth.user.id;
          logger.debug("Got user ID from Redux store", { userId });
        }
      }
    } catch (error) {
      logger.error("Error getting user ID from Redux store", error);
    }

    // If not found in Redux, try TokenService
    if (!userId && this.tokenService) {
      try {
        // Check if getUserId method exists
        if (typeof this.tokenService.getUserId === "function") {
          userId = this.tokenService.getUserId() || null;
        } else {
          // Try to get user ID from other methods
          logger.warn(
            "TokenService.getUserId is not a function, trying alternatives"
          );

          // Try getUserData method
          if (typeof this.tokenService.getUserData === "function") {
            const userData = this.tokenService.getUserData();
            if (userData && userData.id) {
              userId = userData.id;
            }
          }
        }
      } catch (error) {
        logger.error("Error getting user ID from TokenService", error);
      }
    }

    logger.info("Attempting to join Primus rooms", {
      component: "PrimusAuthService",
      socketId: this.primus?.id || "unknown",
      deviceId: this.deviceId,
      tabId: this.tabId,
      userId: userId || "unknown",
      timestamp: new Date().toISOString(),
    });

    // Join user room
    if (userId) {
      this.primus.write({
        event: "join",
        room: `user:${userId}`,
      });

      // Store the user ID for future use
      this.rooms[RoomType.USER] = `user:${userId}`;

      logger.debug("Joined user room", { userId, room: `user:${userId}` });
    } else {
      logger.warn("Could not join user room - no user ID available", {
        component: "PrimusAuthService",
        deviceId: this.deviceId,
        tabId: this.tabId,
      });

      // Try to get user ID from auth success data
      if (this.primus && this.primus.auth && this.primus.auth.userId) {
        const authUserId = this.primus.auth.userId;
        this.primus.write({
          event: "join",
          room: `user:${authUserId}`,
        });

        this.rooms[RoomType.USER] = `user:${authUserId}`;

        logger.debug("Joined user room using auth data", {
          userId: authUserId,
          room: `user:${authUserId}`,
        });
      }
    }

    // Join device room
    this.primus.write({
      event: "join",
      room: `device:${this.deviceId}`,
    });

    // Join tab room
    this.primus.write({
      event: "join",
      room: `tab:${this.tabId}`,
    });

    // Log to console for visibility
    console.log("%c🔄 Joining Primus Rooms", "color: blue; font-weight: bold", {
      userId: userId || "unknown",
      deviceId: this.deviceId,
      tabId: this.tabId,
      socketId: this.primus?.id,
    });
  }

  /**
   * Disconnect from the server
   */
  public disconnect(): void {
    // No heartbeat interval in event-based system

    // Clear leader ping interval
    if (this.leaderPingInterval) {
      clearInterval(this.leaderPingInterval);
      this.leaderPingInterval = null;
    }

    // Remove event listeners
    if (typeof document !== "undefined") {
      document.removeEventListener(
        "visibilitychange",
        this.handleVisibilityChange.bind(this)
      );
    }

    if (typeof window !== "undefined") {
      window.removeEventListener(
        "beforeunload",
        this.handleTabClosing.bind(this)
      );
    }

    // Notify backend about disconnection if still connected
    if (this.primus && this.status === "connected") {
      try {
        // Send a synchronous notification about tab disconnection
        this.primus.write({
          event: "auth:tab_disconnecting",
          tabId: this.tabId,
          deviceId: this.deviceId,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error("Error sending disconnect notification", {
          component: "PrimusAuthService",
          error,
        });
      }
    }

    if (!this.primus) {
      return;
    }

    // Close the connection
    this.primus.end();
    this.primus = null;

    // Update status
    this.status = "disconnected";

    // Clear rooms
    this.rooms = {
      [RoomType.USER]: null,
      [RoomType.DEVICE]: null,
      [RoomType.SESSION]: null,
      [RoomType.TAB]: null,
    };

    // Emit event
    this.eventEmitter.emit(AuthEventType.DISCONNECTED, {
      timestamp: Date.now(),
    });

    logger.info("Disconnected from Primus server", {
      component: "PrimusAuthService",
      tabId: this.tabId,
      deviceId: this.deviceId,
    });
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.status === "connected";
  }

  /**
   * Check if leader
   */
  public isLeader(): boolean {
    return this.isLeaderTab;
  }

  /**
   * Get room
   */
  public getRoom(type: RoomType): string | null {
    return this.rooms[type];
  }

  /**
   * Extract access token from cookie
   * This is used as a fallback authentication method
   */
  private getAccessTokenFromCookie(): string | null {
    try {
      const cookies = document.cookie.split(";");
      const accessTokenName =
        SOCKET_CONFIG.CONNECTION.SECURITY.COOKIE_NAMES.ACCESS_TOKEN;

      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split("=");
        if (name === accessTokenName) {
          return value;
        }
      }

      // Log for debugging
      logger.debug("No access token found in cookies", {
        cookieCount: cookies.length,
        cookieNames: cookies.map((c) => c.trim().split("=")[0]),
        component: "PrimusAuthService",
      });

      return null;
    } catch (error) {
      logger.error("Error extracting access token from cookie", {
        error,
        component: "PrimusAuthService",
      });
      return null;
    }
  }

  /**
   * Get socket ID
   */
  public getSocketId(): string | null {
    return this.primus?.id || null;
  }

  /**
   * Get device ID
   */
  public getDeviceId(): string {
    return this.deviceId;
  }

  /**
   * Get tab ID
   */
  public getTabId(): string {
    return this.tabId;
  }

  /**
   * Emit an event to the server
   */
  public emit(event: string, data: any): void {
    if (!this.primus || this.status !== "connected") {
      logger.warn(`Cannot emit event ${event}: Not connected`, {
        component: "PrimusAuthService",
      });
      return;
    }

    this.primus.write({
      event,
      payload: data,
    });
  }

  /**
   * Send activity update
   */
  public activity(): void {
    this.emit("activity", {
      tabId: this.tabId,
      deviceId: this.deviceId,
      timestamp: Date.now(),
      isLeader: this.isLeaderTab,
    });
  }

  /**
   * Add event listener
   */
  public on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Remove event listener
   */
  public off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * Handle leader failed event from server
   * This is called when the backend detects that a leader tab has failed
   */
  private handleLeaderFailed(data: any): void {
    const previousLeaderId = data.previousLeaderId || null;
    const reason = data.reason || "unknown";

    logger.info(`Leader failed: ${previousLeaderId} (reason: ${reason})`, {
      component: "PrimusAuthService",
      previousLeaderId,
      reason,
      timestamp: data.timestamp || Date.now(),
      thisTabId: this.tabId,
      deviceId: this.deviceId,
    });

    // Check if the failed leader is stored in localStorage for this device
    try {
      const leaderData = localStorage.getItem(
        `auth_leader_tab_${this.deviceId}`
      );
      if (leaderData) {
        const storedLeader = JSON.parse(leaderData);

        // If the failed leader is the one stored in localStorage, remove it
        if (
          storedLeader.tabId === previousLeaderId &&
          storedLeader.deviceId === this.deviceId
        ) {
          logger.debug("Removing failed leader from localStorage", {
            component: "PrimusAuthService",
            failedLeaderId: previousLeaderId,
            deviceId: this.deviceId,
            reason,
          });

          // Mark as failed in localStorage
          localStorage.setItem(
            `auth_leader_tab_${this.deviceId}`,
            JSON.stringify({
              tabId: previousLeaderId,
              deviceId: this.deviceId,
              timestamp: Date.now(),
              status: "failed",
              reason: reason,
            })
          );

          // Wait for backend to elect a new leader
          // If no leader is elected within 5 seconds, force an election
          setTimeout(() => {
            try {
              const currentLeaderData = localStorage.getItem(
                `auth_leader_tab_${this.deviceId}`
              );
              if (currentLeaderData) {
                const currentLeader = JSON.parse(currentLeaderData);

                // If the leader is still marked as failed, force a new election
                if (
                  currentLeader.status === "failed" &&
                  currentLeader.deviceId === this.deviceId
                ) {
                  logger.warn(
                    "No new leader elected after failure, forcing election",
                    {
                      component: "PrimusAuthService",
                      failedLeaderId: previousLeaderId,
                    }
                  );

                  this.forceLeaderElection();
                }
              }
            } catch (error) {
              logger.error("Error checking leader status after failure", {
                component: "PrimusAuthService",
                error,
              });
            }
          }, 5000); // Wait 5 seconds for backend to elect a new leader
        }
      }
    } catch (error) {
      logger.error("Error handling leader failed event", {
        component: "PrimusAuthService",
        error,
      });
    }

    // Emit event for other components
    this.eventEmitter.emit(AuthEventType.LEADER_FAILED, {
      previousLeaderId,
      reason,
      timestamp: data.timestamp || Date.now(),
    });
  }

  /**
   * Remove all event listeners
   */
  public removeAllListeners(event?: string): void {
    this.eventEmitter.removeAllListeners(event);
  }

  /**
   * Set up listener for auth state changes in Redux store
   */
  private setupAuthStateListener(): void {
    if (typeof window === "undefined") return;

    try {
      // Check if Redux store is available
      if ((window as any).__REDUX_STORE__) {
        const store = (window as any).__REDUX_STORE__;

        // Subscribe to store changes
        store.subscribe(() => {
          const state = store.getState();
          const isAuthenticated = state?.auth?.isAuthenticated;

          // Get previous auth state
          const wasAuthenticated = this.isUserAuthenticated();

          // If auth state changed from not authenticated to authenticated, connect
          if (isAuthenticated && !wasAuthenticated && !this.primus) {
            logger.info(
              "Auth state changed to authenticated, connecting to Primus",
              {
                component: "PrimusAuthService",
              }
            );
            this.connect();
          }

          // If auth state changed from authenticated to not authenticated, disconnect
          if (!isAuthenticated && wasAuthenticated && this.primus) {
            logger.info(
              "Auth state changed to not authenticated, disconnecting from Primus",
              {
                component: "PrimusAuthService",
              }
            );
            this.disconnect();
          }
        });

        logger.debug("Set up auth state change listener", {
          component: "PrimusAuthService",
        });
      }
    } catch (error) {
      logger.error("Error setting up auth state change listener", {
        error,
        component: "PrimusAuthService",
      });
    }
  }

  /**
   * Disconnect from the server
   */
  public disconnect(): void {
    if (!this.primus) {
      logger.debug("Not connected, nothing to disconnect", {
        component: "PrimusAuthService",
      });
      return;
    }

    logger.info("Manually disconnecting from Primus", {
      component: "PrimusAuthService",
    });

    try {
      this.primus.end();
      this.primus = null;
      this.status = "disconnected";
    } catch (error) {
      logger.error("Error disconnecting from Primus", {
        error,
        component: "PrimusAuthService",
      });
    }
  }
}

// Export singleton instance
export const primusAuthService = PrimusAuthService.getInstance();

// For backward compatibility
export { primusAuthService as webSocketAuthService };
