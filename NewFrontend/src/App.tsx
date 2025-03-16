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
import { AuthGuard } from "@/features/auth/components/AuthGuard/AuthGuard";
import { ThemeProvider } from "@/components/providers/ThemeProvider/ThemeProvider";
import { Toaster } from "react-hot-toast";
import { ErrorBoundary } from './core/errors/ErrorBoundary';
import { SessionAlert } from '@/features/auth/components/SessionAlert/SessionAlert';
import { SessionTimeout } from '@/features/auth/components/SessionTimeout/SessionTimeout';
import { APP_ROUTES } from '@/config/routes';
import { lazyLoad } from './utils/lazyLoad';
import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { ServerStatusIndicator } from '@/components/ui/ServerStatusIndicator';
import { networkMonitorService } from '@/services/network-monitor.service';
import { useDispatch } from 'react-redux';
import { authService } from './features/auth/services/auth.service';
import { tokenService } from './features/auth/services/token.service';
import { sessionService } from './features/auth/services/session.service';
import { logger } from './utils/logger';

// Define the component name for logging
const COMPONENT = 'App';

// Define RootLayout component first
const RootLayout = () => {
  return (
    <>
      <Outlet />
      <Toaster position="top-right" />
      <SessionAlert />
      <SessionTimeout />
      {process.env.NODE_ENV !== 'production' && <ServerStatusIndicator />}
    </>
  );
};

// Then define routes using the RootLayout
const routes = [
  {
    path: APP_ROUTES.COMMON.HOME,
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

export function App() {
  useEffect(() => {
    const handleOnlineStatus = () => {
      if (!navigator.onLine) {
        toast.warning('You are currently offline. Some features may be limited.');
      }
    };

    window.addEventListener('offline', handleOnlineStatus);
    return () => window.removeEventListener('offline', handleOnlineStatus);
  }, []);

  // Add a ref to track initialization status
  const initializationRef = useRef({
    hasInitialized: false,
    isInitializing: false,
    attempt: 0
  });

  useEffect(() => {
    const COMPONENT = 'App';
    let isMounted = true;
    
    // Skip if already initialized or initializing
    if (initializationRef.current.hasInitialized) {
      logger.debug('App already initialized, skipping duplicate initialization', { component: COMPONENT });
      return;
    }
    
    if (initializationRef.current.isInitializing) {
      logger.debug('App initialization already in progress, skipping duplicate call', { component: COMPONENT });
      return;
    }
    
    // Track initialization attempt
    initializationRef.current.attempt++;
    initializationRef.current.isInitializing = true;
    
    const attemptId = initializationRef.current.attempt;
    
    const initializeAuth = async () => {
      try {
        logger.info(`Initializing application (attempt #${attemptId})`, { component: COMPONENT });
        
        // Use the centralized initialization method
        const initialized = await authService.initialize();
        
        // Check if component is still mounted before updating state
        if (!isMounted) {
          logger.debug(`Initialization completed but component unmounted (attempt #${attemptId})`);
          return;
        }
        
        // Mark as initialized
        initializationRef.current.hasInitialized = true;
        initializationRef.current.isInitializing = false;
        
        logger.info(`Auth initialization completed (attempt #${attemptId})`, { 
          success: initialized,
          component: COMPONENT 
        });
        
        // Only clear data if initialization failed and we need to clean up
        if (!initialized) {
          logger.info('Auth initialization failed, ensuring clean state', { component: COMPONENT });
          try {
            await sessionService.clearSessionData();
            await tokenService.clearTokens();
          } catch (cleanupError) {
            logger.warn('Error during cleanup after failed initialization', {
              component: COMPONENT,
              error: cleanupError
            });
            // Continue despite cleanup errors
          }
        }
      } catch (error) {
        // Only log if component is still mounted
        if (isMounted) {
          logger.error(`Application initialization failed (attempt #${attemptId})`, {
            error,
            component: COMPONENT
          });
        }
        
        // Reset initialization state to allow retry
        if (isMounted) {
          initializationRef.current.isInitializing = false;
        }
      }
    };

    initializeAuth();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Provider store={store}>
      <QueryClientProvider client={new QueryClient()}>
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
