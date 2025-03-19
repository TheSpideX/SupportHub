import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AuthState, User, AuthError } from '../types/auth.types';
import { RootState } from '@/store';
import { logger } from '@/utils/logger';

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,
  isInitialized: false,
  lastVerified: null
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthState: (state, action: PayloadAction<Partial<AuthState>>) => {
      return { ...state, ...action.payload };
    },
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
      state.lastVerified = action.payload ? Date.now() : null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<AuthError | null>) => {
      state.error = action.payload;
    },
    setInitialized: (state, action: PayloadAction<boolean>) => {
      state.isInitialized = action.payload;
      // Log the state change for debugging
      logger.debug('Auth state initialized in Redux', { 
        component: 'authSlice',
        isInitialized: action.payload
      });
    },
    updateUserData: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    clearAuthState: (state) => {
      return {
        ...initialState,
        isInitialized: true, // Keep initialized state
        isLoading: false
      };
    },
    setLastVerified: (state, action: PayloadAction<number>) => {
      state.lastVerified = action.payload;
    }
  }
});

export const { 
  setAuthState, 
  setUser, 
  setLoading, 
  setError, 
  setInitialized,
  updateUserData,
  clearAuthState,
  setLastVerified
} = authSlice.actions;

// Selectors with proper typing
export const selectAuthState = (state: RootState) => state.auth as AuthState;
export const selectUser = (state: RootState) => (state.auth as AuthState).user;
export const selectIsAuthenticated = (state: RootState) => (state.auth as AuthState).isAuthenticated;
export const selectIsLoading = (state: RootState) => (state.auth as AuthState).isLoading;
export const selectAuthError = (state: RootState) => (state.auth as AuthState).error;
export const selectIsInitialized = (state: RootState) => (state.auth as AuthState).isInitialized;

export default authSlice.reducer;
