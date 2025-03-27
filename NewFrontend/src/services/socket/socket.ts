import { io, Socket } from "socket.io-client";
import { logger } from "@/utils/logger";
import { getAuthServices } from "@/features/auth/services";

// Add these new imports
import type { TokenService } from "@/features/auth/services/TokenService";
import type { SecurityService } from "@/features/auth/services/SecurityService";

// Types for strongly typed socket interactions
type SocketStatus = "connecting" | "connected" | "disconnected" | "error";
type SessionEventType = "sync" | "activity" | "update" | "error";

interface SessionSocket extends Socket {
  initialized?: boolean;
  isAlive?: boolean;
}

interface SocketRooms {
  userRoom: string;
  deviceRoom: string;
  sessionRoom: string;
  tabRoom?: string;
}

interface SocketMetadata {
  rooms: SocketRooms;
  lastActivity: number;
  deviceInfo: Record<string, any>;
}

// Add these interfaces
interface RoomHierarchy {
  user: string;
  device: string;
  session: string;
  tab?: string;
}

interface RoomMetadata {
  type: "user" | "device" | "session" | "tab";
  id: string;
  parent?: string;
  children: Set<string>;
  capabilities?: DeviceCapabilities;
  lastActivity: number;
}

interface DeviceCapabilities {
  battery?: {
    level: number;
    charging: boolean;
  };
  network?: {
    type: string;
    downlink: number;
    rtt: number;
  };
  performance?: {
    memory: number;
    cpu: number;
  };
}

class SessionSocketManager {
  private tokenService: TokenService;
  private securityService: SecurityService;

  private socket: SessionSocket | null = null;
  private status: SocketStatus = "disconnected";
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private baseReconnectDelay: number = 1000; // Start with 1s delay
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private deviceFingerprint: string | null = null;
  private tabId: string = `tab_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  private metadata: SocketMetadata | null = null;
  private rooms: Map<string, RoomMetadata> = new Map();
  private currentRooms: RoomHierarchy | null = null;

  // Store the tab ID in session storage for consistent identification
  constructor() {
    const { tokenService, securityService } = getAuthServices();
    this.tokenService = tokenService;
    this.securityService = securityService;

    if (typeof window !== "undefined") {
      // Use existing tab ID or create a new one
      this.tabId = window.sessionStorage.getItem("tab_id") || this.tabId;
      window.sessionStorage.setItem("tab_id", this.tabId);
    }
  }

  /**
   * Initialize the socket connection
   * @param deviceFingerprint Optional device fingerprint for additional authentication
   */
  public initialize(deviceFingerprint?: string): void {
    if (this.socket?.connected || this.socket?.io?.engine?.readyState === "opening") {
      logger.info("Socket already initialized and connecting/connected");
      return;
    }

    // Force cleanup of any existing socket
    if (this.socket) {
      logger.info("Cleaning up existing socket before initialization");
      try {
        this.socket.disconnect();
      } catch (e) {
        logger.error("Error during socket cleanup:", e);
      }
      this.socket = null;
    }

    this.deviceFingerprint = deviceFingerprint || null;

    try {
      const wsUrl = this.getWebSocketUrl();
      logger.info(`Initializing socket with URL: ${wsUrl}/session`);  // Changed to info level

      this.socket = io(`${wsUrl}/session`, {
        autoConnect: true,  // Changed to true for immediate connection
        reconnection: true, // Enable built-in reconnection
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        transports: ["websocket"],
        withCredentials: true,
        auth: {
          deviceFingerprint: this.deviceFingerprint,
        },
        query: {
          tabId: this.tabId,
          clientInfo: this.getClientInfo(),
        },
        timeout: 15000,
      }) as SessionSocket;

      this.socket.initialized = true;
      this.setupEventHandlers();
      this.setupHeartbeat();
      
      // Add debug logging for connection process
      logger.debug("Socket initialized, connecting...");
      this.connect();

      logger.info("Session socket initialized");
    } catch (error) {
      logger.error("Failed to initialize socket:", error);
      this.status = "error";
      this.triggerEvent("status", this.status);
    }
  }

  /**
   * Set up socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Add debug event for connection attempt
    this.socket.io.on("reconnect_attempt", () => {
      logger.debug("Socket.IO reconnect attempt");
    });

    // Add debug event for engine packet
    this.socket.io.engine?.on("packet", (packet: any) => {
      logger.debug(`Socket engine packet: ${packet.type}`);
    });

    // Connection events
    this.socket.on("connect", () => {
      logger.info("Session socket connected", {
        id: this.socket?.id,
        transport: this.socket?.io?.engine?.transport?.name || "unknown",
      });
      this.status = "connected";
      this.reconnectAttempts = 0;
      this.triggerEvent("status", this.status);
    });

    this.socket.on("disconnect", (reason) => {
      logger.info(`Socket disconnected: ${reason}`);
      this.status = "disconnected";
      this.triggerEvent("status", this.status);

      // Handle reconnection
      this.handleReconnect(reason);
    });

    // Add more detailed connection logging
    this.socket.io.on("reconnect", (attempt) => {
      logger.info(`Socket reconnected after ${attempt} attempts`);
      this.status = "connected";
      this.triggerEvent("status", this.status);
    });

    this.socket.io.on("reconnect_error", (error) => {
      logger.error("Socket reconnection error:", error);
      this.status = "error";
      this.triggerEvent("status", this.status);
    });

    // Add connection status logging
    this.socket.on("connecting", () => {
      logger.info("Socket connecting...");
      this.status = "connecting";
      this.triggerEvent("status", this.status);
    });

    this.socket.on("connect_error", (error: any) => {
      // Log detailed error information
      logger.error("Session socket connection error", {
        message: error.message || "Unknown error",
        description: error.description || "No description",
        context: error.context || "unknown",
        data: error.data || null,
        type: error.type || "unknown",
        stack: error.stack,
        // Log additional connection details
        withCredentials: this.socket?.io?.opts?.withCredentials,
        url: this.getWebSocketUrl() || 'unknown',
        transportType: this.socket?.io?.engine?.transport?.name,
      });
      
      this.status = "error";
      this.triggerEvent("status", this.status);
      this.handleReconnect("connect_error");
    });

    // Session-specific events
    this.socket.on("session-update", (data) => {
      logger.debug("Received session update:", data);
      this.triggerEvent("session-update", {
        ...data,
        scope: data.scope || "session",
      });
    });

    this.socket.on("activity-update", (data) => {
      logger.debug("Received activity update", data);
      this.triggerEvent("activity-update", data);
    });

    this.socket.on("error", (error) => {
      logger.error("Socket error:", error);
      this.triggerEvent("error", error);
    });

    // Add room-specific event handlers
    this.socket.on("device:connection", (data) => {
      logger.debug("New device connection:", data);
      this.triggerEvent("device:connection", data);
    });

    this.socket.on("device:disconnect", (data) => {
      logger.debug("Device disconnected:", data);
      this.triggerEvent("device:disconnect", data);
    });

    // Room-specific events
    this.socket.on(
      "room:update",
      (data: { room: string; event: string; data: any }) => {
        logger.debug("Room update:", data);
        this.triggerEvent(`room:${data.room}:${data.event}`, data.data);
      }
    );

    this.socket.on("capability:request", async () => {
      try {
        const capabilities = await this.getDeviceCapabilities();
        this.socket?.emit("capability:update", capabilities);
      } catch (error) {
        logger.error("Failed to send capability update:", error);
      }
    });

    // Handle room disconnections
    this.socket.on(
      "room:disconnected",
      (data: { room: string; reason: string }) => {
        logger.warn("Room disconnected:", data);
        if (this.currentRooms) {
          // Attempt to rejoin if it was our current room
          Object.entries(this.currentRooms).forEach(([key, roomId]) => {
            if (roomId === data.room) {
              this.joinRoomHierarchy().catch((error) => {
                logger.error("Failed to rejoin rooms:", error);
              });
            }
          });
        }
      }
    );

    // Add heartbeat response
    this.socket.on("ping", () => {
      logger.debug("Received ping, sending pong response");
      this.socket?.emit("pong");
      if (this.socket) this.socket.isAlive = true;
    });

    // Also handle server-side ping events
    this.socket.on("heartbeat", () => {
      logger.debug("Received heartbeat, sending response");
      this.socket?.emit("heartbeat:response", { tabId: this.tabId, timestamp: Date.now() });
      if (this.socket) this.socket.isAlive = true;
    });
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect(reason: string): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Don't attempt to reconnect if we're already connected
    if (this.status === "connected") {
      return;
    }

    // Check if we should stop reconnection attempts
    if (
      this.reconnectAttempts >= this.maxReconnectAttempts ||
      reason === "io client disconnect" // Only abort on client-initiated disconnect
    ) {
      logger.warn(
        `Socket reconnection abandoned after ${this.reconnectAttempts} attempts or client-forced disconnect`
      );
      return;
    }

    // Calculate exponential backoff delay with jitter
    const delay = Math.min(
      30000, // Maximum 30 second delay
      this.baseReconnectDelay *
        Math.pow(1.5, this.reconnectAttempts) *
        (0.9 + 0.2 * Math.random())
    );

    this.reconnectAttempts++;

    logger.info(
      `Socket reconnecting in ${Math.round(delay)}ms (attempt ${
        this.reconnectAttempts
      }/${this.maxReconnectAttempts})`
    );
    this.status = "connecting";
    this.triggerEvent("status", this.status);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Connect to the socket server
   */
  private async connect(): Promise<void> {
    if (!this.socket || this.status === "connected") return;

    try {
      this.status = "connecting";
      await this.socket.connect();
      await this.joinRoomHierarchy();
    } catch (error) {
      logger.error("Failed to connect socket:", error);
      this.status = "error";
    }
  }

  /**
   * Disconnect from the socket server
   */
  disconnect(): void {
    if (!this.socket) return;

    try {
      if (this.currentRooms) {
        // Leave rooms in reverse order
        const rooms = Object.values(this.currentRooms).reverse();
        rooms.forEach((room) => {
          this.socket?.emit("leave", room);
        });
      }

      this.socket.disconnect();
      this.status = "disconnected";
      this.currentRooms = null;
    } catch (error) {
      logger.error("Error disconnecting socket:", error);
    }
  }

  /**
   * Send a sync request with scope and room targeting
   */
  sync(
    options: {
      scope: "session" | "device" | "user" | "tab";
      data?: any;
      target?: string;
    } = { scope: "session" }
  ): void {
    if (!this.socket || this.status !== "connected" || !this.currentRooms)
      return;

    try {
      const roomId = this.currentRooms[options.scope];
      if (!roomId) {
        throw new Error(`Invalid sync scope: ${options.scope}`);
      }

      this.socket.emit("sync", {
        room: roomId,
        target: options.target,
        tabId: this.tabId,
        clientInfo: this.getClientInfo(),
        timestamp: Date.now(),
        data: options.data,
      });
    } catch (error) {
      logger.error("Error sending sync request:", error);
    }
  }

  /**
   * Send an activity update to the server
   */
  activity(): void {
    if (!this.socket || this.status !== "connected") return;

    try {
      this.socket.emit("activity", {
        tabId: this.tabId,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error("Error sending activity update:", error);
    }
  }

  /**
   * Add an event listener
   */
  on(event: string, callback: Function): () => void {
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
   * Trigger event callbacks
   */
  private triggerEvent(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);

    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`Error in socket event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Get current socket status
   */
  getStatus(): SocketStatus {
    return this.status;
  }

  /**
   * Get client information for tracking
   */
  private getClientInfo(): Record<string, any> {
    if (typeof navigator === "undefined") {
      return { type: "server" };
    }

    // Basic device information
    const info: Record<string, any> = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      devicePixelRatio: window.devicePixelRatio,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: Date.now(),
    };

    // Enhanced battery info if available
    try {
      if ("getBattery" in navigator) {
        // @ts-ignore: getBattery() exists but TypeScript doesn't know about it
        navigator.getBattery().then((battery: any) => {
          const batteryInfo = {
            level: battery.level,
            charging: battery.charging,
          };

          // Only send battery info if it changes significantly
          if (
            !this.lastBatteryInfo ||
            Math.abs(this.lastBatteryInfo.level - battery.level) > 0.05 ||
            this.lastBatteryInfo.charging !== battery.charging
          ) {
            this.lastBatteryInfo = batteryInfo;
            if (this.socket?.connected) {
              this.socket.emit("client-info-update", {
                battery: batteryInfo,
              });
            }
          }
        });
      }
    } catch (e) {
      // Battery API may not be available
    }

    // Network information if available
    try {
      // @ts-ignore: navigator.connection exists but TypeScript doesn't know about it
      if (navigator.connection) {
        info.network = {
          // @ts-ignore: navigator.connection exists but TypeScript doesn't know about it
          type: navigator.connection.effectiveType,
          // @ts-ignore: navigator.connection exists but TypeScript doesn't know about it
          downlink: navigator.connection.downlink,
          // @ts-ignore: navigator.connection exists but TypeScript doesn't know about it
          rtt: navigator.connection.rtt,
        };
      }
    } catch (e) {
      // Network API may not be available
    }

    return info;
  }

  // Store last battery info to avoid excessive updates
  private lastBatteryInfo: { level: number; charging: boolean } | null = null;

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.disconnect();
    this.eventListeners.clear();
    this.socket = null;
  }

  /**
   * Get WebSocket URL based on environment
   */
  private getWebSocketUrl(): string {
    // Get base API URL from environment or use current origin
    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
    
    // For development, ensure we're using the right port
    if (import.meta.env.DEV && !import.meta.env.VITE_API_URL) {
      // Default development backend port is 3000
      return 'http://localhost:3000';
    }
    
    return apiUrl;
  }

  // Add new method for room management
  private async joinRoomHierarchy(): Promise<void> {
    if (!this.socket?.connected) return;

    try {
      // Verify we have valid session
      const session = this.tokenService.getSessionInfo();
      if (!session?.isValid) {
        throw new Error("No valid session found");
      }

      // Create room IDs
      const roomIds = {
        user: `user:${this.getUserId()}`,
        device: `device:${this.deviceFingerprint || "unknown"}`,
        session: `session:${this.getSessionId()}`,
        tab: `tab:${this.tabId}`,
      };

      // Join rooms in hierarchical order with error handling
      try {
        await this.socket.emitWithAck("join:user", roomIds.user);
        logger.debug("Joined user room", { roomId: roomIds.user });

        await this.socket.emitWithAck("join:device", {
          roomId: roomIds.device,
          parent: roomIds.user,
          capabilities: await this.getDeviceCapabilities(),
        });
        logger.debug("Joined device room", { roomId: roomIds.device });

        await this.socket.emitWithAck("join:session", {
          roomId: roomIds.session,
          parent: roomIds.device,
        });
        logger.debug("Joined session room", { roomId: roomIds.session });

        await this.socket.emitWithAck("join:tab", {
          roomId: roomIds.tab,
          parent: roomIds.session,
        });
        logger.debug("Joined tab room", { roomId: roomIds.tab });

        this.currentRooms = roomIds;
        logger.info("Successfully joined room hierarchy", { rooms: roomIds });
      } catch (error) {
        // If any room join fails, attempt cleanup
        logger.error("Failed to join rooms, cleaning up", error);
        this.disconnect();
        throw error;
      }
    } catch (error) {
      logger.error("Failed to initialize room hierarchy:", error);
      throw error;
    }
  }

  // Add method to get device capabilities
  private async getDeviceCapabilities(): Promise<DeviceCapabilities> {
    const capabilities: DeviceCapabilities = {};

    // Battery info
    try {
      if ("getBattery" in navigator) {
        const battery: any = await (navigator as any).getBattery();
        capabilities.battery = {
          level: battery.level,
          charging: battery.charging,
        };
      }
    } catch (e) {
      // Battery API not available
    }

    // Network info
    try {
      const connection = (navigator as any).connection;
      if (connection) {
        capabilities.network = {
          type: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
        };
      }
    } catch (e) {
      // Network API not available
    }

    // Performance info
    try {
      const memory = (performance as any).memory;
      capabilities.performance = {
        memory: memory?.usedJSHeapSize || 0,
        cpu: navigator.hardwareConcurrency || 1,
      };
    } catch (e) {
      // Performance API not available
    }

    return capabilities;
  }

  // Add method to get specific room events
  subscribeToRoom(
    roomType: keyof RoomHierarchy,
    event: string,
    callback: (data: any) => void
  ): () => void {
    if (!this.currentRooms?.[roomType]) {
      logger.warn(`Cannot subscribe to room type ${roomType}: not joined`);
      return () => {};
    }

    const eventName = `room:${this.currentRooms[roomType]}:${event}`;
    return this.on(eventName, callback);
  }

  /**
   * Get current user ID from token
   */
  private getUserId(): string {
    try {
      const session = this.tokenService.getSessionInfo();
      if (!session?.userId) {
        throw new Error("No user ID found in session");
      }
      return session.userId;
    } catch (error) {
      logger.error("Failed to get user ID:", error);
      throw error;
    }
  }

  /**
   * Get current session ID from token
   */
  private getSessionId(): string {
    try {
      const session = this.tokenService.getSessionInfo();
      if (!session?.id) {
        throw new Error("No session ID found");
      }
      return session.id;
    } catch (error) {
      logger.error("Failed to get session ID:", error);
      throw error;
    }
  }

  /**
   * Set up heartbeat mechanism to keep the connection alive
   */
  private setupHeartbeat(): void {
    // Send activity update every 20 seconds to keep the connection alive
    const heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        // Use the socket's emit method directly instead of this.activity()
        this.socket.emit("heartbeat:response", { 
          tabId: this.tabId, 
          timestamp: Date.now() 
        });
        
        if (this.socket) this.socket.isAlive = true;
        logger.debug("Sent heartbeat response");
      } else if (this.status === "disconnected") {
        clearInterval(heartbeatInterval);
      }
    }, 20000); // 20 seconds

    // Clear interval when component unmounts
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        clearInterval(heartbeatInterval);
      });
    }
  }

  /**
   * Check if socket exists
   */
  public hasSocket(): boolean {
    return !!this.socket;
  }

  /**
   * Check if socket is connected
   */
  public isConnected(): boolean {
    return !!this.socket?.connected;
  }
}

// Replace the direct instantiation with a getter function
let _sessionSocketManager: SessionSocketManager | null = null;

// Export a function to get the singleton instance
export function getSessionSocketManager(): SessionSocketManager {
  if (!_sessionSocketManager) {
    _sessionSocketManager = new SessionSocketManager();
    logger.info("Created new SessionSocketManager instance");
  }
  return _sessionSocketManager;
}

// Update the initializeSessionSocket function
export function initializeSessionSocket(): void {
  logger.info("Initializing session socket connection");
  const { securityService } = getAuthServices();

  // Get device fingerprint from security service
  securityService.getDeviceFingerprint().then((fingerprint) => {
    // Initialize socket with fingerprint
    const socketManager = getSessionSocketManager();
    socketManager.initialize(fingerprint);
    
    // Log connection attempt
    logger.info("Socket initialization triggered with device fingerprint", { fingerprint: fingerprint ? "present" : "missing" });
  }).catch(error => {
    logger.error("Failed to get device fingerprint, initializing without it", error);
    // Initialize socket without fingerprint as fallback
    getSessionSocketManager().initialize();
  });
}

// Remove the direct export of sessionSocketManager
// export const sessionSocketManager = new SessionSocketManager();
