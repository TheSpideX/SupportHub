import { BroadcastChannel } from 'broadcast-channel';
import { tokenService } from './token.service';
import { securityService } from './security.service';
import { deviceService } from './device.service';
import { AUTH_CONSTANTS } from '../constants/auth.constants';
import { EventEmitter } from '@/utils/event-emitter';
import { Logger } from '@/utils/logger';
import { 
  SessionData, 
  SessionState, 
  SessionMetrics,
  DeviceInfo,
  SecurityContext 
} from '../types/session.types';
import { User } from '../types/auth.types';
import { axiosInstance } from '@/utils/axios';
import { API_ROUTES } from '@/config/routes';
import { SecureStorage } from '@/utils/secure-storage';
import { AuthError, createAuthError } from '../errors/auth-error';

interface ValidationCacheEntry {
  result: boolean;
  timestamp: number;
}

export class SessionService {
  private static instance: SessionService;
  private readonly SESSION_KEY = 'user_session';
  private readonly ACTIVITY_KEY = 'last_activity';
  private readonly METRICS_KEY = 'session_metrics';
  private readonly INACTIVE_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CHECK_INTERVAL = 60 * 1000; // 1 minute
  private readonly VALIDATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  private secureStorage: SecureStorage;
  private logger: Logger;
  private sessionChannel: BroadcastChannel<any>;
  private sessionListeners: Set<() => void> = new Set();
  private events: EventEmitter;
  private activityTimer: NodeJS.Timeout | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private metricsTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private metrics: SessionMetrics = {
    startTime: 0,
    activeTime: 0,
    interactions: 0,
    networkRequests: 0,
    errors: 0
  };
  private validationCache: Map<string, ValidationCacheEntry> = new Map();
  private recoveryAttempts: number = 0;
  private readonly MAX_RECOVERY_ATTEMPTS = 3;
  private isRecoveryInProgress: boolean = false;

  private constructor() {
    this.secureStorage = new SecureStorage('session');
    this.logger = new Logger('SessionService');
    this.sessionChannel = new BroadcastChannel('session_channel');
    this.events = new EventEmitter();
    
    this.setupSessionSync();
    this.setupBeforeUnloadHandler();
    this.setupNetworkStatusMonitoring();
    
    // Initialize session if tokens exist
    this.initializeFromExistingTokens();
  }

  static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  // Event subscription methods
  onSessionStart(callback: (data: any) => void): () => void {
    return this.events.on('sessionStarted', callback);
  }

  onSessionEnd(callback: (data: any) => void): () => void {
    return this.events.on('sessionEnded', callback);
  }

  onSessionExpired(callback: () => void): () => void {
    return this.events.on('sessionExpired', callback);
  }

  onSessionExtended(callback: () => void): () => void {
    return this.events.on('sessionExtended', callback);
  }

  onForceLogout(callback: (data: any) => void): () => void {
    return this.events.on('forceLogout', callback);
  }

  onGlobalLogout(callback: () => void): () => void {
    return this.events.on('globalLogout', callback);
  }

  onSessionSecurityIssue(callback: (data: any) => void): () => void {
    return this.events.on('sessionSecurityIssue', callback);
  }

  // Session Lifecycle Management
  async initializeSession(user: User, deviceInfo: DeviceInfo): Promise<void> {
    try {
      const securityContext = await securityService.getSecurityContext();
      const session: SessionData = {
        id: crypto.randomUUID(),
        user,
        startTime: Date.now(),
        lastActivity: Date.now(),
        deviceInfo: {
          ...deviceInfo,
          userAgent: navigator.userAgent,
          platform: navigator.platform
        },
        securityContext,
        state: 'active',
        metadata: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: navigator.language,
          screenResolution: `${window.screen.width}x${window.screen.height}`
        }
      };
      
      // Set the session
      await this.setSession(session);
      
      // Persist the session
      await this.persistSession(session);
      
      // Start monitoring
      this.startSessionMonitoring();
      
      this.logger.info('Session initialized successfully', { sessionId: session.id });
    } catch (error) {
      this.logger.error('Failed to initialize session', { error });
      throw error;
    }
  }

  async endSession(reason: 'LOGOUT' | 'EXPIRED' | 'FORCED' = 'LOGOUT'): Promise<void> {
    try {
      const session = await this.getSession();
      if (session) {
        await this.deregisterSessionFromServer(session.id);
        this.stopSessionMonitoring();
        await this.saveSessionMetrics();
        
        await Promise.all([
          tokenService.clearTokens(),
          this.clearSessionData(),
          this.notifySessionEnd(reason)
        ]);

        this.sessionChannel.postMessage({ 
          type: 'SESSION_ENDED',
          data: { reason, sessionId: session.id } 
        });
        
        this.events.emit('sessionEnded', { reason, sessionId: session.id });
      }
    } catch (error) {
      this.logger.error('Session end error:', { error });
      // Force cleanup even if server communication fails
      await this.clearSessionData();
    }
  }

  // Session Storage and Retrieval
  private async storeSession(session: SessionData): Promise<void> {
    try {
      const encryptedSession = await this.encryptSessionData(session);
      await this.secureStorage.setItem(this.SESSION_KEY, encryptedSession);
    } catch (error) {
      this.logger.error('Session storage failed', { error });
      throw new Error('Failed to store session');
    }
  }

  async getSession(): Promise<SessionData | null> {
    try {
      const encryptedSession = await this.secureStorage.getItem(this.SESSION_KEY);
      if (!encryptedSession) return null;
      
      const session = await this.decryptSessionData(encryptedSession);
      return session;
    } catch {
      return null;
    }
  }

  // Session Validation and Activity Monitoring
  async isSessionValid(useCachedResult = false): Promise<boolean> {
    try {
      const session = await this.getSession();
      if (!session) return false;
      
      const cacheKey = `session_valid:${session.id}`;
      
      // Check cache if allowed
      if (useCachedResult) {
        const cached = this.validationCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.VALIDATION_CACHE_TTL) {
          return cached.result;
        }
      }
      
      // Perform validation if no cache or cache expired
      const validationResults = await Promise.allSettled([
        this.validateTokens(),
        this.validateDeviceContext(session),
        this.validateActivityTimeout(),
        this.validateSecurityContext(session)
      ]);
      
      // Consider the session valid if all validations that completed successfully passed
      const isValid = validationResults.every(result => 
        result.status === 'fulfilled' ? result.value : true
      );
      
      // Cache the result
      this.validationCache.set(cacheKey, {
        result: isValid,
        timestamp: Date.now()
      });
      
      return isValid;
    } catch (error) {
      this.logger.error('Session validation failed', { error });
      return false;
    }
  }

  private startSessionMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    // Set up interval to check session validity
    this.monitoringInterval = setInterval(() => {
      this.checkSessionValidity();
    }, this.MONITORING_INTERVAL);
    
    // Set up activity listeners
    this.setupActivityListeners();
    
    this.logger.debug('Session monitoring started');
  }

  private stopSessionMonitoring(): void {
    [this.activityTimer, this.syncTimer, this.metricsTimer, this.healthCheckTimer].forEach(timer => {
      if (timer) clearInterval(timer);
    });
    this.removeActivityListeners();
  }

  // Activity Tracking
  private startActivityTracking(): void {
    const activityEvents = ['mousemove', 'keypress', 'click', 'touchstart', 'scroll'];
    
    activityEvents.forEach(event => {
      document.addEventListener(event, this.handleUserActivity);
    });

    this.activityTimer = setInterval(() => {
      this.checkInactivity();
    }, this.CHECK_INTERVAL);
  }

  private handleUserActivity = async (): Promise<void> => {
    const currentSession = await this.getSession();
    if (!currentSession) return;

    this.updateLastActivity();
    this.metrics.interactions++;
    
    this.sessionChannel.postMessage({ 
      type: 'ACTIVITY_UPDATE',
      data: {
        sessionId: currentSession.id,
        timestamp: Date.now()
      }
    });
  };

  private removeActivityListeners(): void {
    const activityEvents = ['mousemove', 'keypress', 'click', 'touchstart', 'scroll'];
    
    activityEvents.forEach(event => {
      document.removeEventListener(event, this.handleUserActivity);
    });
  }

  // Session Synchronization
  private setupSessionSync(): void {
    this.sessionChannel.onmessage = async (msg) => {
      switch (msg.type) {
        case 'SESSION_TERMINATED':
          if (msg.data.sessionId === (await this.getSession())?.id) {
            await this.endSession('FORCED');
            this.events.emit('forceLogout', { reason: msg.data.reason });
          }
          break;

        case 'SESSION_RECOVERY_REQUIRED':
          if (msg.data.sessionId === (await this.getSession())?.id) {
            await this.attemptSessionRecovery();
          }
          break;

        case 'GLOBAL_LOGOUT':
          await this.endSession('FORCED');
          this.events.emit('globalLogout');
          break;

        case 'SESSION_STATE_UPDATE':
          await this.handleSessionStateUpdate(msg.data);
          break;
          
        case 'ACTIVITY_UPDATE':
          // Sync activity across tabs
          const session = await this.getSession();
          if (session && msg.data.sessionId === session.id) {
            localStorage.setItem(this.ACTIVITY_KEY, msg.data.timestamp.toString());
          }
          break;
      }
    };
    
    this.startSessionSync();
  }

  private startSessionSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    this.syncTimer = setInterval(async () => {
      try {
        const session = await this.getSession();
        if (!session) return;
        
        // Sync session state with server
        const response = await axiosInstance.post(API_ROUTES.AUTH.SYNC_SESSION, {
          sessionId: session.id,
          lastActivity: await this.getLastActivity(),
          metrics: this.metrics
        });
        
        if (response.data.status === 'invalid') {
          this.sessionChannel.postMessage({
            type: 'SESSION_RECOVERY_REQUIRED',
            data: { sessionId: session.id }
          });
        } else if (response.data.status === 'terminated') {
          await this.endSession('FORCED');
          this.events.emit('forceLogout', { reason: response.data.reason });
        }
      } catch (error) {
        this.logger.error('Session sync failed', { error });
      }
    }, this.SYNC_INTERVAL);
  }

  // Metrics and Analytics
  private initializeSessionMetrics(session: SessionData): void {
    this.metrics = {
      startTime: session.startTime,
      activeTime: 0,
      interactions: 0,
      networkRequests: 0,
      errors: 0
    };
  }

  private startMetricsTracking(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    
    this.metricsTimer = setInterval(() => {
      this.updateSessionMetrics();
    }, 60000); // Update metrics every minute
    
    // Track network requests
    this.setupNetworkTracking();
  }

  private updateSessionMetrics(): void {
    const now = Date.now();
    const lastActivity = parseInt(localStorage.getItem(this.ACTIVITY_KEY) || '0', 10);
    
    // Only count time as active if there was activity in the last 5 minutes
    if (now - lastActivity < 5 * 60 * 1000) {
      this.metrics.activeTime += 60; // Add one minute of active time
    }
    
    // Save metrics to storage
    this.saveSessionMetrics();
  }

  private async saveSessionMetrics(): Promise<void> {
    try {
      localStorage.setItem(this.METRICS_KEY, JSON.stringify(this.metrics));
      
      // Optionally send metrics to server
      const session = await this.getSession();
      if (session) {
        await axiosInstance.post(API_ROUTES.AUTH.UPDATE_SESSION_METRICS, {
          sessionId: session.id,
          metrics: this.metrics
        }).catch(error => {
          this.logger.error('Failed to update session metrics on server', { error });
        });
      }
    } catch (error) {
      this.logger.error('Failed to save session metrics', { error });
    }
  }

  private setupNetworkTracking(): void {
    // Track successful requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      this.metrics.networkRequests++;
      return originalFetch.apply(window, args);
    };
    
    // Track axios requests
    axiosInstance.interceptors.request.use(config => {
      this.metrics.networkRequests++;
      return config;
    });
    
    // Track errors
    window.addEventListener('error', () => {
      this.metrics.errors++;
    });
  }

  // Security and Validation
  private async validateTokens(): Promise<boolean> {
    const accessToken = await tokenService.getAccessToken();
    return !!(accessToken && !(await tokenService.isTokenBlacklisted(accessToken)));
  }

  private async validateDeviceContext(session: SessionData): Promise<boolean> {
    const currentDeviceInfo = await deviceService.getDeviceInfo();
    return currentDeviceInfo.fingerprint === session.deviceInfo.fingerprint;
  }

  private async validateActivityTimeout(): Promise<boolean> {
    const lastActivity = await this.getLastActivity();
    return (Date.now() - lastActivity) < this.INACTIVE_TIMEOUT;
  }

  private async validateSecurityContext(session: SessionData): Promise<boolean> {
    // Use a single API call to validate multiple security aspects
    try {
      const response = await axiosInstance.post(API_ROUTES.AUTH.VALIDATE_SESSION, {
        sessionId: session.id,
        deviceFingerprint: session.deviceInfo.fingerprint,
        securityContext: session.securityContext
      });
      
      return response.data.valid;
    } catch {
      // If server validation fails, fall back to local validation
      const currentSecurityContext = await securityService.getSecurityContext();
      
      // Compare critical security properties
      return (
        currentSecurityContext.ipAddress === session.securityContext.ipAddress &&
        currentSecurityContext.userAgent === session.securityContext.userAgent
      );
    }
  }

  // Utility Methods
  private async encryptSessionData(data: SessionData): Promise<string> {
    // In a real implementation, this would use a proper encryption algorithm
    // For now, we'll just return the JSON string
    // TODO: Implement actual encryption
    return JSON.stringify(data);
  }

  private async decryptSessionData(encrypted: string): Promise<SessionData> {
    // In a real implementation, this would decrypt the data
    // For now, we'll just parse the JSON
    // TODO: Implement actual decryption
    return JSON.parse(encrypted);
  }

  private async clearSessionData(): Promise<void> {
    try {
      // Remove session from secure storage
      await this.secureStorage.removeItem('current_session');
      
      // Remove the session flag
      localStorage.removeItem('has_session');
      
      // Clear validation cache
      this.validationCache.clear();
      
      this.logger.debug('Session data cleared successfully', { 
        component: 'SessionService' // Use a default component name
      });
    } catch (error) {
      this.logger.error('Failed to clear session data', { 
        error,
        component: 'SessionService' // Use a default component name
      });
    }
  }

  private async checkInactivity(): Promise<void> {
    const session = await this.getSession();
    if (!session) return;

    const lastActivity = await this.getLastActivity();
    const now = Date.now();
    const inactiveTime = now - lastActivity;

    if (inactiveTime >= this.INACTIVE_TIMEOUT) {
      await this.endSession('EXPIRED');
      this.events.emit('sessionExpired');
    } else if (this.shouldExtendSession(inactiveTime)) {
      await this.extendSession();
    }
  }

  private async getLastActivity(): Promise<number> {
    const stored = localStorage.getItem(this.ACTIVITY_KEY);
    return stored ? parseInt(stored, 10) : Date.now();
  }

  private async updateLastActivity(): Promise<void> {
    const now = Date.now();
    localStorage.setItem(this.ACTIVITY_KEY, now.toString());
    
    const session = await this.getSession();
    if (session) {
      session.lastActivity = now;
      await this.storeSession(session);
    }
  }

  private shouldExtendSession(inactiveTime: number): boolean {
    const extensionThreshold = this.INACTIVE_TIMEOUT * 0.5; // Extend at 50% of timeout
    return inactiveTime >= extensionThreshold;
  }

  private async extendSession(): Promise<void> {
    try {
      const session = await this.getSession();
      if (!session) return;

      // Extend session on server
      await axiosInstance.post(API_ROUTES.AUTH.EXTEND_SESSION, {
        sessionId: session.id
      });

      // Update local session
      session.expiresAt = Date.now() + this.INACTIVE_TIMEOUT;
      await this.storeSession(session);
      
      this.events.emit('sessionExtended');
    } catch (error) {
      this.logger.error('Failed to extend session', { error });
    }
  }

  // Session Recovery
  private async attemptSessionRecovery(): Promise<boolean> {
    if (this.isRecoveryInProgress) return false;
    
    this.isRecoveryInProgress = true;
    
    try {
      if (this.recoveryAttempts >= this.MAX_RECOVERY_ATTEMPTS) {
        this.logger.warn('Maximum recovery attempts reached, forcing logout');
        await this.endSession('FORCED');
        this.events.emit('forceLogout', { reason: 'MAX_RECOVERY_ATTEMPTS_REACHED' });
        return false;
      }
      
      this.recoveryAttempts++;
      
      const session = await this.getSession();
      if (!session) return false;

      const recoverySteps = [
        this.validateTokens(),
        this.validateDeviceContext(session),
        this.validateSecurityContext(session),
        this.validateActivityTimeout()
      ];

      const results = await Promise.all(recoverySteps);
      const isValid = results.every(result => result);

      if (!isValid) {
        // Try to refresh tokens
        const refreshed = await tokenService.refreshTokens();
        if (refreshed) {
          await this.extendSession();
          this.recoveryAttempts = 0; // Reset counter on successful recovery
          return true;
        }
        
        // If token refresh fails, try to restore from persisted state
        const restored = await this.restoreSessionState();
        if (restored) {
          this.recoveryAttempts = 0;
          return true;
        }
      } else {
        this.recoveryAttempts = 0;
        return true;
      }

      // If all recovery attempts fail
      if (this.recoveryAttempts >= this.MAX_RECOVERY_ATTEMPTS) {
        await this.endSession('FORCED');
        this.events.emit('forceLogout', { reason: 'RECOVERY_FAILED' });
      }
      
      return false;
    } catch (error) {
      this.logger.error('Session recovery failed', { error });
      return false;
    } finally {
      this.isRecoveryInProgress = false;
    }
  }

  private async persistSessionState(): Promise<void> {
    try {
      const session = await this.getSession();
      if (!session) return;

      const persistedState = {
        sessionId: session.id,
        metrics: this.metrics,
        lastActivity: await this.getLastActivity(),
        securityContext: session.securityContext
      };

      const encrypted = await this.encryptSessionData(persistedState);
      sessionStorage.setItem('session_state', encrypted);
    } catch (error) {
      this.logger.error('Failed to persist session state', { error });
    }
  }

  private async restoreSessionState(): Promise<boolean> {
    try {
      const encryptedState = sessionStorage.getItem('session_state');
      if (!encryptedState) return false;
      
      const state = await this.decryptSessionData(encryptedState);
      
      // Verify the session ID matches
      const currentSession = await this.getSession();
      if (!currentSession || currentSession.id !== state.sessionId) {
        return false;
      }
      
      // Restore metrics and activity
      this.metrics = state.metrics;
      localStorage.setItem(this.ACTIVITY_KEY, state.lastActivity.toString());
      
      return true;
    } catch (error) {
      this.logger.error('Failed to restore session state', { error });
      return false;
    }
  }

  // Health Monitoring
  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(() => {
      this.monitorSessionHealth();
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  private async monitorSessionHealth(): Promise<void> {
    try {
      const session = await this.getSession();
      if (!session) return;

      const healthMetrics = {
        tokenHealth: await this.validateTokens(),
        deviceHealth: await this.validateDeviceContext(session),
        securityHealth: await this.validateSecurityContext(session),
        activityHealth: Date.now() - await this.getLastActivity() < this.INACTIVE_TIMEOUT,
        networkHealth: navigator.onLine
      };

      const unhealthyMetrics = Object.entries(healthMetrics)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

      if (unhealthyMetrics.length > 0) {
        this.logger.warn('Session health issues detected', { unhealthyMetrics });
        
        if (unhealthyMetrics.includes('tokenHealth')) {
          await this.attemptSessionRecovery();
        }

        if (unhealthyMetrics.includes('securityHealth')) {
          this.events.emit('sessionSecurityIssue', { 
            sessionId: session.id,
            issues: unhealthyMetrics
          });
        }
      }
    } catch (error) {
      this.logger.error('Session health check failed', { error });
    }
  }

  // Server Communication
  private async registerSessionWithServer(session: SessionData): Promise<void> {
    try {
      await axiosInstance.post(API_ROUTES.AUTH.REGISTER_SESSION, {
        sessionId: session.id,
        userId: session.user.id,
        deviceInfo: session.deviceInfo,
        metadata: session.metadata
      });
    } catch (error) {
      this.logger.error('Failed to register session with server', { error });
      // Continue anyway - we'll try to sync later
    }
  }

  private async deregisterSessionFromServer(sessionId: string): Promise<void> {
    try {
      await axiosInstance.post(API_ROUTES.AUTH.DEREGISTER_SESSION, { sessionId });
    } catch (error) {
      this.logger.error('Failed to deregister session from server', { error });
      // Continue anyway - session will eventually expire on server
    }
  }

  private async notifySessionEnd(reason: string): Promise<void> {
    try {
      await axiosInstance.post(API_ROUTES.AUTH.END_SESSION, { 
        reason,
        metrics: this.metrics
      });
    } catch (error) {
      this.logger.error('Failed to notify server about session end', { error });
    }
  }

  // Force logout capability
  async forceLogout(sessionId: string, reason: string = 'ADMIN_ACTION'): Promise<void> {
    try {
      await axiosInstance.post(API_ROUTES.AUTH.FORCE_LOGOUT, { sessionId });
      
      this.sessionChannel.postMessage({
        type: 'SESSION_TERMINATED',
        data: { sessionId, reason }
      });

      this.events.emit('sessionTerminated', { sessionId, reason });
    } catch (error) {
      this.logger.error('Force logout failed', { error });
      throw error;
    }
  }

  // Global logout (all sessions)
  async logoutAllSessions(exceptCurrentSession: boolean = false): Promise<void> {
    try {
      const currentSession = await this.getSession();
      await axiosInstance.post(API_ROUTES.AUTH.LOGOUT_ALL, {
        exceptSessionId: exceptCurrentSession ? currentSession?.id : null
      });

      this.sessionChannel.postMessage({
        type: 'GLOBAL_LOGOUT',
        data: { initiatorSessionId: currentSession?.id }
      });

      if (!exceptCurrentSession) {
        await this.endSession('FORCED');
      }
    } catch (error) {
      this.logger.error('Global logout failed', { error });
      throw error;
    }
  }

  // Handle session state updates
  private async handleSessionStateUpdate(data: any): Promise<void> {
    const currentSession = await this.getSession();
    if (!currentSession || data.sessionId !== currentSession.id) return;

    if (data.type === 'SECURITY_CONTEXT_CHANGE') {
      await this.validateSecurityContext(currentSession);
    } else if (data.type === 'TOKEN_REFRESH_REQUIRED') {
      await tokenService.refreshTokens();
    }
  }

  // Get all active sessions
  async getAllActiveSessions(): Promise<SessionData[]> {
    try {
      const response = await axiosInstance.get(API_ROUTES.AUTH.ACTIVE_SESSIONS);
      const currentSession = await this.getSession();

      return response.data.map(session => ({
        ...session,
        isCurrentSession: session.id === currentSession?.id
      }));
    } catch (error) {
      this.logger.error('Failed to fetch active sessions', { error });
      throw error;
    }
  }

  // Initialize from existing tokens
  private async initializeFromExistingTokens(): Promise<boolean> {
    try {
      // Check if we have tokens
      if (!tokenService.hasStoredTokens()) {
        this.logger.debug('No tokens found');
        return false;
      }
      
      // Check if we have a persisted session
      const persistedSession = await this.loadPersistedSession();
      if (!persistedSession) {
        this.logger.debug('No persisted session found');
        return false;
      }
      
      // Verify tokens are valid
      const accessToken = await tokenService.getAccessToken();
      if (!accessToken) {
        this.logger.debug('No access token found');
        // Try to refresh tokens
        const refreshed = await tokenService.refreshTokens();
        if (!refreshed) {
          return false;
        }
      }
      
      // Verify session with server
      const isValid = await this.verifySessionWithServer(persistedSession.id);
      if (!isValid) {
        this.logger.warn('Server rejected session', { sessionId: persistedSession.id });
        await this.clearSessionData();
        return false;
      }
      
      // Session is valid, update last activity
      await this.updateSessionActivity();
      
      // Emit session initialized event
      this.events.emit('sessionInitialized', { session: persistedSession });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize from existing tokens', { 
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
  
  // Add a new method to validate session with server when needed
  private async validateSessionWithServer(sessionId: string): Promise<boolean> {
    try {
      // Try to use the user info endpoint instead of validate-session
      // This endpoint should be available in most auth systems
      const response = await axiosInstance.get(API_ROUTES.AUTH.USER_INFO);
      
      if (response.data && response.data.user) {
        this.logger.info('Session validated successfully', { sessionId });
        return true;
      }
      
      this.logger.warn('Session validation returned unexpected response', { 
        sessionId,
        responseStatus: response.status
      });
      return false;
    } catch (error) {
      this.logger.error('Session validation failed', { 
        sessionId,
        errorStatus: error.response?.status,
        errorMessage: error.message
      });
      
      if (error.response && error.response.status === 401) {
        // Invalid session, clear it
        await this.clearSessionData();
        this.events.emit('sessionInvalid', { sessionId });
      }
      return false;
    }
  }

  // Browser lifecycle hooks
  private setupBeforeUnloadHandler(): void {
    window.addEventListener('beforeunload', () => {
      this.persistSessionState();
    });
  }

  private setupNetworkStatusMonitoring(): void {
    window.addEventListener('online', () => {
      this.handleNetworkStatusChange(true);
    });
    
    window.addEventListener('offline', () => {
      this.handleNetworkStatusChange(false);
    });
  }

  private async handleNetworkStatusChange(isOnline: boolean): Promise<void> {
    if (isOnline) {
      // When coming back online, sync session with server
      const session = await this.getSession();
      if (session) {
        try {
          await axiosInstance.post(API_ROUTES.AUTH.SYNC_SESSION, {
            sessionId: session.id,
            lastActivity: await this.getLastActivity(),
            metrics: this.metrics,
            reconnect: true
          });
        } catch (error) {
          this.logger.error('Failed to sync session after reconnect', { error });
        }
      }
    }
  }

  // Session information methods
  async getSessionDuration(): Promise<number> {
    const session = await this.getSession();
    if (!session) return 0;
    
    return Date.now() - session.startTime;
  }

  // async getSessionTimeRemaining(): Promise<number> {
  //   const lastActivity = await this.getLastActivity();
  //   const timeElapsed = Date.now() - lastActivity;
  //   return Math.max(0, this.INACTIVE_TIMEOUT - timeElapsed);
  // }

  async getSessionInfo(): Promise<Record<string, any>> {
    const session = await this.getSession();
    if (!session) return {};
    
    return {
      id: session.id,
      startTime: new Date(session.startTime).toISOString(),
      lastActivity: new Date(session.lastActivity).toISOString(),
      duration: await this.getSessionDuration(),
      timeRemaining: await this.getSessionTimeRemaining(),
      deviceInfo: session.deviceInfo,
      metadata: session.metadata,
      metrics: this.metrics
    };
  }

  // Cleanup
  destroy(): void {
    this.stopSessionMonitoring();
    this.sessionChannel.close();
    this.sessionListeners.clear();
    this.events.removeAllListeners();
  }

  // Offline support
  async handleOfflineMode(): Promise<void> {
    const session = await this.getSession();
    if (!session) return;
    
    // Store critical session data in IndexedDB for offline access
    await this.offlineStorage.storeSession({
      id: session.id,
      user: session.user,
      lastActivity: Date.now(),
      offlineMode: true
    });
    
    // Queue operations that need to be synced when back online
    this.syncQueue.initialize();
    
    // Update session state
    await this.updateSession({
      ...session,
      state: 'offline',
      metadata: {
        ...session.metadata,
        offlineSince: new Date().toISOString()
      }
    });
    
    this.events.emit('sessionOffline', { timestamp: new Date() });
  }

  // Network recovery
  async handleNetworkRecovery(): Promise<void> {
    const session = await this.getSession();
    if (!session) return;
    
    try {
      // Validate session with server
      const isValid = await this.validateWithServer(session.id);
      
      if (isValid) {
        // Process sync queue
        await this.syncQueue.processQueue();
        
        // Update session state
        await this.updateSession({
          ...session,
          state: 'active',
          lastActivity: Date.now(),
          metadata: {
            ...session.metadata,
            recoveredAt: new Date().toISOString()
          }
        });
        
        this.events.emit('sessionRecovered', { timestamp: new Date() });
      } else {
        // Session expired during offline period
        await this.handleExpiredSession();
      }
    } catch (error) {
      // Handle recovery failure
      this.logger.error('Session recovery failed', error);
      this.events.emit('sessionRecoveryFailed', { 
        timestamp: new Date(),
        error
      });
    }
  }

  // Session recovery from unexpected termination
  async recoverSessionFromStorage(): Promise<boolean> {
    try {
      // Check for recoverable session in storage
      const storedSession = await this.storage.getItem('last_active_session');
      if (!storedSession) return false;
      
      // Validate the stored session with the server
      const isValid = await this.validateWithServer(storedSession.id);
      if (!isValid) {
        await this.storage.removeItem('last_active_session');
        return false;
      }
      
      // Restore the session
      await this.restoreSession(storedSession);
      this.events.emit('sessionRestored', { timestamp: new Date() });
      return true;
    } catch (error) {
      this.logger.error('Session recovery attempt failed', error);
      return false;
    }
  }

  private async validateSessionInBackground(session: SessionData): Promise<void> {
    try {
      const validationResults = await Promise.all([
        this.validateTokens(),
        this.validateDeviceContext(session),
        this.validateActivityTimeout(),
        this.validateSecurityContext(session)
      ]);
      
      const isValid = validationResults.every(result => result);
      
      // Update cache
      const cacheKey = `session_valid:${session.id}`;
      this.validationCache.set(cacheKey, {
        result: isValid,
        timestamp: Date.now()
      });
      
      // If session is invalid, trigger event
      if (!isValid) {
        this.events.emit('sessionInvalid', { session });
      }
    } catch (error) {
      // Log error but don't throw
      console.error('Background session validation failed:', error);
    }
  }

  public updateSessionActivity(): void {
    try {
      const timestamp = Date.now();
      localStorage.setItem('lastActivity', timestamp.toString());
      
      // If using Redux, dispatch an action to update the last activity
      if (this.store) {
        this.store.dispatch({ 
          type: 'auth/updateLastActivity', 
          payload: { timestamp } 
        });
      }
    } catch (error) {
      this.logger.error('Failed to update session activity', { error });
    }
  }

  // Add the missing getSessionMetrics method
  async getSessionMetrics(): Promise<SessionMetrics> {
    try {
      // Return the current metrics from the class property
      return this.metrics || {
        startTime: Date.now(),
        activeTime: 0,
        interactions: 0,
        networkRequests: 0,
        errors: 0
      };
    } catch (error) {
      this.logger.error('Failed to get session metrics', { error });
      // Return default metrics if there's an error
      return {
        startTime: Date.now(),
        activeTime: 0,
        interactions: 0,
        networkRequests: 0,
        errors: 0
      };
    }
  }

  // Add the missing isSessionExpiringSoon method
  isSessionExpiringSoon(): boolean {
    try {
      const session = this.getSessionSync();
      if (!session) return false;
      
      const expiresAt = session.expiresAt;
      const now = Date.now();
      const timeRemaining = expiresAt - now;
      
      return timeRemaining <= AUTH_CONSTANTS.SESSION.EXPIRY_THRESHOLD;
    } catch (error) {
      this.logger.error('Failed to check if session is expiring soon', { error });
      return false;
    }
  }

  // Add a synchronous method to get session without async
  private getSessionSync(): any {
    try {
      const sessionData = localStorage.getItem(this.SESSION_KEY);
      if (!sessionData) return null;
      
      return JSON.parse(sessionData);
    } catch (error) {
      this.logger.error('Failed to get session synchronously', { error });
      return null;
    }
  }

  // Add the getSessionTimeRemaining method that's being used
  getSessionTimeRemaining(): number {
    try {
      const session = this.getSessionSync();
      if (!session) return 0;
      
      const expiresAt = session.expiresAt;
      const now = Date.now();
      return Math.max(0, expiresAt - now);
    } catch (error) {
      this.logger.error('Failed to get session time remaining', { error });
      return 0;
    }
  }

  async persistSession(session: SessionData): Promise<void> {
    try {
      // Store session data in secure storage
      await this.secureStorage.setItem('current_session', JSON.stringify({
        id: session.id,
        startTime: session.startTime,
        lastActivity: session.lastActivity,
        user: {
          id: session.user.id,
          email: session.user.email,
          role: session.user.role
        },
        deviceInfo: session.deviceInfo,
        securityContext: session.securityContext,
        state: session.state
      }));
      
      // Set a flag indicating we have a stored session
      localStorage.setItem('has_session', 'true');
      
      this.logger.debug('Session persisted successfully', { sessionId: session.id });
    } catch (error) {
      this.logger.error('Failed to persist session', { error });
    }
  }

  async loadPersistedSession(): Promise<SessionData | null> {
    try {
      // Check if we have a stored session
      const hasSession = localStorage.getItem('has_session');
      if (hasSession !== 'true') return null;
      
      // Get session data from secure storage
      const sessionData = await this.secureStorage.getItem('current_session');
      if (!sessionData) return null;
      
      const session = JSON.parse(sessionData);
      
      // Validate session data
      if (!session.id || !session.user || !session.startTime) {
        this.logger.warn('Invalid persisted session data', { session });
        return null;
      }
      
      return session;
    } catch (error) {
      this.logger.error('Failed to load persisted session', { error });
      return null;
    }
  }

  /**
   * Verify session with server
   */
  private async verifySessionWithServer(sessionId: string): Promise<boolean> {
    try {
      // Get device info for validation
      const deviceInfo = await deviceService.getDeviceInfo();
      
      console.log('Verifying session with server:', {
        sessionId: sessionId.substring(0, 8) + '...',
        deviceFingerprint: deviceInfo.fingerprint.substring(0, 8) + '...'
      });
      
      // Check if we have an access token in storage
      const accessToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      console.log('Access token present:', !!accessToken);
      
      // Check if we have cookies
      console.log('Document cookies present:', !!document.cookie);
      
      const response = await axiosInstance.post(API_ROUTES.AUTH.VALIDATE_SESSION, {
        sessionId,
        deviceInfo,
        timestamp: Date.now() // Prevent caching
      }, {
        withCredentials: true, // Ensure cookies are sent
        headers: {
          'X-Debug-Info': 'session-validation-request'
        }
      });
      
      console.log('Session verification response:', {
        status: response.status,
        sessionValid: response.data.sessionValid,
        hasUserData: !!response.data.user
      });
      
      return response.data.sessionValid === true;
    } catch (error) {
      console.error('Session verification failed:', error);
      
      this.logger.error('Session verification failed', { 
        error: error instanceof Error ? error.message : String(error),
        sessionId,
        status: error.response?.status,
        data: error.response?.data
      });
      
      if (error.response && error.response.status === 401) {
        // Invalid session, clear it
        console.log('Clearing session data due to 401 response');
        await this.clearSessionData();
        this.events.emit('sessionInvalid', { sessionId });
      }
      return false;
    }
  }

  /**
   * Clear all session data
   */
  async clearSessionData(): Promise<void> {
    try {
      // Clear session from storage
      await this.secureStorage.removeItem('current_session');
      
      // Clear session state
      sessionStorage.removeItem('session_state');
      localStorage.removeItem(this.ACTIVITY_KEY);
      
      // Reset metrics
      this.metrics = this.createDefaultMetrics();
      
      // Emit event
      this.events.emit('sessionCleared', { timestamp: new Date() });
    } catch (error) {
      this.logger.error('Failed to clear session data', { 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async setSession(session: SessionData): Promise<void> {
    try {
      // Store the encrypted session data
      await this.storeSession(session);
      
      // Update last activity
      localStorage.setItem(this.ACTIVITY_KEY, session.lastActivity.toString());
      
      // Broadcast session update to other tabs
      this.sessionChannel.postMessage({
        type: 'SESSION_UPDATED',
        data: { sessionId: session.id }
      });
      
      // Emit session initialized event
      this.events.emit('sessionInitialized', { sessionId: session.id });
    } catch (error) {
      this.logger.error('Failed to set session', { error });
      throw error;
    }
  }
}

export const sessionService = new SessionService();
