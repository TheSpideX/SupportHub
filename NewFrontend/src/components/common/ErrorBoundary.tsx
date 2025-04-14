import React, { Component, ErrorInfo, ReactNode } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg shadow-lg text-white">
          <div className="flex items-center mb-4 text-amber-500">
            <FaExclamationTriangle className="h-6 w-6 mr-2" />
            <h2 className="text-xl font-semibold">Something went wrong</h2>
          </div>
          <div className="bg-gray-900 p-4 rounded-md mb-4 overflow-auto max-h-40">
            <pre className="text-sm text-gray-300 whitespace-pre-wrap">
              {this.state.error?.message || 'An unknown error occurred'}
            </pre>
          </div>
          <p className="text-gray-400 mb-4">
            The application encountered an error. You can try refreshing the page or contact support if the problem persists.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white transition-colors"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
