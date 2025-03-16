import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { User, AuthTokens, AuthErrorCode, SecurityContext, DeviceInfo } from '../types/auth.types';
import { RootState } from '@/store';
import { authService } from '../services/auth.service';

export interface SessionAlert {
  type: 'warning' | 'danger' | 'error' | 'info';
  message: string;
  action: 'verify' | 'reauthenticate' | 'logout' | 'extend' | 'none';
  expiresAt?: number;
}

export interface AuthError {
  code: AuthErrorCode;
  message: string;
  details?: Record<string, any>;
}

interface RateLimit {
  expiresAt: number;
  duration: number;
  attempts: number;
  maxAttempts: number;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  lastActivity: number;
  sessionExpiry: number | null;
  activeSessions: number;
  sessionAlert: SessionAlert | null;
  error: AuthError | null;
  rateLimit: RateLimit | null;
  securityContext: SecurityContext | null;
  rememberMe: boolean;
  twoFactorRequired: boolean;
  twoFactorVerified: boolean;
  deviceVerified: boolean;
  pendingSync: boolean;
  isOffline: boolean;
  tokens: AuthTokens | null;
  isOfflineMode: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  lastActivity: Date.now(),
  sessionExpiry: null,
  activeSessions: 0,
  sessionAlert: null,
  error: null,
  rateLimit: null,
  securityContext: null,
  rememberMe: false,
  twoFactorRequired: false,
  twoFactorVerified: false,
  deviceVerified: false,
  pendingSync: false,
  isOffline: false,
  tokens: null,
  isOfflineMode: false
};

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      return await authService.login(credentials);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const refreshTokens = createAsyncThunk(
  'auth/refreshTokens',
  async (_, { rejectWithValue }) => {
    try {
      return await authService.refreshToken();
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ user: User; tokens?: AuthTokens }>) => {
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.error = null;
      if (action.payload.tokens) {
        state.tokens = action.payload.tokens;
      }
    },
    updateLastActivity: (state, action: PayloadAction<number | undefined>) => {
      state.lastActivity = action.payload || Date.now();
    },
    setSessionExpiry: (state, action: PayloadAction<number | null>) => {
      state.sessionExpiry = action.payload;
    },
    setActiveSessions: (state, action: PayloadAction<number>) => {
      state.activeSessions = action.payload;
    },
    setSessionAlert: (state, action: PayloadAction<SessionAlert | null>) => {
      state.sessionAlert = action.payload;
    },
    setError: (state, action: PayloadAction<AuthError>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
    setAuthLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.sessionExpiry = null;
      state.sessionAlert = null;
      state.error = null;
      state.securityContext = null;
      state.tokens = null;
      state.twoFactorRequired = false;
      state.twoFactorVerified = false;
      state.deviceVerified = false;
    },
    setRateLimit: (state, action: PayloadAction<RateLimit | null>) => {
      state.rateLimit = action.payload;
    },
    setSecurityContext: (state, action: PayloadAction<SecurityContext>) => {
      state.securityContext = action.payload;
    },
    setRememberMe: (state, action: PayloadAction<boolean>) => {
      state.rememberMe = action.payload;
    },
    setTwoFactorRequired: (state, action: PayloadAction<boolean>) => {
      state.twoFactorRequired = action.payload;
    },
    setTwoFactorVerified: (state, action: PayloadAction<boolean>) => {
      state.twoFactorVerified = action.payload;
    },
    setDeviceVerified: (state, action: PayloadAction<boolean>) => {
      state.deviceVerified = action.payload;
    },
    setPendingSync: (state, action: PayloadAction<boolean>) => {
      state.pendingSync = action.payload;
    },
    setOfflineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOffline = action.payload;
    },
    updateTokens: (state, action: PayloadAction<AuthTokens>) => {
      state.tokens = action.payload;
    },
    extendSession: (state) => {
      if (state.sessionExpiry) {
        // Extend session by 30 minutes from now
        state.sessionExpiry = Date.now() + 30 * 60 * 1000;
        state.sessionAlert = null;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.tokens = action.payload.tokens;
        state.securityContext = action.payload.securityContext;
        state.lastActivity = Date.now();
        state.twoFactorRequired = !!action.payload.requiresTwoFactor;
        state.deviceVerified = !!action.payload.deviceVerified;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as AuthError;
      })
      // Token refresh
      .addCase(refreshTokens.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(refreshTokens.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tokens = action.payload.tokens;
        state.lastActivity = Date.now();
      })
      .addCase(refreshTokens.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as AuthError;
        // If token refresh fails, log out
        if ((action.payload as AuthError)?.code === 'TOKEN_EXPIRED') {
          state.user = null;
          state.isAuthenticated = false;
          state.tokens = null;
        }
      });
  }
});

// Selectors
export const selectCurrentUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectAuthLoading = (state: RootState) => state.auth.isLoading;
export const selectAuthError = (state: RootState) => state.auth.error;
export const selectSecurityContext = (state: RootState) => state.auth.securityContext;
export const selectSessionExpiry = (state: RootState) => state.auth.sessionExpiry;
export const selectSessionAlert = (state: RootState) => state.auth.sessionAlert;
export const selectTwoFactorRequired = (state: RootState) => state.auth.twoFactorRequired;
export const selectDeviceVerified = (state: RootState) => state.auth.deviceVerified;
export const selectIsOffline = (state: RootState) => state.auth.isOffline;

export const {
  setCredentials,
  updateLastActivity,
  setSessionExpiry,
  setActiveSessions,
  setSessionAlert,
  setError,
  clearError,
  setAuthLoading,
  logout,
  setRateLimit,
  setSecurityContext,
  setRememberMe,
  setTwoFactorRequired,
  setTwoFactorVerified,
  setDeviceVerified,
  setPendingSync,
  setOfflineStatus,
  updateTokens,
  extendSession,
} = authSlice.actions;

// Create backward compatible aliases
export const setUser = setCredentials;
export const clearCredentials = logout;
export const setAuthError = setError;

export default authSlice.reducer;
