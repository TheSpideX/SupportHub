import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from "react-router-dom";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { store } from "@/store";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { AuthGuard } from "@/features/auth/components/AuthGuard";
import { ThemeProvider } from "@/components/providers/ThemeProvider/ThemeProvider";
import { Toaster } from "react-hot-toast";
import { ErrorBoundary } from "./core/errors/ErrorBoundary";
import { APP_ROUTES } from "@/config/routes";
import { useEffect, useRef, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useDispatch } from "react-redux";
import { logger } from "./utils/logger";
import {
  clearAuthState,
  setInitialized,
  setLoading,
  setAuthState,
} from "@/features/auth/store";
// Import the auth initialization function
import { initAuth } from "@/features/auth/init";
import { getAuthService } from "./features/auth/services";
// Import the toast service
import { ToastService } from "./utils/toast.service";
import AuthMonitorWidget from "./features/auth/components/AuthMonitorWidget";
// In your main App component or initialization code
import { getCrossTabService } from "@/features/auth/services/CrossTabService";

// Component name for logging
const COMPONENT = "App";

// Root layout with common UI elements
const RootLayout = () => (
  <>
    <Outlet />
    <Toaster position="top-right" />
    <AuthMonitorWidget />
  </>
);

// Application routes configuration
const routes = [
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/login" replace />,
      },
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "register",
        element: <RegisterPage />,
      },
      {
        path: "dashboard",
        element: (
          <AuthGuard>
            <DashboardPage />
          </AuthGuard>
        ),
      },
    ],
  },
];

// Create router instance
const router = createBrowserRouter(routes);

// Create a stable QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export function App() {
  const dispatch = useDispatch();
  const [authInitialized, setAuthInitialized] = useState(false);
  // Add a ref to track initialization
  const initRef = useRef(false);
  // Initialize the auth service
  const authService = getAuthService();

  // Initialize cross-tab service early
  useEffect(() => {
    // Initialize once
    const crossTabService = getCrossTabService();

    // Log tab information
    logger.info("Tab initialized", {
      tabId: crossTabService.getTabId(),
      isLeader: crossTabService.isLeader(),
    });

    // Register tab visibility change handler
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        // Tab became active, check if we should become leader
        if (!localStorage.getItem(crossTabService.getLeaderStorageKey())) {
          crossTabService.electLeader();
        }
      }
    };

    document.addEventListener("visibilitychange", visibilityHandler);

    // Clean up when component unmounts
    return () => {
      document.removeEventListener("visibilitychange", visibilityHandler);
      crossTabService.cleanup();
    };
  }, []);

  // Initialize auth on app load
  useEffect(() => {
    // Skip if already initialized via ref
    if (initRef.current) {
      logger.debug("Auth initialization already triggered, skipping", {
        component: COMPONENT,
      });
      return;
    }

    // Mark as initialized immediately
    initRef.current = true;

    const initializeAuth = async () => {
      try {
        // Additional check from service
        if (authService.isInitialized()) {
          logger.debug("Auth already initialized in service, skipping", {
            component: COMPONENT,
          });
          // Make sure Redux state is also initialized
          dispatch(setInitialized(true));
          setAuthInitialized(true);
          return;
        }

        logger.info("Starting auth initialization (attempt #1)", {
          component: COMPONENT,
        });
        dispatch(setLoading(true));

        // Initialize auth and check for existing session
        const isAuthenticated = await authService.initialize();

        if (isAuthenticated) {
          logger.info("User session restored successfully", {
            component: COMPONENT,
          });
          // Get current auth state from service
          const currentState = authService.getAuthState();
          // Update Redux with complete state
          dispatch(
            setAuthState({
              user: currentState.user,
              isAuthenticated: true,
              sessionExpiry: currentState.sessionExpiry,
              isInitialized: true, // Explicitly set initialized
            })
          );
        } else {
          logger.info("No active session found, user is not authenticated", {
            component: COMPONENT,
          });
          // Clear auth state but ensure initialized is true
          dispatch(clearAuthState());
          dispatch(setInitialized(true)); // Explicitly set initialized
        }

        setAuthInitialized(true);
        logger.info("Auth initialized successfully", { component: COMPONENT });
      } catch (error) {
        logger.error("Auth initialization failed", {
          component: COMPONENT,
          error,
        });
        dispatch(setInitialized(true)); // Ensure initialized is set even on error
        dispatch(clearAuthState());
        setAuthInitialized(true);
        toast.error("Failed to initialize authentication");
      } finally {
        dispatch(setLoading(false));
      }
    };

    initializeAuth();
    // Empty dependency array to run only once
  }, []);

  // Network status monitoring
  useEffect(() => {
    const toastService = ToastService.getInstance();

    const handleOffline = () => {
      // Use the warning method from our custom service
      toastService.warning(
        "You are currently offline. Some features may be limited."
      );
    };

    const handleOnline = () => {
      toast.success("You are back online.");
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ErrorBoundary>
            <RouterProvider router={router} />
          </ErrorBoundary>
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  );
}

export default App;
