import { toast } from 'react-hot-toast';
import * as Sentry from '@sentry/react';
import { AppError, NetworkError, ValidationError, AuthenticationError, BusinessError } from './base';
import { logger } from '@/utils/logger';
import { ToastService } from '@/utils/toast.service';

interface ErrorMetadata {
  component?: string;
  action?: string;
  userId?: string;
  timestamp: number;
  [key: string]: any;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  initialize(config: { environment: string; release: string }) {
    if (this.isInitialized) return;

    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: config.environment,
      release: config.release,
      integrations: [
        new Sentry.BrowserTracing(),
      ],
      tracesSampleRate: 1.0,
    });

    this.isInitialized = true;
  }

  handleError(error: unknown, metadata?: ErrorMetadata): void {
    const errorInfo = this.normalizeError(error);
    
    // Log error
    this.logError(errorInfo, metadata);

    // Show user feedback
    this.showErrorFeedback(errorInfo);

    // Track error
    this.trackError(errorInfo, metadata);

    // Handle specific error types
    if (errorInfo instanceof AuthenticationError) {
      this.handleAuthError(errorInfo);
    }
  }

  normalizeError(error: unknown): AppError {
    if (error instanceof AppError) return error;

    const axiosError = error as any;
    if (axiosError.isAxiosError) {
      return this.handleApiError(axiosError);
    }

    return new AppError(
      'UNKNOWN_ERROR',
      error instanceof Error ? error.message : 'An unexpected error occurred',
      { originalError: error }
    );
  }

  handleApiError(error: any): AppError {
    const status = error.response?.status;
    const data = error.response?.data;

    switch (status) {
      case 401:
      case 403:
        return new AuthenticationError(
          data?.code || 'AUTH_ERROR',
          data?.message || 'Authentication failed',
          data?.redirectPath
        );
      case 400:
        return new ValidationError(
          data?.message || 'Invalid request',
          data?.details
        );
      case 404:
        return new BusinessError(
          'RESOURCE_NOT_FOUND',
          data?.message || 'Resource not found'
        );
      default:
        return new NetworkError(
          data?.message || 'Network request failed',
          status
        );
    }
  }

  private handleAuthError(error: AuthenticationError): void {
    if (error.redirectPath) {
      window.location.href = error.redirectPath;
    }
  }

  private showErrorFeedback(error: AppError): void {
    const toastConfig = {
      duration: error.severity === 'HIGH' ? 6000 : 4000,
    };

    ToastService.error(error.message, toastConfig);
  }

  private logError(error: AppError, metadata?: ErrorMetadata): void {
    logger.error(error.message, {
      code: error.code,
      details: error.details,
      metadata,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      component: metadata?.component || 'unknown',
      action: metadata?.action || 'unknown',
      requestInfo: error.requestInfo || {},
      browserInfo: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer
      }
    });
  }

  private trackError(error: AppError, metadata?: ErrorMetadata): void {
    if (error.severity === 'LOW') return;

    Sentry.withScope((scope) => {
      scope.setExtra('errorDetails', error.details);
      scope.setExtra('metadata', metadata);
      scope.setLevel(error.severity === 'HIGH' ? 'fatal' : 'error');
      
      Sentry.captureException(error);
    });
  }
}

export const errorHandler = ErrorHandler.getInstance();
