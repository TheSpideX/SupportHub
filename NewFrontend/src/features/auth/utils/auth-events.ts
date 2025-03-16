import { AUTH_CONSTANTS } from '../constants/auth.constants';
import { logger } from '@/utils/logger';
import { analytics } from '@/services/analytics.service';

// Types
export type AuthEventType = 
  // Core auth events
  | 'login' | 'logout' | 'register' | 'token_refresh' | 'session_expired'
  // Security events
  | 'suspicious_activity' | 'device_verified' | 'security_challenge'
  // Session events
  | 'session_created' | 'session_extended' | 'session_terminated'
  // Multi-device events
  | 'device_added' | 'device_removed' | 'force_logout'
  // Error events
  | 'auth_error' | 'network_error' | 'validation_error';

export interface AuthEvent {
  type: AuthEventType;
  timestamp: number;
  data?: any;
  source?: 'user' | 'system' | 'security' | 'network';
}

// Event listeners
type EventListener = (event: AuthEvent) => void;
const listeners: Map<AuthEventType, Set<EventListener>> = new Map();
const eventHistory: AuthEvent[] = [];
const MAX_HISTORY_SIZE = 50;

// Component identifier for logging
const COMPONENT = 'auth-events';

/**
 * Subscribe to authentication events
 */
export const subscribe = (eventType: AuthEventType, listener: EventListener): () => void => {
  if (!listeners.has(eventType)) {
    listeners.set(eventType, new Set());
  }
  
  listeners.get(eventType)?.add(listener);
  
  // Return unsubscribe function
  return () => {
    listeners.get(eventType)?.delete(listener);
  };
};

/**
 * Subscribe to multiple authentication events
 */
export const subscribeToMany = (eventTypes: AuthEventType[], listener: EventListener): () => void => {
  const unsubscribers = eventTypes.map(type => subscribe(type, listener));
  
  // Return combined unsubscribe function
  return () => {
    unsubscribers.forEach(unsubscribe => unsubscribe());
  };
};

/**
 * Unsubscribe from authentication events
 */
export const unsubscribe = (eventType: AuthEventType, listener: EventListener): void => {
  listeners.get(eventType)?.delete(listener);
};

/**
 * Emit an authentication event
 */
export const emit = (eventType: AuthEventType, data?: any, source: 'user' | 'system' | 'security' | 'network' = 'system'): void => {
  try {
    const event: AuthEvent = {
      type: eventType,
      timestamp: Date.now(),
      data,
      source
    };
    
    // Add to history with size limit
    eventHistory.unshift(event);
    if (eventHistory.length > MAX_HISTORY_SIZE) {
      eventHistory.pop();
    }
    
    // Log event
    logger.debug('Auth event emitted', { 
      component: COMPONENT, 
      eventType, 
      source 
    });
    
    // Analytics tracking removed
  } catch (error) {
    logger.error('Failed to emit auth event', { error, eventType });
  }
};

/**
 * Get event history
 */
export const getEventHistory = (limit = MAX_HISTORY_SIZE): AuthEvent[] => {
  return eventHistory.slice(0, limit);
};

/**
 * Get events by type
 */
export const getEventsByType = (eventType: AuthEventType, limit = MAX_HISTORY_SIZE): AuthEvent[] => {
  return eventHistory
    .filter(event => event.type === eventType)
    .slice(0, limit);
};

/**
 * Clear event history
 */
export const clearEventHistory = (): void => {
  eventHistory.length = 0;
};

/**
 * Broadcast event to other tabs
 */
const broadcastEventToOtherTabs = (event: AuthEvent): void => {
  try {
    if (typeof localStorage !== 'undefined') {
      const storageKey = `${AUTH_CONSTANTS.STORAGE_KEYS.AUTH_EVENT}_${event.type}`;
      localStorage.setItem(storageKey, JSON.stringify({
        ...event,
        broadcast: true
      }));
      
      // Clean up after a short delay
      setTimeout(() => {
        localStorage.removeItem(storageKey);
      }, 1000);
    }
  } catch (error) {
    logger.error('Failed to broadcast auth event', {
      component: COMPONENT,
      eventType: event.type,
      error
    });
  }
};

/**
 * Initialize auth events system
 */
export const initAuthEvents = (): () => void => {
  // Listen for storage events from other tabs
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key?.startsWith(AUTH_CONSTANTS.STORAGE_KEYS.AUTH_EVENT) && e.newValue) {
      try {
        const event = JSON.parse(e.newValue) as AuthEvent;
        if (event.broadcast) {
          // Re-emit locally without broadcasting to avoid loops
          const eventType = event.type;
          const { broadcast, ...eventData } = event;
          
          // Notify only local listeners
          listeners.get(eventType)?.forEach(listener => {
            try {
              listener(event);
            } catch (error) {
              logger.error('Error in cross-tab auth event listener', {
                component: COMPONENT,
                eventType,
                error
              });
            }
          });
        }
      } catch (error) {
        logger.error('Failed to process cross-tab auth event', {
          component: COMPONENT,
          error
        });
      }
    }
  };
  
  window.addEventListener('storage', handleStorageEvent);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('storage', handleStorageEvent);
  };
};

/**
 * Get event statistics
 */
export const getEventStats = (): Record<AuthEventType, number> => {
  const stats: Partial<Record<AuthEventType, number>> = {};
  
  eventHistory.forEach(event => {
    if (!stats[event.type]) {
      stats[event.type] = 0;
    }
    stats[event.type]!++;
  });
  
  return stats as Record<AuthEventType, number>;
};

/**
 * Create a throttled event emitter
 */
export const createThrottledEmitter = (
  eventType: AuthEventType, 
  throttleMs = 1000
): (data?: any, source?: 'user' | 'system' | 'security' | 'network') => void => {
  let lastEmit = 0;
  let queued = false;
  let queuedData: any = null;
  let queuedSource: 'user' | 'system' | 'security' | 'network' = 'system';
  
  return (data?: any, source: 'user' | 'system' | 'security' | 'network' = 'system') => {
    const now = Date.now();
    
    if (now - lastEmit >= throttleMs) {
      // Emit immediately
      lastEmit = now;
      emit(eventType, data, source);
    } else {
      // Queue for later
      queued = true;
      queuedData = data;
      queuedSource = source;
      
      // If no timeout is set, create one
      if (!queued) {
        setTimeout(() => {
          if (queued) {
            lastEmit = Date.now();
            emit(eventType, queuedData, queuedSource);
            queued = false;
          }
        }, throttleMs - (now - lastEmit));
      }
    }
  };
};

// Export default object for easier imports
export default {
  subscribe,
  subscribeToMany,
  unsubscribe,
  emit,
  getEventHistory,
  getEventsByType,
  clearEventHistory,
  initAuthEvents,
  getEventStats,
  createThrottledEmitter
};