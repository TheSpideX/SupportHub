import * as Sentry from '@sentry/react';

export const initSentry = () => {
  // Only initialize if DSN is provided
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE, // 'development' or 'production'
      release: import.meta.env.VITE_APP_VERSION,
      
      // Set high sample rate in development
      tracesSampleRate: 1.0,
      
      // Disable session replay in development
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,

      // Add debug mode in development
      debug: true,

      // Ignore certain errors in development
      ignoreErrors: [
        // Add patterns for errors you want to ignore
        'ResizeObserver loop limit exceeded',
        'Network request failed',
      ],

      beforeSend(event) {
        // Log to console in development
        if (import.meta.env.DEV) {
          console.group('🐛 Sentry Error:');
          console.log('Event:', event);
          console.groupEnd();
        }
        return event;
      },
    });
  } else {
    console.log('Sentry disabled: No DSN provided');
  }
};