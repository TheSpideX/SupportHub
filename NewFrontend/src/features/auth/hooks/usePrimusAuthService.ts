/**
 * usePrimusAuthService Hook
 *
 * Provides access to the PrimusAuthService singleton instance
 * Only connects to WebSocket when user is authenticated
 */

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { PrimusAuthService } from "../services/PrimusAuthService";
import { useTokenService } from "./useTokenService";
import { SecurityService } from "../services/SecurityService";
import { selectIsAuthenticated } from "../store";
import { logger } from "@/utils/logger";

// Create a singleton instance of SecurityService
let securityServiceInstance: SecurityService | null = null;

// Create a singleton instance of PrimusAuthService
let primusAuthServiceInstance: PrimusAuthService | null = null;

export const usePrimusAuthService = (): PrimusAuthService | null => {
  const tokenService = useTokenService();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const [primusService, setPrimusService] = useState<PrimusAuthService | null>(
    primusAuthServiceInstance
  );

  // Initialize the service
  useEffect(() => {
    // Skip if TokenService is not available
    if (!tokenService) {
      logger.debug("TokenService not available yet", {
        component: "usePrimusAuthService",
      });
      return;
    }

    // Delay initialization to ensure TokenService is fully initialized
    const initTimer = setTimeout(() => {
      try {
        // Initialize SecurityService if not already done
        if (!securityServiceInstance) {
          securityServiceInstance = new SecurityService();
        }

        // Initialize PrimusAuthService if not already done
        if (!primusAuthServiceInstance) {
          // Create a proxy for TokenService to handle missing methods
          const tokenServiceProxy = new Proxy(tokenService, {
            get: (target, prop) => {
              if (prop === "getCsrfToken") {
                return function () {
                  if (typeof target.getCsrfToken === "function") {
                    return target.getCsrfToken();
                  } else {
                    logger.warn(
                      "TokenService.getCsrfToken is not available, using fallback",
                      { component: "usePrimusAuthService" }
                    );
                    // Fallback implementation
                    return (
                      document.cookie
                        .split("; ")
                        .find((row) => row.startsWith("csrf_token="))
                        ?.split("=")[1] || ""
                    );
                  }
                };
              }
              return target[prop as keyof typeof target];
            },
          });

          primusAuthServiceInstance = new PrimusAuthService(
            tokenServiceProxy as TokenService,
            securityServiceInstance
          );

          logger.info("PrimusAuthService initialized", {
            component: "usePrimusAuthService",
            isAuthenticated,
          });
        }

        setPrimusService(primusAuthServiceInstance);
      } catch (error) {
        logger.error("Error initializing PrimusAuthService:", {
          error,
          component: "usePrimusAuthService",
        });
      }
    }, 1000); // Delay initialization

    return () => clearTimeout(initTimer);
  }, [tokenService]);

  // Handle authentication state changes
  useEffect(() => {
    if (!primusService) return;

    if (isAuthenticated) {
      logger.info("User is authenticated, connecting to Primus", {
        component: "usePrimusAuthService",
      });

      // Small delay to ensure auth state is fully propagated
      const connectTimer = setTimeout(() => {
        try {
          primusService.connect();
        } catch (error) {
          logger.error("Error connecting to WebSocket:", {
            error,
            component: "usePrimusAuthService",
          });
        }
      }, 500);

      return () => clearTimeout(connectTimer);
    } else {
      logger.info("User is not authenticated, disconnecting from Primus", {
        component: "usePrimusAuthService",
      });

      try {
        primusService.disconnect();
      } catch (error) {
        logger.error("Error disconnecting from WebSocket:", {
          error,
          component: "usePrimusAuthService",
        });
      }
    }
  }, [isAuthenticated, primusService]);

  return primusService;
};
