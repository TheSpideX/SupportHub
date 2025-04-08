/**
 * PrimusAuthService
 * Replaces WebSocketAuthService with Primus for bidirectional communication
 */

import { EventEmitter } from "@/utils/EventEmitter";
import { logger } from "@/utils/logger";
import { TokenService } from "./TokenService";
import { SecurityService } from "./SecurityService";
import { SOCKET_CONFIG } from "@/config/socket";

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
    this.tabId = `tab_${Math.random()
      .toString(36)
      .substring(2, 9)}_${Date.now()}`;

    // Initialize device ID
    this.initializeDeviceId();

    // Load Primus client library
    this.loadPrimusLibrary();
  }

  /**
   * Initialize device ID
   */
  private async initializeDeviceId(): Promise<void> {
    if (this.securityService) {
      try {
        this.deviceId = await this.securityService.getDeviceFingerprint();
      } catch (error) {
        logger.error("Failed to get device fingerprint", {
          error,
          component: "PrimusAuthService",
        });
        // Generate a fallback device ID
        this.deviceId = `device_${Math.random()
          .toString(36)
          .substring(2, 9)}_${Date.now()}`;
      }
    } else {
      // Generate a fallback device ID
      this.deviceId = `device_${Math.random()
        .toString(36)
        .substring(2, 9)}_${Date.now()}`;
    }
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
   * Connect to the server
   */
  public connect(): void {
    if (this.primus && this.status === "connected") {
      logger.debug("Already connected", {
        component: "PrimusAuthService",
      });
      return;
    }

    // Get CSRF token if available
    if (this.tokenService) {
      this.csrfToken = this.tokenService.getCsrfToken() || "";
    }

    // Get security context if available
    let securityContext = null;
    if (this.securityService) {
      securityContext = this.securityService.getSecurityContext();
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
    this.primus.on(
      "token:refresh_error",
      this.handleTokenRefreshError.bind(this)
    );

    // Room events
    this.primus.on("room:joined", this.handleRoomJoined.bind(this));

    // Leader election events
    this.primus.on("leader:elected", this.handleLeaderElected.bind(this));

    // Device events
    this.primus.on("device:info", this.handleDeviceInfo.bind(this));

    // Heartbeat
    this.primus.on("heartbeat", this.handleHeartbeat.bind(this));

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
    logger.info("Primus connected", {
      component: "PrimusAuthService",
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
            });
        }, backoffDelay);
      } else {
        logger.error("Cannot refresh token: TokenService not available", {
          component: "PrimusAuthService",
        });
      }
    } else {
      // For non-auth errors, just log the error
      logger.error("Primus connection error (non-auth)", {
        message: error.message,
        component: "PrimusAuthService",
      });
    }
  }

  /**
   * Handle authentication success
   */
  private handleAuthSuccess(data: any): void {
    logger.info("Authentication successful", {
      component: "PrimusAuthService",
    });

    // Emit event
    this.eventEmitter.emit(AuthEventType.AUTH_SUCCESS, {
      ...data,
      timestamp: Date.now(),
    });

    // Join rooms
    this.joinRooms();
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
    logger.debug("Room joined", {
      data,
      component: "PrimusAuthService",
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
  }

  /**
   * Handle leader elected
   */
  private handleLeaderElected(data: any): void {
    logger.info("Leader elected", {
      data,
      component: "PrimusAuthService",
    });

    // Update leader status
    this.isLeaderTab = data.tabId === this.tabId;

    // Emit event
    this.eventEmitter.emit(AuthEventType.LEADER_ELECTED, {
      ...data,
      isLeader: this.isLeaderTab,
      timestamp: Date.now(),
    });
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
   * Handle heartbeat
   */
  private handleHeartbeat(data: any): void {
    // Respond to heartbeat
    if (this.primus && this.status === "connected") {
      this.primus.write({
        event: "heartbeat:response",
        payload: {
          timestamp: Date.now(),
          tabId: this.tabId,
          deviceId: this.deviceId,
        },
      });
    }
  }

  /**
   * Handle security event
   */
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
    if (this.tokenService) {
      const userData = this.tokenService.getUserData();
      userId = userData?.id || null;
    }

    // Join user room
    if (userId) {
      this.primus.write({
        event: "join",
        room: `user:${userId}`,
      });
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
  }

  /**
   * Disconnect from the server
   */
  public disconnect(): void {
    if (!this.primus) {
      return;
    }

    // Close the connection
    this.primus.end();

    // Clear rooms
    this.rooms = {
      [RoomType.USER]: null,
      [RoomType.DEVICE]: null,
      [RoomType.SESSION]: null,
      [RoomType.TAB]: null,
    };
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
   * Remove all event listeners
   */
  public removeAllListeners(event?: string): void {
    this.eventEmitter.removeAllListeners(event);
  }
}

// Export singleton instance
export const primusAuthService = PrimusAuthService.getInstance();

// For backward compatibility
export { primusAuthService as webSocketAuthService };
