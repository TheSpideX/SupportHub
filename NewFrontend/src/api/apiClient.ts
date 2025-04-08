import axios from "axios";
import { getTokenService } from "@/features/auth/services";
import { getSocketService } from "@/services/socket";
import { primusAuthService } from "@/features/auth/services/PrimusAuthService";

// Configure base URL to avoid duplication
const apiClient = axios.create({
  baseURL: "", // Remove any base URL here to prevent duplication
  timeout: 30000,
  withCredentials: true, // Important for cookies
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

// Add request interceptor for CSRF token
apiClient.interceptors.request.use(
  (config) => {
    // Get CSRF token from TokenService if available
    const tokenService = getTokenService();
    const csrfToken =
      tokenService.getCsrfToken() ||
      document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrf_token="))
        ?.split("=")[1];

    if (csrfToken) {
      config.headers["X-CSRF-Token"] = csrfToken;
    }

    // Add device and tab identifiers for session tracking
    // Try to get from socketService first for backward compatibility
    const socketService = getSocketService();
    if (socketService && typeof socketService.getDeviceId === "function") {
      config.headers["X-Device-ID"] = socketService.getDeviceId();
      config.headers["X-Tab-ID"] = socketService.getTabId();

      // Add leader status if this tab is the leader
      if (socketService.isLeaderTab()) {
        config.headers["X-Tab-Leader"] = "true";
      }
    } else {
      // Fallback to primusAuthService directly
      config.headers["X-Device-ID"] = primusAuthService.getDeviceId();
      config.headers["X-Tab-ID"] = primusAuthService.getTabId();

      // Add leader status if this tab is the leader
      if (primusAuthService.isLeader()) {
        config.headers["X-Tab-Leader"] = "true";
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle auth responses
apiClient.interceptors.response.use(
  (response) => {
    // If response contains CSRF token, store it
    if (response.data?.csrfToken) {
      const tokenService = getTokenService();
      tokenService.setCsrfToken(response.data.csrfToken);
    }

    // Handle session information if present
    if (response.data?.session || response.headers["x-session-expires-in"]) {
      const tokenService = getTokenService();
      const socketService = getSocketService();

      // Update session data
      if (response.data?.session) {
        tokenService.updateSessionData(response.data.session);
      }

      // Handle session expiration from headers
      const expiresIn = response.headers["x-session-expires-in"];
      if (expiresIn && socketService) {
        const expiresInMs = parseInt(expiresIn, 10) * 1000;
        socketService.updateSessionExpiration(expiresInMs);
      }
    }

    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 (Unauthorized) and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const socketService = getSocketService();

        // If we have a socket service and we're not the leader tab,
        // wait for the leader to refresh the token
        if (socketService && !socketService.isLeaderTab()) {
          await socketService.waitForTokenRefresh();
          // Retry the original request after token refresh
          return apiClient(originalRequest);
        }

        // Otherwise, this tab will handle the token refresh
        const tokenService = getTokenService();
        await tokenService.refreshToken();

        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // If refresh fails, redirect to login
        window.location.href = "/login?session=expired";
        return Promise.reject(refreshError);
      }
    }

    // Handle 403 (Forbidden) - possibly due to CSRF token issues
    if (
      error.response?.status === 403 &&
      error.response?.data?.message?.includes("CSRF")
    ) {
      // Try to get a new CSRF token and retry
      try {
        const tokenService = getTokenService();
        await tokenService.refreshCsrfToken();

        // Update the CSRF token in the original request
        originalRequest.headers["X-CSRF-Token"] = tokenService.getCsrfToken();

        // Retry the original request
        return apiClient(originalRequest);
      } catch (csrfError) {
        return Promise.reject(csrfError);
      }
    }

    return Promise.reject(error);
  }
);

export { apiClient };
