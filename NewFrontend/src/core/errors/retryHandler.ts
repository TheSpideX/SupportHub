import { errorHandler } from './errorHandler';
import { logger } from '@/utils/logger';

interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffFactor: number;
  retryableErrors: string[];
}

export class RetryHandler {
  private static defaultConfig: RetryConfig = {
    maxAttempts: 3,
    delayMs: 1000,
    backoffFactor: 2,
    retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'SERVER_ERROR']
  };

  static async retry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const finalConfig = { ...this.defaultConfig, ...config };
    let lastError: Error;
    let attempt = 1;
    let delay = finalConfig.delayMs;

    while (attempt <= finalConfig.maxAttempts) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        const errorCode = error.code || 'UNKNOWN_ERROR';

        if (!finalConfig.retryableErrors.includes(errorCode)) {
          throw error;
        }

        logger.warn(`Retry attempt ${attempt} of ${finalConfig.maxAttempts} failed`, {
          error: errorCode,
          attempt,
          nextDelay: delay
        });

        if (attempt === finalConfig.maxAttempts) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= finalConfig.backoffFactor;
        attempt++;
      }
    }

    throw lastError;
  }
}