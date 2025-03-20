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
    ip?: string;
  };
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    },
    session: {
      id: string;
      expiresAt: string;
    }
  };
  requiresTwoFactor?: boolean;
  twoFactorToken?: string;
}
