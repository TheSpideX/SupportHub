import { z } from "zod";
import zxcvbn from 'zxcvbn';

// Add the missing loginSchema export
export const loginSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((val) => val.toLowerCase()),
  password: z
    .string()
    .min(1, "Password is required"),
  rememberMe: z
    .boolean()
    .default(false),
  deviceInfo: z
    .object({
      userAgent: z.string(),
      fingerprint: z.string(),
      location: z.object({
        country: z.string().optional(),
        city: z.string().optional(),
        ip: z.string().optional()
      }).optional().default({})
    })
    .optional()
});

export type LoginFormData = z.infer<typeof loginSchema>;

const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  minScore: 3, // zxcvbn uses 0-4 scale, requiring 3 for strong
};

const PASSWORD_FEEDBACK = {
  minLength: { valid: false, message: "At least 8 characters" },
  hasUppercase: { valid: false, message: "At least one uppercase letter" },
  hasLowercase: { valid: false, message: "At least one lowercase letter" },
  hasNumber: { valid: false, message: "At least one number" },
  hasSpecial: { valid: false, message: "At least one special character" },
};

export const getPasswordStrength = (password: string) => {
  const result = zxcvbn(password);
  return {
    score: result.score, // 0-4
    feedback: result.feedback,
  };
};

export const getPasswordFeedback = (password: string) => {
  return {
    minLength: { 
      valid: password.length >= PASSWORD_REQUIREMENTS.minLength,
      message: PASSWORD_FEEDBACK.minLength.message 
    },
    hasUppercase: { 
      valid: /[A-Z]/.test(password),
      message: PASSWORD_FEEDBACK.hasUppercase.message 
    },
    hasLowercase: { 
      valid: /[a-z]/.test(password),
      message: PASSWORD_FEEDBACK.hasLowercase.message 
    },
    hasNumber: { 
      valid: /[0-9]/.test(password),
      message: PASSWORD_FEEDBACK.hasNumber.message 
    },
    hasSpecial: { 
      valid: /[^A-Za-z0-9]/.test(password),
      message: PASSWORD_FEEDBACK.hasSpecial.message 
    },
  };
};

export const registrationSchema = z
  .object({
    email: z
      .string()
      .email("Invalid email address")
      .transform((val) => val.toLowerCase()),

    password: z
      .string()
      .min(PASSWORD_REQUIREMENTS.minLength, PASSWORD_FEEDBACK.minLength.message)
      .refine((password) => !/\s/.test(password), {
        message: "Password cannot contain spaces",
      })
      .refine((password) => /[A-Z]/.test(password), {
        message: PASSWORD_FEEDBACK.hasUppercase.message,
      })
      .refine((password) => /[a-z]/.test(password), {
        message: PASSWORD_FEEDBACK.hasLowercase.message,
      })
      .refine((password) => /[0-9]/.test(password), {
        message: PASSWORD_FEEDBACK.hasNumber.message,
      })
      .refine((password) => /[^A-Za-z0-9]/.test(password), {
        message: PASSWORD_FEEDBACK.hasSpecial.message,
      })
      .refine((password) => {
        const result = zxcvbn(password);
        return result.score >= PASSWORD_REQUIREMENTS.minScore;
      }, {
        message: 'Password must be stronger. Try making it longer or more complex.'
      }),

    confirmPassword: z.string(),

    firstName: z
      .string()
      .min(2, "First name is required")
      .max(50, "First name is too long")
      .regex(
        /^[a-zA-Z\s-]+$/,
        "First name can only contain letters, spaces, and hyphens"
      ),

    lastName: z
      .string()
      .min(2, "Last name is required")
      .max(50, "Last name is too long")
      .regex(
        /^[a-zA-Z\s-]+$/,
        "Last name can only contain letters, spaces, and hyphens"
      ),

    type: z.enum(["customer", "company", "company_employee"]),

    companyName: z
      .string()
      .min(2, "Company name is required")
      .max(100, "Company name is too long")
      .optional()
      .nullable(),

    inviteCode: z.string().min(6, "Invalid invite code").optional().nullable(),

    timezone: z
      .string()
      .default(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type RegistrationFormData = z.infer<typeof registrationSchema>;
