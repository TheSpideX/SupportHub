/**
 * ConnectionRecoveryService
 * 
 * Provides resilient connection handling for authentication services
 * - Manages WebSocket reconnection with exponential backoff
 * - Provides HTTP fallback when WebSockets are unavailable
 * - Coordinates recovery across tabs
 * - Handles offline scenarios gracefully
 */

import { logger } from "@/utils/logger";
import { SOCKET_CONFIG } from "@/config/socket";
import { TokenService } from "./TokenService";
import { PrimusAuthService } from "./PrimusAuthService";
import { API_CONFIG } from "@/config/api";
import { apiClient } from "@/api/apiClient";

// Recovery states
export enum RecoveryState {
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FALLBACK = 'fallback',
  OFFLINE = 'offline',
  FAILED = 'failed'
}

// Recovery events
export enum RecoveryEvent {
  CONNECTION_LOST = 'connection:lost',
  RECONNECTING = 'connection:reconnecting',
  RECONNECTED = 'connection:reconnected',
  FALLBACK_ACTIVATED = 'connection:fallback',
  RECOVERY_FAILED = 'connection:recovery_failed',
  OFFLINE_MODE = 'connection:offline',
  ONLINE_RESTORED = 'connection:online_restored'
}

export class ConnectionRecoveryService {
  private tokenService: TokenService;
  private primusService: PrimusAuthService | null = null;
  private recoveryState: RecoveryState = RecoveryState.CONNECTED;
  private recoveryAttempts: number = 0;
  private maxRecoveryAttempts: number = SOCKET_CONFIG.FALLBACK.MAX_RECOVERY_ATTEMPTS || 5;
  private recoveryToken: string | null = null;
  private pollingIntervalId: number | null = null;
  private heartbeatIntervalId: number | null = null;
  private lastHeartbeat: number = Date.now();
  private eventListeners: Map<string, Function[]> = new Map();
  private isLeaderTab: boolean = false;
  private deviceId: string = '';
  private tabId: string = '';
  private broadcastChannel: BroadcastChannel | null = null;

  constructor(tokenService: TokenService, primusService?: PrimusAuthService) {
    this.tokenService = tokenService;
    this.primusService = primusService || null;
    
    // Initialize device and tab IDs
    this.deviceId = sessionStorage.getItem('device_fingerprint') || 
                    localStorage.getItem('device_fingerprint') || 
                    `device_${Math.random().toString(36).substring(2, 10)}`;
    
    this.tabId = sessionStorage.getItem('tab_id') || 
                `tab_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
    
    // Store IDs for future use
    sessionStorage.setItem('device_fingerprint', this.deviceId);
    sessionStorage.setItem('tab_id', this.tabId);
    
    // Initialize cross-tab communication
    this.initCrossTabCommunication();
    
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Check if we're already offline
    if (!navigator.onLine) {
      this.setRecoveryState(RecoveryState.OFFLINE);
    }
    
    logger.info('Connection recovery service initialized', {
      deviceId: this.deviceId,
      tabId: this.tabId,
      isOnline: navigator.onLine
    });
  }
  
  /**
   * Initialize cross-tab communication
   */
  private initCrossTabCommunication(): void {
    try {
      this.broadcastChannel = new BroadcastChannel('auth_recovery_channel');
      
      this.broadcastChannel.addEventListener('message', (event) => {
        if (!event.data || !event.data.type) return;
        
        switch (event.data.type) {
          case 'RECOVERY_STATE_CHANGE':
            // Another tab changed recovery state
            logger.debug('Recovery state change from another tab', event.data);
            break;
            
          case 'RECOVERY_TOKEN':
            // Another tab is sharing a recovery token
            if (event.data.token && !this.recoveryToken) {
              this.recoveryToken = event.data.token;
              logger.debug('Received recovery token from another tab', { token: this.recoveryToken });
            }
            break;
            
          case 'HEARTBEAT_UPDATE':
            // Update last heartbeat time if newer
            if (event.data.timestamp > this.lastHeartbeat) {
              this.lastHeartbeat = event.data.timestamp;
            }
            break;
        }
      });
      
      logger.debug('Cross-tab communication initialized for connection recovery');
    } catch (error) {
      logger.error('Failed to initialize cross-tab communication for recovery', error);
    }
  }
  
  /**
   * Set recovery state and notify listeners
   */
  private setRecoveryState(state: RecoveryState): void {
    const previousState = this.recoveryState;
    this.recoveryState = state;
    
    // Log state change
    logger.info(`Connection recovery state changed: ${previousState} -> ${state}`, {
      deviceId: this.deviceId,
      tabId: this.tabId,
      isLeader: this.isLeaderTab,
      recoveryAttempts: this.recoveryAttempts
    });
    
    // Emit appropriate event based on state change
    let eventType: RecoveryEvent | null = null;
    
    switch (state) {
      case RecoveryState.RECONNECTING:
        eventType = RecoveryEvent.RECONNECTING;
        break;
      case RecoveryState.FALLBACK:
        eventType = RecoveryEvent.FALLBACK_ACTIVATED;
        break;
      case RecoveryState.OFFLINE:
        eventType = RecoveryEvent.OFFLINE_MODE;
        break;
      case RecoveryState.CONNECTED:
        if (previousState !== RecoveryState.CONNECTED) {
          eventType = RecoveryEvent.RECONNECTED;
        }
        break;
      case RecoveryState.FAILED:
        eventType = RecoveryEvent.RECOVERY_FAILED;
        break;
    }
    
    // Emit event if applicable
    if (eventType) {
      this.emit(eventType, {
        previousState,
        currentState: state,
        timestamp: Date.now(),
        recoveryAttempts: this.recoveryAttempts
      });
    }
    
    // Broadcast state change to other tabs
    this.broadcastStateChange(state);
    
    // Take action based on new state
    this.handleStateChange(previousState, state);
  }
  
  /**
   * Handle recovery state change
   */
  private handleStateChange(previousState: RecoveryState, newState: RecoveryState): void {
    // Clean up previous state
    this.cleanupState(previousState);
    
    // Initialize new state
    switch (newState) {
      case RecoveryState.RECONNECTING:
        // Start reconnection attempts with exponential backoff
        this.startReconnection();
        break;
        
      case RecoveryState.FALLBACK:
        // Start HTTP polling as fallback
        this.startFallbackPolling();
        break;
        
      case RecoveryState.OFFLINE:
        // Enable offline mode
        this.enableOfflineMode();
        break;
        
      case RecoveryState.CONNECTED:
        // Reset recovery attempts
        this.recoveryAttempts = 0;
        this.recoveryToken = null;
        
        // Start heartbeat
        this.startHeartbeat();
        break;
        
      case RecoveryState.FAILED:
        // Handle complete failure
        this.handleRecoveryFailure();
        break;
    }
  }
  
  /**
   * Clean up resources for previous state
   */
  private cleanupState(state: RecoveryState): void {
    switch (state) {
      case RecoveryState.RECONNECTING:
        // Nothing to clean up
        break;
        
      case RecoveryState.FALLBACK:
        // Stop polling
        if (this.pollingIntervalId) {
          clearInterval(this.pollingIntervalId);
          this.pollingIntervalId = null;
        }
        break;
        
      case RecoveryState.OFFLINE:
        // Nothing to clean up
        break;
        
      case RecoveryState.CONNECTED:
        // Stop heartbeat
        if (this.heartbeatIntervalId) {
          clearInterval(this.heartbeatIntervalId);
          this.heartbeatIntervalId = null;
        }
        break;
    }
  }
  
  /**
   * Start reconnection attempts with exponential backoff
   */
  private startReconnection(): void {
    // Only the leader tab should handle reconnection
    if (!this.isLeaderTab && this.hasOtherTabs()) {
      logger.debug('Not handling reconnection - not the leader tab');
      return;
    }
    
    this.recoveryAttempts++;
    
    // Calculate backoff delay
    const baseDelay = SOCKET_CONFIG.CONNECTION.RECONNECTION.DELAY;
    const maxDelay = SOCKET_CONFIG.CONNECTION.RECONNECTION.MAX_DELAY;
    const jitter = SOCKET_CONFIG.CONNECTION.RECONNECTION.JITTER;
    
    // Apply exponential backoff with jitter
    const exponentialDelay = Math.min(
      baseDelay * Math.pow(2, this.recoveryAttempts - 1),
      maxDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitterFactor = 1 - jitter + (Math.random() * jitter * 2);
    const delay = Math.floor(exponentialDelay * jitterFactor);
    
    logger.info(`Attempting reconnection in ${delay}ms (attempt ${this.recoveryAttempts}/${this.maxRecoveryAttempts})`);
    
    // Schedule reconnection attempt
    setTimeout(() => {
      this.attemptReconnection();
    }, delay);
  }
  
  /**
   * Attempt to reconnect to WebSocket
   */
  private attemptReconnection(): void {
    // If we're online and have a Primus service, try to reconnect
    if (navigator.onLine && this.primusService) {
      logger.info('Attempting to reconnect WebSocket');
      
      try {
        // If we have a recovery token, use it
        if (this.recoveryToken) {
          this.primusService.reconnectWithToken(this.recoveryToken);
        } else {
          this.primusService.reconnect();
        }
        
        // Check connection status after a short delay
        setTimeout(() => {
          if (this.primusService?.isConnected()) {
            logger.info('WebSocket reconnection successful');
            this.setRecoveryState(RecoveryState.CONNECTED);
          } else {
            this.handleReconnectionFailure();
          }
        }, 2000);
      } catch (error) {
        logger.error('WebSocket reconnection attempt failed', error);
        this.handleReconnectionFailure();
      }
    } else {
      // If we're offline or don't have Primus, go to appropriate state
      if (!navigator.onLine) {
        this.setRecoveryState(RecoveryState.OFFLINE);
      } else {
        this.handleReconnectionFailure();
      }
    }
  }
  
  /**
   * Handle reconnection failure
   */
  private handleReconnectionFailure(): void {
    // If we've reached max attempts, switch to fallback mode
    if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
      logger.warn(`Maximum reconnection attempts (${this.maxRecoveryAttempts}) reached, switching to fallback mode`);
      this.setRecoveryState(RecoveryState.FALLBACK);
    } else {
      // Otherwise, try again
      this.setRecoveryState(RecoveryState.RECONNECTING);
    }
  }
  
  /**
   * Start HTTP polling as fallback for WebSocket
   */
  private startFallbackPolling(): void {
    // Only the leader tab should handle polling
    if (!this.isLeaderTab && this.hasOtherTabs()) {
      logger.debug('Not starting fallback polling - not the leader tab');
      return;
    }
    
    logger.info('Starting HTTP polling as WebSocket fallback');
    
    // Set up polling interval
    const pollingInterval = SOCKET_CONFIG.FALLBACK.POLLING_INTERVAL || 5000;
    this.pollingIntervalId = window.setInterval(() => {
      this.pollAuthEvents();
    }, pollingInterval);
    
    // Do an initial poll immediately
    this.pollAuthEvents();
  }
  
  /**
   * Poll for authentication events using HTTP
   */
  private async pollAuthEvents(): Promise<void> {
    if (!navigator.onLine) {
      logger.debug('Skipping auth events poll - offline');
      this.setRecoveryState(RecoveryState.OFFLINE);
      return;
    }
    
    try {
      // Get CSRF token
      const csrfToken = this.tokenService.getCsrfToken();
      
      // Poll for events
      const response = await apiClient.get(SOCKET_CONFIG.FALLBACK.ENDPOINTS.AUTH_EVENTS, {
        headers: {
          'X-CSRF-Token': csrfToken || '',
          'X-Device-ID': this.deviceId,
          'X-Tab-ID': this.tabId,
          'X-Leader-Tab': this.isLeaderTab ? 'true' : 'false'
        },
        params: {
          since: this.lastHeartbeat,
          _t: Date.now() // Cache buster
        }
      });
      
      // Process events
      if (response.data && response.data.events) {
        this.processPolledEvents(response.data.events);
      }
      
      // Update last heartbeat
      this.lastHeartbeat = Date.now();
      this.broadcastHeartbeat();
      
      // Check if WebSocket is available again
      this.checkWebSocketAvailability();
    } catch (error) {
      logger.error('Failed to poll auth events', error);
      
      // If we get a 401, try to refresh the token
      if (error.response && error.response.status === 401) {
        this.handleUnauthorizedError();
      }
    }
  }
  
  /**
   * Process events received from polling
   */
  private processPolledEvents(events: any[]): void {
    if (!events || events.length === 0) return;
    
    logger.debug(`Processing ${events.length} polled events`);
    
    // Process each event
    events.forEach(event => {
      // Emit event locally
      this.emit(event.type, event.data);
      
      // Broadcast to other tabs
      this.broadcastEvent(event);
      
      // Handle special events
      if (event.type === 'token:expiring' && this.isLeaderTab) {
        this.handleTokenExpiring(event.data);
      } else if (event.type === 'session:expired') {
        this.handleSessionExpired(event.data);
      }
    });
  }
  
  /**
   * Handle token expiring event
   */
  private handleTokenExpiring(data: any): void {
    // Only the leader tab should refresh the token
    if (!this.isLeaderTab) return;
    
    logger.info('Token expiring notification received in fallback mode', data);
    
    // Refresh token
    this.tokenService.refreshToken()
      .then(success => {
        logger.info('Token refresh in fallback mode', { success });
      })
      .catch(error => {
        logger.error('Failed to refresh token in fallback mode', error);
      });
  }
  
  /**
   * Handle session expired event
   */
  private handleSessionExpired(data: any): void {
    logger.warn('Session expired notification received in fallback mode', data);
    
    // Clear tokens
    this.tokenService.clearTokens();
    
    // Redirect to login
    window.location.href = `/login?reason=session_expired&t=${Date.now()}`;
  }
  
  /**
   * Check if WebSocket is available again
   */
  private checkWebSocketAvailability(): void {
    // Only check occasionally (every ~5 polls)
    if (Math.random() > 0.2) return;
    
    logger.debug('Checking WebSocket availability');
    
    // Try to create a test WebSocket
    try {
      const wsUrl = SOCKET_CONFIG.BASE_URL.replace(/^http/, 'ws');
      const testSocket = new WebSocket(`${wsUrl}/primus/test`);
      
      // Set up event handlers
      testSocket.onopen = () => {
        logger.info('WebSocket connection available again');
        testSocket.close();
        
        // Switch back to reconnecting state to try normal connection
        this.recoveryAttempts = 0; // Reset attempts
        this.setRecoveryState(RecoveryState.RECONNECTING);
      };
      
      // Handle errors (expected if still unavailable)
      testSocket.onerror = () => {
        testSocket.close();
      };
      
      // Set timeout to close socket if it doesn't connect
      setTimeout(() => {
        if (testSocket.readyState !== WebSocket.CLOSED) {
          testSocket.close();
        }
      }, 3000);
    } catch (error) {
      // Ignore errors - this is just a test
    }
  }
  
  /**
   * Enable offline mode
   */
  private enableOfflineMode(): void {
    logger.info('Enabling offline mode');
    
    // Cache authentication data if available
    if (this.tokenService.hasTokens()) {
      // Cache tokens for offline use
      if (typeof this.tokenService.cacheTokensForOffline === 'function') {
        this.tokenService.cacheTokensForOffline();
      }
    }
    
    // Set up listener for online event
    // (The main handler is already set up in constructor)
  }
  
  /**
   * Handle going online
   */
  private handleOnline(): void {
    logger.info('Network connection restored');
    
    // If we were in offline mode, try to reconnect
    if (this.recoveryState === RecoveryState.OFFLINE) {
      // Reset recovery attempts
      this.recoveryAttempts = 0;
      
      // Try to reconnect
      this.setRecoveryState(RecoveryState.RECONNECTING);
      
      // Emit online restored event
      this.emit(RecoveryEvent.ONLINE_RESTORED, {
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Handle going offline
   */
  private handleOffline(): void {
    logger.info('Network connection lost');
    
    // Switch to offline mode
    this.setRecoveryState(RecoveryState.OFFLINE);
  }
  
  /**
   * Start heartbeat to verify connection health
   */
  private startHeartbeat(): void {
    // Clear any existing heartbeat
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
    }
    
    // Set up new heartbeat interval
    const heartbeatInterval = SOCKET_CONFIG.HEARTBEAT.INTERVAL || 25000;
    this.heartbeatIntervalId = window.setInterval(() => {
      this.sendHeartbeat();
    }, heartbeatInterval);
    
    logger.debug('Connection heartbeat started');
  }
  
  /**
   * Send heartbeat to verify connection
   */
  private sendHeartbeat(): void {
    // Skip if we're not connected
    if (this.recoveryState !== RecoveryState.CONNECTED) return;
    
    // If we have Primus service, use it
    if (this.primusService && this.primusService.isConnected()) {
      this.primusService.sendHeartbeat();
      this.lastHeartbeat = Date.now();
      this.broadcastHeartbeat();
    } else {
      // Otherwise, use HTTP fallback
      this.sendHttpHeartbeat();
    }
  }
  
  /**
   * Send HTTP heartbeat as fallback
   */
  private async sendHttpHeartbeat(): Promise<void> {
    try {
      // Get CSRF token
      const csrfToken = this.tokenService.getCsrfToken();
      
      // Send heartbeat
      await apiClient.post(SOCKET_CONFIG.FALLBACK.ENDPOINTS.HEARTBEAT, {
        deviceId: this.deviceId,
        tabId: this.tabId,
        timestamp: Date.now(),
        isLeader: this.isLeaderTab
      }, {
        headers: {
          'X-CSRF-Token': csrfToken || '',
          'X-Device-ID': this.deviceId,
          'X-Tab-ID': this.tabId
        }
      });
      
      // Update last heartbeat
      this.lastHeartbeat = Date.now();
      this.broadcastHeartbeat();
    } catch (error) {
      logger.error('Failed to send HTTP heartbeat', error);
      
      // If we get a 401, try to refresh the token
      if (error.response && error.response.status === 401) {
        this.handleUnauthorizedError();
      }
    }
  }
  
  /**
   * Handle unauthorized error (401)
   */
  private handleUnauthorizedError(): void {
    // Only the leader tab should handle token refresh
    if (!this.isLeaderTab) return;
    
    logger.warn('Received 401 unauthorized in recovery service');
    
    // Try to refresh the token
    this.tokenService.refreshToken()
      .then(success => {
        logger.info('Token refresh after 401', { success });
      })
      .catch(error => {
        logger.error('Failed to refresh token after 401', error);
        
        // If refresh fails, redirect to login
        window.location.href = `/login?reason=session_expired&t=${Date.now()}`;
      });
  }
  
  /**
   * Handle complete recovery failure
   */
  private handleRecoveryFailure(): void {
    logger.error('Connection recovery failed after all attempts');
    
    // Emit failure event
    this.emit(RecoveryEvent.RECOVERY_FAILED, {
      timestamp: Date.now(),
      attempts: this.recoveryAttempts
    });
    
    // Try to refresh the page as last resort
    // But only if this is the leader tab
    if (this.isLeaderTab) {
      logger.warn('Leader tab will refresh the page as last resort');
      
      // Wait a bit before refreshing
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    }
  }
  
  /**
   * Broadcast recovery state change to other tabs
   */
  private broadcastStateChange(state: RecoveryState): void {
    if (!this.broadcastChannel) return;
    
    try {
      this.broadcastChannel.postMessage({
        type: 'RECOVERY_STATE_CHANGE',
        state,
        tabId: this.tabId,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Failed to broadcast recovery state change', error);
    }
  }
  
  /**
   * Broadcast heartbeat to other tabs
   */
  private broadcastHeartbeat(): void {
    if (!this.broadcastChannel) return;
    
    try {
      this.broadcastChannel.postMessage({
        type: 'HEARTBEAT_UPDATE',
        timestamp: this.lastHeartbeat,
        tabId: this.tabId
      });
    } catch (error) {
      logger.error('Failed to broadcast heartbeat', error);
    }
  }
  
  /**
   * Broadcast event to other tabs
   */
  private broadcastEvent(event: any): void {
    if (!this.broadcastChannel) return;
    
    try {
      this.broadcastChannel.postMessage({
        type: 'AUTH_EVENT',
        event,
        tabId: this.tabId,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Failed to broadcast event', error);
    }
  }
  
  /**
   * Check if there are other tabs open
   */
  private hasOtherTabs(): boolean {
    try {
      const leaderData = localStorage.getItem('auth_leader_tab');
      if (!leaderData) return false;
      
      const data = JSON.parse(leaderData);
      return data.tabId !== this.tabId;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Add event listener
   */
  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    
    this.eventListeners.get(event)?.push(callback);
  }
  
  /**
   * Remove event listener
   */
  public off(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) return;
    
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(callback);
    
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }
  
  /**
   * Emit event
   */
  private emit(event: string, data: any): void {
    if (!this.eventListeners.has(event)) return;
    
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        logger.error(`Error in event listener for ${event}`, error);
      }
    });
  }
  
  /**
   * Get current recovery state
   */
  public getState(): RecoveryState {
    return this.recoveryState;
  }
  
  /**
   * Check if connection is healthy
   */
  public isConnectionHealthy(): boolean {
    return this.recoveryState === RecoveryState.CONNECTED;
  }
  
  /**
   * Force reconnection (for testing or manual recovery)
   */
  public forceReconnect(): void {
    logger.info('Forcing reconnection');
    
    // Reset recovery attempts
    this.recoveryAttempts = 0;
    
    // Try to reconnect
    this.setRecoveryState(RecoveryState.RECONNECTING);
  }
  
  /**
   * Force fallback mode (for testing)
   */
  public forceFallbackMode(): void {
    logger.info('Forcing fallback mode');
    this.setRecoveryState(RecoveryState.FALLBACK);
  }
  
  /**
   * Clean up resources
   */
  public destroy(): void {
    // Clean up intervals
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
    
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    
    // Remove event listeners
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
    
    // Close broadcast channel
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    
    logger.info('Connection recovery service destroyed');
  }
}

// Create singleton instance
let connectionRecoveryService: ConnectionRecoveryService | null = null;

export function getConnectionRecoveryService(
  tokenService?: TokenService,
  primusService?: PrimusAuthService
): ConnectionRecoveryService {
  if (!connectionRecoveryService && tokenService) {
    connectionRecoveryService = new ConnectionRecoveryService(tokenService, primusService);
  }
  
  if (!connectionRecoveryService) {
    throw new Error('ConnectionRecoveryService not initialized');
  }
  
  return connectionRecoveryService;
}
