/**
 * usePrimusAuthService Hook
 *
 * Provides access to the PrimusAuthService singleton instance
 */

import { useEffect, useState } from "react";
import { PrimusAuthService } from "../services/PrimusAuthService";
import { useTokenService } from "./useTokenService";
import { SecurityService } from "../services/SecurityService";

// Create a singleton instance of SecurityService
let securityServiceInstance: SecurityService | null = null;

// Create a singleton instance of PrimusAuthService
let primusAuthServiceInstance: PrimusAuthService | null = null;

export const usePrimusAuthService = (): PrimusAuthService | null => {
  const tokenService = useTokenService();
  const [primusService, setPrimusService] = useState<PrimusAuthService | null>(
    primusAuthServiceInstance
  );

  useEffect(() => {
    // Skip if TokenService is not available
    if (!tokenService) {
      console.log("TokenService not available yet");
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
                    console.warn(
                      "TokenService.getCsrfToken is not available, using fallback"
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

          // Connect to WebSocket with a delay
          setTimeout(() => {
            try {
              primusAuthServiceInstance?.connect();
            } catch (error) {
              console.error("Error connecting to WebSocket:", error);
            }
          }, 2000); // Longer delay to ensure everything is initialized
        }

        setPrimusService(primusAuthServiceInstance);
      } catch (error) {
        console.error("Error initializing PrimusAuthService:", error);
      }
    }, 1000); // Delay initialization

    return () => clearTimeout(initTimer);
  }, [tokenService]);

  return primusService;
};
