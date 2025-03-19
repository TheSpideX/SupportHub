// API Routes - Centralized endpoint definitions
// Import environment variables from a separate config file
import { API_CONFIG } from './api';

export const API_ROUTES = {
  BASE_URL: API_CONFIG.BASE_URL,
  
  // Auth endpoints
  AUTH: {
    // Authentication
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    LOGOUT: "/api/auth/logout",
    REFRESH_TOKEN: "/api/auth/refresh-token",
    
    // User information
    USER_INFO: "/api/auth/me",
    
    // Email verification
    VERIFY_EMAIL: "/api/auth/verify-email",
    RESEND_VERIFICATION: "/api/auth/resend-verification",
    
    // Two-factor authentication
    VERIFY_2FA: "/api/auth/verify-2fa",
    SETUP_2FA: "/api/auth/setup-2fa",
    DISABLE_2FA: "/api/auth/disable-2fa",
    GENERATE_BACKUP_CODES: "/api/auth/generate-backup-codes",
    
    // Password management
    FORGOT_PASSWORD: "/api/auth/forgot-password",
    RESET_PASSWORD: "/api/auth/reset-password",
    CHANGE_PASSWORD: "/api/auth/change-password",
    
    // Profile management
    UPDATE_PROFILE: "/api/auth/update-profile",
    
    // Session management
    VALIDATE_SESSION: "/api/auth/validate-session",
    SYNC_SESSION: "/api/auth/session/sync",
    GET_SESSIONS: "/api/auth/sessions",
    TERMINATE_SESSION: "/api/auth/sessions/terminate",
    TERMINATE_ALL_SESSIONS: "/api/auth/sessions/terminate-all",
    
    // Security
    CSRF_TOKEN: "/api/auth/csrf-token",
    VERIFY_DEVICE: "/api/auth/verify-device",
    REPORT_SECURITY_ISSUE: "/api/auth/report-security-issue"
  },
  
  // User management endpoints
  USERS: {
    BASE: "/api/users",
    GET_ALL: "/api/users",
    GET_BY_ID: (id: string) => `/api/users/${id}`,
    CREATE: "/api/users",
    UPDATE: (id: string) => `/api/users/${id}`,
    DELETE: (id: string) => `/api/users/${id}`,
    SEARCH: "/api/users/search"
  },
  
  // Health and status endpoints
  SYSTEM: {
    HEALTH: "/api/system/health",
    STATUS: "/api/system/status",
    VERSION: "/api/system/version"
  }
} as const;

// Extended API routes with dynamic path generation
export const EXTENDED_API_ROUTES = {
  ...API_ROUTES,
  AUTH: {
    ...API_ROUTES.AUTH,
    LOGOUT_EVERYWHERE: API_ROUTES.AUTH.TERMINATE_ALL_SESSIONS, // Use existing endpoint
    TERMINATE_SESSION: API_ROUTES.AUTH.TERMINATE_SESSION, // Use consistent naming
    TERMINATE_ALL_OTHER_SESSIONS: `${API_ROUTES.BASE_URL}/api/auth/sessions/terminate-others`, // Keep this unique endpoint
    GET_USER: API_ROUTES.AUTH.USER_INFO
  }
};

// Frontend application routes
export const APP_ROUTES = {
  ROOT: "/",
  
  // Authentication routes
  AUTH: {
    ROOT: "/auth",
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    FORGOT_PASSWORD: "/auth/forgot-password",
    RESET_PASSWORD: "/auth/reset-password",
    VERIFY_EMAIL: "/auth/verify-email",
    VERIFY_2FA: "/auth/verify-2fa",
    SETUP_2FA: "/auth/setup-2fa"
  },
  
  // Dashboard routes
  DASHBOARD: {
    ROOT: "/dashboard",
    OVERVIEW: "/dashboard/overview",
    PROFILE: "/dashboard/profile",
    SETTINGS: "/dashboard/settings",
    SECURITY: "/dashboard/security",
    SESSIONS: "/dashboard/sessions"
  },
  
  // Error pages
  ERRORS: {
    NOT_FOUND: "/404",
    FORBIDDEN: "/403",
    SERVER_ERROR: "/500",
    OFFLINE: "/offline"
  }
} as const;

// Route metadata for authorization and navigation
export const ROUTE_METADATA = {
  [APP_ROUTES.ROOT]: {
    requiresAuth: false,
    title: "Home",
    description: "Welcome to the application"
  },
  [APP_ROUTES.AUTH.LOGIN]: {
    requiresAuth: false,
    title: "Login",
    description: "Sign in to your account"
  },
  [APP_ROUTES.DASHBOARD.ROOT]: {
    requiresAuth: true,
    title: "Dashboard",
    description: "Your dashboard overview",
    requiredRoles: ["user", "admin"]
  },
  [APP_ROUTES.DASHBOARD.SETTINGS]: {
    requiresAuth: true,
    title: "Settings",
    description: "Manage your account settings",
    requiredRoles: ["user", "admin"]
  }
} as const;

// Type exports
export type ApiRoutes = typeof API_ROUTES;
export type AppRoutes = typeof APP_ROUTES;
export type RouteMetadata = typeof ROUTE_METADATA;
