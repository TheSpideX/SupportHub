import { logger } from "@/utils/logger";

// Simple EventEmitter implementation
class SimpleEventEmitter {
  private events: Record<string, Array<(data: any) => void>> = {};

  public on(event: string, callback: (data: any) => void): () => void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.events[event]?.indexOf(callback);
      if (index !== undefined && index > -1) {
        this.events[event].splice(index, 1);
      }
    };
  }

  public emit(event: string, data?: any): void {
    if (!this.events[event]) return;

    this.events[event].forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        logger.error(`Error in event handler for ${event}:`, error);
      }
    });
  }
}

// Message types
export enum MessageType {
  SESSION_UPDATED = "SESSION_UPDATED",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  USER_ACTIVITY = "USER_ACTIVITY",
  TOKENS_UPDATED = "TOKENS_UPDATED",
  TOKENS_REFRESHED = "TOKENS_REFRESHED",
  AUTH_STATE_CHANGED = "AUTH_STATE_CHANGED",
  LOGOUT = "LOGOUT",
  LEADER_PING = "LEADER_PING",
  LEADER_ELECTION = "LEADER_ELECTION",
  LOGIN_SUCCESS = "LOGIN_SUCCESS", // New message type
  TAB_VISIBLE = "TAB_VISIBLE",     // New message type
}

// Cross-tab message interface
export interface CrossTabMessage {
  type: MessageType;
  payload: any;
  timestamp: number;
  sourceTabId: string;
  signature?: string; // For message integrity
}

// Configuration options
export interface CrossTabConfig {
  channelName: string;
  storagePrefix: string;
  leaderCheckInterval: number;
  messageTimeout: number;
  debug: boolean;
  workerPath: string; // Path to shared worker script
  useSharedWorker: boolean; // Whether to use SharedWorker
}

// Default configuration
const DEFAULT_CONFIG: CrossTabConfig = {
  channelName: "auth_unified_channel",
  storagePrefix: "auth_sync_",
  leaderCheckInterval: 5000, // 5 seconds
  messageTimeout: 5000, // Messages older than 5 seconds are ignored
  debug: false,
  workerPath: "/src/features/auth/workers/AuthSharedWorker.js", // Default path
  useSharedWorker: true, // Enable by default
};

export class CrossTabService {
  private static instance: CrossTabService | null = null;

  private eventEmitter: SimpleEventEmitter = new SimpleEventEmitter();
  private config: CrossTabConfig;
  private broadcastChannel: BroadcastChannel | null = null;
  private sharedWorker: SharedWorker | null = null;
  private workerPort: MessagePort | null = null;
  private tabId: string;
  private cleanupFunctions: Array<() => void> = [];
  private leaderCheckIntervalId: number | null = null;
  private isInitialized: boolean = false;
  private workerHeartbeatId: number | null = null;
  private workerAvailable: boolean = false;
  private isLeaderTab: boolean = false;
  private leaderStorageKey: string;

  // Get singleton instance
  public static getInstance(
    config: Partial<CrossTabConfig> = {}
  ): CrossTabService {
    // Store on window object to survive hot module replacement
    const w = typeof window !== "undefined" ? (window as any) : {};

    if (!w.__crossTabServiceInstance) {
      w.__crossTabServiceInstance = new CrossTabService(config);
      CrossTabService.instance = w.__crossTabServiceInstance;
    }

    return w.__crossTabServiceInstance;
  }

  private constructor(configOptions: Partial<CrossTabConfig> = {}) {
    // Return existing instance if already created (for HMR safety)
    const w = typeof window !== "undefined" ? (window as any) : {};
    if (w.__crossTabServiceInstance) {
      return w.__crossTabServiceInstance;
    }

    this.config = { ...DEFAULT_CONFIG, ...configOptions };
    this.tabId = this.generateTabId();
    this.leaderStorageKey = `${this.config.storagePrefix}leader`;

    if (typeof window !== "undefined") {
      this.initialize();
    }
  }

  // Initialize service
  private initialize(): void {
    if (this.isInitialized) {
      return;
    }

    logger.info("Initializing CrossTabService", { tabId: this.tabId });

    // Store tab ID in session storage
    sessionStorage.setItem("tab_id", this.tabId);

    // Setup communication channels
    this.setupCommunicationChannels();

    // If SharedWorker is not available, fall back to traditional methods
    if (!this.workerAvailable) {
      // Start leader election process
      this.startLeaderElection();
    }

    // Start health check process
    this.startHealthCheck();

    // Mark as initialized
    this.isInitialized = true;
  }

  // Generate unique tab ID
  private generateTabId(): string {
    return `tab_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
  }

  // Set up communication channels
  private setupCommunicationChannels(): void {
    try {
      // Try SharedWorker first if enabled
      if (this.config.useSharedWorker && typeof SharedWorker !== "undefined") {
        try {
          // Create SharedWorker instance
          this.sharedWorker = new SharedWorker(this.config.workerPath);
          this.workerPort = this.sharedWorker.port;

          // Set up message handler
          this.workerPort.addEventListener("message", (event) => {
            this.handleWorkerMessage(event.data);
          });

          // Start the port
          this.workerPort.start();

          // Send initial connection message with tabId
          this.workerPort.postMessage({
            type: "INIT",
            payload: { tabId: this.tabId },
            tabId: this.tabId,
            timestamp: Date.now(),
          });

          // Add cleanup function
          this.cleanupFunctions.push(() => {
            if (this.workerPort) {
              this.workerPort.close();
            }
          });

          // Set up heartbeat to monitor worker connection
          this.startWorkerHeartbeat();

          this.workerAvailable = true;
          logger.info("SharedWorker communication initialized");
        } catch (error) {
          logger.error(
            "Failed to initialize SharedWorker, falling back",
            error
          );
          this.workerAvailable = false;
        }
      }

      // If SharedWorker failed or is not available, try BroadcastChannel API
      if (!this.workerAvailable && typeof BroadcastChannel !== "undefined") {
        this.broadcastChannel = new BroadcastChannel(this.config.channelName);
        this.broadcastChannel.addEventListener("message", (event) => {
          this.handleIncomingMessage(event.data);
        });

        // Add to cleanup functions
        this.cleanupFunctions.push(() => {
          if (this.broadcastChannel) {
            this.broadcastChannel.removeEventListener("message", (event) => {
              this.handleIncomingMessage(event.data);
            });
            this.broadcastChannel.close();
          }
        });

        logger.debug("BroadcastChannel communication initialized");
      } else if (!this.workerAvailable) {
        logger.warn(
          "BroadcastChannel API not available, using localStorage fallback"
        );
      }

      // Set up localStorage event listener as final fallback
      const storageHandler = (event: StorageEvent) => {
        if (
          !event.key ||
          !event.key.startsWith(this.config.storagePrefix) ||
          !event.newValue
        ) {
          return;
        }

        try {
          const message = JSON.parse(event.newValue);
          this.handleIncomingMessage(message);
        } catch (error) {
          logger.error("Failed to parse storage event", error);
        }
      };

      window.addEventListener("storage", storageHandler);
      this.cleanupFunctions.push(() => {
        window.removeEventListener("storage", storageHandler);
      });
    } catch (error) {
      logger.error("Failed to setup communication channels", error);
    }
  }

  // Start heartbeat to verify worker connection
  private startWorkerHeartbeat(): void {
    if (this.workerHeartbeatId) {
      clearInterval(this.workerHeartbeatId);
    }

    this.workerHeartbeatId = window.setInterval(() => {
      if (this.workerPort) {
        try {
          const heartbeatStart = Date.now();

          // Send heartbeat message
          this.workerPort.postMessage({
            type: "HEARTBEAT",
            payload: { timestamp: heartbeatStart },
            tabId: this.tabId,
            timestamp: heartbeatStart,
          });

          // Set timeout to detect worker failure
          const timeoutId = setTimeout(() => {
            logger.warn(
              "SharedWorker heartbeat timeout - worker may be unresponsive"
            );
            this.workerAvailable = false;

            // Fall back to traditional methods
            if (!this.leaderCheckIntervalId) {
              this.startLeaderElection();
            }
          }, 2000); // 2 second timeout

          // Add one-time handler to clear timeout when response received
          const heartbeatHandler = (event: MessageEvent) => {
            if (event.data && event.data.type === "HEARTBEAT_RESPONSE") {
              clearTimeout(timeoutId);
              this.workerPort?.removeEventListener("message", heartbeatHandler);
            }
          };

          this.workerPort.addEventListener("message", heartbeatHandler);
        } catch (error) {
          logger.error("SharedWorker heartbeat failed", error);
          this.workerAvailable = false;

          // Fall back to traditional methods
          if (!this.leaderCheckIntervalId) {
            this.startLeaderElection();
          }
        }
      }
    }, 30000); // Check every 30 seconds

    this.cleanupFunctions.push(() => {
      if (this.workerHeartbeatId) {
        clearInterval(this.workerHeartbeatId);
      }
    });
  }

  // Start leader election process (for fallback when worker is not available)
  private startLeaderElection(): void {
    // Clear any existing interval
    if (this.leaderCheckIntervalId) {
      clearInterval(this.leaderCheckIntervalId);
    }

    // Try to become the leader
    this.attemptLeaderElection();

    // Set up regular leader check
    this.leaderCheckIntervalId = window.setInterval(() => {
      this.checkLeader();
    }, this.config.leaderCheckInterval);

    // Add cleanup function
    this.cleanupFunctions.push(() => {
      if (this.leaderCheckIntervalId) {
        clearInterval(this.leaderCheckIntervalId);
        this.leaderCheckIntervalId = null;
      }
    });
  }

  // Attempt to become the leader (for fallback)
  private attemptLeaderElection(): void {
    try {
      const now = Date.now();
      const leaderData = localStorage.getItem(this.leaderStorageKey);

      if (!leaderData) {
        // No leader, become the leader
        this.becomeLeader();
        return;
      }

      const leader = JSON.parse(leaderData);
      const leaderTimestamp = leader.timestamp || 0;
      const leaderExpired =
        now - leaderTimestamp > this.config.leaderCheckInterval * 3;

      if (leaderExpired) {
        // Leader expired, become the leader
        this.becomeLeader();
      } else if (leader.tabId === this.tabId) {
        // Already the leader, update timestamp
        this.updateLeaderTimestamp();
      } else {
        // Someone else is leader
        this.isLeaderTab = false;
      }
    } catch (error) {
      logger.error("Error in leader election process", error);
    }
  }

  // Become the leader (for fallback)
  private becomeLeader(): void {
    try {
      const leaderData = {
        tabId: this.tabId,
        timestamp: Date.now(),
      };
      localStorage.setItem(this.leaderStorageKey, JSON.stringify(leaderData));
      this.isLeaderTab = true;
      logger.info("This tab is now the leader");

      // Broadcast leader election result
      this.broadcastMessage(MessageType.LEADER_ELECTION, {
        tabId: this.tabId,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error("Failed to become leader", error);
    }
  }

  // Update leader timestamp (for fallback)
  private updateLeaderTimestamp(): void {
    try {
      const leaderData = {
        tabId: this.tabId,
        timestamp: Date.now(),
      };
      localStorage.setItem(this.leaderStorageKey, JSON.stringify(leaderData));
      this.isLeaderTab = true;
    } catch (error) {
      logger.error("Failed to update leader timestamp", error);
    }
  }

  // Check current leader (for fallback)
  private checkLeader(): void {
    try {
      const leaderData = localStorage.getItem(this.leaderStorageKey);
      if (!leaderData) {
        // No leader, try to become one
        this.becomeLeader();
        return;
      }

      const leader = JSON.parse(leaderData);
      this.isLeaderTab = leader.tabId === this.tabId;

      // If we are the leader, update the timestamp
      if (this.isLeaderTab) {
        this.updateLeaderTimestamp();
      }
    } catch (error) {
      logger.error("Failed to check leader", error);
    }
  }

  // Start health check process
  private startHealthCheck(): void {
    // Health check logic can be added here
    // For now, let's just clean up old messages
    this.cleanupOldMessages();
  }

  // Clean up old messages from localStorage (for fallback)
  private cleanupOldMessages(): void {
    try {
      if (typeof localStorage === "undefined") return;

      const now = Date.now();
      const keysToRemove: string[] = [];

      // Find old message keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          key.startsWith(this.config.storagePrefix) &&
          key !== this.leaderStorageKey
        ) {
          try {
            const messageData = JSON.parse(localStorage.getItem(key) || "{}");
            if (
              messageData.timestamp &&
              now - messageData.timestamp > this.config.messageTimeout * 2
            ) {
              keysToRemove.push(key);
            }
          } catch (e) {
            // Ignore parsing errors
            keysToRemove.push(key);
          }
        }
      }

      // Remove old keys
      keysToRemove.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          // Ignore errors
        }
      });
    } catch (error) {
      logger.error("Error cleaning up old messages", error);
    }
  }

  // Handle incoming messages from BroadcastChannel or localStorage (for fallback)
  private handleIncomingMessage(message: any): void {
    if (!message || !message.type) return;

    // Validate message
    if (message.tabId === this.tabId) {
      // Skip messages from self
      return;
    }

    // Check for message timeout
    if (
      message.timestamp &&
      Date.now() - message.timestamp > this.config.messageTimeout
    ) {
      logger.debug("Ignoring outdated message", { message });
      return;
    }

    // Process message
    switch (message.type) {
      case MessageType.LEADER_ELECTION:
        // Update local leadership status
        this.isLeaderTab = message.payload?.tabId === this.tabId;
        break;
      case MessageType.LEADER_PING:
        // Handle leader ping
        if (this.isLeaderTab) {
          // Respond with leader confirmation
          this.broadcastMessage(MessageType.LEADER_PING, {
            tabId: this.tabId,
            timestamp: Date.now(),
            isResponse: true,
          });
        }
        break;
      default:
        // Pass other messages to subscribers
        if (Object.values(MessageType).includes(message.type)) {
          this.eventEmitter.emit(message.type, message.payload);
        }
        break;
    }
  }

  // Handle messages from SharedWorker
  private handleWorkerMessage(message: any): void {
    if (!message || !message.type) return;

    switch (message.type) {
      case "AUTH_STATE_UPDATE":
        // Worker is sending updated auth state
        this.eventEmitter.emit(MessageType.AUTH_STATE_CHANGED, message.payload);
        logger.debug("Received auth state update from worker", {
          isAuthenticated: !!message.payload?.isAuthenticated,
        });
        break;

      case "LOGOUT_CONFIRMED":
        // Worker confirmed logout, emit to subscribers
        this.eventEmitter.emit(MessageType.LOGOUT, message.payload);
        logger.debug("Received logout confirmation from worker");
        break;

      case "LEADER_ELECTED":
      case "LEADER_INFO":
        // Update leader information
        if (message.payload && message.payload.tabId === this.tabId) {
          this.isLeaderTab = true;
          logger.debug("This tab is now the leader");
        } else {
          this.isLeaderTab = false;
        }
        break;

      case "CONNECTED_TABS":
        // Just for info logging
        if (this.config.debug) {
          logger.debug("Connected tabs:", message.payload);
        }
        break;

      // Handle other message types as needed
      default:
        // Pass through other message types to subscribers
        if (Object.values(MessageType).includes(message.type)) {
          this.eventEmitter.emit(message.type, message.payload);
        }
    }
  }

  // Broadcast a message to all tabs
  public broadcastMessage(type: MessageType, payload: any): void {
    const message = {
      type,
      payload,
      timestamp: Date.now(),
      tabId: this.tabId,
    };

    // First try SharedWorker if available
    if (this.workerAvailable && this.workerPort) {
      try {
        this.workerPort.postMessage(message);
      } catch (error) {
        logger.error("Failed to send message via SharedWorker", error);
        this.workerAvailable = false;
      }
    }

    // If worker not available or send failed, fall back to BroadcastChannel
    if (!this.workerAvailable && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(message);
      } catch (error) {
        logger.error("Failed to send message via BroadcastChannel", error);

        // Close and reset channel for reconnection attempt
        try {
          this.broadcastChannel.close();
        } catch (e) {}
        this.broadcastChannel = null;
      }
    }

    // Final fallback to localStorage
    if (!this.workerAvailable || !this.broadcastChannel) {
      try {
        const key = `${this.config.storagePrefix}${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 9)}`;
        localStorage.setItem(key, JSON.stringify(message));
        this.cleanupOldMessages();
      } catch (error) {
        logger.error("LocalStorage fallback failed", error);
      }
    }

    // Always emit locally
    this.eventEmitter.emit(type, payload);
  }

  // Public API: Check if this tab is the leader
  public isLeader(): boolean {
    return this.isLeaderTab;
  }

  // Public API: Get tab ID
  public getTabId(): string {
    return this.tabId;
  }

  // Public API: Check if SharedWorker is being used
  public isUsingSharedWorker(): boolean {
    return this.workerAvailable;
  }

  // Public API: Get connected tabs info
  public getConnectedTabs(): Promise<string[]> {
    return new Promise((resolve) => {
      if (this.workerAvailable && this.workerPort) {
        const messageHandler = (event: MessageEvent) => {
          if (event.data && event.data.type === "CONNECTED_TABS") {
            this.workerPort?.removeEventListener("message", messageHandler);
            resolve(event.data.payload?.tabs || []);
          }
        };

        // Listen for response
        this.workerPort.addEventListener("message", messageHandler);

        // Send request
        this.workerPort.postMessage({
          type: "GET_CONNECTED_TABS",
          tabId: this.tabId,
          timestamp: Date.now(),
        });

        // Timeout after 2 seconds
        setTimeout(() => {
          this.workerPort?.removeEventListener("message", messageHandler);
          resolve([]);
        }, 2000);
      } else {
        resolve([]);
      }
    });
  }

  // Subscribe to messages of a specific type
  public subscribe(
    type: MessageType,
    handler: (payload: any) => void
  ): () => void {
    return this.eventEmitter.on(type, handler);
  }

  // Clean up all resources
  public cleanup(): void {
    logger.debug("Cleaning up CrossTabService resources");

    // Clean up SharedWorker
    if (this.workerPort) {
      try {
        this.workerPort.close();
      } catch (error) {
        logger.error("Error closing SharedWorker port", error);
      }
      this.workerPort = null;
      this.sharedWorker = null;
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch (error) {
        logger.error("Error closing BroadcastChannel", error);
      }
      this.broadcastChannel = null;
    }

    // Execute all cleanup functions
    this.cleanupFunctions.forEach((cleanup) => cleanup());
    this.cleanupFunctions = [];

    // Clear intervals
    if (this.leaderCheckIntervalId !== null) {
      clearInterval(this.leaderCheckIntervalId);
      this.leaderCheckIntervalId = null;
    }

    if (this.workerHeartbeatId !== null) {
      clearInterval(this.workerHeartbeatId);
      this.workerHeartbeatId = null;
    }

    // Reset state
    this.isInitialized = false;
  }

  // Add this public method
  public getLeaderStorageKey(): string {
    return this.leaderStorageKey;
  }
}

// Export singleton getter
export function getCrossTabService(
  config: Partial<CrossTabConfig> = {}
): CrossTabService {
  return CrossTabService.getInstance(config);
}
