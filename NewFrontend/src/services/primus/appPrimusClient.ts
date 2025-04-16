import { store } from "@/store";
import { toast } from "react-hot-toast";
import { SOCKET_CONFIG } from "@/config/socket";
import { PRIMUS_CONFIG } from "@/config/primus";
import { logger } from "@/utils/logger";

/**
 * AppPrimusClient
 *
 * Handles the application-specific Primus connection for real-time features:
 * - Real-time notifications
 * - Data synchronization
 * - Feature-specific events (tickets, teams, users)
 * - Status updates
 *
 * This connection is separate from the authentication Primus connection
 * and focuses solely on application business logic.
 */
class AppPrimusClient {
  public primus: any = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private baseReconnectDelay: number = 1000; // 1 second
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private isInitialized: boolean = false;

  /**
   * Load Primus library from the server
   * @returns Promise that resolves when the library is loaded
   */
  private loadPrimusLibrary(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if Primus is already loaded
      if ((window as any).Primus) {
        logger.debug("Primus library already loaded", {
          component: "AppPrimusClient",
        });
        resolve();
        return;
      }

      // Create script element
      const script = document.createElement("script");
      script.src = `${SOCKET_CONFIG.SERVER.URL}${SOCKET_CONFIG.SERVER.PATH}/primus.js`;
      script.async = true;

      // Set up event handlers
      script.onload = () => {
        logger.info("Primus library loaded successfully", {
          component: "AppPrimusClient",
        });
        resolve();
      };

      script.onerror = (error) => {
        logger.error("Failed to load Primus library", {
          error,
          component: "AppPrimusClient",
        });
        reject(new Error("Failed to load Primus library"));
      };

      // Add script to document
      document.head.appendChild(script);
    });
  }

  /**
   * Initialize the Primus connection
   * This should be called after the user is authenticated
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load Primus library
      await this.loadPrimusLibrary();

      // Create the Primus client
      const primusUrl = `${SOCKET_CONFIG.BASE_URL}/primus/app`;

      // Check if Primus is available globally
      if (typeof (window as any).Primus === "undefined") {
        logger.error(
          "Primus is not loaded. Make sure the Primus client script is included in your HTML.",
          { component: "AppPrimusClient" }
        );
        return;
      }

      // Initialize Primus with the app namespace
      this.primus = new (window as any).Primus(primusUrl, {
        strategy: PRIMUS_CONFIG.strategy,
        manual: PRIMUS_CONFIG.manual, // Don't connect automatically
        withCredentials: PRIMUS_CONFIG.withCredentials, // Send cookies for authentication
        reconnect: PRIMUS_CONFIG.reconnect,
        timeout: PRIMUS_CONFIG.timeout,
        pingInterval: PRIMUS_CONFIG.pingInterval,
      });

      // Set up event listeners
      this.setupEventListeners();

      // Mark as initialized
      this.isInitialized = true;

      logger.info("App Primus client initialized successfully", {
        component: "AppPrimusClient",
        url: primusUrl,
      });
    } catch (error) {
      logger.error("Failed to initialize App Primus client", {
        error,
        component: "AppPrimusClient",
      });
      toast.error("Failed to initialize real-time connection");
    }
  }

  /**
   * Set up event listeners for the Primus connection
   */
  private setupEventListeners(): void {
    if (!this.primus) return;

    // Connection opened
    this.primus.on("open", () => {
      logger.info("App Primus connection established", {
        component: "AppPrimusClient",
        socketId: this.primus?.id,
      });
      this.reconnectAttempts = 0;
      this.isConnecting = false;

      // Notify the user that the connection is established
      toast.success("Real-time connection established", {
        id: "app-primus-connected",
      });

      // Dispatch connection status to Redux if needed
      // store.dispatch(setAppConnectionStatus('connected'));

      // Register the client with the server
      this.primus.write({
        event: "register",
        payload: {
          clientId: this.getClientId(),
          deviceId: this.getDeviceInfo().deviceId,
          tabId: this.getClientId(),
          deviceInfo: this.getDeviceInfo(),
        },
      });
    });

    // Connection closed
    this.primus.on("close", () => {
      logger.info("App Primus connection closed", {
        component: "AppPrimusClient",
      });

      this.isConnecting = false;

      // Dispatch connection status to Redux if needed
      // store.dispatch(setAppConnectionStatus('disconnected'));
    });

    // Connection error
    this.primus.on("error", (err: Error) => {
      logger.error("App Primus connection error:", {
        error: err,
        component: "AppPrimusClient",
      });

      // Notify the user of the error
      toast.error("Connection error. Reconnecting...", {
        id: "app-primus-error",
      });

      // Dispatch connection status to Redux if needed
      // store.dispatch(setAppConnectionStatus('error'));
    });

    // Reconnection
    this.primus.on("reconnect", () => {
      logger.info("App Primus attempting to reconnect...", {
        component: "AppPrimusClient",
        attempt: this.reconnectAttempts + 1,
      });

      // Dispatch connection status to Redux if needed
      // store.dispatch(setAppConnectionStatus('reconnecting'));
    });

    // Reconnection failed
    this.primus.on("reconnect failed", () => {
      logger.error("App Primus reconnection failed", {
        component: "AppPrimusClient",
        attempts: this.reconnectAttempts,
      });

      // Notify the user that reconnection failed
      toast.error("Failed to reconnect. Please refresh the page.", {
        id: "app-primus-reconnect-failed",
      });

      // Dispatch connection status to Redux if needed
      // store.dispatch(setAppConnectionStatus('reconnect_failed'));
    });

    // Incoming data
    this.primus.on("data", (data: any) => {
      logger.debug("App Primus received data:", {
        component: "AppPrimusClient",
        data,
      });

      // Handle different types of data
      if (data && data.event) {
        // Pass the event directly to listeners
        this.primus.emit(data.event, data.data);

        // Log the event
        logger.debug(`Emitted event: ${data.event}`, {
          component: "AppPrimusClient",
          event: data.event,
          data: data.data,
        });
      } else if (data && data.type) {
        // Legacy handling for type-based messages
        switch (data.type) {
          case "notification":
            this.handleNotification(data.payload);
            break;
          case "data_update":
            this.handleDataUpdate(data.payload);
            break;
          case "status_update":
            this.handleStatusUpdate(data.payload);
            break;
          default:
            logger.debug("Unknown data type:", {
              type: data.type,
              component: "AppPrimusClient",
            });
        }
      }
    });
  }

  /**
   * Connect to the Primus server
   */
  async connect(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.primus || this.isConnecting) return;

    this.isConnecting = true;
    logger.info("Connecting to App Primus server...", {
      component: "AppPrimusClient",
    });

    try {
      this.primus.open();
    } catch (error) {
      logger.error("Error connecting to App Primus server:", {
        error,
        component: "AppPrimusClient",
      });
      this.isConnecting = false;

      // Attempt to reconnect with exponential backoff
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the Primus server
   */
  disconnect(): void {
    if (!this.primus) return;

    logger.info("Disconnecting from App Primus server...", {
      component: "AppPrimusClient",
    });
    this.primus.end();
    this.isConnecting = false;

    // Clear any pending reconnect timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.warn("Maximum reconnection attempts reached", {
        component: "AppPrimusClient",
        attempts: this.reconnectAttempts,
      });
      return;
    }

    // Calculate delay with exponential backoff
    const delay =
      this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts);
    logger.info(
      `Scheduling reconnect in ${delay}ms (attempt ${
        this.reconnectAttempts + 1
      })`,
      {
        component: "AppPrimusClient",
        delay,
        attempt: this.reconnectAttempts + 1,
      }
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.isConnecting = false;
      this.connect();
    }, delay);
  }

  /**
   * Send data to the Primus server
   */
  send(action: string, data: any): void {
    if (!this.primus) {
      logger.error("Cannot send data: Primus not initialized", {
        component: "AppPrimusClient",
        action,
        data,
      });
      return;
    }

    logger.debug("Sending data to Primus server", {
      component: "AppPrimusClient",
      action,
      data,
    });

    this.primus.write({
      action,
      data,
    });
  }

  /**
   * Handle incoming notifications
   */
  private handleNotification(payload: any): void {
    logger.info("Handling notification:", {
      component: "AppPrimusClient",
      payload,
    });

    // Show a toast notification
    if (payload.message) {
      toast(payload.message, {
        icon: payload.icon || "🔔",
        duration: payload.duration || 5000,
      });
    }

    // Dispatch to Redux if needed
    // store.dispatch(addNotification(payload));
  }

  /**
   * Handle data updates
   */
  private handleDataUpdate(payload: any): void {
    logger.info("Handling data update:", {
      component: "AppPrimusClient",
      payload,
    });

    // Dispatch to Redux based on the entity type
    if (payload.entity && payload.data) {
      switch (payload.entity) {
        case "user":
          // store.dispatch(updateUser(payload.data));
          break;
        case "team":
          // store.dispatch(updateTeam(payload.data));
          break;
        case "ticket":
          // Emit a ticket event for listeners
          const ticketEvent = `ticket:${payload.action || "updated"}`;
          this.primus.emit(ticketEvent, payload.data);
          break;
        case "query":
          // Emit a query event for listeners
          const queryEvent = `query:${payload.action || "updated"}`;
          this.primus.emit(queryEvent, payload.data);
          break;
        default:
          logger.debug("Unknown entity type:", {
            entity: payload.entity,
            component: "AppPrimusClient",
          });
      }
    }
  }

  /**
   * Handle status updates
   */
  private handleStatusUpdate(payload: any): void {
    logger.info("Handling status update:", {
      component: "AppPrimusClient",
      payload,
    });

    // Update status in Redux if needed
    if (payload.entity && payload.id && payload.status) {
      // store.dispatch(updateEntityStatus({
      //   entity: payload.entity,
      //   id: payload.id,
      //   status: payload.status
      // }));
    }
  }

  /**
   * Get a unique client ID for this browser tab
   */
  private getClientId(): string {
    // Generate a unique ID if one doesn't exist
    let clientId = sessionStorage.getItem("app_client_id");

    if (!clientId) {
      clientId = `client_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      sessionStorage.setItem("app_client_id", clientId);
    }

    return clientId;
  }

  /**
   * Get basic device information
   */
  private getDeviceInfo(): any {
    // Generate a device ID if one doesn't exist
    let deviceId = localStorage.getItem("device_fingerprint");

    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      localStorage.setItem("device_fingerprint", deviceId);
    }

    return {
      deviceId,
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
}

// Create a singleton instance
export const appPrimusClient = new AppPrimusClient();

// Export the singleton
export default appPrimusClient;
