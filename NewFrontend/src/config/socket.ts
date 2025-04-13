/**
 * Primus WebSocket Configuration
 *
 * This file contains all Primus WebSocket-related configuration settings.
 * It's used by the PrimusAuthService.
 *
 * IMPORTANT: WebSocket connections should use the backend port (4290)
 * instead of the frontend port (5173). This is necessary because
 * WebSockets can't go through the Vite proxy.
 *
 * The WebSocket connection requires HTTP-only cookies for authentication,
 * so withCredentials must be set to true.
 */

// No imports needed

// WebSocket configuration
export const SOCKET_CONFIG = {
  // Base URL for WebSocket connections
  // Socket.IO requires http:// or https:// protocol, not ws://
  // In development, connect directly to the backend
  BASE_URL:
    import.meta.env.VITE_WS_URL ||
    (import.meta.env.MODE === "development"
      ? "http://localhost:4290"
      : "http://localhost:4290"),

  // Server configuration
  SERVER: {
    // Server URL (default: backend server URL)
    URL: import.meta.env.VITE_API_URL || "http://localhost:4290",
    // Primus path
    PATH: "/primus",
  },

  // Connection settings
  CONNECTION: {
    // Reconnection strategy
    RECONNECTION: {
      ENABLED: true,
      MAX_ATTEMPTS: 10,
      DELAY: 1000, // Initial delay in ms
      MAX_DELAY: 5000, // Maximum delay in ms
      JITTER: 0.5, // Random factor to prevent thundering herd
    },

    // Timeout settings
    TIMEOUT: 30000, // 30 seconds

    // Transport settings
    // IMPORTANT: Start with polling for better cookie handling
    // This ensures HTTP-only cookies are properly sent during the initial handshake
    // Then upgrade to websocket for better performance
    TRANSPORTS: ["polling", "websocket"],

    // Primus transformer
    TRANSFORMER: "websockets",

    // Authentication
    // IMPORTANT: This must be true for HTTP-only cookies to be sent
    WITH_CREDENTIALS: true,

    // Security settings
    SECURITY: {
      // CSRF token handling
      CSRF_HEADER: "X-CSRF-Token",
      CSRF_COOKIE: "csrf_token",
      // Device fingerprinting
      DEVICE_ID_HEADER: "X-Device-ID",
      DEVICE_ID_PARAM: "deviceFingerprint",
      // Tab ID for cross-tab synchronization
      TAB_ID_HEADER: "X-Tab-ID",
      TAB_ID_PARAM: "tabId",
      // Security context for additional protection
      SECURITY_CONTEXT_HEADER: "X-Security-Context",
      SECURITY_CONTEXT_PARAM: "securityContextId",
      // Timestamp for request freshness validation
      TIMESTAMP_HEADER: "X-Request-Timestamp",
      TIMESTAMP_PARAM: "timestamp",

      // Cookie names for authentication
      COOKIE_NAMES: {
        ACCESS_TOKEN: "access_token",
        REFRESH_TOKEN: "refresh_token",
        CSRF_TOKEN: "csrf_token",
      },
    },
  },

  // Heartbeat settings
  HEARTBEAT: {
    INTERVAL: 25000, // 25 seconds
    TIMEOUT: 5000, // 5 seconds to wait for response
    PING_INTERVAL: 25000, // Send ping every 25 seconds
    PING_TIMEOUT: 5000, // 5 seconds to wait for ping response
  },

  // Room settings
  ROOMS: {
    // Room prefixes
    PREFIXES: {
      USER: "user:",
      DEVICE: "device:",
      SESSION: "session:",
      TAB: "tab:",
    },

    // Join behavior
    JOIN_BEHAVIOR: {
      AUTO_JOIN_USER_ROOM: true,
      AUTO_JOIN_DEVICE_ROOM: true,
      AUTO_JOIN_SESSION_ROOM: true,
      AUTO_JOIN_TAB_ROOM: true,
    },
  },

  // Event names for WebSocket communication
  EVENTS: {
    // Authentication events
    AUTH_SUCCESS: "auth:success",
    AUTH_ERROR: "auth:error",

    // Session events
    SESSION_EXPIRED: "session:expired",
    SESSION_TIMEOUT_WARNING: "session:timeout_warning",
    SESSION_EXTENDED: "session:extended",

    // Token events
    TOKEN_REFRESHED: "token:refreshed",
    TOKEN_REFRESH_ERROR: "token:refresh_error",
    TOKEN_EXPIRING: "token:expiring",

    // User events
    USER_ACTIVITY: "user:activity",
    USER_UPDATED: "user:updated",

    // Room events
    ROOM_JOINED: "room:joined",
    ROOM_JOIN_FAILED: "room:join_failed",

    // Leader election events
    LEADER_ELECTED: "leader:elected",
    LEADER_HEARTBEAT: "leader:heartbeat",

    // Device events
    DEVICE_CONNECTED: "device:connected",
    DEVICE_DISCONNECTED: "device:disconnected",
    DEVICE_INFO: "device:info",

    // Security events
    SECURITY_EVENT: "security:event",
    SECURITY_VIOLATION: "security:violation",

    // Heartbeat
    HEARTBEAT: "heartbeat",
    HEARTBEAT_RESPONSE: "heartbeat:response",
  },

  // Cross-tab synchronization
  CROSS_TAB: {
    ENABLED: true,
    BROADCAST_CHANNEL: "auth_socket_channel",
    LEADER_STORAGE_KEY: "auth_leader_tab",
    SYNC_INTERVAL: 5000, // 5 seconds

    // Message types for cross-tab communication
    MESSAGE_TYPES: {
      AUTH_EVENT: "AUTH_EVENT",
      SESSION_STATUS: "SESSION_STATUS",
      SESSION_EXPIRED: "SESSION_EXPIRED",
      TOKEN_REFRESHED: "TOKEN_REFRESHED",
      TOKEN_CLEARED: "TOKEN_CLEARED",
      LEADER_ELECTED: "LEADER_ELECTED",
      FALLBACK_STATUS: "FALLBACK_STATUS",
    },

    // Leader election settings
    LEADER_ELECTION: {
      // Storage keys
      LEADER_ID_KEY: "socket_leader_id",
      LAST_HEARTBEAT_KEY: "socket_leader_heartbeat",
      // Timeouts
      HEARTBEAT_INTERVAL: 3000, // 3 seconds
      HEARTBEAT_TIMEOUT: 10000, // 10 seconds - time after which leader is considered inactive
      // Election settings
      ELECTION_TIMEOUT: 1000, // 1 second - delay before starting election
      PRIORITY_FACTORS: {
        VISIBILITY: 10, // Visible tabs get higher priority
        CREATION_TIME: 5, // Older tabs get higher priority
        ACTIVITY: 3, // More active tabs get higher priority
        RANDOM: 1, // Small random factor to break ties
      },
    },
  },

  // Fallback settings when WebSockets are unavailable
  FALLBACK: {
    ENABLED: true,
    POLLING_INTERVAL: 5000, // 5 seconds
    MAX_POLLING_ATTEMPTS: 12, // 1 minute total (12 * 5000ms)
    MAX_RECOVERY_ATTEMPTS: 5, // Maximum WebSocket recovery attempts before switching to fallback
    EVENTS_ENDPOINT: "/api/auth/events",

    // Endpoints for fallback HTTP polling
    ENDPOINTS: {
      SESSION_STATUS: "/api/auth/session/status",
      AUTH_EVENTS: "/api/auth/events",
      HEARTBEAT: "/api/auth/heartbeat",
      TOKEN_REFRESH: "/api/auth/token/refresh",
      SESSION_VALIDATE: "/api/auth/session/validate",
      TOKEN_STATUS: "/api/auth/token-status",
      TOKEN_VERSION: "/api/auth/token-version",
      CSRF_TOKEN: "/api/auth/token/csrf",
      DEVICE_SESSIONS: "/api/auth/device/sessions",
    },

    // Retry settings for fallback HTTP polling
    RETRY: {
      MAX_RETRIES: 3,
      RETRY_DELAY: 1000, // 1 second
      BACKOFF_FACTOR: 1.5, // Exponential backoff
      MAX_DELAY: 10000, // Maximum delay between retries (10 seconds)
    },

    // Security settings for fallback HTTP polling
    SECURITY: {
      // Always include these headers in fallback requests
      REQUIRED_HEADERS: [
        "X-CSRF-Token",
        "X-Device-ID",
        "X-Tab-ID",
        "X-Request-Timestamp",
      ],
      // Always include withCredentials for HTTP-only cookies
      WITH_CREDENTIALS: true,
    },

    // Offline mode settings
    OFFLINE: {
      ENABLED: true,
      MAX_CACHE_AGE: 24 * 60 * 60 * 1000, // 24 hours
      SYNC_ON_RECONNECT: true,
      RESTRICTED_OPERATIONS: [
        "password_change",
        "profile_update",
        "account_deletion",
      ],
    },
  },
};

// Export default
export default SOCKET_CONFIG;
