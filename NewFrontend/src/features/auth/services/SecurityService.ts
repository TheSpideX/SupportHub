/**
 * SecurityService
 *
 * Handles security-specific concerns including:
 * - Rate limiting detection
 * - XSS prevention
 * - Security context validation
 * - Suspicious activity detection
 * - Device fingerprinting
 */

import { logger } from "@/utils/logger";
import { TokenService } from "./TokenService";
import {
  createSecurityContext,
  getSecurityContext,
  setSecurityContext,
} from "../utils/storage.utils";
import {
  SecurityContext,
  AuthError,
  AUTH_ERROR_CODES,
} from "../types/auth.types";
import { authApi } from "../api/auth-api";

export interface SecurityServiceConfig {
  apiBaseUrl: string;
  securityEndpoint: string;
  fingerprintEndpoint: string;
  enableFingerprinting: boolean;
  enableLocationTracking: boolean;
  suspiciousActivityThreshold: number;
  maxFailedAttempts: number;
  lockoutDuration: number; // in milliseconds
  securityLevel: "low" | "medium" | "high";
}

const defaultConfig: SecurityServiceConfig = {
  apiBaseUrl: "/api",
  securityEndpoint: "/auth/security",
  fingerprintEndpoint: "/auth/fingerprint",
  enableFingerprinting: true,
  enableLocationTracking: true,
  suspiciousActivityThreshold: 3,
  maxFailedAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  securityLevel: "medium",
};

export class SecurityService {
  private config: SecurityServiceConfig;
  private tokenService: TokenService;
  private securityContext: SecurityContext | null = null;
  private failedAttempts: number = 0;
  private deviceFingerprint: string | null = null;
  private securityListeners: Array<(event: string, data?: any) => void> = [];

  constructor(
    config: Partial<SecurityServiceConfig> = {},
    tokenService: TokenService
  ) {
    this.config = { ...defaultConfig, ...config };
    this.tokenService = tokenService;

    // Initialize security context
    this.initSecurityContext();

    // Generate device fingerprint if enabled
    if (this.config.enableFingerprinting) {
      this.generateDeviceFingerprint();
    }

    logger.info("SecurityService initialized");
  }

  /**
   * Initialize security context
   */
  private async initSecurityContext(): Promise<void> {
    try {
      // Try to get existing security context
      const existingContext = getSecurityContext();

      if (existingContext) {
        this.securityContext = existingContext;
      } else {
        // Create new security context
        this.securityContext = await createSecurityContext();
        setSecurityContext(this.securityContext);
      }

      logger.info("Security context initialized");
    } catch (error) {
      logger.error("Failed to initialize security context:", error);
    }
  }

  /**
   * Generate device fingerprint
   */
  private async generateDeviceFingerprint(): Promise<void> {
    try {
      // In a real implementation, you would use a fingerprinting library
      // or make an API call to generate a fingerprint

      // For now, we'll use a simple random ID
      const buffer = new Uint8Array(16);
      window.crypto.getRandomValues(buffer);
      this.deviceFingerprint = Array.from(buffer)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      logger.info("Device fingerprint generated");
    } catch (error) {
      logger.error("Failed to generate device fingerprint:", error);
    }
  }

  /**
   * Validate security context
   */
  public async validateSecurityContext(): Promise<boolean> {
    try {
      if (!this.securityContext) {
        await this.initSecurityContext();
      }

      // Check if security context is valid
      if (!this.securityContext) {
        return false;
      }

      // Validate with server if online
      if (navigator.onLine) {
        const response = await authApi.validateSecurityContext({
          securityContext: this.securityContext,
          deviceFingerprint: this.deviceFingerprint,
        });

        return response.data.valid === true;
      }

      // If offline, do basic validation
      const now = Date.now();
      const lastVerified = this.securityContext.lastVerified || 0;

      // Context is valid if verified within the last 24 hours
      return now - lastVerified < 24 * 60 * 60 * 1000;
    } catch (error) {
      logger.error("Failed to validate security context:", error);
      return false;
    }
  }

  /**
   * Detect suspicious activity
   */
  public detectSuspiciousActivity(activity: any): boolean {
    try {
      // Implement suspicious activity detection logic
      // This is a simplified version

      if (!this.securityContext) {
        return true; // No context is suspicious
      }

      // Check for IP change
      if (
        activity.ipHash &&
        this.securityContext.ipHash &&
        activity.ipHash !== this.securityContext.ipHash
      ) {
        this.notifySecurityEvent("ip_change", {
          previous: this.securityContext.ipHash,
          current: activity.ipHash,
        });
        return true;
      }

      // Check for user agent change
      if (
        activity.userAgent &&
        this.securityContext.userAgent &&
        activity.userAgent !== this.securityContext.userAgent
      ) {
        this.notifySecurityEvent("user_agent_change", {
          previous: this.securityContext.userAgent,
          current: activity.userAgent,
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error("Failed to detect suspicious activity:", error);
      return false;
    }
  }

  /**
   * Handle failed authentication attempt
   */
  public handleFailedAttempt(): void {
    this.failedAttempts += 1;

    if (this.failedAttempts >= this.config.maxFailedAttempts) {
      this.notifySecurityEvent("multiple_failures", {
        attempts: this.failedAttempts,
      });

      // Implement lockout if needed
      if (this.config.securityLevel === "high") {
        this.implementLockout();
      }
    }
  }

  /**
   * Reset failed attempts counter
   */
  public resetFailedAttempts(): void {
    this.failedAttempts = 0;
  }

  /**
   * Implement account lockout
   */
  private implementLockout(): void {
    try {
      // Store lockout timestamp
      localStorage.setItem(
        "auth_lockout_until",
        (Date.now() + this.config.lockoutDuration).toString()
      );

      this.notifySecurityEvent("account_lockout", {
        duration: this.config.lockoutDuration,
      });
    } catch (error) {
      logger.error("Failed to implement lockout:", error);
    }
  }

  /**
   * Check if account is locked out
   */
  public isLockedOut(): boolean {
    try {
      const lockoutUntil = localStorage.getItem("auth_lockout_until");

      if (!lockoutUntil) {
        return false;
      }

      const lockoutTime = parseInt(lockoutUntil, 10);
      const now = Date.now();

      if (now >= lockoutTime) {
        // Lockout period has passed
        localStorage.removeItem("auth_lockout_until");
        return false;
      }

      return true;
    } catch (error) {
      logger.error("Failed to check lockout status:", error);
      return false;
    }
  }

  /**
   * Get remaining lockout time in milliseconds
   */
  public getRemainingLockoutTime(): number {
    try {
      const lockoutUntil = localStorage.getItem("auth_lockout_until");

      if (!lockoutUntil) {
        return 0;
      }

      const lockoutTime = parseInt(lockoutUntil, 10);
      const now = Date.now();

      return Math.max(0, lockoutTime - now);
    } catch (error) {
      logger.error("Failed to get remaining lockout time:", error);
      return 0;
    }
  }

  /**
   * Add security event listener
   */
  public addSecurityListener(
    listener: (event: string, data?: any) => void
  ): void {
    this.securityListeners.push(listener);
  }

  /**
   * Remove security event listener
   */
  public removeSecurityListener(
    listener: (event: string, data?: any) => void
  ): void {
    this.securityListeners = this.securityListeners.filter(
      (l) => l !== listener
    );
  }

  /**
   * Notify all security listeners of an event
   */
  private notifySecurityEvent(event: string, data?: any): void {
    this.securityListeners.forEach((listener) => {
      try {
        listener(event, data);
      } catch (error) {
        logger.error("Error in security listener:", error);
      }
    });

    // Also notify token service of security events
    this.tokenService.handleSecurityEvent(event, data);
  }

  /**
   * Sanitize user input to prevent XSS
   */
  public sanitizeInput(input: string): string {
    // Simple sanitization - in production use a proper library
    return input
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Validate request headers for security
   */
  public validateRequestHeaders(headers: Record<string, string>): boolean {
    // Check for required security headers
    if (!headers[this.tokenService.getConfig().csrfHeaderName]) {
      logger.warn("Missing CSRF token in request headers");
      return false;
    }

    // Additional header validations can be added here

    return true;
  }

  /**
   * Get security headers for requests
   */
  public getSecurityHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    // Add device fingerprint if available
    if (this.deviceFingerprint) {
      headers["X-Device-Fingerprint"] = this.deviceFingerprint;
    }

    return headers;
  }

  /**
   * Get the current security context
   */
  public getSecurityContext(): SecurityContext | null {
    return this.securityContext;
  }

  /**
   * Update the security context
   */
  public async updateSecurityContext(
    context: Partial<SecurityContext>
  ): Promise<void> {
    try {
      if (!this.securityContext) {
        this.securityContext = await createSecurityContext();
      }

      // Update security context with new values
      this.securityContext = {
        ...this.securityContext,
        ...context,
        lastVerified: Date.now(),
      };

      // Save updated context
      setSecurityContext(this.securityContext);

      logger.info("Security context updated");
    } catch (error) {
      logger.error("Failed to update security context:", error);
    }
  }

  /**
   * Get the current security level
   */
  public getSecurityLevel(): string {
    return this.config.securityLevel;
  }

  /**
   * Set the security level
   */
  public setSecurityLevel(level: "low" | "medium" | "high"): void {
    this.config.securityLevel = level;
    logger.info(`Security level set to: ${level}`);
  }

  /**
   * Checks if an action is rate limited
   */
  public isRateLimited(actionType: string): boolean {
    // In development mode, disable rate limiting
    if (import.meta.env.DEV) {
      return false;
    }

    // Implementation to check if the action is rate limited
    const attempts = this.getAttemptCount(actionType);
    const limit = this.getRateLimit(actionType);
    return attempts >= limit;
  }

  /**
   * Tracks a failed authentication attempt
   */
  public trackFailedAttempt(actionType: string, details?: any): void {
    // Implementation to track failed attempts
    this.failedAttempts += 1;
    this.notifySecurityEvent("failed_attempt", {
      type: actionType,
      details,
    });

    if (this.failedAttempts >= this.config.maxFailedAttempts) {
      this.handleFailedAttempt();
    }
  }

  // Helper methods
  private getAttemptCount(actionType: string): number {
    // Implementation to get attempt count
    return this.failedAttempts;
  }

  private getRateLimit(actionType: string): number {
    // Implementation to get rate limit based on action type
    switch (actionType) {
      case "login":
        return this.config.maxFailedAttempts;
      case "register":
        return this.config.maxFailedAttempts;
      case "passwordReset":
        return this.config.maxFailedAttempts;
      default:
        return 5; // Default limit
    }
  }

  /**
   * Subscribe to security events
   * @param listener Function to call when security events occur
   * @returns Unsubscribe function
   */
  public subscribe(
    listener: (event: string, payload?: any) => void
  ): () => void {
    this.securityListeners.push(listener);

    // Return unsubscribe function
    return () => {
      this.securityListeners = this.securityListeners.filter(
        (l) => l !== listener
      );
    };
  }

  /**
   * Refresh the security context
   * @returns Updated security context
   */
  public async refreshSecurityContext(): Promise<SecurityContext | null> {
    try {
      // Validate current context first
      const isValid = await this.validateSecurityContext();

      if (!isValid) {
        // Create a new context if current one is invalid
        const userId = this.tokenService.getUserId();
        const newContext = await createSecurityContext(userId || undefined);
        await setSecurityContext(newContext);
        this.securityContext = newContext;
        return newContext;
      }

      // Update last verified timestamp
      if (this.securityContext) {
        const updatedContext = {
          ...this.securityContext,
          lastVerified: Date.now(),
        };

        await setSecurityContext(updatedContext);
        this.securityContext = updatedContext;
        return updatedContext;
      }

      return null;
    } catch (error) {
      logger.error("Failed to refresh security context:", error);
      return null;
    }
  }

  /**
   * Report suspicious activity to the server
   * @param activity Details of suspicious activity
   * @returns Success status
   */
  public async reportSuspiciousActivity(activity: any): Promise<boolean> {
    try {
      // Log locally
      logger.warn("Suspicious activity reported:", activity);

      // Notify listeners
      this.notifySecurityEvent("suspicious_activity_reported", activity);

      // Report to server if online
      if (navigator.onLine) {
        const response = await authApi.reportSuspiciousActivity({
          ...activity,
          timestamp: Date.now(),
          deviceFingerprint: this.deviceFingerprint,
          securityContext: this.securityContext
            ? this.securityContext.id
            : null,
        });

        return response.status === 200;
      }

      return true;
    } catch (error) {
      logger.error("Failed to report suspicious activity:", error);
      return false;
    }
  }

  /**
   * Sync security context from storage
   * Updates the security context based on storage changes
   */
  public syncSecurityContextFromStorage(): void {
    try {
      const securityContextStr = localStorage.getItem("auth_security_context");
      if (securityContextStr) {
        const securityContext = JSON.parse(securityContextStr);
        this.setSecurityContext(securityContext);
        logger.debug("Security context synced from storage");
      }
    } catch (error) {
      logger.error("Failed to sync security context from storage", error);
    }
  }

  /**
   * Set security context
   * @param context The security context to set
   */
  private setSecurityContext(context: any): void {
    this.securityContext = context;
    // Additional logic for applying security context
  }

  /**
   * Get device fingerprint - exposed as public method for auth
   */
  public async getDeviceFingerprint(): Promise<string> {
    // If we already have a fingerprint, return it
    if (this.deviceFingerprint) {
      return this.deviceFingerprint;
    }

    // Otherwise generate a new one
    await this.generateDeviceFingerprint();
    return this.deviceFingerprint || "unknown-device";
  }

  /**
   * Get device information for security purposes
   * @returns Device information object
   */
  public async getDeviceInfo(): Promise<any> {
    try {
      // Collect basic device information
      const deviceInfo = {
        fingerprint: await this.generateDeviceFingerprint(),
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
      };

      return deviceInfo;
    } catch (error) {
      logger.error("Error getting device info:", error);
      // Return basic info if detailed collection fails
      return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      };
    }
  }
}
