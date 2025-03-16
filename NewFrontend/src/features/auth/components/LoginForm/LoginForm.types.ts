export interface LoginFormProps {
  setIsLogin: (value: boolean) => void;
  handleSocialLogin: (provider: string) => void;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    name: string;
  };
}