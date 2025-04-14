import React from "react";
import { TeamProvider as TeamContextProvider } from "../context/TeamContext";
import { CacheProvider } from "../context/CacheContext";

interface TeamProviderProps {
  children: React.ReactNode;
}

// Wrapper component that provides both cache and team context
export const TeamProvider: React.FC<TeamProviderProps> = ({ children }) => {
  return (
    <CacheProvider>
      <TeamContextProvider>{children}</TeamContextProvider>
    </CacheProvider>
  );
};

export default TeamProvider;
