import React from "react";
import { TeamProvider as TeamContextProvider } from "../context/TeamContext";

interface TeamProviderProps {
  children: React.ReactNode;
}

// Simple wrapper component that always renders the TeamContextProvider
export const TeamProvider: React.FC<TeamProviderProps> = ({ children }) => {
  return <TeamContextProvider>{children}</TeamContextProvider>;
};

export default TeamProvider;
