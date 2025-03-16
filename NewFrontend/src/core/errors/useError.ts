import { useCallback } from 'react';
import { errorHandler } from './errorHandler';
import { AppError } from './base';

export function useError() {
  const handleError = useCallback((error: unknown, metadata?: {
    action?: string;
    component?: string;
  }) => {
    errorHandler.handleError(error, {
      ...metadata,
      timestamp: Date.now(),
    });
  }, []);

  const normalizeError = useCallback((error: unknown): AppError => {
    return errorHandler.normalizeError(error);
  }, []);

  return {
    handleError,
    normalizeError,
  };
}