/**
 * Authentication system types
 * Based on the auth-system-architecture using HTTP-only cookies
 */

// Extend Window interface to include securityService
declare global {
  interface Window {
    securityService?: {
      getDeviceFingerprint: () => Promise<string>;
      [key: string]: any;
    };
  }
}

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: string[];
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  ADMIN = "admin",
  CUSTOMER = "customer",
  SUPPORT = "support",
  TECHNICAL = "technical",
  TEAM_LEAD = "team_lead"
}

// Authentication state
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  user: User | null;
  error: AuthError | null;
  sessionExpiry?: number;
  twoFactorRequired?: boolean;
  emailVerificationRequired?: boolean;
  lastVerified: number | null;
}

// Storage types
export type StorageType =
  | "localStorage"
  | "sessionStorage"
  | "cookie"
  | "memory";

export interface StorageOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
  path?: string;
  domain?: string;
  maxAge?: number;
  encrypt?: boolean;
}

// Circuit breaker pattern
export interface CircuitBreakerState {
  status: "open" | "closed" | "half-open";
  failures: number;
  lastFailure: number;
  nextRetry: number;
}

// Token data
export interface TokenData {
  userId?: string;
  exp?: number;
  iat?: number;
  [key: string]: any;
}

// Session data
export interface SessionData {
  userId: string;
  expiresAt: number;
  createdAt: number;
  lastActivity: number;
  deviceInfo: {
    browser: string;
    os: string;
    deviceType: string;
  };
  id: string;
  securityContext?: SecurityContext;
  metadata?: {
    sessionId?: string;
    [key: string]: any;
  };
  metrics?: {
    [key: string]: any;
  };
  _source?: "server" | "tab" | "local"; // Track the origin of session data
}

// Offline auth queue
export interface OfflineAuthAction {
  type: "login" | "logout" | "refresh" | "update";
  payload: any;
  timestamp: number;
  id: string;
}

// Auth error
export interface AuthError {
  code: string;
  message: string;
  details?: any;
  retry?: boolean;
}

// Auth service interface
export interface AuthServiceInterface {
  login: (credentials: LoginCredentials) => Promise<User>;
  register: (data: RegistrationData) => Promise<void>;
  logout: (options?: { everywhere?: boolean }) => Promise<void>;
  refreshSession: () => Promise<void>;
  getUser: () => Promise<User | null>;
  verifyEmail: (token: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  setupTwoFactor: () => Promise<{ qrCode: string; backupCodes: string[] }>;
  verifyTwoFactor: (code: string) => Promise<void>;
  disableTwoFactor: (code: string) => Promise<void>;
  checkAuthStatus: () => Promise<boolean>;
}

// Token service interface
export interface TokenServiceInterface {
  getCsrfToken: () => Promise<string | null>;
  refreshCsrfToken: () => Promise<string | null>;
  isTokenExpired: () => boolean;
  getTokenExpiry: () => number | null;
}

// Session service interface
export interface SessionServiceInterface {
  startSessionTimer: () => void;
  stopSessionTimer: () => void;
  extendSession: () => Promise<void>;
  getSessionExpiry: () => number | null;
  terminateSession: (sessionId?: string) => Promise<void>;
  terminateAllOtherSessions: () => Promise<void>;
  getSessions: () => Promise<SessionInfo[]>;
}

// Session information
export interface SessionInfo {
  id: string;
  device: string;
  browser: string;
  ip: string;
  location?: string;
  lastActive: string;
  current: boolean;
}

// Auth events
export type AuthEventType =
  | "login:success"
  | "login:failure"
  | "logout"
  | "session:expired"
  | "token:refreshed"
  | "token:refresh:failed"
  | "security:violation"
  | "user:updated"
  | "cross-tab:sync";

export interface AuthEvent {
  type: AuthEventType;
  payload?: any;
  timestamp: number;
}

// Auth init options
export interface AuthInitOptions {
  apiUrl?: string;
  csrfProtection?: boolean;
  sessionTimeout?: number;
  refreshThreshold?: number;
  enableCrossTabs?: boolean;
  securityLevel?: SecurityLevel;
  errorHandling?: Partial<ErrorHandlingConfig>;
}

// Security level type
export type SecurityLevel = "low" | "medium" | "high";

// Error handling config
export interface ErrorHandlingConfig {
  retryStrategy: "none" | "linear" | "exponential";
  maxRetries: number;
  notificationLevel: "silent" | "user-friendly" | "detailed";
}

// User data
export interface UserData {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: string[];
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  profileImageUrl?: string;
  lastLoginAt?: string;
  preferences?: Record<string, any>;
}

// Security context
export interface SecurityContext {
  id: string;
  userId: string;
  createdAt: number;
  lastVerified: number;
  ipHash?: string;
  deviceFingerprint?: string;
  userAgent?: string;
  geoLocation?: GeoLocation;
  riskScore?: number;
  trustLevel?: "high" | "medium" | "low";
  lastActivity?: number;
}

// Geo location
export interface GeoLocation {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

// Session metadata type
export interface SessionMetadata {
  lastActivity: number;
  securityContext?: {
    deviceId?: string;
    ipHash?: string;
    userAgent?: string;
    lastVerified: number;
  };
}

// Add missing constants and functions
export enum AUTH_ERROR_CODES {
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  NETWORK_ERROR = "NETWORK_ERROR",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  RATE_LIMITED = "RATE_LIMITED",
  INVALID_TOKEN = "INVALID_TOKEN",
  REFRESH_FAILED = "REFRESH_FAILED",
  SESSION_INVALID = "SESSION_INVALID",
  UNKNOWN = "UNKNOWN",
  INITIALIZATION_FAILED = "INITIALIZATION_FAILED",
  LOGIN_FAILED = "LOGIN_FAILED",
  LOGOUT_FAILED = "LOGOUT_FAILED",
  REGISTRATION_FAILED = "REGISTRATION_FAILED",
  PASSWORD_RESET_FAILED = "PASSWORD_RESET_FAILED",
  USER_DATA_REFRESH_FAILED = "USER_DATA_REFRESH_FAILED",
  SECURITY_VIOLATION = "SECURITY_VIOLATION",
  USER_DATA_FETCH_FAILED = "USER_DATA_FETCH_FAILED",
  AUTH_REFRESH_FAILED = "AUTH_REFRESH_FAILED",
  SERVER_ERROR = "SERVER_ERROR",
}

// Add this interface to your auth.types.ts file
export interface TokenRefreshQueueItem {
  operation: () => Promise<any>;
  resolve?: (value: any) => void;
  reject?: (error: any) => void;
}

// Session status type
export type SessionStatus = "active" | "inactive" | "warning" | "expired";

// Add missing interfaces
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
  twoFactorCode?: string;
}

export interface RegistrationFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  type: "customer" | "company" | "company_employee";
  timezone: string;
  companyName?: string;
  inviteCode?: string;
  acceptTerms?: boolean;
}

export interface RegistrationData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  type: "customer" | "company" | "company_employee";
  timezone: string;
  companyName?: string;
  inviteCode?: string;
  acceptTerms?: boolean;
  securityContext?: {
    fingerprint?: string;
    userAgent?: string;
    location?: {
      country?: string;
      city?: string;
      ip?: string;
    };
  };
}

export interface PasswordResetData {
  email?: string;
  token?: string;
  newPassword?: string;
}

export interface SecurityEvent {
  id: string;
  type: string;
  timestamp: number;
  payload?: any; // Add this property to support event data
}
