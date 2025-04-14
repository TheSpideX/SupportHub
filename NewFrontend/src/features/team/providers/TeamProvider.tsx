import React from "react";
import { TeamProvider as TeamContextProvider } from "../context/TeamContext";

interface TeamProviderProps {
  children: React.ReactNode;
}

// Wrapper component that provides team context (no longer uses cache)
export const TeamProvider: React.FC<TeamProviderProps> = ({ children }) => {
  return <TeamContextProvider>{children}</TeamContextProvider>;
};

export default TeamProvider;
