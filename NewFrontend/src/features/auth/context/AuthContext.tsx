import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { User, SecurityContext } from '../types';

// Define context state type
interface AuthContextState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  securityContext: SecurityContext | null;
  lastActivity: number;
}

// Define context actions
type AuthAction = 
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; securityContext?: SecurityContext } }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'UPDATE_ACTIVITY' }
  | { type: 'UPDATE_SECURITY_CONTEXT'; payload: SecurityContext };

// Initial state
const initialState: AuthContextState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  securityContext: null,
  lastActivity: Date.now()
};

// Create context
const AuthContext = createContext<{
  state: AuthContextState;
  dispatch: React.Dispatch<AuthAction>;
}>({
  state: initialState,
  dispatch: () => null
});

// Reducer function
function authReducer(state: AuthContextState, action: AuthAction): AuthContextState {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        securityContext: action.payload.securityContext || state.securityContext,
        isAuthenticated: true,
        isLoading: false,
        lastActivity: Date.now()
      };
    case 'LOGOUT':
      return {
        ...initialState,
        lastActivity: Date.now()
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      };
    case 'UPDATE_ACTIVITY':
      return {
        ...state,
        lastActivity: Date.now()
      };
    case 'UPDATE_SECURITY_CONTEXT':
      return {
        ...state,
        securityContext: action.payload
      };
    default:
      return state;
  }
}

// Provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  
  // Sync with storage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        // Load user from storage
        const storedUser = await authPersistenceService.getUser();
        const securityContext = await authPersistenceService.getSecurityContext();
        
        if (storedUser) {
          dispatch({ 
            type: 'LOGIN_SUCCESS', 
            payload: { user: storedUser, securityContext } 
          });
        }
      } catch (error) {
        console.error('Failed to initialize auth state', error);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };
    
    initializeAuth();
  }, []);
  
  return (
    <AuthContext.Provider value={{ state, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for using auth context
export const useAuthContext = () => useContext(AuthContext);