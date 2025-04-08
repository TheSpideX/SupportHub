import { AuthService } from "./AuthService";
import { TokenService } from "./TokenService";
import { SessionService } from "./SessionService";
import { SecurityService } from "./SecurityService";
import { PrimusAuthService, webSocketAuthService } from "./PrimusAuthService";
import { getAuthInstance, initAuth, isAuthInitialized } from "../init";

// Get or initialize auth services
export function getAuthServices() {
  if (isAuthInitialized()) {
    return getAuthInstance();
  }

  // Initialize with default config if not already initialized
  return initAuth({
    apiUrl: "/api",
    csrfProtection: true,
    sessionTimeout: 30 * 60 * 1000,
    refreshThreshold: 5 * 60 * 1000,
    enableCrossTabs: true,
    securityLevel: "medium",
  });
}

// Convenience method to get auth service
export function getAuthService(): AuthService {
  const services = getAuthServices();
  if (!services.authService) {
    throw new Error("Auth service not initialized");
  }
  return services.authService;
}

// Convenience method to get token service
export function getTokenService() {
  return getAuthServices().tokenService;
}

// Convenience method to get session service
export function getSessionService() {
  return getAuthServices().sessionService;
}

// Convenience method to get security service
export function getSecurityService() {
  return getAuthServices().securityService;
}

// Convenience method to get WebSocket auth service
export function getWebSocketAuthService() {
  return getAuthServices().webSocketAuthService;
}

// Export other convenience methods
export { isAuthInitialized };

// Export services directly
export { PrimusAuthService };

// For backward compatibility
export { webSocketAuthService };
