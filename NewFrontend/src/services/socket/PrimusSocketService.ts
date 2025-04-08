
// Event types that can be emitted by the socket service
export enum EventType {
  // Authentication events
  AUTH_SUCCESS = "auth:success",
  AUTH_ERROR = "auth:error",

  // Token events
  TOKEN_EXPIRING = "token:expiring",
  TOKEN_REFRESHED = "token:refreshed",
  TOKEN_INVALID = "token:invalid",
  TOKEN_REVOKED = "token:revoked",

  // Session events
  SESSION_TIMEOUT_WARNING = "session:timeout_warning",
  SESSION_TERMINATED = "session:terminated",
  SESSION_EXTENDED = "session:extended",

  // Security events
  SECURITY_ALERT = "security:alert",

  // Leader election events
  LEADER_ELECTED = "leader:elected",
  LEADER_HEARTBEAT = "leader:heartbeat"
}

// Room types for socket connections
export enum RoomType {
  USER = "user",
  DEVICE = "device",
  SESSION = "session",
  TAB = "tab"
}

export class PrimusSocketService {
  // ... rest of the class implementation
}

// Export the singleton instance
export const primusSocketService = new PrimusSocketService();

