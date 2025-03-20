/**
 * Cross-tab communication utilities
 * Standardizes communication between tabs for auth system
 */

// Constants for cross-tab communication
export const CHANNEL_NAME = 'auth_session_channel';
export const STORAGE_PREFIX = 'auth_sync_';
export const STORAGE_LAST_SYNC = `${STORAGE_PREFIX}last_sync`;
export const STORAGE_LEADER = `${STORAGE_PREFIX}leader`;
export const DEBOUNCE_TIME = 300; // ms

// Message types
export enum MessageType {
  SESSION_UPDATED = 'SESSION_UPDATED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  USER_ACTIVITY = 'USER_ACTIVITY',
  TOKENS_UPDATED = 'TOKENS_UPDATED',
  LEADER_PING = 'LEADER_PING',
  LEADER_ELECTION = 'LEADER_ELECTION'
}

// Interface for cross-tab messages
export interface CrossTabMessage {
  type: MessageType;
  payload: any;
  timestamp: number;
  sourceTabId: string; // Track which tab originated the change
}

// Generate a unique ID for this tab if not already done
export const TAB_ID = typeof window !== 'undefined' ? 
  window.sessionStorage.getItem('tab_id') || 
  `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : 
  'server';

// Store the tab ID in session storage
if (typeof window !== 'undefined') {
  window.sessionStorage.setItem('tab_id', TAB_ID);
}

// Debounce function
export function debounce(func: Function, wait: number): Function {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function(...args: any[]) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Check if BroadcastChannel is available
export const isBroadcastChannelSupported = typeof BroadcastChannel !== 'undefined';

// Create a singleton BroadcastChannel instance if supported
let broadcastChannel: BroadcastChannel | null = null;
if (isBroadcastChannelSupported) {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  } catch (error) {
    console.error('Failed to create BroadcastChannel:', error);
  }
}

/**
 * Send a message to other tabs
 */
export function sendCrossTabMessage(type: MessageType, payload: any): void {
  const message: CrossTabMessage = {
    type,
    payload,
    timestamp: Date.now(),
    sourceTabId: TAB_ID // Mark this tab as the source
  };

  // Try BroadcastChannel first
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(message);
    } catch (error) {
      console.error('BroadcastChannel send failed:', error);
      fallbackToLocalStorage(message);
    }
  } else {
    fallbackToLocalStorage(message);
  }
}

/**
 * Fallback to localStorage for cross-tab communication
 */
function fallbackToLocalStorage(message: CrossTabMessage): void {
  try {
    const key = `${STORAGE_PREFIX}${Date.now()}`;
    localStorage.setItem(key, JSON.stringify(message));
    
    // Clean up old messages (keep only last 5)
    const keys = Object.keys(localStorage)
      .filter(k => k.startsWith(STORAGE_PREFIX) && k !== STORAGE_LEADER)
      .sort()
      .slice(0, -5);
    
    keys.forEach(k => localStorage.removeItem(k));
  } catch (error) {
    console.error('LocalStorage fallback failed:', error);
  }
}

/**
 * Register a handler for cross-tab messages
 */
export function registerCrossTabHandler(handler: (message: CrossTabMessage) => void): () => void {
  const debouncedHandler = debounce((message: CrossTabMessage) => {
    // Skip messages from this tab
    if (message.sourceTabId === TAB_ID) return;
    
    // Skip old messages (older than 5 seconds)
    if (Date.now() - message.timestamp > 5000) return;
    
    handler(message);
  }, DEBOUNCE_TIME);

  // Handler for BroadcastChannel
  const broadcastHandler = (event: MessageEvent) => {
    debouncedHandler(event.data);
  };

  // Handler for localStorage events
  const storageHandler = (event: StorageEvent) => {
    if (!event.key || !event.key.startsWith(STORAGE_PREFIX) || !event.newValue) return;
    try {
      const message = JSON.parse(event.newValue);
      debouncedHandler(message);
    } catch (error) {
      console.error('Failed to parse storage event:', error);
    }
  };

  // Register handlers
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', broadcastHandler);
  }
  window.addEventListener('storage', storageHandler);

  // Return cleanup function
  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', broadcastHandler);
    }
    window.removeEventListener('storage', storageHandler);
  };
}

/**
 * Leader election mechanism
 * Returns true if this tab is the leader
 */
export function electLeader(): boolean {
  try {
    const now = Date.now();
    const currentLeader = localStorage.getItem(STORAGE_LEADER);
    
    // Parse current leader data
    let leaderData = { tabId: '', timestamp: 0 };
    try {
      if (currentLeader) {
        leaderData = JSON.parse(currentLeader);
      }
    } catch (error) {
      console.error('Failed to parse leader data:', error);
    }
    
    // If leader is recent (last 10 seconds) and not this tab, we're not leader
    if (leaderData.tabId && leaderData.tabId !== TAB_ID && now - leaderData.timestamp < 10000) {
      return false;
    }
    
    // Otherwise, claim leadership
    localStorage.setItem(STORAGE_LEADER, JSON.stringify({ tabId: TAB_ID, timestamp: now }));
    
    // Announce leadership
    sendCrossTabMessage(MessageType.LEADER_PING, { tabId: TAB_ID, timestamp: now });
    
    return true;
  } catch (error) {
    console.error('Leader election failed:', error);
    return false;
  }
}

/**
 * Check if this tab is the leader
 */
export function isLeader(): boolean {
  try {
    const currentLeader = localStorage.getItem(STORAGE_LEADER);
    if (!currentLeader) return electLeader();
    
    const leaderData = JSON.parse(currentLeader);
    return leaderData.tabId === TAB_ID;
  } catch (error) {
    console.error('Leader check failed:', error);
    return false;
  }
}

// Start leader election process
setTimeout(() => {
  // Only try to become leader if no leader exists or leader is stale
  if (!isLeader()) {
    electLeader();
  }
  
  // Periodically check and renew leadership
  setInterval(() => {
    if (isLeader()) {
      // Renew leadership
      localStorage.setItem(STORAGE_LEADER, JSON.stringify({ 
        tabId: TAB_ID, 
        timestamp: Date.now() 
      }));
    } else if (!localStorage.getItem(STORAGE_LEADER)) {
      // No leader, try to become one
      electLeader();
    }
  }, 5000);
}, 1000);
