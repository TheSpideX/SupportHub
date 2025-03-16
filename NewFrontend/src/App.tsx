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
import { useEffect } from 'react';
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

  useEffect(() => {
    const restoreUserSession = async () => {
      logger.debug('Attempting to restore user session on app initialization', { component: COMPONENT });
      try {
        // First check server configuration
        const configCheck = await authService.checkServerConfiguration();
        logger.info('Server configuration check results', { configCheck, component: COMPONENT });
        
        if (!configCheck.corsConfigured) {
          toast.error('CORS is not properly configured on the server');
        }
        
        if (!configCheck.cookiesConfigured) {
          toast.error('HTTP cookies are not properly configured on the server');
        }
        
        if (!configCheck.csrfConfigured) {
          toast.warning('CSRF protection may not be properly configured');
        }
        
        // Then try to restore session
        const restored = await authService.restoreSession();
        logger.debug('Session restoration attempt completed', { 
          success: restored,
          timestamp: new Date().toISOString(),
          component: COMPONENT
        });
        
        if (!restored) {
          logger.info('Session could not be restored, clearing any stale data', { component: COMPONENT });
          // Clear any stale session data
          try {
            await sessionService.clearSessionData();
            await tokenService.clearTokens();
          } catch (clearError) {
            logger.warn('Error while clearing session data', { 
              error: clearError.message || 'Unknown error',
              component: COMPONENT 
            });
          }
        }
      } catch (error) {
        // Extract error message safely
        let errorMessage = 'Unknown error';
        
        if (error) {
          if (typeof error === 'string') {
            errorMessage = error;
          } else if (error.message) {
            errorMessage = error.message;
          } else if (error.error) {
            if (typeof error.error === 'string') {
              errorMessage = error.error;
            } else if (error.error.message) {
              errorMessage = error.error.message;
            }
          }
        }
        
        logger.error('Failed to restore session', { errorMessage, component: COMPONENT });
      }
    };

    restoreUserSession();
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
