import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';
import sessionReducer from '@/features/auth/store/sessionSlice';
import securityReducer from '@/features/auth/store/securitySlice';
import { AuthState } from '@/features/auth/types/auth.types';

// Define the shape of your RootState
export interface RootState {
  auth: AuthState;
  session: ReturnType<typeof sessionReducer>;
  security: ReturnType<typeof securityReducer>;
}

export const store = configureStore({
  reducer: {
    auth: authReducer,
    session: sessionReducer,
    security: securityReducer
  },
});

export type AppDispatch = typeof store.dispatch;
