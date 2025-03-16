import React, { Suspense } from 'react';
import { Skeleton } from '@/components/shared/skeletons/Skeleton';

interface LazyLoadOptions {
  fallback?: React.ReactNode;
  errorBoundary?: React.ComponentType<{ error: Error }>;
}

export function lazyLoad(
  factory: () => Promise<{ default: React.ComponentType<any> }>,
  options: LazyLoadOptions = {}
) {
  const LazyComponent = React.lazy(factory);
  const DefaultFallback = <Skeleton className="w-full h-32" />;
  const DefaultError = ({ error }: { error: Error }) => (
    <div className="text-red-500">Error loading component: {error.message}</div>
  );

  return function LazyLoadWrapper(props: any) {
    const ErrorBoundary = options.errorBoundary || DefaultError;

    return (
      <ErrorBoundary>
        <Suspense fallback={options.fallback || DefaultFallback}>
          <LazyComponent {...props} />
        </Suspense>
      </ErrorBoundary>
    );
  };
}