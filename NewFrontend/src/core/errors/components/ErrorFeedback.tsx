import React from 'react';
import { AppError } from '../base';

interface ErrorFeedbackProps {
  error: AppError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const ErrorFeedback: React.FC<ErrorFeedbackProps> = ({ 
  error, 
  onRetry, 
  onDismiss 
}) => {
  const isRetryable = error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT_ERROR';

  return (
    <div className="bg-white rounded-lg shadow p-4 max-w-md mx-auto">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="ml-3 w-full">
          <h3 className="text-sm font-medium text-gray-900">
            {error.message}
          </h3>
          {error.details?.help && (
            <p className="mt-1 text-sm text-gray-500">
              {error.details.help}
            </p>
          )}
          <div className="mt-4 flex justify-end space-x-3">
            {isRetryable && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Retry
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};