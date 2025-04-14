import React, { ReactNode } from 'react';
import { TeamProvider } from './TeamContext';
import { CacheProvider } from './CacheContext';

interface TeamProviderWithCacheProps {
  children: ReactNode;
}

export const TeamProviderWithCache: React.FC<TeamProviderWithCacheProps> = ({ children }) => {
  return (
    <CacheProvider>
      <TeamProvider>
        {children}
      </TeamProvider>
    </CacheProvider>
  );
};
