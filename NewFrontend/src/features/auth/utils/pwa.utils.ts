declare global {
  interface ServiceWorkerRegistration {
    sync: {
      register(tag: string): Promise<void>;
    }
  }
  
  class PasswordCredential implements Credential {
    id: string;
    type: string;
    password: string;
    name?: string;
    
    constructor(init: {
      id: string;
      password: string;
      name?: string;
    });
  }
  
  // Use the correct type for mediation that matches the built-in type
  interface CredentialRequestOptions {
    password?: boolean;
    // Use CredentialMediationRequirement which is the built-in type
    // mediation?: 'silent' | 'optional' | 'required';
  }
}

// Utilities for PWA authentication features

/**
 * Register the authentication service worker
 * @returns Promise that resolves when registration is complete
 */
export async function registerAuthServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register(
        '/auth-sw.js',
        { scope: '/auth/' }
      );
      
      console.log('Auth service worker registered:', registration.scope);
      return registration;
    } catch (error) {
      console.error('Auth service worker registration failed:', error);
      return null;
    }
  }
  
  console.warn('Service workers are not supported in this browser');
  return null;
}

/**
 * Check if the auth service worker is active
 * @returns Promise that resolves to boolean indicating if service worker is active
 */
export async function isAuthServiceWorkerActive(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.getRegistration('/auth/');
    return !!registration && !!registration.active;
  } catch (error) {
    console.error('Error checking auth service worker status:', error);
    return false;
  }
}

/**
 * Manage cache for auth resources
 */
export const authCacheManager = {
  /**
   * Clear all authentication-related caches
   */
  clearAuthCache: async (): Promise<void> => {
    if (!('caches' in window)) {
      return;
    }
    
    try {
      await caches.delete('auth-cache-v1');
      
      // Notify service worker to clear its cache too
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLEAR_AUTH_CACHE'
        });
      }
    } catch (error) {
      console.error('Failed to clear auth cache:', error);
    }
  },
  
  /**
   * Prefetch and cache critical auth resources
   */
  prefetchAuthResources: async (): Promise<void> => {
    if (!('caches' in window)) {
      return;
    }
    
    const criticalResources = [
      '/static/js/auth-chunk.js',
      '/static/css/auth-styles.css',
      '/static/media/auth-logo.svg'
    ];
    
    try {
      const cache = await caches.open('auth-cache-v1');
      await Promise.all(
        criticalResources.map(url => 
          fetch(url).then(response => cache.put(url, response))
        )
      );
    } catch (error) {
      console.error('Failed to prefetch auth resources:', error);
    }
  }
};

/**
 * Detect network connectivity and handle offline mode transitions
 */
export const connectivityManager = {
  /**
   * Check if the user is currently online
   */
  isOnline: (): boolean => {
    return navigator.onLine;
  },
  
  /**
   * Register a callback for online status changes
   * @param onOnline - Callback for when device comes online
   * @param onOffline - Callback for when device goes offline
   * @returns Function to unregister the listeners
   */
  registerConnectivityListeners: (
    onOnline: () => void,
    onOffline: () => void
  ): () => void => {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  },
  
  /**
   * Check connection quality
   * @returns Promise resolving to connection quality ('fast', 'medium', 'slow', 'offline')
   */
  checkConnectionQuality: async (): Promise<string> => {
    if (!navigator.onLine) {
      return 'offline';
    }
    
    // Use Network Information API if available
    if ('connection' in navigator && navigator.connection) {
      const connection = navigator.connection as any;
      
      if (connection.effectiveType === '4g') {
        return 'fast';
      } else if (connection.effectiveType === '3g') {
        return 'medium';
      } else {
        return 'slow';
      }
    }
    
    // Fallback: measure response time to determine quality
    try {
      const start = Date.now();
      await fetch('/api/ping', { method: 'HEAD' });
      const duration = Date.now() - start;
      
      if (duration < 100) {
        return 'fast';
      } else if (duration < 500) {
        return 'medium';
      } else {
        return 'slow';
      }
    } catch (error) {
      return 'offline';
    }
  }
};

/**
 * Background sync registration for deferred auth operations
 */
export const backgroundSyncManager = {
  /**
   * Register a background sync for auth operations
   * @param syncTag - Unique tag for the sync operation
   * @returns Promise resolving to boolean indicating if registration was successful
   */
  registerAuthSync: async (syncTag: string = 'auth-sync'): Promise<boolean> => {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
      return false;
    }
    
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register(syncTag);
      return true;
    } catch (error) {
      console.error('Background sync registration failed:', error);
      return false;
    }
  },
  
  /**
   * Check if background sync is supported
   * @returns Boolean indicating if background sync is supported
   */
  isBackgroundSyncSupported: (): boolean => {
    return 'serviceWorker' in navigator && 'SyncManager' in window;
  }
};

/**
 * Credential Management API integration
 */
export const credentialManager = {
  /**
   * Store credentials using Credential Management API
   * @param username - User's username or email
   * @param password - User's password
   * @returns Promise resolving to boolean indicating if storage was successful
   */
  storeCredentials: async (username: string, password: string): Promise<boolean> => {
    if (!('credentials' in navigator) || !navigator.credentials) {
      return false;
    }
    
    try {
      const cred = new PasswordCredential({
        id: username,
        password: password,
        name: username
      });
      
      await navigator.credentials.store(cred);
      return true;
    } catch (error) {
      console.error('Failed to store credentials:', error);
      return false;
    }
  },
  
  /**
   * Retrieve stored credentials
   * @returns Promise resolving to credential object or null
   */
  getCredentials: async (): Promise<Credential | null> => {
    if (!('credentials' in navigator) || !navigator.credentials) {
      return null;
    }
    
    try {
      return await navigator.credentials.get({
        password: true,
        mediation: 'optional'
      });
    } catch (error) {
      console.error('Failed to get credentials:', error);
      return null;
    }
  },
  
  /**
   * Check if Credential Management API is supported
   * @returns Boolean indicating if Credential Management API is supported
   */
  isCredentialManagementSupported: (): boolean => {
    return 'credentials' in navigator && !!navigator.credentials;
  }
};

/**
 * Push notification setup for auth events
 */
export const pushNotificationManager = {
  /**
   * Request permission for push notifications
   * @returns Promise resolving to permission status ('granted', 'denied', 'default')
   */
  requestPermission: async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications');
    }
    
    return await Notification.requestPermission();
  },
  
  /**
   * Subscribe to push notifications for auth events
   * @param publicKey - VAPID public key for push subscription
   * @returns Promise resolving to PushSubscription or null
   */
  subscribeToPushNotifications: async (publicKey: string): Promise<PushSubscription | null> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return null;
    }
    
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Convert base64 public key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      
      // Subscribe to push notifications
      return await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  },
  
  /**
   * Check if push notifications are supported
   * @returns Boolean indicating if push notifications are supported
   */
  isPushNotificationSupported: (): boolean => {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }
};

/**
 * Helper function to convert base64 string to Uint8Array
 * @param base64String - Base64 encoded string
 * @returns Uint8Array representation
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}
