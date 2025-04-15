// API Routes - Centralized endpoint definitions
// Import environment variables from a separate config file
import { API_CONFIG } from "./api";

export const API_ROUTES = {
  BASE_URL: API_CONFIG.BASE_URL,

  // Auth endpoints
  AUTH: {
    // Core authentication
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    LOGOUT: "/api/auth/logout",

    // Auth status & user info
    STATUS: "/api/auth/status",
    USER_INFO: "/api/auth/me",

    // Email verification
    VERIFY_EMAIL: "/api/auth/verify-email",
    RESEND_VERIFICATION: "/api/auth/resend-verification",

    // Token management
    REFRESH_TOKEN: "/api/auth/token/refresh",
    CSRF_TOKEN: "/api/auth/token/csrf",
    WS_AUTH_TOKEN: "/api/auth/token/ws-auth",

    // Session management
    VALIDATE_SESSION: "/api/auth/session",
    ACTIVE_SESSIONS: "/api/auth/session/active",
    TERMINATE_SESSION: (sessionId: string) => `/api/auth/session/${sessionId}`,
    TERMINATE_ALL_SESSIONS: "/api/auth/session/terminate-all",
    SESSION_HEARTBEAT: "/api/auth/session/heartbeat",

    // Tab management (WebSocket fallbacks)
    REGISTER_TAB: "/api/auth/register-tab",
    UNREGISTER_TAB: "/api/auth/unregister-tab",
    TAB_ACTIVITY: "/api/auth/session/tab-activity",
    TAB_FOCUS: "/api/auth/session/tab-focus",
    SYNC_STATE: "/api/auth/sync-state",
    POLL_STATE: "/api/auth/poll-state",

    // Device management
    REGISTER_DEVICE: "/api/auth/session/devices",
    UPDATE_DEVICE: (deviceId: string) =>
      `/api/auth/session/devices/${deviceId}`,
    VERIFY_DEVICE: "/api/auth/verify-device",

    // User profile management
    GET_PROFILE: "/api/auth/user/profile",
    UPDATE_PROFILE: "/api/auth/user/profile",
    GET_PREFERENCES: "/api/auth/user/preferences",
    UPDATE_PREFERENCES: "/api/auth/user/preferences",

    // Password management
    CHANGE_PASSWORD: "/api/auth/user/password",
    FORGOT_PASSWORD: "/api/auth/forgot-password",
    RESET_PASSWORD: "/api/auth/reset-password",

    // Two-factor authentication
    SETUP_2FA: "/api/auth/security/2fa/setup",
    VERIFY_2FA_SETUP: "/api/auth/security/2fa/verify-setup",
    DISABLE_2FA: "/api/auth/security/2fa/disable",
    VERIFY_2FA: "/api/auth/verify-2fa",
    GENERATE_BACKUP_CODES: "/api/auth/security/2fa/backup-codes",

    // Security settings
    SECURITY_SETTINGS: "/api/auth/security/settings",

    // Permissions
    GET_PERMISSIONS: "/api/auth/permissions",

    // System
    HEALTH: "/api/auth/health",
  },

  // User management endpoints
  USERS: {
    BASE: "/api/users",
    GET_ALL: "/api/users",
    GET_BY_ID: (id: string) => `/api/users/${id}`,
    CREATE: "/api/users",
    UPDATE: (id: string) => `/api/users/${id}`,
    DELETE: (id: string) => `/api/users/${id}`,
    SEARCH: "/api/users/search",
    BY_IDS: "/api/users/by-ids",
    CHANGE_STATUS: (id: string) => `/api/users/${id}/status`,
    RESET_PASSWORD: (id: string) => `/api/users/${id}/reset-password`,
  },

  // Customer management endpoints
  CUSTOMERS: {
    BASE: "/api/customers",
    GET_ALL: "/api/customers",
    GET_BY_ID: (id: string) => `/api/customers/${id}`,
    CREATE: "/api/customers",
    UPDATE: (id: string) => `/api/customers/${id}`,
    DELETE: (id: string) => `/api/customers/${id}`,
    CHANGE_STATUS: (id: string) => `/api/customers/${id}/status`,
  },

  // Team management endpoints
  TEAMS: {
    BASE: "/api/teams",
    GET_ALL: "/api/teams",
    GET_BY_ID: (id: string) => `/api/teams/${id}`,
    CREATE: "/api/teams",
    UPDATE: (id: string) => `/api/teams/${id}`,
    DELETE: (id: string) => `/api/teams/${id}`,
    MY_TEAMS: "/api/teams/my-teams",
    MEMBERSHIP: (id: string) => `/api/teams/${id}/membership`,
    ADD_MEMBER: (id: string) => `/api/teams/${id}/members`,
    REMOVE_MEMBER: (id: string, memberId: string) =>
      `/api/teams/${id}/members/${memberId}`,
    CHANGE_LEAD: (id: string) => `/api/teams/${id}/lead`,
    CREATE_INVITATION: (teamId: string) => `/api/teams/${teamId}/invitations`,
    GET_INVITATIONS: (teamId: string) => `/api/teams/${teamId}/invitations`,
  },

  // Invitation endpoints
  INVITATIONS: {
    VERIFY: (code: string) => `/api/invitations/verify/${code}`,
    ACCEPT: (code: string) => `/api/invitations/accept/${code}`,
    REVOKE: (id: string) => `/api/invitations/${id}`,
    RESEND: (id: string) => `/api/invitations/${id}/resend`,
    MY_INVITATIONS: "/api/invitations/my-invitations",
  },

  // Health and status endpoints
  SYSTEM: {
    HEALTH: "/api/system/health",
    STATUS: "/api/system/status",
    VERSION: "/api/system/version",
    INCIDENTS: "/api/system/incidents",
    METRICS: "/api/system/metrics",
  },
} as const;

// Extended API routes with dynamic path generation
export const EXTENDED_API_ROUTES = {
  ...API_ROUTES,
  AUTH: {
    ...API_ROUTES.AUTH,
    LOGOUT_EVERYWHERE: "/api/auth/logout/all",
    TERMINATE_ALL_OTHER_SESSIONS: "/api/auth/session/terminate-others",
  },
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
    SETUP_2FA: "/auth/setup-2fa",
  },

  // Dashboard routes
  DASHBOARD: {
    ROOT: "/dashboard",
    OVERVIEW: "/dashboard/overview",
    PROFILE: "/dashboard/profile",
    SETTINGS: "/dashboard/settings",
    SECURITY: "/dashboard/security",
    SESSIONS: "/dashboard/sessions",
  },

  // Team management routes
  TEAMS: {
    ROOT: "/teams",
    LIST: "/teams",
    DETAIL: (id: string) => `/teams/${id}`,
    CREATE: "/teams/create",
    EDIT: (id: string) => `/teams/${id}/edit`,
    MEMBERS: (id: string) => `/teams/${id}/members`,
    INVITATIONS: (id: string) => `/teams/${id}/invitations`,
  },

  // Invitation routes
  INVITATIONS: {
    ACCEPT: (code: string) => `/invitations/accept/${code}`,
    MY_INVITATIONS: "/invitations",
  },

  // Admin routes
  ADMIN: {
    ROOT: "/admin",
    DASHBOARD: "/admin/dashboard",
    TEAM_MANAGEMENT: "/admin/team-management",
    USER_MANAGEMENT: "/admin/user-management",
    CUSTOMER_MANAGEMENT: "/admin/customer-management",
    SYSTEM_STATUS: "/admin/system-status",
  },

  // Error pages
  ERRORS: {
    NOT_FOUND: "/404",
    FORBIDDEN: "/403",
    SERVER_ERROR: "/500",
    OFFLINE: "/offline",
  },
} as const;

// Route metadata for authorization and navigation
export const ROUTE_METADATA = {
  [APP_ROUTES.ROOT]: {
    requiresAuth: false,
    title: "Home",
    description: "Welcome to the application",
  },
  [APP_ROUTES.AUTH.LOGIN]: {
    requiresAuth: false,
    title: "Login",
    description: "Sign in to your account",
  },
  [APP_ROUTES.DASHBOARD.ROOT]: {
    requiresAuth: true,
    title: "Dashboard",
    description: "Your dashboard overview",
    requiredRoles: ["user", "admin"],
  },
  [APP_ROUTES.DASHBOARD.SETTINGS]: {
    requiresAuth: true,
    title: "Settings",
    description: "Manage your account settings",
    requiredRoles: ["user", "admin"],
  },
} as const;

// Type exports
export type ApiRoutes = typeof API_ROUTES;
export type AppRoutes = typeof APP_ROUTES;
export type RouteMetadata = typeof ROUTE_METADATA;
