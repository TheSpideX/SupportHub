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
  private events = new EventEmitter();
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

  // Event subscription methods
  onTokenRefresh(callback: (success: boolean) => void): () => void {
    return this.events.on('tokenRefresh', callback);
  }

  onTokenExpiring(callback: () => void): () => void {
    return this.events.on('tokenExpiring', callback);
  }

  // Store token expiry times (tokens themselves are in HTTP-only cookies)
  async storeTokenExpiry(tokenData: any): Promise<void> {
    try {
      const COMPONENT = 'TokenService';
      
      // Store expiration times
      if (tokenData.accessTokenExpiry) {
        await this.secureStorage.setItem(
          this.ACCESS_TOKEN_EXPIRY_KEY, 
          tokenData.accessTokenExpiry.toString()
        );
      }
      
      if (tokenData.refreshTokenExpiry) {
        await this.secureStorage.setItem(
          this.REFRESH_TOKEN_EXPIRY_KEY, 
          tokenData.refreshTokenExpiry.toString()
        );
      }
      
      // Store token status
      await this.secureStorage.setItem(this.HAS_TOKENS_KEY, 'true');
      
      this.logger.debug('Token expiry times stored successfully', { component: COMPONENT });
      
      // Schedule token refresh based on new expiry
      this.scheduleTokenRefresh();
    } catch (error) {
      this.logger.error('Failed to store token expiry data', { 
        error: error.message 
      });
      throw new Error('TOKEN_STORAGE_FAILED');
    }
  }

  // Check if we have valid access token (based on expiry time)
  async hasValidAccessToken(): Promise<boolean> {
    try {
      const expiryStr = await this.secureStorage.getItem(this.ACCESS_TOKEN_EXPIRY_KEY);
      if (!expiryStr) return false;
      
      const expiryTime = parseInt(expiryStr, 10);
      return expiryTime > Date.now();
    } catch (error) {
      this.logger.error('Error checking access token expiry', { error: error.message });
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

  // Clear token expiry data
  async clearTokenData(): Promise<void> {
    try {
      await this.secureStorage.removeItem(this.ACCESS_TOKEN_EXPIRY_KEY);
      await this.secureStorage.removeItem(this.REFRESH_TOKEN_EXPIRY_KEY);
      await this.secureStorage.removeItem(this.HAS_TOKENS_KEY);
      
      this.logger.debug('Token data cleared successfully');
      
      // Clear any scheduled refresh
      if (this.tokenRefreshTimer) {
        clearTimeout(this.tokenRefreshTimer);
        this.tokenRefreshTimer = null;
      }
    } catch (error) {
      this.logger.error('Failed to clear token data', { 
        error: error.message 
      });
    }
  }

  /**
   * Check if the token is expiring soon
   * @param bufferTime Time in seconds before expiry to consider token as expiring
   * @returns Boolean indicating if token is expiring soon
   */
  async isTokenExpiring(bufferTime = 300): Promise<boolean> {
    try {
      const tokenExpiry = await this.getTokenExpiry();
      if (!tokenExpiry) return true;
      
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = tokenExpiry - now;
      
      return expiresIn <= bufferTime;
    } catch (error) {
      this.logger.error('Error checking token expiration', { error });
      return true; // Assume token is expiring if we can't check
    }
  }

  // Refresh tokens
  async refreshTokens(): Promise<boolean> {
    // If a refresh is already in progress, return that promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Create a new refresh promise
    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const result = await this.refreshPromise;
      // Notify listeners about token refresh
      this.events.emit('tokenRefresh', result);
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<boolean> {
    try {
      // Get device info for security context
      const deviceInfo = await deviceService.getDeviceInfo();
      
      // Call refresh endpoint (refresh token is in HTTP-only cookie)
      const response = await axiosInstance.post(API_ROUTES.AUTH.REFRESH_TOKEN, { 
        deviceInfo
      });
      
      if (!response.data.success) {
        this.logger.warn('Token refresh failed', { 
          reason: response.data.message || 'Unknown reason'
        });
        return false;
      }
      
      // Store new token expiry times
      await this.storeTokenExpiry(response.data.tokens);
      
      this.logger.info('Tokens refreshed successfully');
      return true;
    } catch (error) {
      this.logger.error('Token refresh failed', { 
        error: error.response?.data?.message || error.message,
        status: error.response?.status
      });
      
      // If refresh fails with 401/403, clear token data
      if (error.response?.status === 401 || error.response?.status === 403) {
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
        
        if (await this.isTokenExpiringSoon(120)) {
          this.logger.debug('Token is expiring soon, triggering refresh');
          this.events.emit('tokenExpiring');
          await this.refreshTokens();
        }
      } catch (error) {
        this.logger.error('Token refresh scheduler error', { 
          error: error.message 
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
}

export const tokenService = TokenService.getInstance();
