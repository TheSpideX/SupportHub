/**
 * WebSocket configuration for authentication system
 * Comprehensive settings for WebSocket connections, reconnection,
 * cross-tab coordination, and security
 */
require('dotenv').config();
const isDevelopment = process.env.NODE_ENV !== 'production';
const tokenConfig = require('./token.config');
const sessionConfig = require('./session.config');
const securityConfig = require('./security.config');
const roomRegistryConfig = require('./room-registry.config');
const cookieConfig = require('./cookie.config');

// Event name constants to avoid duplication
const EVENT_NAMES = {
  TOKEN_REFRESHED: 'token:refreshed',
  TOKEN_EXPIRING: 'token:expiring',
  TOKEN_EXPIRED: 'token:expired',
  TOKEN_INVALID: 'token:invalid',
  TOKEN_REVOKED: 'token:revoked',
  SECURITY_PASSWORD_CHANGED: 'security:password_changed',
  SECURITY_SUSPICIOUS_ACTIVITY: 'security:suspicious_activity',
  SECURITY_DEVICE_VERIFIED: 'security:device_verified',
  SECURITY_PERMISSION_CHANGED: 'security:permission_changed'
};

// Environment-specific overrides
const envOverrides = {
  development: {
    reconnectionAttempts: 10,
    requireCsrfToken: false,
    strictOriginMatching: false,
    maxConnectionsTotal: 5000,
    enableConnectionSharing: false
  },
  production: {
    reconnectionAttempts: Infinity,
    requireCsrfToken: true,
    strictOriginMatching: true,
    maxConnectionsTotal: 100000,
    enableConnectionSharing: true
  }
};

// Use environment-specific settings
const env = isDevelopment ? 'development' : 'production';
const envConfig = envOverrides[env];

const websocketConfig = {
  // Connection parameters
  connection: {
    // Connection timeout settings
    connectTimeout: 10000, // 10 seconds to establish initial connection
    pingTimeout: 5000, // 5 seconds to wait for ping response
    pingInterval: 25000, // Send ping every 25 seconds
    
    // Reconnection strategy
    reconnection: {
      enabled: true,
      attempts: envConfig.reconnectionAttempts,
      delay: 1000, // Start with 1 second delay
      maxDelay: 30000, // Maximum 30 second delay
      jitter: 0.5, // Add randomness to prevent thundering herd
      exponentialBackoff: true // Increase delay exponentially
    },
    
    // Connection state management
    state: {
      persistState: true, // Save connection state to localStorage
      stateKey: 'ws_auth_state', // Key for localStorage
      stateExpiry: 86400, // State valid for 24 hours
      restoreOnReconnect: true // Restore state on reconnection
    }
  },
  
  // Authentication handshake configuration
  authentication: {
    // Cookie validation
    cookies: {
      enabled: true,
      validateOnConnect: true,
      refreshTokenCookieName: cookieConfig.names.REFRESH_TOKEN,
      accessTokenCookieName: cookieConfig.names.ACCESS_TOKEN,
      csrfTokenHeaderName: tokenConfig.csrf.headerName,
      requireCsrfToken: process.env.REQUIRE_CSRF_TOKEN === 'true' || false,
      allowReconnectWithExpiredAccess: true, // Allow reconnection with expired access token if refresh token is valid
      maxAuthAttempts: 3, // Maximum authentication attempts before temporary ban
      // Align cookie security settings with HTTP cookies
      sameSite: tokenConfig.cookie.sameSite,
      secure: tokenConfig.cookie.secure,
      httpOnly: true // Always true for WebSocket auth cookies
    },
    
    // Handshake process
    handshake: {
      timeout: 5000, // 5 seconds to complete authentication
      requireAuth: true, // Require authentication for all connections
      anonymousNamespace: '/public', // Namespace for unauthenticated connections
      authenticatedNamespace: '/auth', // Namespace for authenticated connections
      authEventName: 'authenticate', // Event name for authentication
      authResponseEventName: 'authenticated', // Event name for authentication response
      authErrorEventName: 'auth_error' // Event name for authentication error
    },
    
    // Session binding
    sessionBinding: {
      bindToSession: true, // Bind socket to session
      enforceDeviceMatch: true, // Enforce device ID match
      storeSocketId: true, // Store socket ID in session
      maxSocketsPerSession: sessionConfig.tracking.maxDevicesPerUser * 5 // Max sockets per session
    },
    
    // Authentication middleware configuration
    middleware: {
      enabled: true,
      validateTokens: true, // Validate tokens during handshake
      refreshExpiredAccess: true, // Attempt to refresh expired access tokens
      rejectInvalidTokens: true, // Reject connections with invalid tokens
      extractUserData: true, // Extract user data from token for socket
      attachToSocket: true, // Attach user data to socket object
      userProperty: 'user', // Property name for user data on socket
      sessionProperty: 'session' // Property name for session data on socket
    }
  },
  
  // Cross-tab coordination
  crossTab: {
    // Leader election
    leaderElection: {
      enabled: true,
      heartbeatInterval: 2000, // Leader sends heartbeat every 2 seconds
      missedHeartbeatsThreshold: 3, // Consider leader dead after 3 missed heartbeats
      leaderKey: 'ws_leader_tab', // localStorage key for leader ID
      candidateDelay: 500, // Wait 500ms before starting election (prevents race)
      leaderPriority: {
        active: 3, // Highest priority for active tabs
        visible: 2, // Medium priority for visible but not active tabs
        hidden: 1 // Lowest priority for hidden tabs
      }
    },
    
    // State synchronization
    stateSync: {
      enabled: true,
      syncInterval: 5000, // Sync state every 5 seconds
      syncKey: 'ws_auth_sync', // localStorage key for sync
      broadcastChannel: 'auth_ws_channel', // BroadcastChannel API name
      useBroadcastChannel: true, // Use BroadcastChannel API if available
      fallbackToStorage: true, // Fall back to localStorage if BroadcastChannel not available
      debounceTime: 200 // Debounce state updates by 200ms
    },
    
    // Connection sharing
    connectionSharing: {
      enabled: envConfig.enableConnectionSharing,
      maxSharedConnections: 1, // Only one shared connection
      shareAcrossDomains: false, // Don't share across domains
      tabsPerConnection: 5, // Up to 5 tabs can share one connection
      connectionSelector: 'newest', // Use newest connection when multiple exist
      sharedStateKey: 'ws_shared_connection' // localStorage key for shared connection
    }
  },
  
  // Token refresh flow
  tokenRefresh: {
    // Single reference to token expiry warning time
    expiryWarningTime: tokenConfig.socket.expiryWarningTime,
    
    // Refresh coordination
    coordination: {
      leaderOnly: true, // Only leader tab performs refresh
      notifyAllTabs: true, // Notify all tabs after refresh
      refreshEvent: EVENT_NAMES.TOKEN_REFRESHED, // Use constant instead of string literal
      refreshChannel: 'auth_refresh', // BroadcastChannel for refresh coordination
      queueRefresh: true, // Queue refresh requests
      queueDelay: tokenConfig.socket.refreshQueueDelay // Use value from token config
    },
    
    // Background tab behavior
    backgroundTabs: {
      refreshIfExpiringSoon: true, // Refresh tokens in background tabs if expiring soon
      soonThreshold: tokenConfig.socket.expiryWarningTime, // Use value from token config
      refreshIfActive: false, // Don't refresh if user inactive
      inactivityThreshold: sessionConfig.timeouts.idle, // Use session idle timeout
      suspendRefreshAfter: 4 * 60 * 60 // Stop refreshing after 4 hours in background
    },
    
    // Token expiry events
    events: {
      expiryWarning: EVENT_NAMES.TOKEN_EXPIRING, // Use constant
      refreshed: EVENT_NAMES.TOKEN_REFRESHED, // Use constant
      expired: EVENT_NAMES.TOKEN_EXPIRED, // Use constant
      invalid: EVENT_NAMES.TOKEN_INVALID, // Use constant
      revoked: EVENT_NAMES.TOKEN_REVOKED, // Use constant
      // Use the single reference for warning threshold
      warningThreshold: tokenConfig.socket.expiryWarningTime // Seconds before expiry to send warning
    }
  },
  
  // Security settings
  security: {
    // CORS settings
    cors: {
      enabled: true,
      origins: securityConfig.socket.allowedOrigins, // Use origins from security config
      allowCredentials: true,
      validateOrigin: securityConfig.socket.enforceOrigin // Use value from security config
    },
    
    // Origin validation
    originValidation: {
      enabled: true,
      strictMatching: envConfig.strictOriginMatching,
      allowSubdomains: true, // Allow subdomains of allowed origins
      rejectInvalidOrigin: true // Reject connections with invalid origins
    },
    
    // Rate limiting
    rateLimit: {
      enabled: true,
      windowMs: 60000, // 1 minute window
      maxConnectionsPerIP: securityConfig.socket.rateLimiting.connectionsPerIP, // Use value from security config
      maxEventsPerIP: securityConfig.socket.rateLimiting.messagesPerMinute, // Use value from security config
      maxConnectionsTotal: envConfig.maxConnectionsTotal,
      ipWhitelist: [], // IPs exempt from rate limiting
      errorMessage: 'Too many connections, please try again later',
      headers: true // Send rate limit headers
    },
    
    // Payload validation
    payloadValidation: {
      enabled: true,
      maxPayloadSize: securityConfig.socket.maxPayloadSize, // Use value from security config
      validateSchema: true, // Validate event payloads against schema
      sanitizePayloads: true, // Sanitize payloads to prevent injection
      rejectInvalidPayloads: true // Reject invalid payloads
    }
  },
  
  // Room management
  rooms: {
    // Join/leave behavior
    joinBehavior: {
      autoJoinUserRoom: true, // Auto-join user room on connect
      autoJoinDeviceRoom: true, // Auto-join device room on connect
      autoJoinSessionRoom: true, // Auto-join session room on connect
      joinTabRoomOnly: false, // Join all applicable rooms, not just tab
      leaveOnDisconnect: true, // Leave rooms on disconnect
      rejoinOnReconnect: true // Rejoin rooms on reconnect
    },
    
    // Room naming - use prefixes directly from room registry config
    roomNames: {
      userPrefix: roomRegistryConfig.roomTypes.user.prefix,
      devicePrefix: roomRegistryConfig.roomTypes.device.prefix,
      sessionPrefix: roomRegistryConfig.roomTypes.session.prefix,
      tabPrefix: roomRegistryConfig.roomTypes.tab.prefix
    }
  },
  
  // NEW: Error handling configuration
  errorHandling: {
    enabled: true,
    retryableOperations: {
      roomJoin: {
        maxRetries: 3,
        backoffFactor: 1.5,
        initialDelay: 1000
      },
      authentication: {
        maxRetries: 2,
        backoffFactor: 2,
        initialDelay: 2000
      },
      eventDelivery: {
        maxRetries: 3,
        backoffFactor: 1.5,
        initialDelay: 500
      }
    },
    errorEvents: {
      connectionError: 'error:connection',
      authError: 'error:authentication',
      roomError: 'error:room',
      tokenError: 'error:token',
      generalError: 'error:general'
    },
    errorLogging: {
      logToServer: true,
      logToClient: isDevelopment,
      sanitizeErrors: true,
      includeStackTrace: isDevelopment
    }
  },
  
  // NEW: Event propagation configuration
  eventPropagation: {
    enabled: true,
    hierarchical: {
      enabled: true,
      propagateUp: true, // Events propagate up the hierarchy
      propagateDown: true, // Events propagate down the hierarchy
      selectiveDownPropagation: true // Only propagate relevant events down
    },
    filtering: {
      enabled: true,
      filterByRoomType: true, // Filter events based on room type
      filterByEventType: true // Filter events based on event type
    },
    propagationRules: {
      // Define which events propagate in which direction
      [EVENT_NAMES.TOKEN_REFRESHED]: {
        direction: 'down',
        targetRooms: ['session', 'tab']
      },
      [EVENT_NAMES.SECURITY_PASSWORD_CHANGED]: {
        direction: 'down',
        targetRooms: ['device', 'session', 'tab']
      },
      [EVENT_NAMES.SECURITY_SUSPICIOUS_ACTIVITY]: {
        direction: 'down',
        targetRooms: ['device', 'session', 'tab']
      }
    },
    throttling: {
      enabled: true,
      maxEventsPerSecond: 50,
      burstSize: 100
    }
  },
  
  // NEW: Security events configuration
  securityEvents: {
    enabled: true,
    events: {
      passwordChanged: EVENT_NAMES.SECURITY_PASSWORD_CHANGED,
      suspiciousActivity: EVENT_NAMES.SECURITY_SUSPICIOUS_ACTIVITY,
      deviceVerified: EVENT_NAMES.SECURITY_DEVICE_VERIFIED,
      permissionChanged: EVENT_NAMES.SECURITY_PERMISSION_CHANGED
    },
    propagationDelay: securityConfig.socket.securityEvents.propagationDelay,
    retryAttempts: securityConfig.socket.securityEvents.retryAttempts,
    criticalEvents: [
      EVENT_NAMES.SECURITY_PASSWORD_CHANGED,
      EVENT_NAMES.SECURITY_SUSPICIOUS_ACTIVITY
    ],
    responseActions: {
      [EVENT_NAMES.SECURITY_PASSWORD_CHANGED]: 'forceReauthentication',
      [EVENT_NAMES.SECURITY_SUSPICIOUS_ACTIVITY]: 'notifyAndVerify',
      [EVENT_NAMES.SECURITY_PERMISSION_CHANGED]: 'refreshPermissions'
    }
  },
  
  // NEW: Debugging tools configuration
  debuggingTools: {
    enabled: isDevelopment,
    roomInspector: {
      enabled: isDevelopment,
      adminOnly: true,
      eventName: 'debug:inspectRoom',
      responseEvent: 'debug:roomData'
    },
    eventLogger: {
      enabled: isDevelopment,
      logLevel: isDevelopment ? 'debug' : 'error',
      includePayloads: isDevelopment,
      sanitizePayloads: true,
      eventName: 'debug:setLogLevel'
    },
    connectionTracer: {
      enabled: isDevelopment,
      traceConnections: isDevelopment,
      traceDisconnections: isDevelopment,
      traceReconnections: isDevelopment,
      eventName: 'debug:traceConnection'
    },
    replayTool: {
      enabled: isDevelopment,
      maxEventsToReplay: 100,
      eventName: 'debug:replayEvents',
      storageKey: 'ws_event_replay'
    }
  }
};

module.exports = websocketConfig;
