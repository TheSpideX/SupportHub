/// <reference lib="webworker" />

// Add these type declarations at the top of the file
declare const self: ServiceWorkerGlobalScope;
declare global {
  // Modify the ServiceWorkerGlobalScope interface without conflicting declarations
  interface ServiceWorkerGlobalScope {
    // The registration property is already defined in the standard lib
    // registration: ServiceWorkerRegistration;
  }
  
  interface Headers {
    entries(): IterableIterator<[string, string]>;
  }
  
  interface SyncEvent extends ExtendableEvent {
    tag: string;
  }
}

// Service worker for authentication processes
const AUTH_CACHE_NAME = 'auth-cache-v1';
const AUTH_API_ENDPOINTS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh-token',
  '/api/auth/logout',
  '/api/auth/verify-email',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/mfa'
];

const AUTH_UI_RESOURCES = [
  '/static/js/auth-chunk',
  '/static/css/auth-styles',
  '/static/media/auth-icons'
];

// Cache auth UI components for instant loading
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(AUTH_CACHE_NAME).then((cache) => {
      return cache.addAll(AUTH_UI_RESOURCES);
    })
  );
});

// Intercept and cache authentication API requests
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);
  
  // Handle auth API requests
  if (AUTH_API_ENDPOINTS.some(endpoint => url.pathname.includes(endpoint))) {
    // For POST requests (login, register, etc.)
    if (event.request.method === 'POST') {
      event.respondWith(
        handleAuthPostRequest(event.request)
      );
    } 
    // For GET requests (token refresh, etc.)
    else if (event.request.method === 'GET') {
      event.respondWith(
        handleAuthGetRequest(event.request)
      );
    }
  }
  
  // Handle auth UI resources
  if (AUTH_UI_RESOURCES.some(resource => url.pathname.includes(resource))) {
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request).then(fetchResponse => {
          return caches.open(AUTH_CACHE_NAME).then(cache => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
  }
});

// Handle offline authentication flows
async function handleAuthPostRequest(request: Request): Promise<Response> {
  try {
    // Try to make the request online first
    const response = await fetch(request.clone());
    
    // If successful, store the response for offline use
    if (response.ok) {
      const responseToCache = response.clone();
      const cache = await caches.open(AUTH_CACHE_NAME);
      await cache.put(request, responseToCache);
    }
    
    return response;
  } catch (error) {
    // If offline, check if we have a cached response
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If no cached response, queue the request for later
    await queueAuthRequest(request);
    
    // Return offline error response
    return new Response(JSON.stringify({
      success: false,
      error: 'You are offline. Your request will be processed when you reconnect.'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle auth GET requests (like token refresh)
async function handleAuthGetRequest(request: Request): Promise<Response> {
  try {
    // Try online first
    const response = await fetch(request.clone());
    
    // Cache successful responses
    if (response.ok) {
      const responseToCache = response.clone();
      const cache = await caches.open(AUTH_CACHE_NAME);
      await cache.put(request, responseToCache);
    }
    
    return response;
  } catch (error) {
    // If offline, use cached response
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // No cached response available
    return new Response(JSON.stringify({
      success: false,
      error: 'You are offline and no cached authentication data is available.'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Queue auth requests for later processing
async function queueAuthRequest(request: Request): Promise<void> {
  // Register a sync event if supported
  if ('sync' in self.registration) {
    try {
      // Clone the request to store it
      const requestClone = request.clone();
      const requestData = {
        url: request.url,
        method: request.method,
        headers: Array.from(request.headers.entries()),
        body: await requestClone.text(),
        credentials: request.credentials,
        mode: request.mode,
        redirect: request.redirect
      };
      
      // Store in IndexedDB for later
      await storeRequestInIndexedDB(requestData);
      
      // Register for sync
      await self.registration.sync.register('auth-sync');
    } catch (error) {
      console.error('Failed to queue auth request:', error);
    }
  }
}

// Store request in IndexedDB for later processing
async function storeRequestInIndexedDB(requestData: any): Promise<void> {
  // Implementation would go here
  // This is a placeholder for the actual IndexedDB implementation
}

// Process queued requests when back online
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'auth-sync') {
    event.waitUntil(processQueuedRequests());
  }
});

// Process all queued requests
async function processQueuedRequests(): Promise<void> {
  // Implementation would go here
  // This would retrieve requests from IndexedDB and retry them
}

// Listen for messages from the main thread
self.addEventListener('message', (event: MessageEvent) => {
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'REFRESH_TOKEN':
        handleTokenRefresh(event.data.payload);
        break;
      case 'CLEAR_AUTH_CACHE':
        clearAuthCache();
        break;
      case 'SYNC_AUTH_STATE':
        syncAuthState(event.data.payload);
        break;
    }
  }
});

// Handle background token refresh
async function handleTokenRefresh(payload: any): Promise<void> {
  try {
    const response = await fetch('/api/auth/token/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      const data = await response.json();
      // Notify main thread of successful refresh
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'TOKEN_REFRESHED',
            payload: data
          });
        });
      });
    }
  } catch (error) {
    console.error('Background token refresh failed:', error);
  }
}

// Clear auth cache (e.g., on logout)
async function clearAuthCache(): Promise<void> {
  try {
    await caches.delete(AUTH_CACHE_NAME);
  } catch (error) {
    console.error('Failed to clear auth cache:', error);
  }
}

// Sync auth state with main thread
function syncAuthState(payload: any): void {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'AUTH_STATE_SYNC',
        payload
      });
    });
  });
}

// Expose the service worker scope
export {};
