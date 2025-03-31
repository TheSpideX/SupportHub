/**
 * Event names constants
 */
const EVENT_NAMES = {
  // Cross-tab coordination events
  LEADER_ELECTION: "leader:election",
  LEADER_ELECTED: "leader:elected",
  LEADER_HEARTBEAT: "leader:heartbeat",
  LEADER_TRANSFER: "leader:transfer",
  LEADER_TRANSFERRED: "leader:transferred",
  LEADER_FAILED: "leader:failed",

  // User presence events
  USER_ONLINE: "user:online",
  USER_OFFLINE: "user:offline",
  USER_IDLE: "user:idle",
  USER_ACTIVE: "user:active",

  // Tab visibility events
  TAB_VISIBLE: "tab:visible",
  TAB_HIDDEN: "tab:hidden",

  // Session events
  SESSION_CREATED: "session:created",
  SESSION_UPDATED: "session:updated",
  SESSION_DELETED: "session:deleted",
  SESSION_TERMINATED: "session:terminated",
  SESSION_TIMEOUT_WARNING: "session:timeout_warning",

  // Token events
  TOKEN_UPDATED: "auth:token:updated",
  TOKEN_INVALIDATED: "auth:token:invalidated",
  TOKEN_ERROR: "auth:token:error",
  TOKEN_REFRESH_NOTIFICATION: "auth:token:refresh:notification",
  TOKEN_REFRESH: "token:refresh",
  TOKEN_EXPIRED: "token:expired",
  TOKEN_EXPIRING: "token:expiring",
  TOKEN_REFRESHED: "token:refreshed",

  // Cross-device synchronization events
  DEVICE_STATE_SYNC_REQUEST: "auth:device:state:sync:request",
  DEVICE_STATE_SYNC: "auth:device:state:sync",
  DEVICE_STATE_UPDATE: "auth:device:state:updated",
  DEVICE_STATE_UPDATED: "auth:device:state:updated:notification",
  DEVICE_CONNECTED: "device:connected",
  DEVICE_DISCONNECTED: "device:disconnected",
  DEVICE_VERIFIED: "device:verified",
  DEVICE_UNVERIFIED: "device:unverified",
  DEVICE_SUSPICIOUS: "device:suspicious",

  // Authentication events
  AUTH_SUCCESS: "auth:success",
  AUTH_FAILURE: "auth:failure",
  AUTH_REQUIRED: "auth:required",

  // Security events
  SECURITY_ALERT: "security:alert",
  SECURITY_LOCKOUT: "security:lockout",
  SECURITY_BREACH: "security:breach",

  // Room events
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  ROOM_UPDATE: "room:update",
  ROOM_JOINED: "room:joined",
  ROOM_JOIN_FAILED: "room:join:failed",

  // Error events
  ERROR_CONNECTION: "error:connection",
  ERROR_AUTHENTICATION: "error:authentication",
  ERROR_ROOM: "error:room",
  ERROR_TOKEN: "error:token",
  ERROR_GENERAL: "error:general"
};

/**
 * Socket.IO room name prefixes
 */
const ROOM_PREFIXES = {
  USER: "user:",
  DEVICE: "device:",
  SESSION: "session:",
  TAB: "tab:"
};

module.exports = { EVENT_NAMES, ROOM_PREFIXES };
