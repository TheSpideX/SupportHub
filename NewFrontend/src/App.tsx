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
import { ErrorBoundary } from './core/errors/ErrorBoundary';
import { APP_ROUTES } from '@/config/routes';
import { useEffect, useRef, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { logger } from './utils/logger';
import { clearAuthState, setInitialized, setLoading } from '@/features/auth/store';
// Import the auth initialization function
import { initAuth } from '@/features/auth/init';
import { getAuthService } from './features/auth/services';
// Import the toast service
import { ToastService } from './utils/toast.service';

// Component name for logging
const COMPONENT = 'App';

// Root layout with common UI elements
const RootLayout = () => (
  <>
    <Outlet />
    <Toaster position="top-right" />
  </>
);

// Application routes configuration
const routes = [
  {
    path: APP_ROUTES.ROOT,
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Navigate to={APP_ROUTES.AUTH.LOGIN} replace />,
      },
      {
        path: APP_ROUTES.AUTH.ROOT,
        children: [
          {
            path: 'login',
            element: <LoginPage />,
          },
          {
            path: 'register',
            element: <RegisterPage />,
          },
        ],
      },
      {
        path: 'dashboard',
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
  
  // Initialize auth on app load
  useEffect(() => {
    // Skip if already initialized via ref
    if (initRef.current) {
      logger.debug('Auth initialization already triggered, skipping', { component: COMPONENT });
      return;
    }
    
    // Mark as initialized immediately
    initRef.current = true;
    
    const initializeAuth = async () => {
      try {
        // Additional check from service
        if (authService.isInitialized()) {
          logger.debug('Auth already initialized in service, skipping', { component: COMPONENT });
          return;
        }
        
        logger.info('Starting auth initialization (attempt #1)', { component: COMPONENT });
        dispatch(setLoading(true));
        
        // Initialize auth and check for existing session
        const isAuthenticated = await authService.initialize();
        
        if (isAuthenticated) {
          logger.info('User session restored successfully', { component: COMPONENT });
          // You can dispatch additional actions here if needed
        } else {
          logger.info('No active session found, user is not authenticated', { component: COMPONENT });
          dispatch(clearAuthState());
        }
        
        dispatch(setInitialized(true));
        setAuthInitialized(true);
        logger.info('Auth initialized successfully', { component: COMPONENT });
      } catch (error) {
        logger.error('Auth initialization failed', { component: COMPONENT, error });
        dispatch(setInitialized(true));
        dispatch(clearAuthState());
        setAuthInitialized(true);
        toast.error('Failed to initialize authentication');
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
      toastService.warning('You are currently offline. Some features may be limited.');
    };
    
    const handleOnline = () => {
      toast.success('You are back online.');
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
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
