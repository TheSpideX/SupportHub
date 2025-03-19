import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SecurityContext } from '../types/auth.types';
import { RootState } from '@/store';

interface SecurityEvent {
  id: string;
  type: string;
  timestamp: number;
  payload?: any; // Add payload property to match what's used in useSecurityContext
  details?: any;
  resolved: boolean;
}

interface SecurityState {
  context: SecurityContext | null;
  events: SecurityEvent[];
  threatLevel: 'none' | 'low' | 'medium' | 'high';
  lockoutUntil: number | null;
  failedAttempts: number;
}

const initialState: SecurityState = {
  context: null,
  events: [],
  threatLevel: 'none',
  lockoutUntil: null,
  failedAttempts: 0
};

export const securitySlice = createSlice({
  name: 'security',
  initialState,
  reducers: {
    setSecurityContext: (state, action: PayloadAction<SecurityContext | null>) => {
      state.context = action.payload;
    },
    updateSecurityContext: (state, action: PayloadAction<Partial<SecurityContext>>) => {
      if (state.context) {
        state.context = { ...state.context, ...action.payload };
      }
    },
    setSecurityEvents: (state, action: PayloadAction<SecurityEvent[]>) => {
      state.events = action.payload;
    },
    addSecurityEvent: (state, action: PayloadAction<Omit<SecurityEvent, 'id'>>) => {
      const newEvent = {
        ...action.payload,
        id: Date.now().toString(),
        resolved: false
      };
      state.events.push(newEvent);
      
      // Update threat level based on events
      const unresolvedEvents = state.events.filter(e => !e.resolved);
      if (unresolvedEvents.length > 5) {
        state.threatLevel = 'high';
      } else if (unresolvedEvents.length > 3) {
        state.threatLevel = 'medium';
      } else if (unresolvedEvents.length > 0) {
        state.threatLevel = 'low';
      } else {
        state.threatLevel = 'none';
      }
    },
    resolveSecurityEvent: (state, action: PayloadAction<string>) => {
      const event = state.events.find(e => e.id === action.payload);
      if (event) {
        event.resolved = true;
      }
    },
    setThreatLevel: (state, action: PayloadAction<SecurityState['threatLevel']>) => {
      state.threatLevel = action.payload;
    },
    setLockoutUntil: (state, action: PayloadAction<number | null>) => {
      state.lockoutUntil = action.payload;
    },
    setFailedAttempts: (state, action: PayloadAction<number>) => {
      state.failedAttempts = action.payload;
    },
    incrementFailedAttempts: (state) => {
      state.failedAttempts += 1;
    },
    clearSecurityEvents: (state) => {
      state.events = [];
      state.threatLevel = 'none';
    },
    clearSecurityContext: (state) => {
      return initialState;
    }
  }
});

export const {
  setSecurityContext,
  updateSecurityContext,
  setSecurityEvents,
  addSecurityEvent,
  resolveSecurityEvent,
  setThreatLevel,
  setLockoutUntil,
  setFailedAttempts,
  incrementFailedAttempts,
  clearSecurityEvents,
  clearSecurityContext
} = securitySlice.actions;

// Selectors
export const selectSecurityState = (state: RootState) => state.security;
export const selectSecurityContext = (state: RootState) => state.security.context;
export const selectSecurityEvents = (state: RootState) => state.security.events;
export const selectThreatLevel = (state: RootState) => state.security.threatLevel;
export const selectLockoutUntil = (state: RootState) => state.security.lockoutUntil;
export const selectFailedAttempts = (state: RootState) => state.security.failedAttempts;

export default securitySlice.reducer;
