import { jwtDecode } from 'jwt-decode';
import { SecureStorage } from '@/utils/secure-storage';
import { Logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/routes';
import { axiosInstance } from '@/utils/axios';
import { deviceService } from './device.service';
import { EventEmitter } from '@/utils/event-emitter';
import { AuthError, createAuthError } from '../errors/auth-error';

interface TokenPayload {
  sub: string;
  exp: number;
  iat: number;
  jti: string;
  role?: string;
  deviceFingerprint?: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

class TokenService {
  private static instance: TokenService;
  private secureStorage: SecureStorage;
  private logger: Logger;
  private readonly ACCESS_TOKEN_EXPIRY_KEY = 'access_token_expiry';
  private readonly REFRESH_TOKEN_EXPIRY_KEY = 'refresh_token_expiry';
  private readonly HAS_TOKENS_KEY = 'has_tokens';
  private events = {
    listeners: {
      tokenRefresh: [] as Array<(success: boolean) => void>
    },
    
    emit(event: 'tokenRefresh', data: boolean): void {
      this.listeners[event].forEach(listener => listener(data));
    },
    
    on(event: 'tokenRefresh', callback: (success: boolean) => void): () => void {
      this.listeners[event].push(callback);
      
      // Return unsubscribe function
      return () => {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
      };
    }
  };
  private refreshPromise: Promise<boolean> | null = null;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.secureStorage = new SecureStorage('auth');
    this.logger = new Logger('TokenService');
    this.setupTokenRefreshScheduler();
  }

  static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  // Event handling for token refresh
  /**
   * Subscribe to token refresh events
   * @param callback Function to call when token is refreshed
   * @returns Unsubscribe function
   */
  onTokenRefresh(callback: (success: boolean) => void): () => void {
    return this.events.on('tokenRefresh', callback);
  }

  // Store token expiry times (tokens themselves are in HTTP-only cookies)
  async storeTokenExpiry(tokens: { accessTokenExpiry?: number, refreshTokenExpiry?: number }): Promise<void> {
    try {
      const COMPONENT = 'TokenService.storeTokenExpiry';
      this.logger.debug('Storing token expiry data', { component: COMPONENT });
      
      if (tokens.accessTokenExpiry) {
        await this.secureStorage.setItem(this.ACCESS_TOKEN_EXPIRY_KEY, tokens.accessTokenExpiry.toString());
      }
      
      if (tokens.refreshTokenExpiry) {
        await this.secureStorage.setItem(this.REFRESH_TOKEN_EXPIRY_KEY, tokens.refreshTokenExpiry.toString());
      }
      
      // Store token status in localStorage for quick checks
      localStorage.setItem(this.HAS_TOKENS_KEY, 'true');
      
      this.logger.debug('Token expiry times stored successfully', { component: COMPONENT });
    } catch (error) {
      this.logger.error('Failed to store token expiry data', { 
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error('TOKEN_STORAGE_FAILED');
    }
  }

  /**
   * Check if access token is valid and not expired
   */
  async hasValidAccessToken(): Promise<boolean> {
    try {
      // For HTTP-only cookies, we can't directly check the token
      // Instead, we check if we have a stored expiry time
      const expiryStr = await this.secureStorage.getItem(this.ACCESS_TOKEN_EXPIRY_KEY);
      if (!expiryStr) return false;
      
      const expiry = parseInt(expiryStr, 10);
      const now = Date.now();
      
      // Check if token is expired with a small buffer (10 seconds)
      return expiry > now + 10000;
    } catch (error) {
      this.logger.error('Error checking access token validity', { 
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  // Get access token expiry time
  async getAccessTokenExpiry(): Promise<number | null> {
    try {
      const expiryStr = await this.secureStorage.getItem(this.ACCESS_TOKEN_EXPIRY_KEY);
      if (!expiryStr) return null;
      
      return parseInt(expiryStr, 10);
    } catch (error) {
      this.logger.error('Failed to get access token expiration', { 
        error: error.message 
      });
      return null;
    }
  }

  // Get refresh token expiry time
  async getRefreshTokenExpiry(): Promise<number | null> {
    try {
      const expiryStr = await this.secureStorage.getItem(this.REFRESH_TOKEN_EXPIRY_KEY);
      if (!expiryStr) return null;
      
      return parseInt(expiryStr, 10);
    } catch (error) {
      this.logger.error('Failed to get refresh token expiration', { 
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Clear all token data
   */
  async clearTokenData(): Promise<void> {
    try {
      // Remove token expiry data
      await this.secureStorage.removeItem(this.ACCESS_TOKEN_EXPIRY_KEY);
      await this.secureStorage.removeItem(this.REFRESH_TOKEN_EXPIRY_KEY);
      
      // Remove token status flag
      localStorage.removeItem(this.HAS_TOKENS_KEY);
      
      // For HTTP-only cookies, we need to call the logout endpoint
      // to clear the cookies on the server side
      try {
        await axiosInstance.post(API_ROUTES.AUTH.LOGOUT, {
          timestamp: Date.now() // Prevent caching
        });
      } catch (error) {
        // If the logout endpoint fails, we still want to clear local data
        this.logger.warn('Failed to clear server-side tokens', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (error) {
      this.logger.error('Failed to clear token data', { 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Check if the access token is expiring soon
   * @param {number} thresholdMs - Threshold in milliseconds (default: 5 minutes)
   * @returns {boolean} - True if token is expiring soon
   */
  async isTokenExpiringSoon(thresholdMs = 5 * 60 * 1000): Promise<boolean> {
    try {
      const expiryTimeStr = await this.secureStorage.getItem(this.ACCESS_TOKEN_EXPIRY_KEY);
      
      if (!expiryTimeStr) {
        return false;
      }
      
      const expiryTime = parseInt(expiryTimeStr, 10);
      const now = Date.now();
      
      // Check if token expires within the threshold
      return expiryTime - now < thresholdMs && expiryTime > now;
    } catch (error) {
      this.logger.error('Error checking token expiry', { error });
      return false;
    }
  }

  // Add an alias for backward compatibility
  async isTokenExpiring(thresholdMs = 5 * 60 * 1000): Promise<boolean> {
    return this.isTokenExpiringSoon(thresholdMs);
  }

  /**
   * Get token expiry time
   * @returns Expiry time in seconds or null if not found
   */
  async getTokenExpiry(): Promise<number | null> {
    try {
      const expiryStr = await this.secureStorage.getItem(this.ACCESS_TOKEN_EXPIRY_KEY);
      if (!expiryStr) return null;
      
      // Parse the expiry time
      const expiry = parseInt(expiryStr, 10);
      
      // Validate the expiry time
      if (isNaN(expiry) || expiry <= 0) {
        this.logger.warn('Invalid token expiry value', { value: expiryStr });
        return null;
      }
      
      return expiry;
    } catch (error) {
      this.logger.error('Error getting token expiry', { error });
      return null;
    }
  }

  /**
   * Refresh tokens using the refresh token
   */
  async refreshTokens(): Promise<boolean> {
    try {
      const COMPONENT = 'TokenService.refreshTokens';
      this.logger.debug('Attempting to refresh tokens', { component: COMPONENT });
      
      // For HTTP-only cookies, we don't need to extract the refresh token
      // The browser will automatically send it with the request
      
      const response = await axiosInstance.post(API_ROUTES.AUTH.REFRESH_TOKEN, {
        timestamp: Date.now() // Prevent caching
      });
      
      if (response.data.success) {
        // Store token expiry times
        await this.storeTokenExpiry({
          accessTokenExpiry: response.data.accessTokenExpiry,
          refreshTokenExpiry: response.data.refreshTokenExpiry
        });
        
        this.logger.debug('Tokens refreshed successfully', { component: COMPONENT });
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Token refresh failed', { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      // If refresh fails due to invalid token, clear token data
      if (error.response?.status === 401) {
        await this.clearTokenData();
      }
      
      return false;
    }
  }

  // Token refresh scheduling
  private setupTokenRefreshScheduler(): void {
    // Check for token expiration every minute
    setInterval(async () => {
      try {
        const hasValidToken = await this.hasValidAccessToken();
        if (!hasValidToken) return;
        
        // Get access token expiry time
        const expiryTime = await this.getAccessTokenExpiry();
        if (!expiryTime) return;
        
        const currentTime = Date.now();
        const timeUntilExpiry = expiryTime - currentTime;
        
        // Only refresh if token expires within 5 minutes (300000ms)
        if (timeUntilExpiry < 300000 && timeUntilExpiry > 0) {
          this.logger.debug('Token is expiring soon, triggering refresh');
          this.events.emit('tokenExpiring');
          await this.refreshTokens();
        }
      } catch (error) {
        this.logger.error('Token refresh scheduler error', { 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, 60000); // Check every minute
  }

  private async scheduleTokenRefresh(): Promise<void> {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }
    
    try {
      const expiryTime = await this.getAccessTokenExpiry();
      if (!expiryTime) return;
      
      const currentTime = Date.now();
      const timeUntilExpiry = expiryTime - currentTime;
      
      // Schedule refresh at 80% of token lifetime
      const refreshTime = Math.max(timeUntilExpiry * 0.8, 0);
      
      this.logger.debug('Scheduling token refresh', {
        timeUntilExpiry: Math.floor(timeUntilExpiry / 1000) + 's',
        refreshIn: Math.floor(refreshTime / 1000) + 's'
      });
      
      this.tokenRefreshTimer = setTimeout(() => {
        this.refreshTokens().catch(error => {
          this.logger.error('Scheduled token refresh failed', { 
            error: error.message 
          });
        });
      }, refreshTime);
    } catch (error) {
      this.logger.error('Failed to schedule token refresh', { 
        error: error.message 
      });
    }
  }

  // Get remaining time until token expiry (in milliseconds)
  async getTokenRemainingTime(): Promise<number> {
    const expiryTime = await this.getAccessTokenExpiry();
    if (!expiryTime) return 0;
    
    return Math.max(0, expiryTime - Date.now());
  }

  // Check if we have tokens (based on stored flag)
  async hasTokens(): Promise<boolean> {
    try {
      const hasTokens = await this.secureStorage.getItem(this.HAS_TOKENS_KEY);
      return hasTokens === 'true';
    } catch (error) {
      this.logger.error('Error checking if tokens exist', { 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Check if we have tokens stored
   */
  hasStoredTokens(): boolean {
    return localStorage.getItem(this.HAS_TOKENS_KEY) === 'true';
  }
}

export const tokenService = TokenService.getInstance();
