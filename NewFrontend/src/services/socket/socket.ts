import { io, Socket } from 'socket.io-client';
import { logger } from '@/utils/logger';
import { getAuthServices } from '@/features/auth/services';

// Types for strongly typed socket interactions
type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
type SessionEventType = 'sync' | 'activity' | 'update' | 'error';

interface SessionSocket extends Socket {
  initialized?: boolean;
}

class SessionSocketManager {
  private socket: SessionSocket | null = null;
  private status: SocketStatus = 'disconnected';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private baseReconnectDelay: number = 1000; // Start with 1s delay
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private deviceFingerprint: string | null = null;
  private tabId: string = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Store the tab ID in session storage for consistent identification
  constructor() {
    if (typeof window !== 'undefined') {
      // Use existing tab ID or create a new one
      this.tabId = window.sessionStorage.getItem('tab_id') || this.tabId;
      window.sessionStorage.setItem('tab_id', this.tabId);
    }
  }

  /**
   * Initialize the socket connection with authentication
   */
  initialize(deviceFingerprint?: string): void {
    logger.info('Initializing session socket manager', { 
      hasFingerprint: !!deviceFingerprint 
    });
    
    if (this.socket?.initialized) {
      logger.warn('Socket already initialized');
      return;
    }
    
    this.deviceFingerprint = deviceFingerprint || null;
    
    try {
      // Create socket connection to session namespace
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
      logger.debug('Using API URL for socket connection:', { apiUrl });
      
      // Convert HTTP/HTTPS URLs to WS/WSS for WebSocket connections
      const wsUrl = apiUrl.replace(/^http/, 'ws');
      logger.debug('Converted to WebSocket URL:', { wsUrl });
      
      // Only send minimal data in query parameters
      this.socket = io(`${wsUrl}/session`, {
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        transports: ['websocket'], // Force WebSocket only
        upgrade: false, // Prevent transport upgrades
        query: {
          tabId: this.tabId
        },
        withCredentials: true // Ensure cookies are sent with the request
      }) as SessionSocket;

      logger.debug('Socket instance created with HTTP-only cookie auth');
      
      this.socket.initialized = true;
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Connect to the server
      this.connect();
      
      logger.info('Session socket initialized');
    } catch (error) {
      logger.error('Failed to initialize socket:', error);
      this.status = 'error';
    }
  }

  /**
   * Set up socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;
    
    // Connection events
    this.socket.on('connect', () => {
      logger.info('Session socket connected', { 
        id: this.socket.id,
        transport: this.socket.io?.engine?.transport?.name || 'unknown'
      });
      this.status = 'connected';
      this.reconnectAttempts = 0;
      this.triggerEvent('status', this.status);
    });
    
    this.socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${reason}`);
      this.status = 'disconnected';
      this.triggerEvent('status', this.status);
      
      // Handle reconnection
      this.handleReconnect(reason);
    });
    
    // Define a custom error interface for socket errors
    interface SocketError extends Error {
      description?: string;
      context?: string;
      data?: any;
      type?: string;
    }

    this.socket.on('connect_error', (error: SocketError) => {
      logger.error('Session socket connection error', { 
        message: error.message,
        description: error.description || 'No description',
        context: error.context || 'unknown',
        data: error.data || null,
        type: error.type || 'unknown'
      });
      this.status = 'error';
      this.triggerEvent('status', this.status);
      
      // Handle reconnection
      this.handleReconnect('connect_error');
    });
    
    // Session-specific events
    this.socket.on('session-update', (data) => {
      logger.debug('Received session update', data);
      this.triggerEvent('session-update', data);
    });
    
    this.socket.on('activity-update', (data) => {
      logger.debug('Received activity update', data);
      this.triggerEvent('activity-update', data);
    });
    
    this.socket.on('error', (error) => {
      logger.error('Socket error:', error);
      this.triggerEvent('error', error);
    });
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect(reason: string): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (
      this.reconnectAttempts >= this.maxReconnectAttempts || 
      reason === 'io server disconnect'
    ) {
      logger.warn(`Socket reconnection abandoned after ${this.reconnectAttempts} attempts or server-forced disconnect`);
      return;
    }
    
    // Calculate exponential backoff delay with jitter
    const delay = Math.min(
      30000, // Maximum 30 second delay
      this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts) * (0.9 + 0.2 * Math.random())
    );
    
    this.reconnectAttempts++;
    
    logger.info(`Socket reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.status = 'connecting';
    this.triggerEvent('status', this.status);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Connect to the socket server
   */
  private connect(): void {
    if (!this.socket || this.status === 'connected') return;
    
    try {
      this.status = 'connecting';
      this.socket.connect();
    } catch (error) {
      logger.error('Failed to connect socket:', error);
      this.status = 'error';
    }
  }

  /**
   * Disconnect from the socket server
   */
  disconnect(): void {
    if (!this.socket) return;
    
    try {
      this.socket.disconnect();
      this.status = 'disconnected';
    } catch (error) {
      logger.error('Error disconnecting socket:', error);
    }
  }

  /**
   * Send a sync request to the server
   */
  sync(): void {
    if (!this.socket || this.status !== 'connected') return;
    
    try {
      this.socket.emit('sync', {
        tabId: this.tabId,
        clientInfo: this.getClientInfo(),
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error sending sync request:', error);
    }
  }

  /**
   * Send an activity update to the server
   */
  activity(): void {
    if (!this.socket || this.status !== 'connected') return;
    
    try {
      this.socket.emit('activity', {
        tabId: this.tabId,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error sending activity update:', error);
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
      listeners.forEach(callback => {
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
    if (typeof navigator === 'undefined') {
      return { type: 'server' };
    }
    
    // Basic device information
    const info: Record<string, any> = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      devicePixelRatio: window.devicePixelRatio,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: Date.now()
    };
    
    // Enhanced battery info if available
    try {
      if ('getBattery' in navigator) {
        // @ts-ignore: getBattery() exists but TypeScript doesn't know about it
        navigator.getBattery().then((battery: any) => {
          const batteryInfo = {
            level: battery.level,
            charging: battery.charging
          };
          
          // Only send battery info if it changes significantly
          if (
            !this.lastBatteryInfo ||
            Math.abs(this.lastBatteryInfo.level - battery.level) > 0.05 ||
            this.lastBatteryInfo.charging !== battery.charging
          ) {
            this.lastBatteryInfo = batteryInfo;
            if (this.socket?.connected) {
              this.socket.emit('client-info-update', {
                battery: batteryInfo
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
          rtt: navigator.connection.rtt
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
}

// Add this function to initialize socket when auth is ready
export function initializeSessionSocket(): void {
  const { securityService } = getAuthServices();
  
  // Get device fingerprint from security service
  securityService.getDeviceFingerprint().then(fingerprint => {
    // Initialize socket with fingerprint
    sessionSocketManager.initialize(fingerprint);
  });
}

// Export singleton instance
export const sessionSocketManager = new SessionSocketManager();
