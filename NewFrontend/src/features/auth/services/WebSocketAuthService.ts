/**
 * WebSocketAuthService
 *
 * Core service for WebSocket-based authentication.
 * Handles:
 * - WebSocket connection with authentication
 * - Session status monitoring
 * - Cross-tab synchronization
 * - Token refresh coordination
 */

import { io, Socket } from "socket.io-client";
import { logger } from "@/utils/logger";
import SOCKET_CONFIG from "@/config/socket";
import EventEmitter from "eventemitter3";
import { TokenService } from "./TokenService";
import { SecurityService } from "./SecurityService";

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
  USER_ACTIVITY = "user:activity",
  LEADER_ELECTED = "leader:elected",
  DEVICE_CONNECTED = "device:connected",
  DEVICE_DISCONNECTED = "device:disconnected",
  ROOM_JOINED = "room:joined",
  SECURITY_EVENT = "security:event",

  // Socket.IO native events
  CONNECT = "connect",
  DISCONNECT = "disconnect",

  // Custom events for session management
  SESSION_UPDATE = "session:update",
  ACTIVITY_UPDATE = "activity:update",
}

// Room types
export enum RoomType {
  USER = "user",
  DEVICE = "device",
  SESSION = "session",
  TAB = "tab",
}

// Connection status
export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "connecting"
  | "error";

// Service configuration
export interface WebSocketAuthConfig {
  url: string;
  namespace: string;
  reconnection: boolean;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  reconnectionDelayMax: number;
  timeout: number;
  autoConnect: boolean;
  withCredentials: boolean;
  transports: string[];
}

// Default configuration
const defaultConfig: WebSocketAuthConfig = {
  url: SOCKET_CONFIG.BASE_URL,
  namespace: SOCKET_CONFIG.NAMESPACES.AUTH,
  reconnection: SOCKET_CONFIG.CONNECTION.RECONNECTION.ENABLED,
  reconnectionAttempts: SOCKET_CONFIG.CONNECTION.RECONNECTION.MAX_ATTEMPTS,
  reconnectionDelay: SOCKET_CONFIG.CONNECTION.RECONNECTION.DELAY,
  reconnectionDelayMax: SOCKET_CONFIG.CONNECTION.RECONNECTION.MAX_DELAY,
  timeout: SOCKET_CONFIG.CONNECTION.TIMEOUT,
  autoConnect: true,
  withCredentials: SOCKET_CONFIG.CONNECTION.WITH_CREDENTIALS,
  transports: SOCKET_CONFIG.CONNECTION.TRANSPORTS,
};

/**
 * WebSocketAuthService class
 */
export class WebSocketAuthService {
  private socket: Socket | null = null;
  private config: WebSocketAuthConfig;
  private status: ConnectionStatus = "disconnected";
  private tabId: string;
  private deviceId: string | null = null;
  private sessionId: string | null = null;
  private isLeaderTab: boolean = false;
  private eventEmitter: EventEmitter = new EventEmitter();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private leaderElectionInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts: number = 0;
  private lastActivity: number = Date.now();
  private rooms: Record<RoomType, string | null> = {
    [RoomType.USER]: null,
    [RoomType.DEVICE]: null,
    [RoomType.SESSION]: null,
    [RoomType.TAB]: null,
  };
  private broadcastChannel: BroadcastChannel | null = null;
  private tokenService: TokenService | null = null;
  private securityService: SecurityService | null = null;
  private csrfToken: string | null = null;

  // Singleton instance
  private static instance: WebSocketAuthService | null = null;

  /**
   * Get singleton instance
   */
  public static getInstance(
    config?: Partial<WebSocketAuthConfig>,
    tokenService?: TokenService,
    securityService?: SecurityService
  ): WebSocketAuthService {
    if (!WebSocketAuthService.instance) {
      WebSocketAuthService.instance = new WebSocketAuthService(
        config,
        tokenService,
        securityService
      );
    } else if (tokenService || securityService) {
      // Update services if provided
      if (tokenService) {
        WebSocketAuthService.instance.setTokenService(tokenService);
      }
      if (securityService) {
        WebSocketAuthService.instance.setSecurityService(securityService);
      }
    }
    return WebSocketAuthService.instance;
  }

  /**
   * Constructor
   */
  private constructor(
    config?: Partial<WebSocketAuthConfig>,
    tokenService?: TokenService,
    securityService?: SecurityService
  ) {
    this.config = { ...defaultConfig, ...config };

    // Set services if provided
    if (tokenService) {
      this.tokenService = tokenService;
    }
    if (securityService) {
      this.securityService = securityService;
    }

    // Generate tab ID
    this.tabId = this.generateTabId();

    // Store tab ID in session storage
    if (typeof sessionStorage !== "undefined") {
      // Use existing tab ID if available
      const storedTabId = sessionStorage.getItem("tab_id");
      if (storedTabId) {
        this.tabId = storedTabId;
      } else {
        sessionStorage.setItem("tab_id", this.tabId);
      }
    }

    // Initialize cross-tab communication
    this.initCrossTabCommunication();

    // Initialize device ID
    this.initDeviceId();

    // Get CSRF token if token service is available
    if (this.tokenService) {
      this.csrfToken = this.tokenService.getCsrfToken();
    }

    logger.info("WebSocketAuthService initialized", {
      tabId: this.tabId,
      deviceId: this.deviceId,
      component: "WebSocketAuthService",
    });

    // Start leader election process
    this.startLeaderElection();
  }

  /**
   * Initialize device ID
   */
  private initDeviceId(): void {
    // Try to get device ID from security service first
    if (this.securityService) {
      this.securityService
        .getDeviceFingerprint()
        .then((fingerprint) => {
          if (fingerprint) {
            this.deviceId = fingerprint;
            // Store in session storage for future use
            if (typeof sessionStorage !== "undefined") {
              sessionStorage.setItem("device_fingerprint", fingerprint);
            }
          }
        })
        .catch((error) => {
          logger.error(
            "Failed to get device fingerprint from security service",
            {
              error,
              component: "WebSocketAuthService",
            }
          );
          this.fallbackDeviceId();
        });
    } else {
      this.fallbackDeviceId();
    }
  }

  /**
   * Fallback method to get device ID from storage or generate a new one
   */
  private fallbackDeviceId(): void {
    // Try to get device ID from session storage
    if (typeof sessionStorage !== "undefined") {
      const storedDeviceId = sessionStorage.getItem("device_fingerprint");
      if (storedDeviceId) {
        this.deviceId = storedDeviceId;
      } else {
        // Generate a simple device fingerprint as fallback
        const fallbackFingerprint = this.generateFallbackFingerprint();
        this.deviceId = fallbackFingerprint;
        sessionStorage.setItem("device_fingerprint", fallbackFingerprint);
      }
    }
  }

  /**
   * Generate a fallback device fingerprint
   */
  private generateFallbackFingerprint(): string {
    const components = [
      navigator.userAgent,
      navigator.language,
      new Date().getTimezoneOffset(),
      screen.width + "x" + screen.height,
      navigator.hardwareConcurrency,
      // Use a safer alternative to the deprecated navigator.platform
      navigator.userAgent,
    ];

    return btoa(components.join("|"))
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 32);
  }

  /**
   * Generate a unique tab ID
   */
  private generateTabId(): string {
    return `tab_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
  }

  /**
   * Initialize cross-tab communication
   */
  private initCrossTabCommunication(): void {
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.broadcastChannel = new BroadcastChannel("auth_socket_channel");

        // Set up message handler
        this.broadcastChannel.onmessage = this.handleCrossTabMessage.bind(this);

        logger.debug("Cross-tab communication initialized", {
          component: "WebSocketAuthService",
        });
      } catch (error) {
        logger.warn("Failed to initialize cross-tab communication", {
          error,
          component: "WebSocketAuthService",
        });
      }
    }
  }

  /**
   * Handle cross-tab messages
   */
  private handleCrossTabMessage(event: MessageEvent): void {
    if (!event.data || typeof event.data !== "object") return;

    const message = event.data;

    // Validate message
    if (!this.validateCrossTabMessage(message)) return;

    // Handle message based on type
    switch (message.type) {
      case "USER_ACTIVITY":
        // Update last activity time if newer
        if (message.timestamp > this.lastActivity) {
          this.lastActivity = message.timestamp;
        }
        break;

      case "TOKEN_REFRESHED":
        // Token refreshed in another tab
        logger.debug("Token refreshed in another tab", {
          component: "WebSocketAuthService",
        });
        this.eventEmitter.emit(AuthEventType.TOKEN_REFRESHED, message.data);
        break;

      case "LEADER_ELECTED":
        // Update leader status
        this.isLeaderTab = message.leaderId === this.tabId;
        break;

      case "SESSION_EXPIRED":
        // Session expired
        logger.debug("Session expired notification from another tab", {
          component: "WebSocketAuthService",
        });
        this.eventEmitter.emit(AuthEventType.SESSION_EXPIRED, message.data);
        break;
    }
  }

  /**
   * Validate cross-tab message
   */
  private validateCrossTabMessage(message: any): boolean {
    // Check if message is valid
    if (!message || typeof message !== "object") return false;
    if (!message.type) return false;

    // Check if message is too old (over 5 seconds)
    if (message.timestamp) {
      const now = Date.now();
      if (now - message.timestamp > 5000) {
        logger.warn("Discarding outdated cross-tab message", {
          type: message.type,
          age: now - message.timestamp,
          component: "WebSocketAuthService",
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Set token service
   */
  public setTokenService(tokenService: TokenService): void {
    this.tokenService = tokenService;
    // Update CSRF token
    this.csrfToken = tokenService.getCsrfToken();
  }

  /**
   * Set security service
   */
  public setSecurityService(securityService: SecurityService): void {
    this.securityService = securityService;
    // Re-initialize device ID with security service
    this.initDeviceId();
  }

  /**
   * Connect to WebSocket server
   */
  public connect(): void {
    // Skip if already connected
    if (this.socket?.connected) {
      logger.debug("WebSocket already connected", {
        component: "WebSocketAuthService",
      });
      return;
    }

    // Update status
    this.status = "connecting";

    // Clean up existing connection
    this.cleanup();

    // Get connection URL
    const url = this.config.url;
    const namespace = this.config.namespace;

    logger.info(`Connecting to WebSocket: ${url}${namespace}`, {
      component: "WebSocketAuthService",
    });

    // Log cookie information for debugging
    logger.debug("Cookie information", {
      hasCookies: document.cookie.length > 0,
      cookieCount: document.cookie.split(";").length,
      hasAccessToken: document.cookie.includes("access_token="),
      hasRefreshToken: document.cookie.includes("refresh_token="),
      component: "WebSocketAuthService",
    });

    // Get CSRF token if available
    if (this.tokenService) {
      this.csrfToken = this.tokenService.getCsrfToken();
    }

    // Get security context if available
    let securityContext = null;
    if (this.securityService) {
      securityContext = this.securityService.getSecurityContext();
    }

    // Create socket connection
    this.socket = io(`${url}${namespace}`, {
      autoConnect: this.config.autoConnect,
      reconnection: this.config.reconnection,
      reconnectionAttempts: this.config.reconnectionAttempts,
      reconnectionDelay: this.config.reconnectionDelay,
      reconnectionDelayMax: this.config.reconnectionDelayMax,
      timeout: this.config.timeout,
      withCredentials: this.config.withCredentials,
      transports: this.config.transports,
      auth: {
        tabId: this.tabId,
        deviceId: this.deviceId,
        timestamp: Date.now(),
        csrfToken: this.csrfToken,
        securityContext: securityContext
          ? JSON.stringify(securityContext)
          : undefined,
        isLeader: this.isLeaderTab,
      },
      extraHeaders: {
        [SOCKET_CONFIG.CONNECTION.SECURITY.CSRF_HEADER]: this.csrfToken || "",
        [SOCKET_CONFIG.CONNECTION.SECURITY.DEVICE_ID_HEADER]:
          this.deviceId || "",
        [SOCKET_CONFIG.CONNECTION.SECURITY.TAB_ID_HEADER]: this.tabId,
        [SOCKET_CONFIG.CONNECTION.SECURITY.TIMESTAMP_HEADER]:
          Date.now().toString(),
      },
    });

    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on("connect", this.handleConnect.bind(this));
    this.socket.on("disconnect", this.handleDisconnect.bind(this));
    this.socket.on("connect_error", this.handleConnectError.bind(this));

    // Authentication events
    this.socket.on("auth:success", this.handleAuthSuccess.bind(this));
    this.socket.on("auth:error", this.handleAuthError.bind(this));

    // Session events
    this.socket.on("session:expired", this.handleSessionExpired.bind(this));
    this.socket.on(
      "session:timeout_warning",
      this.handleSessionTimeoutWarning.bind(this)
    );

    // Token events
    this.socket.on("token:refreshed", this.handleTokenRefreshed.bind(this));
    this.socket.on(
      "token:refresh_error",
      this.handleTokenRefreshError.bind(this)
    );

    // Room events
    this.socket.on("room:joined", this.handleRoomJoined.bind(this));

    // Leader election events
    this.socket.on("leader:elected", this.handleLeaderElected.bind(this));

    // Device events
    this.socket.on("device:info", this.handleDeviceInfo.bind(this));

    // Heartbeat
    this.socket.on("heartbeat", this.handleHeartbeat.bind(this));

    // Security events
    this.socket.on("security:event", this.handleSecurityEvent.bind(this));
  }

  /**
   * Handle connect event
   */
  private handleConnect(): void {
    logger.info("WebSocket connected", {
      socketId: this.socket?.id,
      component: "WebSocketAuthService",
    });

    // Update status
    this.status = "connected";
    this.reconnectAttempts = 0;

    // Emit event
    this.eventEmitter.emit(AuthEventType.CONNECTED, {
      socketId: this.socket?.id,
      timestamp: Date.now(),
    });

    // Start heartbeat
    this.startHeartbeat();

    // Join rooms
    this.joinRooms();

    // Participate in leader election
    this.participateInLeaderElection();
  }

  /**
   * Handle disconnect event
   */
  private handleDisconnect(reason: string): void {
    logger.info(`WebSocket disconnected: ${reason}`, {
      component: "WebSocketAuthService",
    });

    // Update status
    this.status = "disconnected";

    // Emit event
    this.eventEmitter.emit(AuthEventType.DISCONNECTED, {
      reason,
      timestamp: Date.now(),
    });

    // Stop heartbeat
    this.stopHeartbeat();
  }

  /**
   * Handle connect error
   */
  private handleConnectError(error: Error): void {
    logger.error("WebSocket connection error", {
      message: error.message,
      component: "WebSocketAuthService",
    });

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

    // Check if we should try to refresh the token
    if (
      error.message.includes("authentication") ||
      error.message.includes("token") ||
      error.message.includes("unauthorized")
    ) {
      // Check if we've exceeded max reconnect attempts
      if (this.reconnectAttempts >= this.config.reconnectionAttempts) {
        logger.error(
          `Maximum reconnect attempts (${this.config.reconnectionAttempts}) reached`,
          {
            component: "WebSocketAuthService",
          }
        );
        return;
      }

      // Calculate backoff delay
      const backoffDelay = Math.min(
        this.config.reconnectionDelay * Math.pow(2, this.reconnectAttempts - 1),
        this.config.reconnectionDelayMax
      );

      logger.info(`Will attempt to refresh token in ${backoffDelay}ms`, {
        component: "WebSocketAuthService",
      });

      // Emit token refresh needed event
      setTimeout(() => {
        this.eventEmitter.emit(AuthEventType.TOKEN_REFRESH_ERROR, {
          error,
          timestamp: Date.now(),
        });
      }, backoffDelay);
    }
  }

  /**
   * Handle authentication success
   */
  private handleAuthSuccess(data: any): void {
    logger.info("Authentication successful", {
      userId: data.userId,
      sessionId: data.sessionId,
      component: "WebSocketAuthService",
    });

    // Store session ID
    this.sessionId = data.sessionId;

    // Emit event
    this.eventEmitter.emit(AuthEventType.AUTH_SUCCESS, data);
  }

  /**
   * Handle authentication error
   */
  private handleAuthError(data: any): void {
    logger.error("Authentication error", {
      message: data.message,
      code: data.code,
      component: "WebSocketAuthService",
    });

    // Emit event
    this.eventEmitter.emit(AuthEventType.AUTH_ERROR, data);
  }

  /**
   * Handle session expired
   */
  private handleSessionExpired(data: any): void {
    logger.warn("Session expired", {
      sessionId: data.sessionId,
      reason: data.reason,
      component: "WebSocketAuthService",
    });

    // Emit event
    this.eventEmitter.emit(AuthEventType.SESSION_EXPIRED, data);

    // Broadcast to other tabs
    this.broadcastMessage({
      type: "SESSION_EXPIRED",
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle session timeout warning
   */
  private handleSessionTimeoutWarning(data: any): void {
    logger.warn("Session timeout warning", {
      sessionId: data.sessionId,
      expiresIn: data.expiresIn,
      component: "WebSocketAuthService",
    });

    // Emit event
    this.eventEmitter.emit(AuthEventType.SESSION_TIMEOUT_WARNING, data);
  }

  /**
   * Handle token refreshed
   */
  private handleTokenRefreshed(data: any): void {
    logger.info("Token refreshed", {
      component: "WebSocketAuthService",
    });

    // Emit event
    this.eventEmitter.emit(AuthEventType.TOKEN_REFRESHED, data);

    // Broadcast to other tabs
    this.broadcastMessage({
      type: "TOKEN_REFRESHED",
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle token refresh error
   */
  private handleTokenRefreshError(data: any): void {
    logger.error("Token refresh error", {
      message: data.message,
      code: data.code,
      component: "WebSocketAuthService",
    });

    // Emit event
    this.eventEmitter.emit(AuthEventType.TOKEN_REFRESH_ERROR, data);
  }

  /**
   * Handle room joined
   */
  private handleRoomJoined(data: any): void {
    logger.debug("Joined room", {
      rooms: data.rooms,
      component: "WebSocketAuthService",
    });

    // Update rooms
    if (data.rooms) {
      this.rooms[RoomType.USER] = data.rooms.userRoom || null;
      this.rooms[RoomType.DEVICE] = data.rooms.deviceRoom || null;
      this.rooms[RoomType.SESSION] = data.rooms.sessionRoom || null;
      this.rooms[RoomType.TAB] = data.rooms.tabRoom || null;
    }

    // Emit event
    this.eventEmitter.emit(AuthEventType.ROOM_JOINED, data);
  }

  /**
   * Handle leader elected
   */
  private handleLeaderElected(data: any): void {
    logger.debug("Leader elected", {
      leaderId: data.leaderId,
      isLeader: data.leaderId === this.tabId,
      component: "WebSocketAuthService",
    });

    // Update leader status
    this.isLeaderTab = data.leaderId === this.tabId;

    // Emit event
    this.eventEmitter.emit(AuthEventType.LEADER_ELECTED, data);

    // Broadcast to other tabs
    this.broadcastMessage({
      type: "LEADER_ELECTED",
      leaderId: data.leaderId,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle device info
   */
  private handleDeviceInfo(data: any): void {
    logger.debug("Device info received", {
      deviceId: data.deviceId,
      component: "WebSocketAuthService",
    });

    // Store device ID
    if (data.deviceId) {
      this.deviceId = data.deviceId;

      // Store in session storage
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("device_fingerprint", data.deviceId);
      }
    }

    // Emit event
    this.eventEmitter.emit(AuthEventType.DEVICE_CONNECTED, data);
  }

  /**
   * Handle heartbeat
   */
  private handleHeartbeat(_data: any): void {
    // Respond to heartbeat
    this.socket?.emit("heartbeat:response", {
      tabId: this.tabId,
      timestamp: Date.now(),
      isLeader: this.isLeaderTab,
    });
  }

  /**
   * Handle security event
   */
  private handleSecurityEvent(data: any): void {
    logger.warn("Security event", {
      type: data.type,
      severity: data.severity,
      component: "WebSocketAuthService",
    });

    // Emit event
    this.eventEmitter.emit(AuthEventType.SECURITY_EVENT, data);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    // Clear existing interval
    this.stopHeartbeat();

    // Start new interval
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit(SOCKET_CONFIG.EVENTS.HEARTBEAT, {
          tabId: this.tabId,
          timestamp: Date.now(),
          isLeader: this.isLeaderTab,
          deviceId: this.deviceId,
          sessionId: this.sessionId,
        });
      }
    }, SOCKET_CONFIG.HEARTBEAT.INTERVAL);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Broadcast message to other tabs
   */
  private broadcastMessage(message: any): void {
    if (!this.broadcastChannel) return;

    try {
      this.broadcastChannel.postMessage(message);
    } catch (error) {
      logger.error("Failed to broadcast message", {
        error,
        component: "WebSocketAuthService",
      });
    }
  }

  /**
   * Update user activity
   */
  public updateUserActivity(): void {
    this.lastActivity = Date.now();

    // Emit to server if connected
    if (this.socket?.connected) {
      this.socket.emit("user:activity", {
        tabId: this.tabId,
        timestamp: this.lastActivity,
      });
    }

    // Broadcast to other tabs
    this.broadcastMessage({
      type: "USER_ACTIVITY",
      timestamp: this.lastActivity,
    });

    // Emit event
    this.eventEmitter.emit(AuthEventType.USER_ACTIVITY, {
      timestamp: this.lastActivity,
    });
  }

  /**
   * Request token refresh
   */
  public requestTokenRefresh(): void {
    if (!this.socket?.connected) {
      logger.warn("Cannot request token refresh: WebSocket not connected", {
        component: "WebSocketAuthService",
      });
      return;
    }

    logger.info("Requesting token refresh", {
      component: "WebSocketAuthService",
    });

    this.socket.emit("token:refresh", {
      tabId: this.tabId,
      timestamp: Date.now(),
      isLeader: this.isLeaderTab,
    });
  }

  /**
   * Disconnect WebSocket
   */
  public disconnect(): void {
    logger.info("Disconnecting WebSocket", {
      component: "WebSocketAuthService",
    });

    this.cleanup();
  }

  /**
   * Join rooms based on authentication state
   */
  private joinRooms(): void {
    if (!this.socket?.connected) {
      logger.warn("Cannot join rooms: Socket not connected", {
        component: "WebSocketAuthService",
      });
      return;
    }

    // Get user ID from token service if available
    let userId = null;
    if (this.tokenService) {
      // Use getUserId method if available
      userId = this.tokenService.getUserId() || null;
    }

    // Skip if no user ID or session ID
    if (!userId && !this.sessionId) {
      logger.warn("Cannot join rooms: No user ID or session ID", {
        component: "WebSocketAuthService",
      });
      return;
    }

    // Emit join rooms event
    this.socket.emit("auth:join", {
      userId: userId,
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      tabId: this.tabId,
      timestamp: Date.now(),
      isLeader: this.isLeaderTab,
    });

    logger.debug("Joining rooms", {
      userId,
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      tabId: this.tabId,
      component: "WebSocketAuthService",
    });
  }

  /**
   * Start leader election process
   */
  private startLeaderElection(): void {
    // Clear existing interval
    if (this.leaderElectionInterval) {
      clearInterval(this.leaderElectionInterval);
      this.leaderElectionInterval = null;
    }

    // Check if we're already the leader
    this.checkLeaderStatus();

    // Start leader election interval
    this.leaderElectionInterval = setInterval(() => {
      this.checkLeaderStatus();
    }, SOCKET_CONFIG.CROSS_TAB.LEADER_ELECTION.HEARTBEAT_INTERVAL);
  }

  /**
   * Check leader status
   */
  private checkLeaderStatus(): void {
    if (typeof localStorage === "undefined") return;

    const now = Date.now();
    const leaderId = localStorage.getItem(
      SOCKET_CONFIG.CROSS_TAB.LEADER_ELECTION.LEADER_ID_KEY
    );
    const lastHeartbeat = localStorage.getItem(
      SOCKET_CONFIG.CROSS_TAB.LEADER_ELECTION.LAST_HEARTBEAT_KEY
    );

    // Check if leader is active
    if (leaderId && lastHeartbeat) {
      const heartbeatTime = parseInt(lastHeartbeat, 10);
      const isLeaderActive =
        now - heartbeatTime <
        SOCKET_CONFIG.CROSS_TAB.LEADER_ELECTION.HEARTBEAT_TIMEOUT;

      if (isLeaderActive) {
        // Leader is active
        this.isLeaderTab = leaderId === this.tabId;

        // If we are the leader, update heartbeat
        if (this.isLeaderTab) {
          localStorage.setItem(
            SOCKET_CONFIG.CROSS_TAB.LEADER_ELECTION.LAST_HEARTBEAT_KEY,
            now.toString()
          );
        }
      } else {
        // Leader is inactive, start election
        this.startElection();
      }
    } else {
      // No leader, start election
      this.startElection();
    }
  }

  /**
   * Start leader election
   */
  private startElection(): void {
    // Calculate priority score
    const priorityScore = this.calculatePriorityScore();

    // Set as leader
    localStorage.setItem(
      SOCKET_CONFIG.CROSS_TAB.LEADER_ELECTION.LEADER_ID_KEY,
      this.tabId
    );
    localStorage.setItem(
      SOCKET_CONFIG.CROSS_TAB.LEADER_ELECTION.LAST_HEARTBEAT_KEY,
      Date.now().toString()
    );
    localStorage.setItem(`${this.tabId}_priority`, priorityScore.toString());

    // Update leader status
    this.isLeaderTab = true;

    // Broadcast leader elected event
    this.broadcastMessage({
      type: "LEADER_ELECTED",
      leaderId: this.tabId,
      priority: priorityScore,
      timestamp: Date.now(),
    });

    // Emit leader elected event
    this.eventEmitter.emit(AuthEventType.LEADER_ELECTED, {
      leaderId: this.tabId,
      priority: priorityScore,
      timestamp: Date.now(),
    });

    logger.info(`Tab ${this.tabId} elected as leader`, {
      priority: priorityScore,
      component: "WebSocketAuthService",
    });

    // If socket is connected, notify server
    if (this.socket?.connected) {
      this.socket.emit("leader:elected", {
        tabId: this.tabId,
        deviceId: this.deviceId,
        sessionId: this.sessionId,
        timestamp: Date.now(),
        priority: priorityScore,
      });
    }
  }

  /**
   * Calculate priority score for leader election
   */
  private calculatePriorityScore(): number {
    const factors = SOCKET_CONFIG.CROSS_TAB.LEADER_ELECTION.PRIORITY_FACTORS;
    let score = 0;

    // Visibility factor
    if (document.visibilityState === "visible") {
      score += factors.VISIBILITY;
    }

    // Creation time factor (older tabs get higher priority)
    const creationTime = parseInt(this.tabId.split("_")[2], 10) || Date.now();
    const ageInMinutes = (Date.now() - creationTime) / (60 * 1000);
    score += Math.min(ageInMinutes, 60) * (factors.CREATION_TIME / 60);

    // Activity factor
    const timeSinceActivity = Date.now() - this.lastActivity;
    const activityScore = Math.max(
      0,
      factors.ACTIVITY - timeSinceActivity / (60 * 1000)
    );
    score += activityScore;

    // Random factor to break ties
    score += Math.random() * factors.RANDOM;

    return score;
  }

  /**
   * Participate in leader election
   */
  private participateInLeaderElection(): void {
    if (!this.socket?.connected) return;

    // Notify server about leader status
    this.socket.emit("leader:status", {
      tabId: this.tabId,
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      isLeader: this.isLeaderTab,
      timestamp: Date.now(),
    });
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    // Disconnect socket
    if (this.socket) {
      try {
        this.socket.disconnect();
        this.socket.removeAllListeners();
        this.socket = null;
      } catch (error) {
        logger.error("Error cleaning up socket", {
          error,
          component: "WebSocketAuthService",
        });
      }
    }

    // Stop heartbeat
    this.stopHeartbeat();

    // Stop leader election
    if (this.leaderElectionInterval) {
      clearInterval(this.leaderElectionInterval);
      this.leaderElectionInterval = null;
    }

    // Reset rooms
    this.rooms = {
      [RoomType.USER]: null,
      [RoomType.DEVICE]: null,
      [RoomType.SESSION]: null,
      [RoomType.TAB]: null,
    };

    // Update status
    this.status = "disconnected";
  }

  /**
   * Subscribe to events
   */
  public on(event: AuthEventType, callback: (data: any) => void): () => void {
    this.eventEmitter.on(event, callback);

    // Return unsubscribe function
    return () => {
      this.eventEmitter.off(event, callback);
    };
  }

  /**
   * Get connection status
   */
  public getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get tab ID
   */
  public getTabId(): string {
    return this.tabId;
  }

  /**
   * Get device ID
   */
  public getDeviceId(): string | null {
    return this.deviceId;
  }

  /**
   * Get session ID
   */
  public getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Check if this is the leader tab
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
   * Get socket ID
   */
  public getSocketId(): string | null {
    return this.socket?.id || null;
  }

  /**
   * Emit an event to the server
   */
  public emit(event: string, data: any): void {
    if (!this.socket?.connected) {
      logger.warn(`Cannot emit event ${event}: Socket not connected`, {
        component: "WebSocketAuthService",
      });
      return;
    }

    this.socket.emit(event, data);
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
}

// Create singleton instance
export const webSocketAuthService = WebSocketAuthService.getInstance();

// Export default
export default webSocketAuthService;
