import { passwordPolicy } from '../config/auth.config';
import zxcvbn from 'zxcvbn'; // Password strength library

// Basic validation patterns
const PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  USERNAME: /^[a-zA-Z0-9_-]{3,20}$/,
  PHONE: /^\+?[\d\s-]{10,15}$/,
  URL: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
  NO_SPECIAL_CHARS: /^[a-zA-Z0-9\s]+$/,
  PASSWORD: new RegExp(`^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{${passwordPolicy.minLength},}$`)
};

// Common validation errors
export const VALIDATION_ERRORS = {
  REQUIRED: 'This field is required',
  EMAIL_FORMAT: 'Please enter a valid email address',
  PASSWORD_REQUIREMENTS: `Password must be at least ${passwordPolicy.minLength} characters and include uppercase, lowercase, number, and special character`,
  PASSWORD_MATCH: 'Passwords do not match',
  USERNAME_FORMAT: 'Username must be 3-20 characters and may include letters, numbers, underscore and hyphen',
  PHONE_FORMAT: 'Please enter a valid phone number',
  URL_FORMAT: 'Please enter a valid URL',
  TOO_SHORT: (min: number) => `Must be at least ${min} characters`,
  TOO_LONG: (max: number) => `Must be less than ${max} characters`,
  INVALID_CHARS: 'Contains invalid characters'
};

// Email validation
export const validateEmail = (email: string): string | null => {
  if (!email) return VALIDATION_ERRORS.REQUIRED;
  if (!PATTERNS.EMAIL.test(email)) return VALIDATION_ERRORS.EMAIL_FORMAT;
  return null;
};

// Password validation with strength assessment
export const validatePassword = (password: string, options = { checkStrength: true }): string | null => {
  if (!password) return VALIDATION_ERRORS.REQUIRED;
  if (password.length < passwordPolicy.minLength) {
    return VALIDATION_ERRORS.TOO_SHORT(passwordPolicy.minLength);
  }
  if (!PATTERNS.PASSWORD.test(password)) {
    return VALIDATION_ERRORS.PASSWORD_REQUIREMENTS;
  }
  
  // Enhanced validation - check password strength if requested
  if (options.checkStrength && getPasswordStrength(password).score < 3) {
    return 'Password is too weak. Try adding more characters or using a mix of character types.';
  }
  
  return null;
};

// Username validation
export const validateUsername = (username: string): string | null => {
  if (!username) return VALIDATION_ERRORS.REQUIRED;
  if (!PATTERNS.USERNAME.test(username)) return VALIDATION_ERRORS.USERNAME_FORMAT;
  return null;
};

// Phone number validation
export const validatePhone = (phone: string): string | null => {
  if (!phone) return null; // Phone might be optional
  if (!PATTERNS.PHONE.test(phone)) return VALIDATION_ERRORS.PHONE_FORMAT;
  return null;
};

// Password confirmation validation
export const validatePasswordConfirmation = (password: string, confirmation: string): string | null => {
  if (!confirmation) return VALIDATION_ERRORS.REQUIRED;
  if (password !== confirmation) return VALIDATION_ERRORS.PASSWORD_MATCH;
  return null;
};

// URL validation
export const validateUrl = (url: string): string | null => {
  if (!url) return null; // URL might be optional
  if (!PATTERNS.URL.test(url)) return VALIDATION_ERRORS.URL_FORMAT;
  return null;
};

// Two-factor authentication code validation
export const validateTwoFactorCode = (code: string): string | null => {
  if (!code) return VALIDATION_ERRORS.REQUIRED;
  if (!/^\d{6}$/.test(code)) return 'Code must be 6 digits';
  return null;
};

// Password strength calculation (returns score 0-4 and feedback)
export const getPasswordStrength = (password: string): { score: number; feedback: string } => {
  const result = zxcvbn(password);
  
  const feedbackMessages = {
    0: 'Very weak - easily guessable',
    1: 'Weak - vulnerable to dictionary attacks',
    2: 'Fair - could be stronger',
    3: 'Good - strong password',
    4: 'Excellent - very strong password'
  };
  
  return {
    score: result.score,
    feedback: result.feedback.warning || feedbackMessages[result.score as keyof typeof feedbackMessages] || ''
  };
};

// Check if password is common/breached (would connect to API in production)
export const isPasswordBreached = async (password: string): Promise<boolean> => {
  // In a real implementation, this would check against a breached password API
  // using a k-anonymity model (sending only partial hash)
  // For demo purposes, we'll just check against a small list of common passwords
  const commonPasswords = [
    'password123', 'qwerty123', '123456789', 'admin123', 'welcome1'
  ];
  
  return commonPasswords.includes(password);
};

// Form validation for login
export const validateLoginForm = (values: { email: string; password: string }): Record<string, string> => {
  const errors: Record<string, string> = {};
  
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  
  const passwordError = validatePassword(values.password, { checkStrength: false });
  if (passwordError) errors.password = passwordError;
  
  return errors;
};

// Form validation for registration
export const validateRegistrationForm = (values: {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  phone?: string;
}): Record<string, string> => {
  const errors: Record<string, string> = {};
  
  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;
  
  const usernameError = validateUsername(values.username);
  if (usernameError) errors.username = usernameError;
  
  const passwordError = validatePassword(values.password);
  if (passwordError) errors.password = passwordError;
  
  const confirmError = validatePasswordConfirmation(values.password, values.confirmPassword);
  if (confirmError) errors.confirmPassword = confirmError;
  
  if (values.phone) {
    const phoneError = validatePhone(values.phone);
    if (phoneError) errors.phone = phoneError;
  }
  
  return errors;
};

// Form validation for password reset
export const validatePasswordResetForm = (values: {
  password: string;
  confirmPassword: string;
}): Record<string, string> => {
  const errors: Record<string, string> = {};
  
  const passwordError = validatePassword(values.password);
  if (passwordError) errors.password = passwordError;
  
  const confirmError = validatePasswordConfirmation(values.password, values.confirmPassword);
  if (confirmError) errors.confirmPassword = confirmError;
  
  return errors;
};

// Form validation for two-factor authentication
export const validateTwoFactorForm = (values: { code: string }): Record<string, string> => {
  const errors: Record<string, string> = {};
  
  const codeError = validateTwoFactorCode(values.code);
  if (codeError) errors.code = codeError;
  
  return errors;
};

// Validate security questions
export const validateSecurityQuestion = (question: string, answer: string): string | null => {
  if (!question) return 'Please select a security question';
  if (!answer) return VALIDATION_ERRORS.REQUIRED;
  if (answer.length < 2) return VALIDATION_ERRORS.TOO_SHORT(2);
  return null;
};

// Real-time validation for password strength meter
export interface PasswordStrengthResult {
  score: number;
  feedback: string;
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
}

export const analyzePasswordStrength = (password: string): PasswordStrengthResult => {
  const strength = getPasswordStrength(password);
  
  return {
    score: strength.score,
    feedback: strength.feedback,
    requirements: {
      minLength: password.length >= passwordPolicy.minLength,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[@$!%*?&]/.test(password)
    }
  };
};