import { logger } from '@/utils/logger';
import { secureGet, secureSet, secureClear, isStorageAvailable } from '../utils/auth-storage';
import { AUTH_CONSTANTS } from '../constants/auth.constants';
import { AuthState, User, SecurityContext } from '../types';
import { store } from '@/store';
import { setUser, setSecurityContext, setRememberMe } from '../store/authSlice';

const COMPONENT = 'AuthPersistenceService';
const CURRENT_STORAGE_VERSION = '1.0';
const STORAGE_VERSION_KEY = 'auth_storage_version';

class AuthPersistenceService {
  private namespace = 'auth';
  private storageStrategy: 'localStorage' | 'indexedDB' | 'inMemory' = 'localStorage';
  private encryptionEnabled = true;

  constructor() {
    this.determineOptimalStorageStrategy();
    logger.info('Auth persistence service initialized', { 
      component: COMPONENT,
      strategy: this.storageStrategy
    });
  }

  /**
   * Determines the best available storage strategy
   */
  private determineOptimalStorageStrategy(): void {
    if (isStorageAvailable('indexedDB')) {
      this.storageStrategy = 'indexedDB';
    } else if (isStorageAvailable('localStorage')) {
      this.storageStrategy = 'localStorage';
    } else {
      this.storageStrategy = 'inMemory';
      logger.warn('Falling back to in-memory storage', { component: COMPONENT });
    }
  }

  /**
   * Persists the authentication state
   */
  async persistAuthState(authState: Partial<AuthState>, options: {
    rememberMe?: boolean;
    expiresIn?: number;
  } = {}): Promise<boolean> {
    try {
      const { rememberMe = false, expiresIn } = options;
      
      // Store user data
      if (authState.user) {
        await this.persistUser(authState.user, { rememberMe, expiresIn });
      }
      
      // Store security context
      if (authState.securityContext) {
        await this.persistSecurityContext(authState.securityContext, { rememberMe, expiresIn });
      }
      
      // Store remember me preference
      if (typeof rememberMe === 'boolean') {
        await secureSet(
          AUTH_CONSTANTS.STORAGE_KEYS.REMEMBER_ME,
          rememberMe,
          { 
            encrypt: false,
            namespace: this.namespace,
            storage: this.storageStrategy
          }
        );
      }
      
      logger.debug('Auth state persisted successfully', { component: COMPONENT });
      return true;
    } catch (error) {
      logger.error('Failed to persist auth state', { component: COMPONENT, error });
      return false;
    }
  }

  /**
   * Loads the saved authentication state
   */
  async loadAuthState(): Promise<Partial<AuthState> | null> {
    try {
      // Check storage version and migrate if needed
      await this.checkAndMigrateStorage();
      
      // Load user data
      const user = await this.loadUser();
      
      // Load security context
      const securityContext = await this.loadSecurityContext();
      
      // Load remember me preference
      const rememberMeData = await secureGet(
        AUTH_CONSTANTS.STORAGE_KEYS.REMEMBER_ME,
        { 
          encrypt: false,
          namespace: this.namespace,
          storage: this.storageStrategy
        }
      );
      const rememberMe = rememberMeData?.value || false;
      
      // Update Redux store
      if (user) store.dispatch(setUser(user));
      if (securityContext) store.dispatch(setSecurityContext(securityContext));
      store.dispatch(setRememberMe(rememberMe));
      
      logger.debug('Auth state loaded successfully', { component: COMPONENT });
      
      return {
        user,
        securityContext,
        rememberMe
      };
    } catch (error) {
      logger.error('Failed to load auth state', { component: COMPONENT, error });
      return null;
    }
  }

  /**
   * Clears the saved authentication state
   */
  async clearAuthState(): Promise<boolean> {
    try {
      // Clear user data
      await secureClear(AUTH_CONSTANTS.STORAGE_KEYS.USER, { 
        namespace: this.namespace,
        storage: this.storageStrategy
      });
      
      // Clear security context
      await secureClear(AUTH_CONSTANTS.STORAGE_KEYS.SECURITY_CONTEXT, { 
        namespace: this.namespace,
        storage: this.storageStrategy
      });
      
      // Clear tokens (handled by token service, but we'll do it here for completeness)
      await secureClear(AUTH_CONSTANTS.STORAGE_KEYS.AUTH_TOKENS, { 
        namespace: this.namespace,
        storage: this.storageStrategy
      });
      
      logger.debug('Auth state cleared successfully', { component: COMPONENT });
      return true;
    } catch (error) {
      logger.error('Failed to clear auth state', { component: COMPONENT, error });
      return false;
    }
  }

  /**
   * Handles storage version migrations
   */
  async migrateStorage(fromVersion: string, toVersion: string): Promise<boolean> {
    try {
      logger.info(`Migrating storage from v${fromVersion} to v${toVersion}`, { component: COMPONENT });
      
      // Implement migration logic based on version changes
      if (fromVersion === '0.9' && toVersion === '1.0') {
        // Example migration: Restructure user data format
        const oldUserData = await secureGet('user_data', { 
          namespace: this.namespace,
          storage: this.storageStrategy
        });
        
        if (oldUserData?.value) {
          // Transform to new format
          const newUserData = this.transformUserDataFormat(oldUserData.value);
          
          // Save in new format
          await secureSet(
            AUTH_CONSTANTS.STORAGE_KEYS.USER,
            newUserData,
            { 
              encrypt: this.encryptionEnabled,
              namespace: this.namespace,
              storage: this.storageStrategy
            }
          );
          
          // Remove old data
          await secureClear('user_data', { 
            namespace: this.namespace,
            storage: this.storageStrategy
          });
        }
      }
      
      // Update storage version
      await secureSet(
        STORAGE_VERSION_KEY,
        toVersion,
        { 
          encrypt: false,
          namespace: this.namespace,
          storage: this.storageStrategy
        }
      );
      
      logger.info('Storage migration completed successfully', { component: COMPONENT });
      return true;
    } catch (error) {
      logger.error('Storage migration failed', { component: COMPONENT, error });
      return false;
    }
  }

  /**
   * Checks storage version and migrates if needed
   */
  private async checkAndMigrateStorage(): Promise<void> {
    const versionData = await secureGet(
      STORAGE_VERSION_KEY,
      { 
        encrypt: false,
        namespace: this.namespace,
        storage: this.storageStrategy
      }
    );
    
    const currentVersion = versionData?.value || '0.9';
    
    if (currentVersion !== CURRENT_STORAGE_VERSION) {
      await this.migrateStorage(currentVersion, CURRENT_STORAGE_VERSION);
    }
  }

  /**
   * Persists user data
   */
  private async persistUser(user: User, options: {
    rememberMe?: boolean;
    expiresIn?: number;
  }): Promise<boolean> {
    const { rememberMe = false, expiresIn } = options;
    
    // Calculate expiration time based on remember me preference
    const actualExpiresIn = expiresIn || (rememberMe 
      ? AUTH_CONSTANTS.SESSION.REMEMBER_ME_DURATION 
      : AUTH_CONSTANTS.SESSION.MAX_INACTIVITY);
    
    return secureSet(
      AUTH_CONSTANTS.STORAGE_KEYS.USER,
      user,
      { 
        encrypt: this.encryptionEnabled,
        namespace: this.namespace,
        storage: this.storageStrategy,
        expiresIn: actualExpiresIn
      }
    );
  }

  /**
   * Loads saved user data
   */
  private async loadUser(): Promise<User | null> {
    const userData = await secureGet(
      AUTH_CONSTANTS.STORAGE_KEYS.USER,
      { 
        encrypt: this.encryptionEnabled,
        namespace: this.namespace,
        storage: this.storageStrategy
      }
    );
    
    return userData?.value || null;
  }

  /**
   * Persists security context
   */
  private async persistSecurityContext(securityContext: SecurityContext, options: {
    rememberMe?: boolean;
    expiresIn?: number;
  }): Promise<boolean> {
    const { rememberMe = false, expiresIn } = options;
    
    // Calculate expiration time based on remember me preference
    const actualExpiresIn = expiresIn || (rememberMe 
      ? AUTH_CONSTANTS.SESSION.REMEMBER_ME_DURATION 
      : AUTH_CONSTANTS.SESSION.MAX_INACTIVITY);
    
    return secureSet(
      AUTH_CONSTANTS.STORAGE_KEYS.SECURITY_CONTEXT,
      securityContext,
      { 
        encrypt: this.encryptionEnabled,
        namespace: this.namespace,
        storage: this.storageStrategy,
        expiresIn: actualExpiresIn
      }
    );
  }

  /**
   * Loads saved security context
   */
  private async loadSecurityContext(): Promise<SecurityContext | null> {
    const contextData = await secureGet(
      AUTH_CONSTANTS.STORAGE_KEYS.SECURITY_CONTEXT,
      { 
        encrypt: this.encryptionEnabled,
        namespace: this.namespace,
        storage: this.storageStrategy
      }
    );
    
    return contextData?.value || null;
  }

  /**
   * Example transformation function for migration
   */
  private transformUserDataFormat(oldFormat: any): User {
    // Implement transformation logic
    return {
      id: oldFormat.userId || oldFormat.id,
      email: oldFormat.email,
      name: oldFormat.displayName || oldFormat.name,
      roles: oldFormat.roles || [],
      permissions: oldFormat.permissions || [],
      // Add other required fields
    };
  }
}

// Create singleton instance
const authPersistenceService = new AuthPersistenceService();
export default authPersistenceService;