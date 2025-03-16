// API Routes Configuration
// export const API_ROUTES = {
//   AUTH: {
//     LOGIN: '/api/auth/login',
//     LOGOUT: '/api/auth/logout',
//     REFRESH_TOKEN: '/api/auth/refresh-token',
//     VALIDATE_SESSION: '/api/auth/validate-session',
//     REGISTER: '/api/auth/register',
//     FORGOT_PASSWORD: '/api/auth/forgot-password',
//     RESET_PASSWORD: '/api/auth/reset-password',
//   },
//   USER: {
//     PROFILE: '/api/user/profile',
//     UPDATE_PROFILE: '/api/user/profile/update',
//     CHANGE_PASSWORD: '/api/user/change-password',
//   },
//   SECURITY: {
//     VALIDATE_DEVICE: '/api/security/validate-device',
//     REPORT_INCIDENT: '/api/security/report-incident',
//     VERIFY_2FA: '/api/security/verify-2fa',
//   }
// } as const;

export const API_ROUTES = {
  BASE_URL: import.meta.env.VITE_API_URL || "http://localhost:4290",
  AUTH: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    LOGOUT: "/api/auth/logout",
    REFRESH_TOKEN: "/api/auth/refresh-token",
    USER_INFO: "/api/auth/me", // This should match the backend endpoint
    VERIFY_EMAIL: "/api/auth/verify-email",
    FORGOT_PASSWORD: "/api/auth/forgot-password",
    RESET_PASSWORD: "/api/auth/reset-password",
    EXTEND_SESSION: "/api/auth/extend-session",
    SYNC_SESSION: "/api/auth/sync-session",
    VALIDATE_SESSION: "/api/auth/validate-session",
    CSRF_TOKEN: "/api/auth/csrf-token",
    VERIFY_DEVICE: "/api/auth/verify-device",
    SECURITY_CONTEXT: "/api/auth/security-context"
  },
};

// Frontend Routes Configuration
export const APP_ROUTES = {
  // Auth Routes
  AUTH: {
    ROOT: "/auth",
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    FORGOT_PASSWORD: "/auth/forgot-password",
    RESET_PASSWORD: "/auth/reset-password",
    VERIFY_2FA: "/auth/verify-2fa",
  },
  // Dashboard Routes
  DASHBOARD: {
    ROOT: "/dashboard",
    OVERVIEW: "/dashboard/overview",
    ANALYTICS: "/dashboard/analytics",
  },
  // User Routes
  USER: {
    PROFILE: "/user/profile",
    SETTINGS: "/user/settings",
    PREFERENCES: "/user/preferences",
  },
  // Error Pages
  ERROR: {
    NOT_FOUND: "/404",
    FORBIDDEN: "/403",
    SERVER_ERROR: "/500",
  },
  // Common Routes
  COMMON: {
    HOME: "/",
    LANDING: "/landing",
  },
} as const;

// Route Guards Configuration
export const ROUTE_GUARDS = {
  PUBLIC_ONLY: ["AUTH.LOGIN", "AUTH.REGISTER", "AUTH.FORGOT_PASSWORD"],
  PROTECTED: ["DASHBOARD.ROOT", "USER.PROFILE", "USER.SETTINGS"],
  ADMIN_ONLY: ["DASHBOARD.ANALYTICS"],
} as const;

// Route Metadata
export const ROUTE_META = {
  [APP_ROUTES.DASHBOARD.ROOT]: {
    title: "Dashboard",
    requiresAuth: true,
    layout: "dashboard",
  },
  [APP_ROUTES.AUTH.LOGIN]: {
    title: "Login",
    requiresAuth: false,
    layout: "auth",
  },
  // Add more route metadata as needed
} as const;

// Type Exports
export type ApiRoutes = typeof API_ROUTES;
export type AppRoutes = typeof APP_ROUTES;
export type RouteGuards = typeof ROUTE_GUARDS;
export type RouteMeta = typeof ROUTE_META;

// Helper function to get route metadata
export const getRouteMeta = (
  path: string
): (typeof ROUTE_META)[keyof typeof ROUTE_META] | undefined => {
  return ROUTE_META[path as keyof typeof ROUTE_META];
};

// Helper function to check if route requires authentication
export const requiresAuth = (path: string): boolean => {
  return getRouteMeta(path)?.requiresAuth ?? false;
};
