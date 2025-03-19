/**
 * SessionService
 * 
 * Manages user sessions including:
 * - Track active sessions
 * - Session timeout handling
 * - Cross-tab synchronization
 * - Activity tracking
 * - Session persistence
 */

import { logger } from '@/utils/logger';
import { TokenService } from './TokenService';
import { SecurityService } from './SecurityService';
import { 
  getSessionMetadata, 
  setSessionMetadata,
  createSecurityContext
} from '../utils/storage.utils';
import {
  extractSessionData,
  isSessionExpired,
  updateLastActivity
} from '../utils/auth.utils';
import {
  SessionData,
  SecurityContext,
  SessionStatus
} from '../types/auth.types';
import { authApi } from '@/features/auth/api/auth-api';
import { apiClient } from '@/api/apiClient';

export interface SessionServiceConfig {
  apiBaseUrl: string;
  sessionEndpoint: string;
  sessionTimeout: number; // in milliseconds
  sessionWarningThreshold: number; // in milliseconds
  activityEvents: string[];
  enableCrossTabs: boolean;
  enableOfflineSupport: boolean;
  syncInterval: number; // in milliseconds
}

const defaultConfig: SessionServiceConfig = {
  apiBaseUrl: '/api',
  sessionEndpoint: '/auth/session',
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  sessionWarningThreshold: 5 * 60 * 1000, // 5 minutes before expiry
  activityEvents: ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'],
  enableCrossTabs: true,
  enableOfflineSupport: true,
  syncInterval: 5 * 60 * 1000 // 5 minutes
};

export class SessionService {
  private config: SessionServiceConfig;
  private tokenService: TokenService;
  private securityService: SecurityService;
  private sessionData: SessionData | null = null;
  private sessionStatus: SessionStatus = 'inactive';
  private inactivityTimer: number | null = null;
  private warningTimer: number | null = null;
  private syncTimer: number | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private sessionListeners: Array<(status: SessionStatus, data?: SessionData) => void> = [];
  private boundActivityHandler: () => void;

  constructor(
    config: Partial<SessionServiceConfig> = {},
    tokenService: TokenService,
    securityService: SecurityService
  ) {
    this.config = { ...defaultConfig, ...config };
    this.tokenService = tokenService;
    this.securityService = securityService;
    this.boundActivityHandler = this.handleUserActivity.bind(this);
    
    // Initialize cross-tab communication if enabled
    if (this.config.enableCrossTabs && typeof BroadcastChannel !== 'undefined') {
      this.initCrossTabCommunication();
    }
    
    logger.info('SessionService initialized');
  }

  /**
   * Initialize cross-tab communication
   */
  private initCrossTabCommunication(): void {
    try {
      this.broadcastChannel = new BroadcastChannel('session_channel');
      
      this.broadcastChannel.addEventListener('message', (event) => {
        const { type, payload } = event.data;
        
        switch (type) {
          case 'SESSION_UPDATED':
            // Update session data from another tab
            this.handleSessionSync(payload.sessionData);
            break;
            
          case 'SESSION_EXPIRED':
            // Session expired in another tab
            this.handleSessionExpired();
            break;
            
          case 'USER_ACTIVITY':
            // User activity in another tab
            this.handleUserActivity(false);
            break;
        }
      });
      
      logger.info('Cross-tab communication initialized for SessionService');
    } catch (error) {
      logger.error('Failed to initialize cross-tab communication:', error);
    }
  }

  /**
   * Start tracking the user's session
   */
  public startSessionTracking(): void {
    if (this.sessionStatus !== 'inactive') {
      return; // Already tracking
    }

    try {
      // Get existing session data or create new
      const existingData = getSessionMetadata();
      
      if (existingData) {
        this.sessionData = existingData;
      } else {
        // With HTTP-only cookies, we can't directly access the token
        // Instead, we'll create a basic session data object
        this.sessionData = {
          userId: 'anonymous', // Will be updated when user logs in
          createdAt: Date.now(), // Using timestamp instead of Date object
          lastActivity: Date.now(), // Using timestamp instead of Date object
          expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours from now
          deviceInfo: {
            browser: this.getBrowserInfo(),
            os: this.getOSInfo(),
            deviceType: this.getDeviceType()
          },
          securityContext: {
            id: 'temp-security-id',
            userId: 'anonymous',
            createdAt: Date.now(),
            lastVerified: Date.now(),
            deviceFingerprint: '',
            userAgent: navigator.userAgent,
            trustLevel: 'medium'
          },
          metadata: {
            sessionId: 'temp-session-id'
          }
        };
        
        // Create security context for new session
        createSecurityContext().then(securityContext => {
          if (this.sessionData) {
            this.sessionData.securityContext = securityContext;
            setSessionMetadata(this.sessionData);
          }
        });
      }
      
      if (this.sessionData) {
        // Update session status
        this.sessionStatus = 'active';
        this.notifyListeners();
        
        // Start inactivity timer
        this.startInactivityTimer();
        
        // Start warning timer
        this.startWarningTimer();
        
        // Start sync timer
        this.startSyncTimer();
        
        // Add activity listeners
        this.addActivityListeners();
        
        // Sync with server
        this.syncSessionWithServer();
        
        logger.info('Session tracking started');
      } else {
        logger.error('Failed to start session tracking: No session data');
      }
    } catch (error) {
      logger.error('Failed to start session tracking:', error);
    }
  }

  /**
   * Stop tracking the user's session
   */
  public stopSessionTracking(notifyExpired: boolean = true): void {
    try {
      // Clear timers
      if (this.inactivityTimer) {
        window.clearTimeout(this.inactivityTimer);
        this.inactivityTimer = null;
      }
      
      if (this.warningTimer) {
        window.clearTimeout(this.warningTimer);
        this.warningTimer = null;
      }
      
      if (this.syncTimer) {
        window.clearTimeout(this.syncTimer);
        this.syncTimer = null;
      }
      
      // Remove activity listeners
      this.removeActivityListeners();
      
      // Close broadcast channel
      if (this.broadcastChannel) {
        this.broadcastChannel.close();
        this.broadcastChannel = null;
      }
      
      // Update session status if notifying about expiration
      if (notifyExpired && this.sessionStatus !== 'expired') {
        this.sessionStatus = 'inactive';
        this.notifyListeners();
      }
      
      logger.info('Session tracking stopped');
    } catch (error) {
      logger.error('Failed to stop session tracking:', error);
    }
  }

  /**
   * Add activity event listeners
   */
  private addActivityListeners(): void {
    this.config.activityEvents.forEach(eventType => {
      window.addEventListener(eventType, this.boundActivityHandler, { passive: true });
    });
  }

  /**
   * Remove activity event listeners
   */
  private removeActivityListeners(): void {
    this.config.activityEvents.forEach(eventType => {
      window.removeEventListener(eventType, this.boundActivityHandler);
    });
  }

  /**
   * Handle user activity
   */
  private handleUserActivity(broadcast: boolean = true): void {
    if (!this.sessionData || this.sessionStatus === 'inactive') {
      return;
    }
    
    // Update last activity timestamp
    this.sessionData = updateLastActivity(this.sessionData);
    
    // Save updated session data
    setSessionMetadata(this.sessionData);
    
    // Restart inactivity timer
    this.startInactivityTimer();
    
    // If session was in warning state, update it
    if (this.sessionStatus === 'warning') {
      this.sessionStatus = 'active';
      this.notifyListeners();
    }
    
    // Broadcast activity to other tabs if needed
    if (broadcast && this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'USER_ACTIVITY',
        payload: {
          timestamp: Date.now()
        }
      });
    }
  }

  /**
   * Start inactivity timer
   */
  private startInactivityTimer(): void {
    // Clear existing timer
    if (this.inactivityTimer) {
      window.clearTimeout(this.inactivityTimer);
    }
    
    // Set new timer
    this.inactivityTimer = window.setTimeout(() => {
      // Check if session is still valid before expiring
      if (this.sessionData && this.getAccessToken()) {
        this.handleSessionExpired();
      } else {
        // If no access token, stop tracking silently
        this.stopSessionTracking(false);
      }
    }, this.config.sessionTimeout);
  }

  /**
   * Start warning timer
   */
  private startWarningTimer(): void {
    // Clear existing timer
    if (this.warningTimer) {
      window.clearTimeout(this.warningTimer);
    }
    
    // Calculate time until warning
    const timeUntilExpiry = this.getTimeUntilExpiry();
    const timeUntilWarning = timeUntilExpiry - this.config.sessionWarningThreshold;
    
    if (timeUntilWarning <= 0) {
      // Already in warning period
      if (timeUntilExpiry > 0) {
        this.sessionStatus = 'warning';
        this.notifyListeners();
      }
      return;
    }
    
    // Set new timer
    this.warningTimer = window.setTimeout(() => {
      this.sessionStatus = 'warning';
      this.notifyListeners();
    }, timeUntilWarning);
  }

  /**
   * Start sync timer
   */
  private startSyncTimer(): void {
    // Clear existing timer
    if (this.syncTimer) {
      window.clearTimeout(this.syncTimer);
    }
    
    // Set new timer
    this.syncTimer = window.setTimeout(() => {
      this.syncSessionWithServer();
      // Restart sync timer
      this.startSyncTimer();
    }, this.config.syncInterval);
  }

  /**
   * Handle session expiration
   */
  private handleSessionExpired(): void {
    // Update session status
    this.sessionStatus = 'expired';
    this.notifyListeners();
    
    // Stop tracking
    this.stopSessionTracking();
    
    // Broadcast to other tabs if needed
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'SESSION_EXPIRED'
      });
    }
    
    logger.info('Session expired');
  }

  /**
   * Handle session sync from another tab
   */
  private handleSessionSync(sessionData: SessionData): void {
    if (!this.sessionData) {
      return;
    }
    
    // Update session data with the latest from another tab
    this.sessionData = {
      ...this.sessionData,
      ...sessionData,
      // Keep local security context
      securityContext: this.sessionData.securityContext
    };
    
    // Save updated session data
    setSessionMetadata(this.sessionData);
    
    // Check if session is expired
    if (isSessionExpired(this.sessionData)) {
      this.handleSessionExpired();
      return;
    }
    
    // Restart timers
    this.startInactivityTimer();
    this.startWarningTimer();
  }

  /**
   * Sync session with server
   */
  private async syncSessionWithServer(): Promise<void> {
    if (!this.sessionData || !navigator.onLine) {
      return;
    }
    
    try {
      // First check if the endpoint exists to avoid 404 errors
      const endpointExists = await this.checkEndpointExists(`${this.config.apiBaseUrl}/auth/session/sync`);
      
      if (!endpointExists) {
        // Endpoint doesn't exist, use local session management instead
        this.updateSessionLocally();
        return;
      }
      
      // Check if the endpoint exists before making the request
      const response = await apiClient.post('/api/auth/session/sync', {
        sessionId: this.sessionData.metadata?.sessionId || null,
        lastActivity: new Date().toISOString(),
        metrics: this.sessionData.metrics || {},
        deviceInfo: this.sessionData.deviceInfo
      });
      
      if (response.data && response.data.status === 'valid') {
        // Update session expiry time if provided
        if (response.data.expiresAt) {
          this.sessionData.expiresAt = response.data.expiresAt;
          setSessionMetadata(this.sessionData);
        }
        
        logger.info('Session synced with server');
      } else if (response.data && response.data.status === 'terminated') {
        this.handleSessionExpired();
        logger.warn(`Session terminated by server: ${response.data.reason}`);
      }
    } catch (error) {
      // Handle 404 errors gracefully
      if (error.response && error.response.status === 404) {
        logger.info('Session sync endpoint not available, using local session management');
        this.updateSessionLocally();
      } else {
        logger.warn('Session sync failed, continuing with local session management', error);
      }
    }
  }

  /**
   * Check if an endpoint exists
   */
  private async checkEndpointExists(url: string): Promise<boolean> {
    try {
      // Use HEAD request to check if endpoint exists without fetching data
      const response = await fetch(url, {
        method: 'HEAD',
        credentials: 'include'
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update session locally when server sync is not available
   */
  private updateSessionLocally(): void {
    if (!this.sessionData) return;
    
    // Update last activity
    this.sessionData.lastActivity = Date.now();
    
    // Calculate new expiry time based on config
    const newExpiryTime = Date.now() + this.config.sessionTimeout;
    
    // Only extend expiry if it would expire sooner than the new time
    if (!this.sessionData.expiresAt || this.sessionData.expiresAt < newExpiryTime) {
      this.sessionData.expiresAt = newExpiryTime;
    }
    
    // Save updated session data
    setSessionMetadata(this.sessionData);
    
    // Restart timers
    this.startInactivityTimer();
    this.startWarningTimer();
    
    logger.debug('Session updated locally');
  }

  /**
   * Get time until session expiry in milliseconds
   */
  private getTimeUntilExpiry(): number {
    if (!this.sessionData) {
      return 0;
    }
    
    const now = Date.now();
    return Math.max(0, this.sessionData.expiresAt - now);
  }

  /**
   * Get current session status
   */
  public getSessionStatus(): SessionStatus {
    return this.sessionStatus;
  }

  /**
   * Get current session data
   */
  public getSessionData(): SessionData | null {
    return this.sessionData;
  }

  /**
   * Subscribe to session status changes
   */
  public subscribe(listener: (status: SessionStatus, data?: SessionData) => void): () => void {
    this.sessionListeners.push(listener);
    
    // Immediately notify with current status
    listener(this.sessionStatus, this.sessionData || undefined);
    
    // Return unsubscribe function
    return () => {
      this.sessionListeners = this.sessionListeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners of session status changes
   */
  private notifyListeners(): void {
    this.sessionListeners.forEach(listener => {
      listener(this.sessionStatus, this.sessionData || undefined);
    });
  }

  /**
   * Terminate the current session
   */
  public async terminateSession(reason: string = 'user_terminated'): Promise<boolean> {
    try {
      // Call server to terminate session
      if (navigator.onLine) {
        await apiClient.post(
          `${this.config.apiBaseUrl}${this.config.sessionEndpoint}/terminate`,
          { reason }
        );
      }
      
      // Stop tracking
      this.stopSessionTracking();
      
      // Clear session data
      this.sessionData = null;
      setSessionMetadata(null);
      
      return true;
    } catch (error) {
      logger.error('Failed to terminate session:', error);
      return false;
    }
  }

  /**
   * Get access token from TokenService
   */
  private getAccessToken(): string | null {
    return this.tokenService.getAccessToken();
  }

  /**
   * Update the last activity timestamp
   * @param timestamp - The timestamp to set as last activity (defaults to current time)
   */
  public updateLastActivity(timestamp: number = Date.now()): void {
    if (!this.sessionData || this.sessionStatus === 'inactive') {
      return;
    }
    
    // Update last activity timestamp
    this.sessionData = updateLastActivity(this.sessionData, timestamp);
    
    // Save updated session data
    setSessionMetadata(this.sessionData);
    
    // If session was in warning state, update it
    if (this.sessionStatus === 'warning') {
      this.sessionStatus = 'active';
      this.notifyListeners();
    }
    
    // Broadcast activity to other tabs if needed
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'USER_ACTIVITY',
        payload: {
          timestamp
        }
      });
    }
  }

  /**
   * Cleanup resources when service is destroyed
   */
  public destroy(): void {
    // Stop tracking
    this.stopSessionTracking();
    
    // Close broadcast channel
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
  }

  /**
   * Get session expiry time
   * Returns the timestamp when the current session will expire
   */
  public getSessionExpiry(): number {
    // For HTTP-only cookies, we need to track session expiry separately
    const expiryStr = localStorage.getItem('auth_session_expiry');
    if (expiryStr) {
      return parseInt(expiryStr, 10);
    }
    
    // If no expiry is stored, return current time (session considered expired)
    return Date.now();
  }

  /**
   * Extend the current session
   * @returns Promise resolving to whether extension was successful
   */
  public async extendSession(): Promise<boolean> {
    try {
      // For HTTP-only cookies, we need to call the server to extend the session
      const response = await fetch(`${this.config.apiBaseUrl}/auth/extend-session`, {
        method: 'POST',
        credentials: 'include', // Important for cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to extend session');
      }
      
      const data = await response.json();
      
      // Update the session expiry in localStorage
      if (data.expiresAt) {
        localStorage.setItem('auth_session_expiry', data.expiresAt.toString());
        
        // If we have session data, update it too
        if (this.sessionData) {
          this.sessionData = {
            ...this.sessionData,
            expiresAt: data.expiresAt
          };
          
          // Save updated session data
          setSessionMetadata(this.sessionData);
          
          // Restart timers
          this.startInactivityTimer();
          this.startWarningTimer();
          
          // Broadcast to other tabs if needed
          if (this.broadcastChannel) {
            this.broadcastChannel.postMessage({
              type: 'SESSION_UPDATED',
              payload: {
                sessionData: this.sessionData
              }
            });
          }
        }
      }
      
      logger.info('Session extended successfully');
      return true;
    } catch (error) {
      logger.error('Error extending session', error);
      return false;
    }
  }

  /**
   * Get browser information
   */
  private getBrowserInfo(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.indexOf("Chrome") > -1) return "Chrome";
    if (userAgent.indexOf("Safari") > -1) return "Safari";
    if (userAgent.indexOf("Firefox") > -1) return "Firefox";
    if (userAgent.indexOf("MSIE") > -1 || userAgent.indexOf("Trident") > -1) return "IE";
    if (userAgent.indexOf("Edge") > -1) return "Edge";
    return "Unknown";
  }

  /**
   * Get OS information
   */
  private getOSInfo(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.indexOf("Windows") > -1) return "Windows";
    if (userAgent.indexOf("Mac") > -1) return "MacOS";
    if (userAgent.indexOf("Linux") > -1) return "Linux";
    if (userAgent.indexOf("Android") > -1) return "Android";
    if (userAgent.indexOf("iOS") > -1 || userAgent.indexOf("iPhone") > -1 || userAgent.indexOf("iPad") > -1) return "iOS";
    return "Unknown";
  }

  /**
   * Get device type
   */
  private getDeviceType(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.indexOf("Mobile") > -1) return "Mobile";
    if (userAgent.indexOf("Tablet") > -1) return "Tablet";
    return "Desktop";
  }
}

// Export a singleton instance
export const sessionService = new SessionService(
  undefined,
  // These will be injected by the auth module
  {} as TokenService,
  {} as SecurityService
);

// Export default for dependency injection in tests
export default SessionService;
