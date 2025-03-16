export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface IAuthError {
  code: AuthErrorCode;
  message: string;
  details?: {
    remainingAttempts?: number;
    lockoutDuration?: number;
    redirectPath?: string;
    requiresAction?: boolean;
  };
}

export type AuthErrorCode = 
  | 'INVALID_CREDENTIALS'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'SESSION_EXPIRED'
  | 'DEVICE_NOT_TRUSTED'
  | 'MFA_REQUIRED'
  | 'ACCOUNT_LOCKED'
  | 'SECURITY_CHECK_FAILED'
  | 'TOKEN_EXPIRED'
  | 'INVALID_TOKEN'
  | 'DEVICE_CHANGED'
  | 'LOCATION_CHANGED'
  | 'CONCURRENT_SESSION'
  | 'INVALID_MFA_CODE'
  | 'PASSWORD_EXPIRED';

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
  deviceInfo: DeviceInfo; // Make deviceInfo required, not optional
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
  securityContext: SecurityContext;
  requiresTwoFactor?: boolean;
  twoFactorToken?: string;
}

export interface SecurityContext {
  deviceTrusted: boolean;
  requiresAction: boolean;
  lastLogin?: Date;
  location?: LocationInfo;
}

export interface DeviceInfo {
  fingerprint: string;
  userAgent: string;
  ip?: string;
  location?: LocationInfo;
}

export interface LocationInfo {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

export interface User {
  id: string;
  email: string;
  role: string;
  status: UserStatus;
  securitySettings: SecuritySettings;
}

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'PENDING_VERIFICATION';

export interface SecuritySettings {
  mfaEnabled: boolean;
  trustedDevices: string[];
  lastPasswordChange: Date;
  loginAttempts: number;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: User;
  tokens: Tokens;
}

export interface Session {
  user: User;
  lastActivity: number;
  deviceInfo: {
    userAgent: string;
    platform: string;
    language: string;
    screenResolution: string;
  };
}
