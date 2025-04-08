/**
 * Auth System Initialization
 * 
 * This file initializes the auth system and sets up the compatibility layer.
 */

import { logger } from '@/utils/logger';
import { authService, tokenService, webSocketAuthService } from './index';
import { 
  authServiceCompat, 
  tokenServiceCompat, 
  sessionServiceCompat, 
  securityServiceCompat 
} from './compatibility';

/**
 * Initialize the auth system
 */
export async function initializeAuthSystem(): Promise<void> {
  logger.info('Initializing auth system', {
    component: 'auth/init'
  });
  
  try {
    // Initialize auth state
    await authService.initializeAuthState();
    
    // Connect WebSocket if authenticated
    if (authService.isAuthenticated()) {
      webSocketAuthService.connect();
    }
    
    // Set up activity tracking
    setupActivityTracking();
    
    // Set up compatibility layer
    setupCompatibilityLayer();
    
    logger.info('Auth system initialized successfully', {
      component: 'auth/init'
    });
  } catch (error) {
    logger.error('Failed to initialize auth system', {
      error,
      component: 'auth/init'
    });
    
    throw error;
  }
}

/**
 * Set up activity tracking
 */
function setupActivityTracking(): void {
  if (typeof window !== 'undefined') {
    // Track user activity
    const activityEvents = [
      'mousedown', 'mousemove', 'keydown', 
      'scroll', 'touchstart', 'click'
    ];
    
    // Throttle activity updates
    let lastActivity = 0;
    const ACTIVITY_THROTTLE = 60000; // 1 minute
    
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivity > ACTIVITY_THROTTLE) {
        lastActivity = now;
        authService.updateUserActivity();
      }
    };
    
    // Add event listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });
    
    // Set initial activity
    authService.updateUserActivity();
    
    logger.debug('Activity tracking initialized', {
      component: 'auth/init'
    });
  }
}

/**
 * Set up compatibility layer
 */
function setupCompatibilityLayer(): void {
  if (typeof window !== 'undefined') {
    // Store compatibility services in window for global access
    (window as any).__authServiceCompat = authServiceCompat;
    (window as any).__tokenServiceCompat = tokenServiceCompat;
    (window as any).__sessionServiceCompat = sessionServiceCompat;
    (window as any).__securityServiceCompat = securityServiceCompat;
    
    logger.debug('Auth compatibility layer initialized', {
      component: 'auth/init'
    });
  }
}

export default initializeAuthSystem;
