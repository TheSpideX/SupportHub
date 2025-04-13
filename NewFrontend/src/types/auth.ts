/**
 * Authentication Types
 *
 * This file contains all authentication-related type definitions.
 */

// Authentication event types
export enum AuthEventType {
  // Connection events
  CONNECTED = "auth:connected",
  DISCONNECTED = "auth:disconnected",
  RECONNECTING = "auth:reconnecting",
  FALLBACK_ACTIVATED = "auth:fallback_activated",
  RECOVERY_FAILED = "auth:recovery_failed",
  FALLBACK_FAILED = "auth:fallback_failed",
  OFFLINE_MODE = "auth:offline_mode",
  ONLINE_RESTORED = "auth:online_restored",

  // Authentication events
  AUTH_SUCCESS = "auth:success",
  AUTH_ERROR = "auth:error",
  AUTH_REQUIRED = "auth:required",

  // Token events
  TOKEN_REFRESHED = "token:refreshed",
  TOKEN_REFRESH_ERROR = "token:refresh_error",
  TOKEN_EXPIRING = "token:expiring",
  TOKENS_CLEARED = "tokens:cleared",

  // Session events
  SESSION_CREATED = "session:created",
  SESSION_UPDATED = "session:updated",
  SESSION_EXPIRED = "session:expired",
  SESSION_TERMINATED = "session:terminated",

  // Status events
  STATUS_CHANGED = "status:changed",

  // Cross-tab events
  LEADER_ELECTED = "leader:elected",
  LEADER_FAILED = "leader:failed",
  LEADER_HEARTBEAT = "leader:heartbeat",

  // Device events
  DEVICE_REGISTERED = "device:registered",
  DEVICE_REMOVED = "device:removed",
}

// Authentication status
export enum AuthStatus {
  INITIALIZING = "initializing",
  AUTHENTICATED = "authenticated",
  UNAUTHENTICATED = "unauthenticated",
  ERROR = "error",
}

// User session
export interface UserSession {
  id: string;
  userId: string;
  deviceId: string;
  tabId: string;
  createdAt: string;
  lastActivity: string;
  expiresAt: string;
  ipAddress: string;
  userAgent: string;
  isCurrentSession: boolean;
}

// Device information
export interface DeviceInfo {
  id: string;
  name: string;
  type: string;
  browser: string;
  os: string;
  lastActivity: string;
  sessions: UserSession[];
  isCurrentDevice: boolean;
}

// Authentication state
export interface AuthState {
  status: AuthStatus;
  user: any | null;
  error: string | null;
  isLoading: boolean;
  lastActivity: string | null;
  deviceId: string | null;
  tabId: string | null;
  isLeaderTab: boolean;
}

// Token information
export interface TokenInfo {
  accessToken: string | null;
  refreshToken: string | null;
  csrfToken: string | null;
  accessTokenExpiry: string | null;
  refreshTokenExpiry: string | null;
  tokenVersion: number;
}

// Authentication options
export interface AuthOptions {
  redirectUrl?: string;
  rememberMe?: boolean;
  deviceName?: string;
}

// Login credentials
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// Registration data
export interface RegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  agreeToTerms: boolean;
}

// Password reset request
export interface PasswordResetRequest {
  email: string;
}

// Password reset confirmation
export interface PasswordResetConfirmation {
  token: string;
  password: string;
  confirmPassword: string;
}

// Authentication response
export interface AuthResponse {
  success: boolean;
  message: string;
  user?: any;
  token?: TokenInfo;
  error?: string;
}

// Export default
export default {
  AuthEventType,
  AuthStatus,
};
