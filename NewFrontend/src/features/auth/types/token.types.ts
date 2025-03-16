export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  exp: number;
  iat: number;
  deviceId?: string;
  nonce?: string;
}

export interface TokenMetadata {
  issuedAt: number;
  expiresAt: number;
  deviceId: string;
  rotationCount: number;
  nonce: string;
  lastRotation?: number;
  issuer?: string;
}

export interface TokenRotationHistory {
  timestamp: number;
  deviceId: string;
  rotationCount: number;
  nonce: string;
  status: TokenRotationStatus;
}

export enum TokenRotationStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  COMPROMISED = 'COMPROMISED',
  FORCED = 'FORCED'
}

export interface TokenValidationResult {
  isValid: boolean;
  error?: TokenValidationError;
  metadata?: TokenMetadata;
}

export enum TokenValidationError {
  EXPIRED = 'TOKEN_EXPIRED',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  DEVICE_MISMATCH = 'DEVICE_MISMATCH',
  BLACKLISTED = 'TOKEN_BLACKLISTED',
  COMPROMISED = 'TOKEN_COMPROMISED',
  INVALID_ROTATION = 'INVALID_ROTATION_SEQUENCE',
  METADATA_MISMATCH = 'METADATA_MISMATCH'
}

export interface TokenEncryptionConfig {
  algorithm: 'AES-GCM';
  keyLength: 256;
  ivLength: 12;
}

export interface TokenStorageKeys {
  ACCESS_TOKEN: 'access_token';
  REFRESH_TOKEN: 'refresh_token';
  TOKEN_METADATA: 'token_metadata';
  ROTATION_HISTORY: 'token_rotation_history';
  TOKEN_NONCE: 'token_nonce';
}

export interface TokenSecurityEvent {
  type: TokenSecurityEventType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata?: TokenMetadata;
  timestamp?: number;
  details?: string;
}

export enum TokenSecurityEventType {
  TOKEN_COMPROMISE = 'TOKEN_COMPROMISE',
  INVALID_ROTATION = 'INVALID_ROTATION',
  DEVICE_MISMATCH = 'DEVICE_MISMATCH',
  MULTIPLE_FAILURES = 'MULTIPLE_FAILURES',
  FORCED_LOGOUT = 'FORCED_LOGOUT'
}

export interface TokenRefreshOptions {
  forceRotation?: boolean;
  validateDevice?: boolean;
  preserveMetadata?: boolean;
  rotationReason?: string;
}

export interface TokenBlacklistEntry {
  token: string;
  reason: string;
  timestamp: number;
  deviceId: string;
  metadata?: TokenMetadata;
}
