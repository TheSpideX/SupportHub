import { store } from '@/store';
import { logger } from '@/utils/logger';
import { tokenService } from './token.service';
import { sessionService } from './session.service';
import { securityService } from './security.service';
import { AuthUser, LoginCredentials } from '../types';
import { createOfflineStore } from '../utils/offline-storage';

const COMPONENT = 'offline-auth.service';
const OFFLINE_CREDENTIALS_KEY = 'offline_auth_credentials';
const OFFLINE_ACTIONS_KEY = 'offline_auth_actions';

class OfflineAuthService {
  private offlineStore: any;
  private syncInProgress = false;

  constructor() {
    this.offlineStore = createOfflineStore();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  private async handleOnline(): Promise<void> {
    logger.info('Network connection restored, syncing offline actions', { component: COMPONENT });
    await this.syncOfflineActions();
  }

  private async handleOffline(): Promise<void> {
    logger.warn('Network connection lost, enabling offline mode', { component: COMPONENT });
    // Ensure we have offline credentials stored if user is authenticated
    const state = store.getState();
    if (state.auth.isAuthenticated) {
      await this.prepareForOfflineUse();
    }
  }

  /**
   * Verifies user credentials in offline mode
   */
  async authenticateOffline(credentials: LoginCredentials): Promise<AuthUser | null> {
    try {
      logger.info('Attempting offline authentication', { component: COMPONENT });
      
      const storedData = await this.offlineStore.get(OFFLINE_CREDENTIALS_KEY);
      logger.debug('Offline credentials retrieved', { 
        component: COMPONENT, 
        hasStoredData: !!storedData,
        email: credentials.email,
        storedEmail: storedData?.user?.email 
      });
      
      if (!storedData) {
        logger.warn('No offline credentials available', { component: COMPONENT });
        return null;
      }

      // Verify credentials against stored hash
      const isValid = await securityService.verifyOfflineCredentials(
        credentials,
        storedData.hash
      );

      logger.debug('Offline credentials validation result', { 
        component: COMPONENT, 
        isValid,
        email: credentials.email 
      });

      if (!isValid) {
        logger.warn('Invalid offline credentials', { component: COMPONENT });
        // Track failed attempt
        await this.trackOfflineAction('auth_failure', { email: credentials.email });
        return null;
      }

      // Valid credentials - return user and set up offline session
      logger.info('Offline authentication successful', { component: COMPONENT });
      await sessionService.handleOfflineMode();
      
      // Track successful login
      await this.trackOfflineAction('auth_success', { userId: storedData.user.id });
      
      return storedData.user;
    } catch (error) {
      logger.error('Offline authentication error', { component: COMPONENT, error });
      return null;
    }
  }

  /**
   * Stores credentials for offline use
   */
  async storeOfflineCredentials(user: AuthUser, credentials: LoginCredentials): Promise<boolean> {
    try {
      // Create secure hash of credentials for offline verification
      const hash = await securityService.hashCredentialsForOfflineUse(credentials);
      
      // Store minimal user data and credential hash
      await this.offlineStore.set(OFFLINE_CREDENTIALS_KEY, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles,
          permissions: user.permissions
        },
        hash,
        timestamp: Date.now()
      });
      
      logger.info('Stored offline credentials', { component: COMPONENT });
      return true;
    } catch (error) {
      logger.error('Failed to store offline credentials', { component: COMPONENT, error });
      return false;
    }
  }

  /**
   * Prepares the application for offline use
   */
  async prepareForOfflineUse(): Promise<void> {
    try {
      const state = store.getState();
      const user = state.auth.user;
      
      if (!user) return;
      
      // Store current session data
      await sessionService.handleOfflineMode();
      
      // Cache essential application data
      await this.cacheEssentialData();
      
      logger.info('Application prepared for offline use', { component: COMPONENT });
    } catch (error) {
      logger.error('Failed to prepare for offline use', { component: COMPONENT, error });
    }
  }

  /**
   * Syncs offline actions when back online
   */
  async syncOfflineActions(): Promise<void> {
    if (this.syncInProgress) return;
    
    try {
      this.syncInProgress = true;
      
      // Get offline actions
      const actions = await this.offlineStore.get(OFFLINE_ACTIONS_KEY) || [];
      if (actions.length === 0) {
        this.syncInProgress = false;
        return;
      }
      
      logger.info(`Syncing ${actions.length} offline actions`, { component: COMPONENT });
      
      // Validate session with server
      const isSessionValid = await sessionService.handleNetworkRecovery();
      if (!isSessionValid) {
        logger.warn('Session invalid, cannot sync offline actions', { component: COMPONENT });
        this.syncInProgress = false;
        return;
      }
      
      // Process each action
      for (const action of actions) {
        await this.processOfflineAction(action);
      }
      
      // Clear processed actions
      await this.offlineStore.set(OFFLINE_ACTIONS_KEY, []);
      
      logger.info('Offline actions synced successfully', { component: COMPONENT });
    } catch (error) {
      logger.error('Failed to sync offline actions', { component: COMPONENT, error });
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Checks if offline authentication is available
   */
  async isOfflineAuthAvailable(): Promise<boolean> {
    try {
      const storedData = await this.offlineStore.get(OFFLINE_CREDENTIALS_KEY);
      return !!storedData && Date.now() - storedData.timestamp < 7 * 24 * 60 * 60 * 1000; // 7 days
    } catch (error) {
      logger.error('Error checking offline auth availability', { component: COMPONENT, error });
      return false;
    }
  }

  /**
   * Clears offline authentication data
   */
  async clearOfflineAuth(): Promise<void> {
    try {
      await this.offlineStore.remove(OFFLINE_CREDENTIALS_KEY);
      logger.info('Offline authentication data cleared', { component: COMPONENT });
    } catch (error) {
      logger.error('Failed to clear offline auth data', { component: COMPONENT, error });
    }
  }

  /**
   * Tracks an action performed while offline
   */
  private async trackOfflineAction(type: string, data: any): Promise<void> {
    try {
      const actions = await this.offlineStore.get(OFFLINE_ACTIONS_KEY) || [];
      actions.push({
        type,
        data,
        timestamp: Date.now()
      });
      await this.offlineStore.set(OFFLINE_ACTIONS_KEY, actions);
    } catch (error) {
      logger.error('Failed to track offline action', { component: COMPONENT, error, type });
    }
  }

  /**
   * Processes a single offline action when back online
   */
  private async processOfflineAction(action: any): Promise<void> {
    try {
      logger.debug('Processing offline action', { component: COMPONENT, action });
      
      // Handle different action types
      switch (action.type) {
        case 'auth_success':
          // Update analytics for offline login
          // No server sync needed
          break;
          
        case 'auth_failure':
          // Report failed offline login attempts
          await securityService.reportFailedLoginAttempt(action.data);
          break;
          
        // Add more action types as needed
          
        default:
          logger.warn('Unknown offline action type', { component: COMPONENT, action });
      }
    } catch (error) {
      logger.error('Failed to process offline action', { component: COMPONENT, error, action });
    }
  }

  /**
   * Caches essential application data for offline use
   */
  private async cacheEssentialData(): Promise<void> {
    // Cache user profile, permissions, and other essential data
    // This would depend on your application's specific needs
  }
}

export const offlineAuthService = new OfflineAuthService();