import { configureStore, getDefaultMiddleware } from '@reduxjs/toolkit';
import { sessionMiddleware } from '@/features/auth/middleware/sessionMiddleware';
import { loggingMiddleware } from './middleware/loggingMiddleware';
import authReducer from '@/features/auth/store/authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(sessionMiddleware)
      .concat(loggingMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
