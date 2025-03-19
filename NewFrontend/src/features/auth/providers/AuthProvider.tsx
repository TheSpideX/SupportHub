import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { AuthService } from '../services/AuthService';
import { TokenService } from '../services/TokenService';
import { SessionService } from '../services/SessionService';
import { SecurityService } from '../services/SecurityService';
import { AuthState } from '../types/auth.types';
import { getAuthServices } from '../services';
import { authMonitor } from '../services/AuthMonitor';
import { logger } from '@/utils/logger';

// Create auth context
interface AuthContextType {
  authService: AuthService;
  tokenService: TokenService;
  sessionService: SessionService;
  securityService: SecurityService;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
  error: any;
  sessionExpiry?: number;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Auth Provider props
interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Get auth services
  const { 
    authService, 
    tokenService, 
    sessionService, 
    securityService 
  } = getAuthServices();
  
  // Initialize state from auth service
  const [authState, setAuthState] = useState<AuthState>(authService.getAuthState());
  
  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = authService.subscribe((newState) => {
      setAuthState(newState);
    });
    
    // Initialize auth state
    authService.initialize().catch(error => {
      logger.error('Failed to initialize auth service', error);
    });
    
    return () => {
      unsubscribe();
    };
  }, [authService]);
  
  // Initialize auth monitor
  useEffect(() => {
    // Initialize auth monitor with the actual service instances
    if (tokenService && sessionService) {
      // @ts-ignore - Accessing private property for initialization
      authMonitor.tokenService = tokenService;
      // @ts-ignore - Accessing private property for initialization
      authMonitor.sessionService = sessionService;
      
      // Start monitoring if authenticated
      if (authState.isAuthenticated) {
        authMonitor.startMonitoring();
      }
    }
    
    return () => {
      authMonitor.stopMonitoring();
    };
  }, [tokenService, sessionService, authState.isAuthenticated]);
  
  // Set up storage event listener for cross-tab communication
  useEffect(() => {
    const handleStorageEvent = (event: StorageEvent) => {
      authService.processStorageEvent(event);
    };
    
    window.addEventListener('storage', handleStorageEvent);
    
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [authService]);
  
  // Context value
  const contextValue: AuthContextType = {
    authService,
    tokenService,
    sessionService,
    securityService,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    user: authState.user,
    error: authState.error,
    sessionExpiry: authState.sessionExpiry
  };
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  
  return context;
};
