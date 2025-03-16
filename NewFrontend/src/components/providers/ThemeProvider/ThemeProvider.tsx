import { ReactNode } from 'react';

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
};