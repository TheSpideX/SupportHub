import { io, Socket } from "socket.io-client";
import { logger } from "@/utils/logger";
import { TokenService } from "@/features/auth/services/TokenService";
import { SecurityService } from "@/features/auth/services/SecurityService";
import { API_CONFIG } from "@/config/api";

// Room types
export enum RoomType {
  USER = "user",
  DEVICE = "device",
  SESSION = "session",
  TAB = "tab",
}

// Event types
export enum EventType {
  TOKEN_EXPIRING = "token:expiring",
  TOKEN_REFRESHED = "token:refreshed",
  TOKEN_INVALID = "token:invalid",
  TOKEN_REVOKED = "token:revoked",
  SESSION_TIMEOUT_WARNING = "session:timeout_warning",
  SESSION_TERMINATED = "session:terminated",
  SESSION_EXTENDED = "session:extended",
  SECURITY_ALERT = "security:alert",
  LEADER_ELECTED = "leader:elected",
  LEADER_HEARTBEAT = "leader:heartbeat",
}

// Room hierarchy
interface RoomHierarchy {
  userRoom: string | null;
  deviceRoom: string | null;
  sessionRoom: string | null;
  tabRoom: string | null;
}

// Socket status
type SocketStatus = "disconnected" | "connecting" | "connected" | "error";

/**
 * WebSocket service for authentication and session management
 * Implements the WebSocket authentication plan
 */
export class WebSocketService {
  private socket: Socket | null = null;
  private tokenService: TokenService | null = null;
  private securityService: SecurityService | null = null;
  private status: SocketStatus = "disconnected";
  private rooms: RoomHierarchy = {
    userRoom: null,
    deviceRoom: null,
    sessionRoom: null,
    tabRoom: null,
  };
  private tabId: string = `tab_${Math.random().toString(36).substring(2, 11)}`;
  private isLeader: boolean = false;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private lastUserActivity: number = Date.now();
  private broadcastChannel: BroadcastChannel | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private deviceFingerprint: string | null = null;

  constructor() {
    // Initialize tab ID
    if (typeof window !== "undefined") {
      // Use existing tab ID or create a new one
      this.tabId = window.sessionStorage.getItem("tab_id") || this.tabId;
      window.sessionStorage.setItem("tab_id", this.tabId);

      // Initialize BroadcastChannel for cross-tab communication
      if (typeof BroadcastChannel !== "undefined") {
        try {
          this.broadcastChannel = new BroadcastChannel("auth_socket_channel");

          // Listen for messages from other tabs
          this.broadcastChannel.onmessage = (event) => {
            if (event.data && event.data.type) {
              switch (event.data.type) {
                case "USER_ACTIVITY":
                  // Update our local activity timestamp if another tab reported activity
                  if (event.data.timestamp > this.lastUserActivity) {
                    this.lastUserActivity = event.data.timestamp;
                  }
                  break;

                case "TOKEN_REFRESHED":
                  // Another tab refreshed the token
                  logger.info("Token refreshed by another tab");
                  break;

                case "LEADER_ELECTED":
                  // Another tab was elected as leader
                  this.isLeader = event.data.leaderId === this.tabId;
                  break;
              }
            }
          };

          logger.debug(
            "BroadcastChannel initialized for cross-tab communication"
          );
        } catch (error) {
          logger.warn("Failed to initialize BroadcastChannel:", error);
        }
      }

      // Setup user activity tracking
      this.setupUserActivityTracking();
    }
  }

  /**
   * Set the auth services
   */
  public setAuthServices(
    tokenService: TokenService,
    securityService: SecurityService
  ): void {
    this.tokenService = tokenService;
    this.securityService = securityService;
  }

  /**
   * Initialize the WebSocket connection
   */
  public initialize(): void {
    if (!this.tokenService || !this.securityService) {
      logger.error(
        "Cannot initialize WebSocket without token and security services"
      );
      return;
    }

    if (this.socket?.connected) {
      logger.info("WebSocket already connected");
      return;
    }

    // Clean up existing socket if any
    this.cleanup();

    // Get the WebSocket URL
    const wsUrl = this.getWebSocketUrl();
    logger.info(`Initializing WebSocket connection to ${wsUrl}`);

    // Get CSRF token if available
    const csrfToken = this.tokenService?.getCsrfToken() || "";

    // Create socket connection
    // IMPORTANT: Use the /auth namespace for authentication
    this.socket = io(`${wsUrl}/auth`, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 30000, // Increased timeout for better reliability
      withCredentials: true, // Critical for HTTP-only cookies
      transports: ["polling", "websocket"], // Start with polling which handles cookies better
      auth: {
        tabId: this.tabId,
        csrfToken: csrfToken,
        timestamp: Date.now(),
        deviceFingerprint: this.getDeviceFingerprint(),
      },
      extraHeaders: {
        "X-CSRF-Token": csrfToken,
        "X-Device-ID": this.getDeviceFingerprint(),
        "X-Tab-ID": this.tabId,
      },
      forceNew: true, // Force a new connection to avoid reusing problematic connections
      path: "/socket.io", // Default Socket.IO path
    });

    // Log detailed connection information
    logger.debug("WebSocket connection details:", {
      url: `${wsUrl}/auth`,
      withCredentials: true,
      csrfTokenLength: csrfToken ? csrfToken.length : 0,
      tabId: this.tabId,
      transportModes: ["polling", "websocket"],
      cookieCount: document.cookie.split(";").length,
      hasCsrfCookie: document.cookie.includes("csrf_token"),
      hasAccessTokenCookie: document.cookie.includes("access_token"),
      hasRefreshTokenCookie: document.cookie.includes("refresh_token"),
    });

    // Log connection attempt with detailed information
    logger.info("WebSocket connecting with credentials to " + wsUrl + "/auth", {
      withCredentials: "[REDACTED]",
      hasCsrfToken: csrfToken ? "[REDACTED]" : "false",
      csrfTokenLength: csrfToken ? csrfToken.length : 0,
      tabId: this.tabId,
      deviceFingerprint: this.deviceFingerprint ? "[REDACTED]" : "not set",
      transportModes: ["polling", "websocket"],
    });

    // Log important connection details
    logger.debug(`Attempting to connect to WebSocket server with credentials`, {
      withCredentials: true,
      hasCsrfToken: !!csrfToken,
      tabId: this.tabId,
    });

    // Log connection attempt
    logger.info("Attempting to connect to WebSocket server with credentials");

    // Add a special handler for auth errors
    this.socket.on("connect_error", (error) => {
      logger.error("WebSocket connection error:", {
        error: error,
        message: error.message,
        code: error.code,
        stack: error.stack,
      });

      // Increment reconnect attempts
      this.reconnectAttempts++;

      // Handle any authentication errors
      if (
        error &&
        error.message &&
        (error.message.includes("access token") ||
          error.message.includes("Authentication required") ||
          error.message.includes("UNAUTHORIZED"))
      ) {
        logger.warn(
          `WebSocket connection failed due to authentication issue. Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
        );

        // Check if we've exceeded the maximum number of reconnect attempts
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          logger.error(
            `Maximum reconnect attempts (${this.maxReconnectAttempts}) reached. Falling back to cross-tab sync.`
          );

          // IMPROVEMENT: Instead of redirecting, fall back to cross-tab synchronization
          this.enableFallbackMode();
          return;
        }

        // Calculate exponential backoff delay
        const backoffDelay = Math.min(
          1000 * Math.pow(2, this.reconnectAttempts - 1), // Exponential backoff
          30000 // Max 30 seconds
        );

        logger.info(
          `Will attempt to refresh token and reconnect in ${backoffDelay}ms`
        );

        // Try to refresh the token with exponential backoff
        setTimeout(() => {
          if (this.tokenService) {
            // First, ensure we have a valid CSRF token
            const csrfToken = this.tokenService.getCsrfToken();
            logger.debug("Using CSRF token for refresh:", {
              hasToken: !!csrfToken,
              tokenLength: csrfToken ? csrfToken.length : 0,
            });

            this.tokenService
              .refreshToken()
              .then(() => {
                logger.info("Token refreshed, reconnecting WebSocket...");
                // Wait a moment for cookies to be properly set
                setTimeout(() => {
                  this.cleanup();
                  this.initialize();
                }, 1000);
              })
              .catch((err) => {
                logger.error("Failed to refresh token:", err);
                // Only redirect to login if we've tried multiple times
                if (this.reconnectAttempts >= 3) {
                  window.location.href =
                    "/auth/login?reason=token_refresh_failed";
                }
              });
          } else {
            logger.error("Cannot refresh token: TokenService not available");
            window.location.href = "/auth/login?reason=no_token_service";
          }
        }, backoffDelay);
      }
    });

    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Enable fallback mode when WebSocket connection fails
   * This switches to using cross-tab synchronization instead of WebSockets
   */
  private enableFallbackMode(): void {
    logger.info(
      "Enabling WebSocket fallback mode with cross-tab synchronization"
    );

    // Clean up any existing socket connection
    this.cleanup();

    // Set status to indicate we're in fallback mode
    this.status = "disconnected";

    // Trigger fallback mode event
    this.triggerEvent("fallback", { enabled: true, timestamp: Date.now() });

    // Initialize cross-tab communication if not already done
    this.initializeCrossTabSync();

    // Start polling for auth events as a fallback
    this.startAuthEventPolling();

    // Notify other tabs that we're in fallback mode
    this.broadcastFallbackStatus(true);
  }

  /**
   * Initialize cross-tab synchronization
   */
  private initializeCrossTabSync(): void {
    // Skip if already initialized or if BroadcastChannel is not available
    if (this.broadcastChannel || typeof BroadcastChannel === "undefined") {
      return;
    }

    try {
      this.broadcastChannel = new BroadcastChannel("auth_socket_channel");

      // Set up message handler
      this.broadcastChannel.onmessage = (event) => {
        if (!event.data || !event.data.type) return;

        // Handle cross-tab messages
        switch (event.data.type) {
          case "AUTH_EVENT":
            // Process auth event from another tab
            this.processAuthEvent(event.data.event);
            break;

          case "FALLBACK_STATUS":
            // Another tab is in fallback mode
            logger.debug(
              "Received fallback status from another tab:",
              event.data
            );
            break;

          case "TOKEN_REFRESHED":
            // Token was refreshed in another tab
            this.triggerEvent("token:refreshed", event.data.payload);
            break;
        }
      };

      logger.info("Cross-tab synchronization initialized for fallback mode");
    } catch (error) {
      logger.error("Failed to initialize cross-tab sync:", error);
    }
  }

  /**
   * Start polling for auth events as a fallback when WebSockets are unavailable
   */
  private startAuthEventPolling(): void {
    // Only the leader tab should poll to avoid duplicate requests
    if (!this.isLeader && this.hasOtherTabs()) {
      logger.debug("Not starting auth event polling - not the leader tab");
      return;
    }

    logger.info("Starting auth event polling as fallback mechanism");

    // Set up polling interval - only if we're the leader tab
    const pollInterval = setInterval(async () => {
      // Skip if we're no longer in fallback mode or not the leader
      if (this.socket?.connected || (!this.isLeader && this.hasOtherTabs())) {
        clearInterval(pollInterval);
        return;
      }

      try {
        // Poll for auth events using REST API
        if (this.tokenService) {
          const lastEventId = localStorage.getItem("last_auth_event_id") || "0";

          const response = await fetch(
            `${API_CONFIG.API_URL}/auth/events?lastEventId=${lastEventId}`,
            {
              credentials: "include",
              headers: {
                "X-CSRF-Token": this.tokenService.getCsrfToken() || "",
              },
            }
          );

          if (response.ok) {
            const data = await response.json();

            if (data.events && data.events.length > 0) {
              // Process each event
              data.events.forEach((event: any) => {
                // Save the last event ID
                localStorage.setItem("last_auth_event_id", event.id);

                // Process the event
                this.processAuthEvent(event);

                // Broadcast to other tabs
                this.broadcastAuthEvent(event);
              });
            }
          }
        }
      } catch (error) {
        logger.error("Error polling for auth events:", error);
      }
    }, 5000); // Poll every 5 seconds
  }

  /**
   * Process an auth event
   */
  private processAuthEvent(event: any): void {
    if (!event || !event.type) return;

    // Map server event types to client event types
    const eventMap: Record<string, string> = {
      "token.refreshed": "token:refreshed",
      "token.expired": "token:expired",
      "session.timeout_warning": "session:timeout_warning",
      "session.terminated": "session:terminated",
      "security.alert": "security:alert",
    };

    const clientEventType = eventMap[event.type] || event.type;

    // Trigger the event
    this.triggerEvent(clientEventType, event.payload || {});
  }

  /**
   * Broadcast an auth event to other tabs
   */
  private broadcastAuthEvent(event: any): void {
    if (!this.broadcastChannel) return;

    try {
      this.broadcastChannel.postMessage({
        type: "AUTH_EVENT",
        event,
        timestamp: Date.now(),
        sourceTabId: this.tabId,
      });
    } catch (error) {
      logger.error("Failed to broadcast auth event:", error);
    }
  }

  /**
   * Broadcast fallback status to other tabs
   */
  private broadcastFallbackStatus(enabled: boolean): void {
    if (!this.broadcastChannel) return;

    try {
      this.broadcastChannel.postMessage({
        type: "FALLBACK_STATUS",
        enabled,
        timestamp: Date.now(),
        sourceTabId: this.tabId,
      });
    } catch (error) {
      logger.error("Failed to broadcast fallback status:", error);
    }
  }

  /**
   * Check if there are other tabs open
   */
  private hasOtherTabs(): boolean {
    try {
      const leaderData = localStorage.getItem("auth_leader_tab");
      if (!leaderData) return false;

      const data = JSON.parse(leaderData);
      return data.tabId !== this.tabId;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get device fingerprint for authentication
   */
  private getDeviceFingerprint(): string {
    // Use cached fingerprint if available
    if (this.deviceFingerprint) {
      return this.deviceFingerprint;
    }

    // Try to get fingerprint from security service
    if (this.securityService) {
      try {
        const fingerprint = this.securityService.getDeviceFingerprintSync();
        if (fingerprint) {
          this.deviceFingerprint = fingerprint;
          return fingerprint;
        }
      } catch (error) {
        logger.warn("Failed to get device fingerprint:", error);
      }
    }

    // Fallback to stored fingerprint in sessionStorage
    const storedFingerprint =
      typeof window !== "undefined"
        ? sessionStorage.getItem("device_fingerprint")
        : null;

    if (storedFingerprint) {
      this.deviceFingerprint = storedFingerprint;
      return storedFingerprint;
    }

    // Last resort: generate a simple fingerprint
    const simpleFingerprint = `device_${Math.random()
      .toString(36)
      .substring(2, 11)}`;
    this.deviceFingerprint = simpleFingerprint;

    // Store for future use
    if (typeof window !== "undefined") {
      sessionStorage.setItem("device_fingerprint", simpleFingerprint);
    }

    return simpleFingerprint;
  }

  /**
   * Get the WebSocket URL
   */
  private getWebSocketUrl(): string {
    // Use the backend URL directly - bypass the Vite proxy for WebSockets
    // This is necessary because WebSockets can't go through the Vite proxy
    // IMPORTANT: Use the backend port (4290) instead of the frontend port (5173)
    const host = API_CONFIG.WS_URL || "http://localhost:4290";

    // Log the WebSocket URL for debugging
    logger.debug(`Using WebSocket URL: ${host}`);

    // Verify that we're not using the frontend port
    if (host.includes("5173")) {
      logger.error(
        "WebSocket URL contains frontend port (5173) instead of backend port"
      );
    }

    return host;
  }

  /**
   * Clean up existing socket connection
   */
  private cleanup(): void {
    if (this.socket) {
      try {
        this.socket.disconnect();
        this.socket.removeAllListeners();
        this.socket = null;
      } catch (error) {
        logger.error("Error cleaning up socket:", error);
      }
    }

    // Clear heartbeat interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Reset rooms
    this.rooms = {
      userRoom: null,
      deviceRoom: null,
      sessionRoom: null,
      tabRoom: null,
    };

    this.status = "disconnected";
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on("connect", () => {
      logger.info("WebSocket connected");
      this.status = "connected";
      this.reconnectAttempts = 0;
      this.triggerEvent("status", this.status);

      // Join rooms
      this.joinRooms();

      // Start heartbeat
      this.startHeartbeat();

      // Disable fallback mode if it was active
      this.broadcastFallbackStatus(false);
    });

    this.socket.on("disconnect", (reason) => {
      logger.info(`WebSocket disconnected: ${reason}`);
      this.status = "disconnected";
      this.triggerEvent("status", this.status);

      // Stop heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // If disconnected due to transport error or network issues, consider fallback mode
      if (
        reason === "transport error" ||
        reason === "transport close" ||
        reason === "ping timeout"
      ) {
        logger.warn(
          `WebSocket disconnected due to ${reason}, considering fallback mode`
        );

        // Wait a bit before enabling fallback mode to allow for reconnection
        setTimeout(() => {
          // Only enable fallback if still disconnected
          if (!this.socket?.connected && this.status === "disconnected") {
            this.enableFallbackMode();
          }
        }, 5000); // Wait 5 seconds before enabling fallback
      }
    });

    this.socket.on("connect_error", (error) => {
      logger.error("WebSocket connection error:", {
        error: error,
        message: error.message,
        code: error.code,
        stack: error.stack,
      });
      this.status = "error";
      this.triggerEvent("status", this.status);
      this.reconnectAttempts++;

      // Check if this is an authentication error
      if (
        error &&
        error.message &&
        (error.message.includes("authentication") ||
          error.message.includes("token") ||
          error.message.includes("unauthorized"))
      ) {
        logger.warn(
          `WebSocket authentication error. Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
        );

        // Check if we've exceeded the maximum number of reconnect attempts
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          logger.error(
            `Maximum reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`
          );
          return;
        }

        // Calculate exponential backoff delay
        const backoffDelay = Math.min(
          1000 * Math.pow(2, this.reconnectAttempts - 1), // Exponential backoff
          30000 // Max 30 seconds
        );

        logger.info(`Will attempt to refresh token in ${backoffDelay}ms`);

        // Try to refresh the token with exponential backoff
        setTimeout(() => {
          if (this.tokenService) {
            this.tokenService.refreshToken().catch((err) => {
              logger.error("Failed to refresh token:", err);
            });
          }
        }, backoffDelay);
      }

      // Handle parser errors which might be related to Redis issues
      if (error && error.code === "parser error") {
        logger.warn(
          "WebSocket parser error detected, reconnecting with fallback..."
        );
        // Force reconnection after a short delay with polling transport only
        setTimeout(() => {
          this.cleanup();

          // Get the WebSocket URL
          const wsUrl = this.getWebSocketUrl();
          logger.info(
            `Reinitializing WebSocket connection to ${wsUrl} with fallback`
          );

          // Get CSRF token if available
          const csrfToken = this.tokenService?.getCsrfToken() || "";

          // Create socket connection with polling only as fallback
          this.socket = io(`${wsUrl}/auth`, {
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
            timeout: 30000,
            withCredentials: true,
            transports: ["polling"], // Fallback to polling only
            auth: {
              tabId: this.tabId,
              csrfToken: csrfToken,
              timestamp: Date.now(),
              fallback: true, // Indicate this is a fallback connection
            },
            extraHeaders: {
              "X-CSRF-Token": csrfToken,
            },
            forceNew: true,
          });

          // Setup event handlers
          this.setupEventHandlers();
        }, 2000);
        return;
      }

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        logger.error(
          `Failed to connect after ${this.maxReconnectAttempts} attempts`
        );
        this.socket?.disconnect();
      }
    });

    // Room events
    this.socket.on("auth:joined", (data) => {
      logger.info(`Joined auth rooms: ${JSON.stringify(data.rooms)}`);

      // Update rooms
      if (data.rooms) {
        this.rooms.userRoom = data.rooms.userRoom || null;
        this.rooms.deviceRoom = data.rooms.deviceRoom || null;
        this.rooms.sessionRoom = data.rooms.sessionRoom || null;
        this.rooms.tabRoom = data.rooms.tabRoom || null;
      }

      this.triggerEvent("auth:joined", data);
    });

    // Device info acknowledgment
    this.socket.on("device:info:ack", (data) => {
      logger.info(`Device info acknowledged: ${JSON.stringify(data)}`);

      // Store device ID if provided
      if (data.deviceId) {
        sessionStorage.setItem("deviceId", data.deviceId);
      }

      this.triggerEvent("device:info:ack", data);
    });

    // Token lifecycle events
    this.socket.on(EventType.TOKEN_EXPIRING, (data) => {
      logger.info("Token expiring notification received:", data);
      this.triggerEvent(EventType.TOKEN_EXPIRING, data);

      // If we're the leader tab, handle the token refresh
      if (this.isLeader) {
        this.handleTokenRefresh();
      }
    });

    this.socket.on(EventType.TOKEN_REFRESHED, (data) => {
      logger.info("Token refreshed notification received:", data);
      this.triggerEvent(EventType.TOKEN_REFRESHED, data);
    });

    this.socket.on(EventType.TOKEN_INVALID, (data) => {
      logger.warn("Token invalid notification received:", data);
      this.triggerEvent(EventType.TOKEN_INVALID, data);
    });

    this.socket.on(EventType.TOKEN_REVOKED, (data) => {
      logger.warn("Token revoked notification received:", data);
      this.triggerEvent(EventType.TOKEN_REVOKED, data);
    });

    // Session lifecycle events
    this.socket.on(EventType.SESSION_TIMEOUT_WARNING, (data) => {
      logger.warn("Session timeout warning received:", data);
      this.triggerEvent(EventType.SESSION_TIMEOUT_WARNING, data);
    });

    this.socket.on(EventType.SESSION_TERMINATED, (data) => {
      logger.warn("Session terminated notification received:", data);
      this.triggerEvent(EventType.SESSION_TERMINATED, data);
    });

    this.socket.on(EventType.SESSION_EXTENDED, (data) => {
      logger.info("Session extended notification received:", data);
      this.triggerEvent(EventType.SESSION_EXTENDED, data);
    });

    // Leader election events
    this.socket.on("leader:elected", (data) => {
      logger.info("Leader elected:", data);
      this.isLeader = data.leaderId === this.tabId;
      this.triggerEvent("leader:elected", data);

      // Broadcast to other tabs
      if (this.broadcastChannel && this.isLeader) {
        this.broadcastChannel.postMessage({
          type: "LEADER_ELECTED",
          leaderId: this.tabId,
          timestamp: Date.now(),
        });
      }
    });

    // Heartbeat
    this.socket.on("heartbeat", () => {
      this.socket?.emit("heartbeat:response", {
        tabId: this.tabId,
        timestamp: Date.now(),
        isLeader: this.isLeader,
      });
    });
  }

  /**
   * Join rooms based on authentication state
   */
  private joinRooms(): void {
    if (!this.socket || !this.tokenService) return;

    const user = this.tokenService.getUser();
    if (!user || !user.id) {
      logger.warn("Cannot join rooms: No authenticated user");
      return;
    }

    // Get session data
    const sessionData = this.tokenService.getSessionData();
    const deviceId =
      sessionData?.deviceId || sessionStorage.getItem("deviceId");

    // Join auth rooms
    this.socket.emit("auth:join", {
      userId: user.id,
      deviceId: deviceId,
      tabId: this.tabId,
      timestamp: Date.now(),
    });

    // Get device info for security context
    this.securityService
      ?.getDeviceFingerprint()
      .then((fingerprint) => {
        if (fingerprint) {
          // Send device info
          this.socket.emit("device:info", {
            fingerprint,
            userAgent: navigator.userAgent,
            timestamp: Date.now(),
          });
        }
      })
      .catch((error) => {
        logger.error("Failed to get device fingerprint:", error);
      });

    // Initiate leader election
    this.initiateLeaderElection();
  }

  /**
   * Start heartbeat for leader election
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected && this.isLeader) {
        this.socket.emit("leader:heartbeat", {
          tabId: this.tabId,
          timestamp: Date.now(),
        });
      }
    }, 30000); // 30 seconds
  }

  /**
   * Initiate leader election
   */
  private initiateLeaderElection(): void {
    if (!this.socket?.connected) return;

    this.socket.emit("leader:elect", {
      tabId: this.tabId,
      timestamp: Date.now(),
      priority: this.calculateLeaderPriority(),
      visible: document.visibilityState === "visible",
    });
  }

  /**
   * Calculate leader priority
   * Higher priority tabs are more likely to be elected as leader
   */
  private calculateLeaderPriority(): number {
    // Priority factors:
    // 1. Tab visibility (visible tabs have higher priority)
    // 2. Tab age (older tabs have higher priority)
    // 3. Random factor to break ties

    let priority = 0;

    // Visibility factor (0-50)
    if (typeof document !== "undefined") {
      priority += document.visibilityState === "visible" ? 50 : 0;
    }

    // Tab age factor (0-30)
    const tabCreationTime = parseInt(
      window.sessionStorage.getItem("tab_creation_time") || "0",
      10
    );
    if (tabCreationTime > 0) {
      const ageInMinutes = (Date.now() - tabCreationTime) / (1000 * 60);
      priority += Math.min(ageInMinutes, 30); // Cap at 30
    }

    // Random factor (0-20)
    priority += Math.random() * 20;

    return priority;
  }

  /**
   * Handle token refresh
   */
  private async handleTokenRefresh(): Promise<void> {
    if (!this.isLeader || !this.tokenService) {
      logger.debug("Not the leader tab, skipping token refresh");
      return;
    }

    logger.info("Leader tab initiating token refresh");

    try {
      // Check if user is active before refreshing
      const isActive = this.isUserActive();

      if (!isActive) {
        logger.info("User is inactive, skipping token refresh");
        return;
      }

      // Use the token service to refresh the token
      const refreshed = await this.tokenService.refreshToken();

      if (refreshed) {
        logger.info("Token refreshed successfully");

        // Broadcast to other tabs
        if (this.broadcastChannel) {
          this.broadcastChannel.postMessage({
            type: "TOKEN_REFRESHED",
            timestamp: Date.now(),
          });
        }
      } else {
        logger.warn("Token refresh failed");
      }
    } catch (error) {
      logger.error("Error refreshing token:", error);
    }
  }

  /**
   * Check if the user is active
   */
  private isUserActive(): boolean {
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    return now - this.lastUserActivity < inactiveThreshold;
  }

  /**
   * Update user activity timestamp
   */
  public updateUserActivity(): void {
    this.lastUserActivity = Date.now();

    // Broadcast to other tabs
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: "USER_ACTIVITY",
        timestamp: this.lastUserActivity,
      });
    }

    // Send activity to server if connected
    if (this.socket?.connected) {
      this.socket.emit("activity", {
        tabId: this.tabId,
        timestamp: this.lastUserActivity,
      });
    }
  }

  /**
   * Setup user activity tracking
   */
  private setupUserActivityTracking(): void {
    if (typeof window === "undefined") return;

    // Store tab creation time
    if (!window.sessionStorage.getItem("tab_creation_time")) {
      window.sessionStorage.setItem("tab_creation_time", Date.now().toString());
    }

    // List of events to track for user activity
    const activityEvents = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
      "focus",
    ];

    // Throttled update function to prevent excessive updates
    let lastUpdate = 0;
    const throttleTime = 5000; // 5 seconds

    const throttledUpdate = () => {
      const now = Date.now();
      if (now - lastUpdate > throttleTime) {
        this.updateUserActivity();
        lastUpdate = now;
      }
    };

    // Attach event listeners
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, throttledUpdate, { passive: true });
    });

    logger.debug("User activity tracking initialized");
  }

  /**
   * Add event listener
   */
  public on(event: string, callback: Function): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }

    this.eventListeners.get(event)?.add(callback);

    // Return function to remove the listener
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  /**
   * Trigger event
   */
  private triggerEvent(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);

    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get current connection status
   */
  public getStatus(): SocketStatus {
    return this.status;
  }

  /**
   * Check if this tab is the leader
   */
  public isLeaderTab(): boolean {
    return this.isLeader;
  }

  /**
   * Disconnect the socket
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.status = "disconnected";
  }
}

// Create singleton instance
export const webSocketService = new WebSocketService();
