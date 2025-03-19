export interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void>;
  isLoading: boolean;
}

export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
  deviceInfo?: {
    fingerprint?: string;
    userAgent?: string;
    screenResolution?: string;
    timezone?: string;
    location?: {
      country?: string;
      city?: string;
      ip?: string;
    };
  };
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

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    role: string;
    name: string;
    preferences?: Record<string, any>;
  };
  securityContext?: {
    lastLogin: string;
    deviceInfo: any;
    sessionId: string;
    sessionExpiresAt: string;
  };
  requiresTwoFactor?: boolean;
  twoFactorToken?: string;
}
