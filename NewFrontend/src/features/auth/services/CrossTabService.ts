import { logger } from "@/utils/logger";

// If you're having EventEmitter import issues, here's a simple implementation:
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
}

// Default configuration
const DEFAULT_CONFIG: CrossTabConfig = {
  channelName: "auth_unified_channel",
  storagePrefix: "auth_sync_",
  leaderCheckInterval: 5000, // 5 seconds
  messageTimeout: 5000, // Messages older than 5 seconds are ignored
  debug: false,
};

export class CrossTabService {
  private static instance: CrossTabService | null = null;

  private eventEmitter: SimpleEventEmitter = new SimpleEventEmitter();
  private config: CrossTabConfig;
  private broadcastChannel: BroadcastChannel | null = null;
  private tabId: string;
  private cleanupFunctions: Array<() => void> = [];
  private leaderCheckIntervalId: number | null = null;
  private isInitialized: boolean = false;
  private messageHandler: (event: MessageEvent) => void; // Add message handler property

  // Leader election properties
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
    // Store message handler as class property for reuse
    this.messageHandler = (event: MessageEvent) =>
      this.handleIncomingMessage(event.data);

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

    // Start leader election process
    this.startLeaderElection();

    // Start health check process
    this.startHealthCheck();

    // Mark as initialized
    this.isInitialized = true;
  }

  // Set up communication channels
  private setupCommunicationChannels(): void {
    try {
      // Try BroadcastChannel API first
      if (typeof BroadcastChannel !== "undefined") {
        this.broadcastChannel = new BroadcastChannel(this.config.channelName);

        // Use the stored message handler
        this.broadcastChannel.addEventListener("message", this.messageHandler);

        // Add to cleanup functions
        this.cleanupFunctions.push(() => {
          if (this.broadcastChannel) {
            this.broadcastChannel.removeEventListener(
              "message",
              this.messageHandler
            );
            this.broadcastChannel.close();
          }
        });

        logger.debug("BroadcastChannel communication initialized");
      } else {
        logger.warn(
          "BroadcastChannel API not available, using localStorage fallback"
        );
      }

      // Set up localStorage event listener as fallback
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

  // Start leader election process
  private startLeaderElection(): void {
    // Try to become leader on init
    this.electLeader();

    // Periodically check and renew leadership
    this.leaderCheckIntervalId = window.setInterval(() => {
      if (this.isLeader()) {
        // Renew leadership
        this.renewLeadership();
      } else if (!localStorage.getItem(this.leaderStorageKey)) {
        // No leader, try to become one
        this.electLeader();
      }
    }, this.config.leaderCheckInterval);

    // Add to cleanup functions
    this.cleanupFunctions.push(() => {
      if (this.leaderCheckIntervalId !== null) {
        clearInterval(this.leaderCheckIntervalId);
      }
    });
  }

  // Process incoming message
  private handleIncomingMessage(message: CrossTabMessage): void {
    // Skip if this is our own message
    if (message.sourceTabId === this.tabId) {
      return;
    }

    // Skip old messages
    if (Date.now() - message.timestamp > this.config.messageTimeout) {
      return;
    }

    // Verify message integrity if needed
    if (message.signature && !this.verifyMessageIntegrity(message)) {
      logger.warn("Message integrity check failed", { message });
      return;
    }

    // Handle leader-related messages
    if (
      message.type === MessageType.LEADER_PING ||
      message.type === MessageType.LEADER_ELECTION
    ) {
      this.handleLeaderMessage(message);
      return;
    }

    // Emit event for subscribers
    this.eventEmitter.emit(message.type, message.payload);

    // Debug logging
    if (this.config.debug) {
      logger.debug("Received cross-tab message", { type: message.type });
    }
  }

  // Handle leader-related messages
  private handleLeaderMessage(message: CrossTabMessage): void {
    if (message.type === MessageType.LEADER_ELECTION) {
      // Another tab is trying to become leader
      if (this.isLeaderTab) {
        // We're already leader, send a ping to assert leadership
        this.broadcastLeaderPing();
      }
    } else if (message.type === MessageType.LEADER_PING) {
      // Another tab is claiming leadership
      const leaderData = message.payload;

      if (leaderData && leaderData.tabId !== this.tabId) {
        // Update our understanding of who's leader
        this.isLeaderTab = false;
        localStorage.setItem(this.leaderStorageKey, JSON.stringify(leaderData));
      }
    }
  }

  // Add a channel validity check before broadcasting
  private ensureChannelValid(): boolean {
    if (!this.broadcastChannel) {
      try {
        this.broadcastChannel = new BroadcastChannel(this.config.channelName);
        this.broadcastChannel.addEventListener("message", this.messageHandler);
        logger.debug("BroadcastChannel reconnected");
        return true;
      } catch (error) {
        logger.error("Failed to create BroadcastChannel", error);
        return false;
      }
    }

    // Test if channel is still valid
    try {
      // Send a tiny ping message to test channel
      this.broadcastChannel.postMessage({ type: "PING" });
      return true;
    } catch (error) {
      // Channel is invalid, close and recreate
      try {
        this.broadcastChannel.close();
      } catch (e) {
        // Ignore errors during close
      }

      this.broadcastChannel = null;

      // Try to recreate once
      try {
        this.broadcastChannel = new BroadcastChannel(this.config.channelName);
        this.broadcastChannel.addEventListener("message", this.messageHandler);
        return true;
      } catch (error) {
        logger.error("Failed to recreate BroadcastChannel", error);
        return false;
      }
    }
  }

  // Broadcast a message to all tabs
  public broadcastMessage(type: MessageType, payload: any): void {
    const message: CrossTabMessage = {
      type,
      payload,
      timestamp: Date.now(),
      sourceTabId: this.tabId,
    };

    // Sign message if needed
    // message.signature = this.signMessage(message);

    // Try BroadcastChannel with safety check
    let broadcastSuccessful = false;
    if (this.ensureChannelValid()) {
      try {
        this.broadcastChannel!.postMessage(message);
        broadcastSuccessful = true;
      } catch (error) {
        // Close and nullify the channel so we can reconnect next time
        try {
          this.broadcastChannel!.close();
        } catch (e) {}
        this.broadcastChannel = null;
        logger.error(
          "BroadcastChannel send failed, falling back to localStorage",
          error
        );
      }
    }

    // Always fall back to localStorage if broadcast failed
    if (!broadcastSuccessful) {
      try {
        const key = `${this.config.storagePrefix}${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 9)}`;
        localStorage.setItem(key, JSON.stringify(message));

        // Clean up old messages (keep only last 10)
        this.cleanupOldMessages();
      } catch (error) {
        logger.error("LocalStorage fallback failed", error);
      }
    }

    // Also emit locally
    this.eventEmitter.emit(type, payload);
  }

  // Clean up old messages in localStorage
  private cleanupOldMessages(): void {
    try {
      const keys = Object.keys(localStorage)
        .filter(
          (k) =>
            k.startsWith(this.config.storagePrefix) &&
            k !== this.leaderStorageKey
        )
        .sort()
        .slice(0, -10); // Keep only the 10 most recent messages

      keys.forEach((k) => localStorage.removeItem(k));
    } catch (error) {
      logger.error("Failed to clean up old messages", error);
    }
  }

  // Try to become the leader tab
  public async electLeader(): Promise<boolean> {
    try {
      const now = Date.now();

      // Use a locking mechanism with timestamp for atomic update
      const lockKey = `${this.config.storagePrefix}election_lock`;
      const lockValue = `${this.tabId}_${now}`;

      // Try to acquire lock
      localStorage.setItem(lockKey, lockValue);

      // Wait a bit to ensure consistency across tabs
      return new Promise<boolean>((resolve) => {
        setTimeout(() => {
          // Check if we still have the lock
          if (localStorage.getItem(lockKey) === lockValue) {
            // We got the lock, proceed with leader election
            const currentLeader = localStorage.getItem(this.leaderStorageKey);

            // Become leader
            const leaderData = { tabId: this.tabId, timestamp: now };
            localStorage.setItem(
              this.leaderStorageKey,
              JSON.stringify(leaderData)
            );
            this.isLeaderTab = true;

            // Broadcast leadership claim
            this.broadcastLeaderPing();

            localStorage.removeItem(lockKey); // Release lock
            resolve(true);
          } else {
            // Someone else got the lock
            resolve(false);
          }
        }, 50); // Small delay, but enough to reduce race condition probability
      });
    } catch (error) {
      logger.error("Leader election failed", error);
      return Promise.resolve(false);
    }
  }

  // Add a synchronous version for internal use
  private electLeaderSync(): boolean {
    try {
      const now = Date.now();

      // Use simple check without the timeout
      const currentLeader = localStorage.getItem(this.leaderStorageKey);
      if (currentLeader) {
        try {
          const leaderData = JSON.parse(currentLeader);

          // If leader is recent and not this tab, we're not leader
          if (
            leaderData.tabId &&
            leaderData.tabId !== this.tabId &&
            now - leaderData.timestamp < 10000
          ) {
            this.isLeaderTab = false;
            return false;
          }
        } catch (error) {
          logger.error("Failed to parse leader data", error);
        }
      }

      // Become leader
      const leaderData = { tabId: this.tabId, timestamp: now };
      localStorage.setItem(this.leaderStorageKey, JSON.stringify(leaderData));
      this.isLeaderTab = true;

      // Schedule async broadcast
      setTimeout(() => this.broadcastLeaderPing(), 0);

      return true;
    } catch (error) {
      logger.error("Leader election failed", error);
      return false;
    }
  }

  // Renew leadership
  private renewLeadership(): void {
    if (!this.isLeaderTab) return;

    try {
      localStorage.setItem(
        this.leaderStorageKey,
        JSON.stringify({ tabId: this.tabId, timestamp: Date.now() })
      );
    } catch (error) {
      logger.error("Failed to renew leadership", error);
    }
  }

  // Broadcast leader ping
  private broadcastLeaderPing(): void {
    this.broadcastMessage(MessageType.LEADER_PING, {
      tabId: this.tabId,
      timestamp: Date.now(),
    });
  }

  // Check if this tab is the leader
  public isLeader(): boolean {
    // Fast path
    if (this.isLeaderTab) {
      return true;
    }

    try {
      const currentLeader = localStorage.getItem(this.leaderStorageKey);
      if (!currentLeader) {
        return this.electLeaderSync(); // Use sync version
      }

      const leaderData = JSON.parse(currentLeader);

      // If leader data is stale, try to become leader
      if (Date.now() - leaderData.timestamp > 10000) {
        return this.electLeaderSync(); // Use sync version
      }

      this.isLeaderTab = leaderData.tabId === this.tabId;
      return this.isLeaderTab;
    } catch (error) {
      logger.error("Leader check failed", error);
      return false;
    }
  }

  // Get this tab's ID
  public getTabId(): string {
    return this.tabId;
  }

  // Generate a unique tab ID
  private generateTabId(): string {
    // Try to get existing tab ID from session storage
    if (typeof sessionStorage !== "undefined") {
      const existingId = sessionStorage.getItem("tab_id");
      if (existingId) {
        return existingId;
      }
    }

    // Generate new ID
    return `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Message integrity verification (optional)
  private verifyMessageIntegrity(message: CrossTabMessage): boolean {
    // Implement message integrity check as needed
    // This could use a hash or simple validation logic
    return true; // Simplified for now
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

    // Clear leader check interval
    if (this.leaderCheckIntervalId !== null) {
      clearInterval(this.leaderCheckIntervalId);
      this.leaderCheckIntervalId = null;
    }

    // Reset state
    this.isInitialized = false;
  }

  // Add this to the CrossTabService class
  private startHealthCheck(): void {
    // Run health check every 30 seconds
    const healthCheckId = setInterval(() => {
      // Check leader status
      const leaderData = localStorage.getItem(this.leaderStorageKey);

      if (!leaderData) {
        logger.warn("No leader found, initiating leader election");
        this.electLeader();
      }

      // Check BroadcastChannel status
      if (!this.ensureChannelValid()) {
        logger.error("BroadcastChannel invalid and couldn't be restored");
      }

      // Send heartbeat if we're leader
      if (this.isLeaderTab) {
        this.broadcastMessage(MessageType.LEADER_PING, {
          tabId: this.tabId,
          timestamp: Date.now(),
          healthCheck: true,
        });
      }
    }, 30000);

    this.cleanupFunctions.push(() => clearInterval(healthCheckId));
  }

  // Add this public method to the CrossTabService class
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
