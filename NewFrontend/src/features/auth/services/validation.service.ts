import { z } from "zod";

// Registration schema with Zod
export const registrationSchema = z.object({
  firstName: z.string()
    .min(2, "First name must be at least 2 characters")
    .max(30, "First name cannot exceed 30 characters"),
  lastName: z.string()
    .min(2, "Last name must be at least 2 characters")
    .max(30, "Last name cannot exceed 30 characters"),
  email: z.string()
    .email("Please enter a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[@$!%*?&]/, "Password must contain at least one special character"),
  type: z.enum(["customer", "company", "company_employee"]),
  timezone: z.string(),
  // Optional fields based on registration type
  companyName: z.string()
    .min(2, "Company name must be at least 2 characters")
    .max(100, "Company name cannot exceed 100 characters")
    .optional(),
  inviteCode: z.string()
    .min(6, "Invite code must be at least 6 characters")
    .optional(),
})
.refine(data => {
  // Company name is required for company registration
  if (data.type === "company" && !data.companyName) {
    return false;
  }
  return true;
}, {
  message: "Company name is required",
  path: ["companyName"]
})
.refine(data => {
  // Invite code is required for company employee registration
  if (data.type === "company_employee" && !data.inviteCode) {
    return false;
  }
  return true;
}, {
  message: "Invite code is required",
  path: ["inviteCode"]
});

// Define the type based on the schema
export type RegistrationFormData = z.infer<typeof registrationSchema>;

// Login schema with enhanced validation
export const loginSchema = z.object({
  email: z.string()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .trim()
    .toLowerCase(),
  password: z.string()
    .min(1, "Password is required"),
  rememberMe: z.boolean().default(false),
  deviceInfo: z.object({
    fingerprint: z.string().optional(),
    userAgent: z.string().optional(),
    ip: z.string().optional()
  }).optional().default({})
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Two-factor authentication schema
export const twoFactorSchema = z.object({
  code: z.string()
    .min(6, "Code must be at least 6 characters")
    .max(6, "Code cannot exceed 6 characters")
    .regex(/^\d+$/, "Code must contain only numbers"),
  twoFactorToken: z.string()
});

export type TwoFactorFormData = z.infer<typeof twoFactorSchema>;

// Password reset request schema
export const passwordResetRequestSchema = z.object({
  email: z.string()
    .email("Please enter a valid email address")
    .trim()
    .toLowerCase()
});

export type PasswordResetRequestData = z.infer<typeof passwordResetRequestSchema>;

// Password reset schema
export const passwordResetSchema = z.object({
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[@$!%*?&]/, "Password must contain at least one special character"),
  confirmPassword: z.string()
    .min(1, "Please confirm your password"),
  token: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export type PasswordResetData = z.infer<typeof passwordResetSchema>;
