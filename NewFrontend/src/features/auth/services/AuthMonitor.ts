import { logger } from '@/utils/logger';
import { TokenService } from './TokenService';
import { SessionService } from './SessionService';

interface HealthStatus {
  tokenServiceHealthy: boolean;
  sessionServiceHealthy: boolean;
  lastTokenRefresh: Date | null;
  lastSessionSync: Date | null;
  lastCheck: Date | null;
  errors: string[];
  tokenDetails?: {
    accessTokenExpiry: Date | null;
    refreshTokenExpiry: Date | null;
    isAccessTokenValid: boolean;
    isRefreshTokenValid: boolean;
  };
  sessionDetails?: {
    currentDevice?: any;
    activeSessions?: number;
    lastActivity?: Date | null;
  };
}

export class AuthMonitor {
  private tokenService: TokenService;
  private sessionService: SessionService;
  private monitorInterval: number | null = null;
  private lastCheckTime: number = 0;
  private checkIntervalMs: number = 60000; // Check every minute
  private healthStatus: HealthStatus;

  constructor(tokenService: TokenService, sessionService: SessionService) {
    this.tokenService = tokenService;
    this.sessionService = sessionService;
    this.healthStatus = {
      tokenServiceHealthy: true,
      sessionServiceHealthy: true,
      lastTokenRefresh: null,
      lastSessionSync: null,
      lastCheck: null,
      errors: []
    };
  }

  /**
   * Start monitoring auth services
   */
  public startMonitoring(): void {
    if (this.monitorInterval) {
      return; // Already monitoring
    }

    logger.info('Starting auth services monitoring');
    this.monitorInterval = window.setInterval(() => this.checkServices(), this.checkIntervalMs);
    
    // Do an initial check
    this.checkServices();
    
    // Listen for token refresh events
    window.addEventListener('token-refreshed', () => {
      this.healthStatus.lastTokenRefresh = new Date();
    });
    
    // Listen for session sync events
    window.addEventListener('session-synced', () => {
      this.healthStatus.lastSessionSync = new Date();
    });
  }

  /**
   * Stop monitoring auth services
   */
  public stopMonitoring(): void {
    if (this.monitorInterval) {
      window.clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      logger.info('Stopped auth services monitoring');
    }
  }

  /**
   * Check services health
   */
  private async checkServices(): Promise<void> {
    try {
      // Update last check timestamp
      this.healthStatus.lastCheck = new Date();
      
      // Check token service
      try {
        // Check if token service is available
        const tokenStatus = await this.checkTokenService();
        this.healthStatus.tokenServiceHealthy = tokenStatus.healthy;
        
        // Add detailed token information
        this.healthStatus.tokenDetails = {
          accessTokenExpiry: tokenStatus.accessTokenExpiry,
          refreshTokenExpiry: tokenStatus.refreshTokenExpiry,
          isAccessTokenValid: tokenStatus.isAccessTokenValid,
          isRefreshTokenValid: tokenStatus.isRefreshTokenValid
        };
        
        if (!tokenStatus.healthy) {
          this.healthStatus.errors.push(`Token service issue: ${tokenStatus.error || 'Unknown error'}`);
        }
      } catch (error) {
        this.healthStatus.tokenServiceHealthy = false;
        this.healthStatus.errors.push(`Token service error: ${error.message || 'Unknown error'}`);
        logger.error('Token service check failed', error);
      }
      
      // Check session service
      try {
        // Check if session service is available
        const sessionStatus = await this.checkSessionService();
        this.healthStatus.sessionServiceHealthy = sessionStatus.healthy;
        
        // Add detailed session information
        this.healthStatus.sessionDetails = {
          currentDevice: sessionStatus.currentDevice,
          activeSessions: sessionStatus.activeSessions,
          lastActivity: sessionStatus.lastActivity
        };
        
        if (!sessionStatus.healthy) {
          this.healthStatus.errors.push(`Session service issue: ${sessionStatus.error || 'Unknown error'}`);
        }
      } catch (error) {
        this.healthStatus.sessionServiceHealthy = false;
        this.healthStatus.errors.push(`Session service error: ${error.message || 'Unknown error'}`);
        logger.error('Session service check failed', error);
      }
      
      // If services are unhealthy, attempt recovery
      if (!this.healthStatus.tokenServiceHealthy || !this.healthStatus.sessionServiceHealthy) {
        await this.attemptRecovery();
      }
    } catch (error) {
      logger.error('Error checking auth services', error);
      this.healthStatus.errors.push(`General monitoring error: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Check token service health
   */
  private async checkTokenService(): Promise<any> {
    try {
      // Get token expiry information
      const accessToken = this.tokenService.getAccessToken();
      
      // Don't try to directly access HTTP-only cookies
      // Instead, check if tokens exist using the hasTokens method
      const hasTokens = this.tokenService.hasTokens();
      
      // Check if tokens exist
      const isAccessTokenValid = hasTokens;
      const isRefreshTokenValid = hasTokens;
      
      // Get expiry dates if available
      let accessTokenExpiry = null;
      let refreshTokenExpiry = null;
      
      try {
        // Try to extract expiry from tokens if possible
        if (isAccessTokenValid) {
          accessTokenExpiry = this.tokenService.getAccessTokenExpiry();
        }
        
        if (isRefreshTokenValid) {
          refreshTokenExpiry = this.tokenService.getRefreshTokenExpiry();
        }
      } catch (e) {
        logger.warn('Could not extract token expiry information', e);
      }
      
      return {
        healthy: true,
        accessTokenExpiry,
        refreshTokenExpiry,
        isAccessTokenValid,
        isRefreshTokenValid
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Check session service health
   */
  private async checkSessionService(): Promise<any> {
    try {
      // Get session information
      const sessionExpiry = this.sessionService.getSessionExpiry();
      const isSessionActive = sessionExpiry ? new Date(sessionExpiry) > new Date() : false;
      
      // Get additional session information if available
      let currentDevice = null;
      let activeSessions = 0;
      let lastActivity = null;
      
      // Try to get session metadata if available
      try {
        const sessionData = this.sessionService.getSessionData();
        if (sessionData) {
          currentDevice = sessionData.device || null;
          activeSessions = sessionData.activeSessions || 0;
          lastActivity = sessionData.lastActive ? new Date(sessionData.lastActive) : null;
        }
      } catch (e) {
        logger.warn('Could not extract session metadata', e);
      }
      
      return {
        healthy: isSessionActive,
        currentDevice,
        activeSessions,
        lastActivity
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Check if session is expired by using session data
   */
  private checkSessionExpiration(): boolean {
    // Use public methods to determine if session is expired
    const sessionExpiry = this.sessionService.getSessionExpiry();
    return sessionExpiry ? Date.now() >= sessionExpiry : true;
  }

  /**
   * Trigger session sync using public methods
   */
  private triggerSessionSync(): void {
    // Use public method to trigger session sync
    this.sessionService.syncSessionWithRetry().catch(error => {
      logger.error('Failed to sync session', error);
    });
  }

  /**
   * Attempt to recover from issues
   */
  private async attemptRecovery(): Promise<void> {
    logger.info('Attempting to recover auth services');
    
    // If token service is unhealthy, try to refresh tokens
    if (!this.healthStatus.tokenServiceHealthy) {
      try {
        logger.info('Attempting token refresh for recovery');
        // Use the refreshToken method from TokenService
        await this.tokenService.refreshToken();
      } catch (error) {
        logger.error('Token service recovery failed', error);
      }
    }
    
    // If session service is unhealthy, try to sync session
    if (!this.healthStatus.sessionServiceHealthy) {
      try {
        logger.info('Attempting session sync for recovery');
        // Use the syncSessionWithRetry method from SessionService
        await this.sessionService.syncSessionWithRetry();
      } catch (error) {
        logger.error('Session service recovery failed', error);
      }
    }
  }

  /**
   * Get current health status
   */
  public getHealthStatus(): any {
    return {
      ...this.healthStatus,
      lastCheckTime: this.lastCheckTime
    };
  }
}

import { tokenService } from './TokenService';
import { sessionService } from './SessionService';

// Export a singleton instance with proper service injection
export const authMonitor = new AuthMonitor(
  tokenService,
  sessionService
);
