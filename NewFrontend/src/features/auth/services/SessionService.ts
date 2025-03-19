// Extend Window interface to include session state
declare global {
  interface Window {
    __sessionServiceState?: {
      lastSyncTime?: number;
      sessionExpiry?: number;
      isActive?: boolean;
      [key: string]: any;
    };
  }
}

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
  sessionSyncEndpoint: string; // Add this property
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
  sessionSyncEndpoint: '/api/auth/session/sync', // Update with full path
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
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private sessionListeners: Array<(status: SessionStatus, data?: SessionData) => void> = [];
  private boundActivityHandler: () => void;
  private sessionInterval: ReturnType<typeof setInterval> | null = null;
  private syncInterval: number;
  private isAuthenticated: boolean = false;
  private api: any; // Using any for now, should be properly typed
  private lastActivity: number = Date.now();

  constructor(
    tokenService: TokenService,
    securityService: SecurityService,
    config: Partial<SessionServiceConfig> = {}
  ) {
    this.tokenService = tokenService;
    this.securityService = securityService;
    this.config = { ...defaultConfig, ...config };
    this.syncInterval = this.config.syncInterval;
    this.boundActivityHandler = this.handleUserActivity.bind(this);
    this.api = apiClient; // Assuming apiClient is imported
    
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
   * Create a default session when none exists
   */
  private createDefaultSession(): void {
    logger.debug('Creating default session');
    
    const defaultExpiry = new Date();
    defaultExpiry.setHours(defaultExpiry.getHours() + 24); // Default 24 hour session
    
    const sessionData: SessionData = {
      id: `session-${Date.now()}`,
      expiresAt: defaultExpiry.getTime(), // Changed to number instead of string
      lastActivity: Date.now(),
      userId: '',
      createdAt: Date.now(),
      deviceInfo: {
        browser: '',
        os: '',
        deviceType: ''
      }
    };
    
    this.sessionData = sessionData;
    this.saveSessionToStorage(sessionData);
    
    logger.debug('Default session created', { id: sessionData.id });
  }

  /**
   * Start tracking the user session
   */
  public startSessionTracking(): boolean {
    try {
      logger.info('Starting session tracking');
      
      // Get session data from storage
      const sessionData = this.getSessionData();
      
      if (!sessionData) {
        logger.warn('No session data available, creating default session');
        this.createDefaultSession();
      } else {
        logger.debug('Retrieved existing session data', sessionData);
        this.sessionData = sessionData;
      }
      
      // Set up activity tracking
      this.setupActivityTracking();
      
      // Set up session expiry check
      this.setupExpiryCheck();
      
      // Sync with server
      this.syncSession();
      
      return true;
    } catch (error) {
      logger.error('Failed to start session tracking', error);
      return false;
    }
  }

  /**
   * Stop tracking the user's session
   */
  public stopSessionTracking(notifyExpired: boolean = true): void {
    logger.info('Stopping session tracking', { notifyExpired });
    
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
    this.inactivityTimer = setTimeout(() => {
      // Check if session is still valid before expiring
      if (this.sessionData && this.getAccessToken()) {
        this.handleSessionExpired();
      } else {
        // If no access token, stop tracking silently
        this.stopSessionTracking(false);
      }
    }, this.config.sessionTimeout) as unknown as ReturnType<typeof setTimeout>;
  }

  /**
   * Start warning timer
   */
  private startWarningTimer(): void {
    // Clear existing timer
    if (this.warningTimer) {
      window.clearTimeout(this.warningTimer);
    }
    
    // Set new timer
    this.warningTimer = setTimeout(() => {
      this.sessionStatus = 'warning';
      this.notifyListeners();
    }, this.config.sessionTimeout - this.config.sessionWarningThreshold) as unknown as ReturnType<typeof setTimeout>;
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
    this.syncTimer = setTimeout(() => {
      this.syncWithServer();
      // Restart sync timer
      this.startSyncTimer();
    }, this.config.syncInterval) as unknown as ReturnType<typeof setTimeout>;
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
  private async syncWithServer(): Promise<boolean> {
    try {
      logger.debug('Syncing session with server');
      
      if (!this.sessionData) {
        logger.warn('No session data to sync');
        return false;
      }
      
      // Prepare session data for sync
      const syncData = {
        sessionId: this.sessionData.id && this.sessionData.id.match(/^[0-9a-fA-F]{24}$/) 
          ? this.sessionData.id  // Use existing ID if it's a valid MongoDB ObjectId
          : null,                // Otherwise let the server find or create a session
        lastActivity: this.sessionData.lastActivity,
        deviceInfo: this.securityService.getDeviceInfo()
      };
      
      logger.debug('Preparing session sync data', { 
        sessionId: syncData.sessionId, 
        hasLastActivity: !!syncData.lastActivity 
      });
      
      // Use the full path for the endpoint
      const endpoint = this.config.sessionSyncEndpoint;
      
      // Make the request with proper authentication
      const response = await apiClient.post(
        endpoint,
        syncData,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': this.tokenService.getCsrfToken() || ''
          }
        }
      );
      
      logger.debug('Session sync response', { 
        status: response.status,
        hasData: !!response.data
      });
      
      // Update session data with response from server
      if (response.data?.data?.session) {
        const serverSession = response.data.data.session;
        
        // Update the session data with server values
        this.sessionData = {
          ...this.sessionData,
          id: serverSession.sessionId,
          lastActivity: new Date(serverSession.lastActivity).getTime(),
          expiresAt: new Date(serverSession.expiresAt).getTime()
        };
        
        // Save updated session data
        this.saveSessionToStorage(this.sessionData);
        
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
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error syncing session with server:', error);
      return false;
    }
  }

  /**
   * Check if an endpoint exists
   */
  private async checkEndpointExists(endpoint: string): Promise<boolean> {
    try {
      logger.debug('Checking if endpoint exists:', { endpoint });
      
      const response = await apiClient.options(endpoint, {
        withCredentials: true
      });
      
      logger.debug('Endpoint check result:', { 
        status: response.status, 
        exists: response.status < 400 
      });
      
      return response.status < 400;
    } catch (error) {
      logger.warn('Endpoint check failed:', error);
      return false;
    }
  }

  /**
   * Update session data
   */
  private updateSessionData(newData: Partial<SessionData>): void {
    if (!this.sessionData) return;
    
    this.sessionData = {
      ...this.sessionData,
      ...newData,
      lastActivity: Date.now() // Always update last activity
    };
    
    this.saveSessionToStorage(this.sessionData);
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
  // public getSessionData(): SessionData | null {
  //   return this.sessionData;
  // }

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

  /**
   * Set up activity tracking
   */
  private setupActivityTracking(): void {
    // Remove any existing listeners
    this.removeActivityListeners();
    
    // Add activity event listeners
    this.config.activityEvents.forEach(eventType => {
      window.addEventListener(eventType, this.boundActivityHandler, { passive: true });
    });
    
    logger.debug('Activity tracking set up');
  }

  /**
   * Get session metrics for reporting
   */
  private getSessionMetrics(): any {
    // Return basic session metrics
    return {
      sessionDuration: this.sessionData ? Date.now() - (this.sessionData.createdAt || 0) : 0,
      lastActivity: this.lastActivity,
      // Add other metrics as needed
    };
  }

  // Add retry logic for session sync
  // async syncSessionWithRetry(retries = 3) {
  //   for (let i = 0; i < retries; i++) {
  //     try {
  //       await this.syncWithServer();
  //       return true;
  //     } catch (error) {
  //       logger.warn(`Session sync failed (attempt ${i+1}/${retries})`, error);
  //       await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
  //     }
  //   }
  //   logger.error(`Session sync failed after ${retries} attempts`);
  //   return false;
  // }

  // Add the missing saveSessionToStorage method
  private saveSessionToStorage(sessionData: SessionData): void {
    setSessionMetadata(sessionData);
  }

  // Add the missing setupExpiryCheck method
  private setupExpiryCheck(): void {
    logger.debug('Setting up session expiry check');
    
    // Clear any existing interval
    if (this.sessionInterval) {
      clearInterval(this.sessionInterval);
    }
    
    // Set up interval to check session expiry
    this.sessionInterval = setInterval(() => {
      if (!this.sessionData) return;
      
      if (isSessionExpired(this.sessionData)) {
        this.handleSessionExpired();
      } else if (this.shouldWarnAboutExpiry()) {
        this.sessionStatus = 'warning';
        this.notifyListeners();
      }
    }, 60000) as unknown as ReturnType<typeof setInterval>; // Check every minute
  }

  // Add the missing shouldWarnAboutExpiry method
  private shouldWarnAboutExpiry(): boolean {
    if (!this.sessionData) return false;
    
    const expiryTime = new Date(this.sessionData.expiresAt).getTime();
    const warningTime = expiryTime - this.config.sessionWarningThreshold;
    
    return Date.now() >= warningTime;
  }

  // Add the missing syncSession method
  private syncSession(): Promise<boolean> {
    return this.syncWithServer()
      .then(() => true)
      .catch(error => {
        logger.error('Session sync failed:', error);
        return false;
      });
  }

  /**
   * Get the last sync time
   */
  public getLastSyncTime(): number {
    // Initialize the state object if it doesn't exist
    if (typeof window !== 'undefined' && !window.__sessionServiceState) {
      window.__sessionServiceState = {
        lastSyncTime: 0
      };
    }
    
    return typeof window !== 'undefined' && window.__sessionServiceState 
      ? window.__sessionServiceState.lastSyncTime || 0 
      : 0;
  }

  /**
   * Check if session is active
   */
  public hasActiveSession(): boolean {
    return !!this.sessionData && this.isAuthenticated;
  }

  /**
   * Emit session synced event
   */
  private emitSessionSyncedEvent(): void {
    // Dispatch event for monitoring
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('session-synced'));
    }
  }

  /**
   * Get session data
   * @returns Session data object or null if not available
   */
  public getSessionData(): any {
    try {
      const sessionData = localStorage.getItem('auth_session_data');
      return sessionData ? JSON.parse(sessionData) : null;
    } catch (error) {
      logger.error('Error getting session data', error);
      return null;
    }
  }

  /**
   * Sync session with server with retry mechanism
   * @param maxRetries Maximum number of retry attempts
   * @returns Promise resolving to success status
   */
  public async syncSessionWithRetry(maxRetries = 3): Promise<boolean> {
    let retries = 0;
    let success = false;

    while (retries < maxRetries && !success) {
      try {
        await this.syncWithServer();
        success = true;
      } catch (error) {
        retries++;
        logger.warn(`Session sync failed, attempt ${retries}/${maxRetries}`, error);
        
        if (retries >= maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
      }
    }

    return success;
  }
}

// Export a singleton instance
export const sessionService = new SessionService(
  {} as TokenService,  // These will be properly injected by the auth module
  {} as SecurityService,
  {}
);

// Export default for dependency injection in tests
export default SessionService;
