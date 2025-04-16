import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/features/auth/store/authSlice";
import sessionReducer from "@/features/auth/store/sessionSlice";
import securityReducer from "@/features/auth/store/securitySlice";
import { AuthState } from "@/features/auth/types/auth.types";
import { api } from "@/lib/api";

// Define the shape of your RootState
export interface RootState {
  auth: AuthState;
  session: ReturnType<typeof sessionReducer>;
  security: ReturnType<typeof securityReducer>;
  [api.reducerPath]: ReturnType<typeof api.reducer>;
}

export const store = configureStore({
  reducer: {
    auth: authReducer,
    session: sessionReducer,
    security: securityReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
});

// Make store available globally for services that can't use React hooks
if (typeof window !== "undefined") {
  (window as any).__REDUX_STORE__ = store;
}

export type AppDispatch = typeof store.dispatch;
