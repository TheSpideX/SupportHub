
export type UserRole = 'admin' | 'team_lead' | 'technical' | 'support' | 'customer';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  // ... other existing user properties
}

export interface LoginFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterFormData extends LoginFormData {
  name: string;
  role?: UserRole;
  companyCode?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError | null;
  sessionExpiry: number | null;
  rememberMe: boolean;
  twoFactorRequired: boolean;
  twoFactorVerified: boolean;
  isOffline: boolean;
  pendingSync: boolean;
}

export interface AuthError extends Error {
  code: 'INVALID_CREDENTIALS' | 'RATE_LIMITED' | 'NETWORK_ERROR' | 'SESSION_EXPIRED';
  details?: {
    remainingAttempts?: number;
    lockoutDuration?: number;
  };
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
  securityContext: SecurityContext;
  requiresTwoFactor?: boolean;
  twoFactorToken?: string;
}

export interface RegisterResponse {
  tokens: AuthTokens;
  user: User;
}

export type RegistrationType = 'company' | 'company_employee' | 'customer';

export interface TwoFactorVerificationData {
  code: string;
  token: string;
}

export interface PasswordStrength {
  score: number; // 0-4
  feedback: {
    warning: string;
    suggestions: string[];
  };
}

export interface RefreshTokenResponse {
  tokens: AuthTokens;
  error?: string;
}

export interface RegistrationData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  type: 'customer' | 'company' | 'company_employee';
  companyName?: string;
  inviteCode?: string;
}

export interface RegistrationResponse {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  requiresTwoFactor: boolean;
  twoFactorToken?: string;
}

export interface InviteCodeVerificationResponse {
  isValid: boolean;
  companyName?: string;
  role?: string;
  error?: string;
}
