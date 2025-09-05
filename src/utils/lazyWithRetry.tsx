import React, { ComponentType, lazy, LazyExoticComponent } from 'react';

interface RetryOptions {
  maxRetries?: number;
  delay?: number;
  fallback?: ComponentType;
}

/**
 * Enhanced lazy loading with retry mechanism and fallback support
 * Handles dynamic import failures gracefully by retrying with exponential backoff
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFunction: () => Promise<{ default: T }>,
  options: RetryOptions = {}
): LazyExoticComponent<T> {
  const { maxRetries = 3, delay = 1000, fallback } = options;

  const retryImport = async (attempt = 1): Promise<{ default: T }> => {
    try {
      return await importFunction();
    } catch (error) {
      console.error(`Lazy import failed (attempt ${attempt}/${maxRetries}):`, error);
      
      // If this is the last attempt or we've exceeded max retries, throw the error
      if (attempt >= maxRetries) {
        console.error(`Failed to load component after ${maxRetries} attempts`);
        
        // If a fallback component is provided, return it
        if (fallback) {
          return { default: fallback as T };
        }
        
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const waitTime = delay * Math.pow(2, attempt - 1);
      console.log(`Retrying in ${waitTime}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return retryImport(attempt + 1);
    }
  };

  return lazy(retryImport);
}

/**
 * Creates a fallback component that displays an error message
 */
export function createFallbackComponent(componentName: string): ComponentType {
  return function FallbackComponent() {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 mb-4">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.232 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Unable to Load {componentName}
            </h3>
            
            <p className="text-sm text-gray-500 mb-6">
              This feature is temporarily unavailable. Please try refreshing the page or contact support if the problem persists.
            </p>
            
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  };
}

/**
 * Default retry options for different component types
 */
export const retryOptions = {
  dashboard: {
    maxRetries: 5,
    delay: 1000,
    fallback: createFallbackComponent('Dashboard')
  },
  page: {
    maxRetries: 3,
    delay: 1000
  },
  component: {
    maxRetries: 2,
    delay: 500
  }
} as const;