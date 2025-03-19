import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SessionData, SessionStatus } from '../types/auth.types';
import { RootState } from '@/store';

interface SessionState {
  status: SessionStatus;
  data: SessionData | null;
  lastActivity: number | null;
  warningIssued: boolean;
}

const initialState: SessionState = {
  status: 'inactive',
  data: null,
  lastActivity: null,
  warningIssued: false
};

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setSessionState: (state, action: PayloadAction<Partial<SessionState>>) => {
      return { ...state, ...action.payload };
    },
    setSessionStatus: (state, action: PayloadAction<SessionStatus>) => {
      state.status = action.payload;
      if (action.payload === 'active') {
        state.warningIssued = false;
      }
    },
    setSessionData: (state, action: PayloadAction<SessionData>) => {
      state.data = action.payload;
    },
    updateSessionData: (state, action: PayloadAction<Partial<SessionData>>) => {
      if (state.data) {
        state.data = { ...state.data, ...action.payload };
      }
    },
    setLastActivity: (state, action: PayloadAction<number>) => {
      state.lastActivity = action.payload;
    },
    setWarningIssued: (state, action: PayloadAction<boolean>) => {
      state.warningIssued = action.payload;
    },
    clearSessionData: (state) => {
      return initialState;
    }
  }
});

export const {
  setSessionState,
  setSessionStatus,
  setSessionData,
  updateSessionData,
  setLastActivity,
  setWarningIssued,
  clearSessionData
} = sessionSlice.actions;

// Selectors
export const selectSessionState = (state: RootState) => state.session;
export const selectSessionStatus = (state: RootState) => state.session.status;
export const selectSessionData = (state: RootState) => state.session.data;
export const selectLastActivity = (state: RootState) => state.session.lastActivity;

export default sessionSlice.reducer;
