/**
 * FallbackApiService
 * 
 * Provides HTTP-based fallback for authentication services when WebSockets are unavailable
 * - Handles HTTP polling for authentication events
 * - Provides fallback mechanisms for token refresh and session management
 * - Works with ConnectionRecoveryService to ensure authentication resilience
 */

import { logger } from "@/utils/logger";
import { SOCKET_CONFIG } from "@/config/socket";
import { TokenService } from "./TokenService";
import { apiClient } from "@/api/apiClient";
import { EventEmitter } from "@/utils/EventEmitter";
import { AuthEventType } from "@/types/auth";

export class FallbackApiService {
  private tokenService: TokenService;
  private eventEmitter: EventEmitter;
  private pollingIntervalId: number | null = null;
  private lastEventTimestamp: number = Date.now();
  private deviceId: string = '';
  private tabId: string = '';
  private isLeaderTab: boolean = false;
  private pollingAttempts: number = 0;
  private maxPollingAttempts: number = SOCKET_CONFIG.FALLBACK.MAX_POLLING_ATTEMPTS;
  private pollingInterval: number = SOCKET_CONFIG.FALLBACK.POLLING_INTERVAL;
  private isPolling: boolean = false;
  private lastHeartbeat: number = Date.now();
  private heartbeatIntervalId: number | null = null;
  
  constructor(tokenService: TokenService, eventEmitter: EventEmitter) {
    this.tokenService = tokenService;
    this.eventEmitter = eventEmitter;
    
    // Initialize device and tab IDs
    this.deviceId = sessionStorage.getItem('device_fingerprint') || 
                    localStorage.getItem('device_fingerprint') || 
                    `device_${Math.random().toString(36).substring(2, 10)}`;
    
    this.tabId = sessionStorage.getItem('tab_id') || 
                `tab_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
    
    // Check if this is the leader tab
    this.checkLeaderStatus();
    
    logger.info('Fallback API service initialized', {
      deviceId: this.deviceId,
      tabId: this.tabId,
      isLeaderTab: this.isLeaderTab
    });
  }
  
  /**
   * Check if this tab is the leader tab
   */
  private checkLeaderStatus(): void {
    try {
      const leaderData = localStorage.getItem('auth_leader_tab');
      if (!leaderData) {
        this.isLeaderTab = false;
        return;
      }
      
      const data = JSON.parse(leaderData);
      this.isLeaderTab = data.tabId === this.tabId;
    } catch (error) {
      this.isLeaderTab = false;
      logger.error('Error checking leader status', error);
    }
  }
  
  /**
   * Start polling for authentication events
   */
  public startPolling(): void {
    // Only the leader tab should poll
    this.checkLeaderStatus();
    if (!this.isLeaderTab) {
      logger.debug('Not starting polling - not the leader tab');
      return;
    }
    
    if (this.isPolling) {
      logger.debug('Polling already in progress');
      return;
    }
    
    this.isPolling = true;
    this.pollingAttempts = 0;
    
    logger.info('Starting fallback polling for auth events');
    
    // Clear any existing interval
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
    }
    
    // Start polling
    this.pollingIntervalId = window.setInterval(() => {
      this.pollAuthEvents();
    }, this.pollingInterval);
    
    // Do an initial poll immediately
    this.pollAuthEvents();
    
    // Start heartbeat
    this.startHeartbeat();
  }
  
  /**
   * Stop polling for authentication events
   */
  public stopPolling(): void {
    logger.info('Stopping fallback polling');
    
    this.isPolling = false;
    
    // Clear polling interval
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
    
    // Clear heartbeat interval
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }
  
  /**
   * Poll for authentication events
   */
  private async pollAuthEvents(): Promise<void> {
    if (!navigator.onLine) {
      logger.debug('Skipping auth events poll - offline');
      return;
    }
    
    // Increment polling attempts
    this.pollingAttempts++;
    
    // Check if we've exceeded max polling attempts
    if (this.pollingAttempts > this.maxPollingAttempts) {
      logger.warn(`Maximum polling attempts (${this.maxPollingAttempts}) reached`);
      this.stopPolling();
      
      // Emit event
      this.eventEmitter.emit(AuthEventType.FALLBACK_FAILED, {
        timestamp: Date.now(),
        attempts: this.pollingAttempts
      });
      
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
          'X-Leader-Tab': this.isLeaderTab ? 'true' : 'false',
          'X-Request-Timestamp': Date.now().toString()
        },
        params: {
          since: this.lastEventTimestamp,
          _t: Date.now() // Cache buster
        },
        withCredentials: true
      });
      
      // Process events
      if (response.data && response.data.events) {
        this.processEvents(response.data.events);
      }
      
      // Update last event timestamp
      this.lastEventTimestamp = Date.now();
      
      // Reset polling attempts on success
      this.pollingAttempts = 0;
    } catch (error) {
      logger.error('Failed to poll auth events', error);
      
      // If we get a 401, try to refresh the token
      if (error.response && error.response.status === 401) {
        this.handleUnauthorizedError();
      }
    }
  }
  
  /**
   * Process authentication events
   */
  private processEvents(events: any[]): void {
    if (!events || events.length === 0) return;
    
    logger.debug(`Processing ${events.length} auth events from fallback polling`);
    
    // Process each event
    events.forEach(event => {
      // Emit event
      this.eventEmitter.emit(event.type, event.data);
      
      // Handle special events
      if (event.type === AuthEventType.TOKEN_EXPIRING && this.isLeaderTab) {
        this.handleTokenExpiring(event.data);
      } else if (event.type === AuthEventType.SESSION_EXPIRED) {
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
    
    // Emit event
    this.eventEmitter.emit(AuthEventType.SESSION_EXPIRED, {
      timestamp: Date.now(),
      reason: 'session_expired',
      source: 'fallback_polling'
    });
  }
  
  /**
   * Handle unauthorized error (401)
   */
  private handleUnauthorizedError(): void {
    // Only the leader tab should handle token refresh
    if (!this.isLeaderTab) return;
    
    logger.warn('Received 401 unauthorized in fallback service');
    
    // Try to refresh the token
    this.tokenService.refreshToken()
      .then(success => {
        logger.info('Token refresh after 401 in fallback mode', { success });
      })
      .catch(error => {
        logger.error('Failed to refresh token after 401 in fallback mode', error);
        
        // Emit session expired event
        this.eventEmitter.emit(AuthEventType.SESSION_EXPIRED, {
          timestamp: Date.now(),
          reason: 'token_refresh_failed',
          source: 'fallback_polling'
        });
      });
  }
  
  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    // Clear any existing interval
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
    }
    
    // Set up heartbeat interval
    const heartbeatInterval = SOCKET_CONFIG.HEARTBEAT.INTERVAL || 25000;
    this.heartbeatIntervalId = window.setInterval(() => {
      this.sendHeartbeat();
    }, heartbeatInterval);
    
    logger.debug('Fallback heartbeat started');
  }
  
  /**
   * Send heartbeat
   */
  private async sendHeartbeat(): Promise<void> {
    if (!navigator.onLine || !this.isPolling) return;
    
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
          'X-Tab-ID': this.tabId,
          'X-Request-Timestamp': Date.now().toString()
        },
        withCredentials: true
      });
      
      // Update last heartbeat
      this.lastHeartbeat = Date.now();
      
      logger.debug('Fallback heartbeat sent successfully');
    } catch (error) {
      logger.error('Failed to send fallback heartbeat', error);
    }
  }
  
  /**
   * Check session status
   */
  public async checkSessionStatus(): Promise<boolean> {
    try {
      // Get CSRF token
      const csrfToken = this.tokenService.getCsrfToken();
      
      // Check session status
      const response = await apiClient.get(SOCKET_CONFIG.FALLBACK.ENDPOINTS.SESSION_STATUS, {
        headers: {
          'X-CSRF-Token': csrfToken || '',
          'X-Device-ID': this.deviceId,
          'X-Tab-ID': this.tabId,
          'X-Request-Timestamp': Date.now().toString()
        },
        withCredentials: true
      });
      
      return response.data && response.data.active === true;
    } catch (error) {
      logger.error('Failed to check session status', error);
      return false;
    }
  }
  
  /**
   * Validate session
   */
  public async validateSession(): Promise<boolean> {
    try {
      // Get CSRF token
      const csrfToken = this.tokenService.getCsrfToken();
      
      // Validate session
      const response = await apiClient.post(SOCKET_CONFIG.FALLBACK.ENDPOINTS.SESSION_VALIDATE, {
        deviceId: this.deviceId,
        tabId: this.tabId,
        timestamp: Date.now()
      }, {
        headers: {
          'X-CSRF-Token': csrfToken || '',
          'X-Device-ID': this.deviceId,
          'X-Tab-ID': this.tabId,
          'X-Request-Timestamp': Date.now().toString()
        },
        withCredentials: true
      });
      
      return response.data && response.data.valid === true;
    } catch (error) {
      logger.error('Failed to validate session', error);
      return false;
    }
  }
  
  /**
   * Get device sessions
   */
  public async getDeviceSessions(): Promise<any[]> {
    try {
      // Get CSRF token
      const csrfToken = this.tokenService.getCsrfToken();
      
      // Get device sessions
      const response = await apiClient.get(SOCKET_CONFIG.FALLBACK.ENDPOINTS.DEVICE_SESSIONS, {
        headers: {
          'X-CSRF-Token': csrfToken || '',
          'X-Device-ID': this.deviceId,
          'X-Tab-ID': this.tabId,
          'X-Request-Timestamp': Date.now().toString()
        },
        withCredentials: true
      });
      
      return response.data && response.data.sessions ? response.data.sessions : [];
    } catch (error) {
      logger.error('Failed to get device sessions', error);
      return [];
    }
  }
  
  /**
   * Clean up resources
   */
  public destroy(): void {
    this.stopPolling();
    logger.info('Fallback API service destroyed');
  }
}

// Create singleton instance
let fallbackApiService: FallbackApiService | null = null;

export function getFallbackApiService(
  tokenService: TokenService,
  eventEmitter: EventEmitter
): FallbackApiService {
  if (!fallbackApiService && tokenService && eventEmitter) {
    fallbackApiService = new FallbackApiService(tokenService, eventEmitter);
  }
  
  if (!fallbackApiService) {
    throw new Error('FallbackApiService not initialized');
  }
  
  return fallbackApiService;
}
