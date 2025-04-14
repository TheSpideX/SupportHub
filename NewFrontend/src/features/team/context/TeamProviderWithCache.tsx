import React, { ReactNode } from "react";
import { TeamProvider } from "./TeamContext";

interface TeamProviderWithCacheProps {
  children: ReactNode;
}

// This component no longer uses cache, but kept for backward compatibility
export const TeamProviderWithCache: React.FC<TeamProviderWithCacheProps> = ({
  children,
}) => {
  return <TeamProvider>{children}</TeamProvider>;
};
