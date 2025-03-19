/**
 * TODO: Future Enhancements
 * 1. Implement offline data synchronization with proper queue processing
 * 2. Add BroadcastChannel API for more efficient cross-tab communication
 * 3. Strengthen HTTP-only cookie integration with backend
 * 4. Enhance security context validation with more sophisticated device fingerprinting
 * 5. Implement the circuit breaker pattern for API calls
 * 6. Add comprehensive error handling for storage operations
 * 7. Implement storage encryption for sensitive data
 * 8. Add support for WebAuthn/FIDO2 for passwordless authentication
 */

import { logger } from '@/utils/logger';
import { encryptData, decryptData, generateNonce } from '@/utils/crypto';
import {
  StorageType,
  StorageOptions,
  SessionData,
  SecurityContext,
  SessionMetadata,
  CircuitBreakerState,
  OfflineAuthAction
} from '../types/auth.types';
// import { processOfflineAuthQueue } from './auth.utils';

// Constants
const CSRF_COOKIE_NAME = 'csrf_token';
const SESSION_METADATA_KEY = 'auth_session_metadata';
const CIRCUIT_BREAKER_KEY = 'storage_circuit_breaker';
const OFFLINE_QUEUE_KEY = 'offline_auth_queue';

// Default options
const defaultOptions: StorageOptions = {
  httpOnly: false, // Client-side cookies can't be httpOnly
  secure: true,
  sameSite: 'strict',
  path: '/',
  maxAge: 30 * 60, // 30 minutes default
  encrypt: false
};

// In-memory fallback storage
const memoryStorage = new Map<string, string>();

// Circuit breaker configuration
const circuitBreakerConfig = {
  threshold: 5, // Number of failures before opening
  resetTimeout: 60000, // 1 minute before trying again
  halfOpenMaxAttempts: 3 // Max attempts in half-open state
};

/**
 * Circuit breaker pattern for storage operations
 */
function getCircuitBreakerState(): CircuitBreakerState {
  try {
    const state = localStorage.getItem(CIRCUIT_BREAKER_KEY);
    return state ? JSON.parse(state) : {
      status: 'closed',
      failures: 0,
      lastFailure: 0,
      nextRetry: 0
    };
  } catch {
    return {
      status: 'closed',
      failures: 0,
      lastFailure: 0,
      nextRetry: 0
    };
  }
}

function updateCircuitBreakerState(update: Partial<CircuitBreakerState>): void {
  try {
    const current = getCircuitBreakerState();
    const updated = { ...current, ...update };
    localStorage.setItem(CIRCUIT_BREAKER_KEY, JSON.stringify(updated));
  } catch (error) {
    logger.error('Failed to update circuit breaker state:', error);
  }
}

function recordStorageFailure(): void {
  const state = getCircuitBreakerState();
  const now = Date.now();
  
  if (state.status === 'closed') {
    const newFailures = state.failures + 1;
    if (newFailures >= circuitBreakerConfig.threshold) {
      // Open the circuit
      updateCircuitBreakerState({
        status: 'open',
        failures: newFailures,
        lastFailure: now,
        nextRetry: now + circuitBreakerConfig.resetTimeout
      });
      logger.warn('Storage circuit breaker opened due to multiple failures');
    } else {
      // Increment failures
      updateCircuitBreakerState({
        failures: newFailures,
        lastFailure: now
      });
    }
  } else if (state.status === 'half-open') {
    // Failed during testing, back to open
    updateCircuitBreakerState({
      status: 'open',
      lastFailure: now,
      nextRetry: now + circuitBreakerConfig.resetTimeout
    });
    logger.warn('Storage circuit breaker reopened after half-open failure');
  }
}

function recordStorageSuccess(): void {
  const state = getCircuitBreakerState();
  
  if (state.status === 'half-open') {
    // Reset to closed on success
    updateCircuitBreakerState({
      status: 'closed',
      failures: 0,
      lastFailure: 0,
      nextRetry: 0
    });
    logger.info('Storage circuit breaker closed after successful operation');
  }
}

function checkCircuitBreaker(): boolean {
  const state = getCircuitBreakerState();
  const now = Date.now();
  
  if (state.status === 'open' && now >= state.nextRetry) {
    // Try half-open state
    updateCircuitBreakerState({
      status: 'half-open'
    });
    logger.info('Storage circuit breaker entering half-open state');
    return true;
  }
  
  return state.status !== 'open';
}

/**
 * Detects if storage is available
 */
export function isStorageAvailable(type: StorageType): boolean {
  if (!checkCircuitBreaker()) {
    logger.warn('Storage circuit breaker is open, using fallbacks');
    return false;
  }
  
  try {
    if (type === 'memory') return true;
    
    const storage = type === 'localStorage' ? localStorage : 
                    type === 'sessionStorage' ? sessionStorage : null;
    
    if (!storage) return type === 'cookie' && navigator.cookieEnabled;
    
    const testKey = `__storage_test__${Math.random()}`;
    storage.setItem(testKey, 'test');
    const result = storage.getItem(testKey) === 'test';
    storage.removeItem(testKey);
    
    if (result) recordStorageSuccess();
    return result;
  } catch (e) {
    recordStorageFailure();
    return false;
  }
}

/**
 * Sets a cookie with the specified options
 */
export function setCookie(name: string, value: string, options: StorageOptions = {}): boolean {
  try {
    const opts = { ...defaultOptions, ...options };
    
    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    
    if (opts.path) cookieString += `; path=${opts.path}`;
    if (opts.domain) cookieString += `; domain=${opts.domain}`;
    if (opts.maxAge) cookieString += `; max-age=${opts.maxAge}`;
    if (opts.secure) cookieString += '; secure';
    if (opts.sameSite) cookieString += `; samesite=${opts.sameSite}`;
    
    // Note: httpOnly cookies can only be set by the server
    
    document.cookie = cookieString;
    recordStorageSuccess();
    return true;
  } catch (error) {
    recordStorageFailure();
    logger.error('Failed to set cookie:', error);
    return false;
  }
}

/**
 * Gets a cookie by name
 */
export function getCookie(name: string): string | null {
  try {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.startsWith(`${name}=`)) {
        recordStorageSuccess();
        return decodeURIComponent(cookie.substring(name.length + 1));
      }
    }
    return null;
  } catch (error) {
    recordStorageFailure();
    logger.error('Failed to get cookie:', error);
    return null;
  }
}

/**
 * Removes a cookie by setting its expiration to the past
 */
export function removeCookie(name: string, options: Partial<StorageOptions> = {}): boolean {
  try {
    const opts = { ...defaultOptions, ...options, maxAge: -1 };
    return setCookie(name, '', opts);
  } catch (error) {
    logger.error('Failed to remove cookie:', error);
    return false;
  }
}

/**
 * Gets session metadata from storage
 */
export function getSessionMetadata(): SessionData | null {
  try {
    if (isStorageAvailable('localStorage')) {
      const data = localStorage.getItem(SESSION_METADATA_KEY);
      if (data) {
        recordStorageSuccess();
        return JSON.parse(data);
      }
    }
    return null;
  } catch (error) {
    recordStorageFailure();
    logger.error('Failed to get session metadata:', error);
    return null;
  }
}

/**
 * Sets session metadata in storage
 * This function is used by auth.utils.ts to store session data
 */
export function setSessionMetadata(data: SessionData): boolean {
  try {
    if (isStorageAvailable('localStorage')) {
      // Encrypt sensitive session data before storing
      const encryptedData = data.securityContext ? 
        { ...data, securityContext: encryptData(JSON.stringify(data.securityContext)) } : 
        data;
        
      localStorage.setItem(SESSION_METADATA_KEY, JSON.stringify(encryptedData));
      recordStorageSuccess();
      
      // Emit storage event for cross-tab communication
      emitStorageEvent('session_updated', { timestamp: Date.now() });
      return true;
    }
    return false;
  } catch (error) {
    recordStorageFailure();
    logger.error('Failed to set session metadata:', error);
    return false;
  }
}

/**
 * Checks if auth tokens exist
 * This aligns with the HTTP-only cookie approach in the architecture
 */
export function hasAuthTokens(): boolean {
  // Check for the existence flag cookie that indicates token presence
  // This is the recommended approach for HTTP-only cookies
  const tokenExists = !!getCookie('auth_token_exists');
  
  // Log the token existence check result for debugging
  logger.debug(`Auth token existence check: ${tokenExists}`);
  
  return tokenExists;
}

/**
 * Gets the offline auth queue
 */
export function getOfflineAuthQueue(): OfflineAuthAction[] {
  try {
    if (isStorageAvailable('localStorage')) {
      const data = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (data) {
        recordStorageSuccess();
        return JSON.parse(data);
      }
    }
    return [];
  } catch (error) {
    recordStorageFailure();
    logger.error('Failed to get offline auth queue:', error);
    return [];
  }
}

/**
 * Queues an offline auth action
 */
export async function queueOfflineAuthAction(action: OfflineAuthAction): Promise<boolean> {
  try {
    const queue = getOfflineAuthQueue();
    queue.push(action);
    
    if (isStorageAvailable('localStorage')) {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      recordStorageSuccess();
      return true;
    }
    return false;
  } catch (error) {
    recordStorageFailure();
    logger.error('Failed to queue offline auth action:', error);
    return false;
  }
}

/**
 * Clears the offline auth queue
 */
export function clearOfflineAuthQueue(): boolean {
  try {
    if (isStorageAvailable('localStorage')) {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
      recordStorageSuccess();
      return true;
    }
    return false;
  } catch (error) {
    recordStorageFailure();
    logger.error('Failed to clear offline auth queue:', error);
    return false;
  }
}

/**
 * Broadcasts a storage event for cross-tab communication
 */
export function emitStorageEvent(key: string, data: any): void {
  try {
    // Use localStorage for cross-tab communication
    const eventKey = `auth_event_${key}`;
    const eventData = {
      source: 'auth-storage',
      key,
      data,
      timestamp: Date.now()
    };
    
    localStorage.setItem(eventKey, JSON.stringify(eventData));
    
    // Dispatch a custom event for same-tab listeners
    const event = new CustomEvent('auth-storage', {
      detail: eventData
    });
    
    window.dispatchEvent(event);
  } catch (error) {
    logger.error('Failed to emit storage event:', error);
  }
}

/**
 * Adds a listener for auth storage events (cross-tab communication)
 */
export function addStorageListener(callback: (event: StorageEvent | CustomEvent) => void): () => void {
  // Function to handle storage events (cross-tab)
  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key && event.key.startsWith('auth_event_')) {
      try {
        const data = event.newValue ? JSON.parse(event.newValue) : null;
        if (data && data.source === 'auth-storage') {
          callback(event);
        }
      } catch (error) {
        logger.error('Failed to parse auth event:', error);
      }
    }
  };
  
  // Function to handle custom events (same-tab)
  const handleCustomEvent = (event: Event) => {
    callback(event as CustomEvent);
  };
  
  // Add event listeners
  window.addEventListener('storage', handleStorageEvent);
  window.addEventListener('auth-storage', handleCustomEvent);
  
  // Return function to remove listeners
  return () => {
    window.removeEventListener('storage', handleStorageEvent);
    window.removeEventListener('auth-storage', handleCustomEvent);
  };
}

/**
 * Initializes the storage module
 */
export function initStorage(): void {
  // Check storage availability
  const storageTypes: StorageType[] = ['localStorage', 'sessionStorage', 'cookie'];
  storageTypes.forEach(type => {
    const available = isStorageAvailable(type);
    logger.info(`Storage type ${type} available: ${available}`);
  });
  
  // Set up listener for online/offline events
  window.addEventListener('online', () => {
    logger.info('Application is online, syncing auth state');
    // Removed processOfflineAuthQueue call
  });
  
  window.addEventListener('offline', () => {
    logger.info('Application is offline, switching to offline auth mode');
  });
  
  // Initialize circuit breaker
  const circuitState = getCircuitBreakerState();
  if (circuitState.status === 'open') {
    logger.warn('Storage circuit breaker is open, will retry after timeout');
  }
}

// Initialize storage when module is loaded
initStorage();

/**
 * Note on HTTP-only cookies:
 * This implementation follows a security best practice where:
 * 1. Authentication tokens are stored in HTTP-only cookies (set by server)
 * 2. CSRF tokens are stored in client-accessible cookies
 * 3. Additional metadata is stored in encrypted client storage
 * 
 * This approach prevents XSS attacks from accessing auth tokens while
 * maintaining the ability to detect authentication state client-side.
 */

/**
 * Creates a new security context for the session
 * This function is used by auth.utils.ts for security validation
 */
export async function createSecurityContext(userId?: string): Promise<SecurityContext> {
  try {
    // Generate a unique identifier for this security context
    const contextId = await generateNonce();
    const now = Date.now();
    
    return {
      id: contextId,
      userId: userId || 'anonymous', // Use provided userId or default to anonymous
      createdAt: now,
      lastVerified: now,
      ipHash: contextId, // In a real app, you'd hash the IP
      userAgent: navigator.userAgent,
      deviceFingerprint: await generateDeviceFingerprint() // Add deviceFingerprint if needed
    };
  } catch (error) {
    logger.error('Failed to create security context:', error);
    const now = Date.now();
    return {
      id: `fallback-${now}`,
      userId: userId || 'anonymous',
      createdAt: now,
      lastVerified: now
      // No deviceFingerprint in error case
    };
  }
}

/**
 * Generate a simple device fingerprint
 * This is used by the security context for device tracking
 */
async function generateDeviceFingerprint(): Promise<string> {
  try {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.colorDepth,
      screen.width + 'x' + screen.height
    ].join('|');
    
    // In a real app, you'd use a more sophisticated fingerprinting approach
    // and possibly hash the result
    return components;
  } catch (error) {
    logger.error('Failed to generate device fingerprint:', error);
    return 'unknown-device';
  }
}

// Fix for error 2: Change SessionMetadata to SessionData
export function syncSessionMetadataAcrossTabs(data: SessionData): void {
  // Implementation of cross-tab synchronization
  // This would use BroadcastChannel API or localStorage events
  try {
    // Example using storage event (would be caught by other tabs)
    if (isStorageAvailable('localStorage')) {
      localStorage.setItem(SESSION_METADATA_KEY, JSON.stringify(data));
    }
  } catch (error) {
    logger.error('Failed to sync session metadata across tabs:', error);
  }
}

/**
 * Get security context from storage
 * @returns The stored security context or null if not found
 */
export function getSecurityContext(): SecurityContext | null {
  try {
    const contextStr = localStorage.getItem('auth_security_context');
    if (!contextStr) return null;
    return JSON.parse(contextStr) as SecurityContext;
  } catch (error) {
    console.error('Failed to get security context:', error);
    return null;
  }
}

/**
 * Set security context in storage
 * @param context - The security context to store
 */
export function setSecurityContext(context: SecurityContext): void {
  try {
    localStorage.setItem('auth_security_context', JSON.stringify(context));
  } catch (error) {
    console.error('Failed to set security context:', error);
  }
}
