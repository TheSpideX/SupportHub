import { AuthService } from './services/AuthService';
import { TokenService } from './services/TokenService';
import { SessionService } from './services/SessionService';
import { SecurityService } from './services/SecurityService';
import { setAuthState, clearAuthState } from './store/authSlice';
import { AuthInitOptions, SecurityLevel, ErrorHandlingConfig } from './types/auth.types';
import { logger } from '@/utils/logger';
import { AUTH_CONSTANTS } from './constants/auth.constants';
import { initializeSessionSocket } from '@/services/socket/socket';

// Define AuthInstance interface
interface AuthInstance {
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  register: (userData: any) => Promise<any>;
  resetPassword: (email: string) => Promise<any>;
  refreshToken: () => Promise<any>;
  getAuthState: () => any;
  isAuthenticated: () => boolean;
  getCurrentUser: () => any;
  extendSession: () => void;
  // Add service properties
  authService: AuthService;
  tokenService: TokenService;
  sessionService: SessionService;
  securityService: SecurityService;
}

// Extended config interface to include additional options
interface ExtendedAuthInitOptions extends AuthInitOptions {
  stateManager?: {
    dispatch: (action: any) => void;
  };
  offlineSupport?: {
    enabled: boolean;
    maxOfflineTime?: number;
    syncStrategy?: string;
  };
  performance?: {
    lazyLoadComponents?: boolean;
    optimisticUpdates?: boolean;
    backgroundRefresh?: {
      enabled: boolean;
      refreshBeforeExpirySeconds?: number;
      maxRetries?: number;
    };
  };
}

const defaultConfig: ExtendedAuthInitOptions = {
  apiUrl: '/api',
  csrfProtection: true,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  refreshThreshold: 5 * 60 * 1000, // 5 minutes
  enableCrossTabs: true,
  securityLevel: 'medium',
  errorHandling: {
    retryStrategy: 'exponential',
    maxRetries: 3,
    notificationLevel: 'user-friendly'
  }
};

// Add a global instance variable
let authInstance: AuthInstance | null = null;

export function initAuth(config: Partial<ExtendedAuthInitOptions> = {}): AuthInstance {
  // Return existing instance if already initialized
  if (authInstance) {
    logger.debug('Auth already initialized, returning existing instance', { component: 'auth/init' });
    return authInstance;
  }
  
  const COMPONENT = 'auth/init';
  logger.info('Initializing authentication system', { component: COMPONENT });
  
  // 1. Validate configuration
  const mergedConfig = { ...defaultConfig, ...config };
  
  // 2. Set up token management
  const tokenService = new TokenService({
    apiBaseUrl: mergedConfig.apiUrl,
    enableCrossTabs: mergedConfig.enableCrossTabs,
    refreshThreshold: mergedConfig.refreshThreshold
  });
  
  // 3. Initialize services
  const securityService = new SecurityService({
    apiBaseUrl: mergedConfig.apiUrl,
    securityLevel: mergedConfig.securityLevel,
    enableFingerprinting: true
  }, tokenService);

  const sessionService = new SessionService(
    tokenService,
    securityService,
    {
      sessionTimeout: mergedConfig.sessionTimeout
    }
  );

  const authService = new AuthService({
    apiBaseUrl: mergedConfig.apiUrl,
    // Remove errorHandling or update the AuthServiceConfig type to include it
  }, tokenService, sessionService, securityService);
  
  // 4. Connect to state management
  if (mergedConfig.stateManager) {
    const { dispatch } = mergedConfig.stateManager;
    
    // Use subscribe method instead of onAuthStateChange
    authService.subscribe((state) => {
      if (state.isAuthenticated && state.user) {
        dispatch(setAuthState({
          user: state.user,
          isAuthenticated: true,
          sessionExpiry: state.sessionExpiry
        }));
      } else {
        dispatch(clearAuthState());
      }
    });
  }
  
  // 5. Set up event listeners
  window.addEventListener('storage', (event) => {
    if (mergedConfig.enableCrossTabs) {
      // Use the correct method from AuthService.ts
      authService.processStorageEvent(event);
    }
  });
  
  // 6. Configure cross-tab synchronization
  if (mergedConfig.enableCrossTabs && typeof BroadcastChannel !== 'undefined') {
    const authChannel = new BroadcastChannel('auth_channel');
    // Use the correct method from AuthService.ts
    authService.initCrossTabCommunication();
  }
  
  // 7. Initialize security measures
  if (mergedConfig.csrfProtection) {
    // Use the correct method from TokenService.ts
    tokenService.setupCsrfProtection();
  }
  
  // 8. Register service worker for auth if PWA features enabled
  if (mergedConfig.offlineSupport?.enabled && 'serviceWorker' in navigator) {
    import('./service-workers/auth-sw').then((module) => {
      // Use registerAuthServiceWorker from pwa.utils instead
      import('./utils/pwa.utils').then((pwUtils) => {
        pwUtils.registerAuthServiceWorker();
      });
    });
  }
  
  // 9. Set up cache strategies for auth UI components
  if (mergedConfig.performance?.lazyLoadComponents) {
    import('./utils/pwa.utils').then((module) => {
      // Use authCacheManager.prefetchAuthResources instead
      module.authCacheManager.prefetchAuthResources();
    });
  }
  
  // 10. Return auth instance with public methods
  // Make sure the auth state is properly initialized
  authService.initializeAuthState().then(() => {
    // Dispatch initial state after auth initialization
    if (mergedConfig.stateManager) {
      const { dispatch } = mergedConfig.stateManager;
      const currentState = authService.getAuthState();
      
      dispatch(setAuthState({
        user: currentState.user,
        isAuthenticated: currentState.isAuthenticated,
        sessionExpiry: currentState.sessionExpiry,
        isInitialized: true // Make sure to set this flag
      }));
    }

    // Initialize socket if user is authenticated
    if (authService.getAuthState().isAuthenticated) {
      initializeSessionSocket();
    }
  });

  const authServiceInstance = {
    initialize: () => authService.initializeAuthState(),
    login: authService.login.bind(authService),
    logout: authService.logout.bind(authService),
    register: authService.register.bind(authService),
    resetPassword: authService.resetPassword.bind(authService),
    refreshToken: tokenService.refreshToken.bind(tokenService),
    getAuthState: () => authService.getAuthState(),
    isAuthenticated: () => authService.getAuthState().isAuthenticated,
    getCurrentUser: () => authService.getAuthState().user,
    extendSession: sessionService.extendSession.bind(sessionService),
    // Add service properties
    authService,
    tokenService,
    sessionService,
    securityService
  };

  // Store the instance before returning
  authInstance = authServiceInstance;
  return authServiceInstance;
}

export default initAuth;

// Add a function to check if auth is initialized
export function isAuthInitialized(): boolean {
  return authInstance !== null;
}

// Add a function to get the existing instance
export function getAuthInstance(): AuthInstance | null {
  return authInstance;
}

export const handleAuthFailure = (error) => {
  console.error('Auth initialization failed:', error);
  
  // Clear any existing tokens
  authInstance.tokenService.clearTokens();
  
  // Redirect to login page with the correct path
  window.location.href = '/login'; // Update from AUTH_CONSTANTS.ROUTES.LOGIN if it was '/auth/login'
  
  return false;
};
