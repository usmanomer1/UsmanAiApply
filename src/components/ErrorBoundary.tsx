import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onRetry?: () => void;
  retryable?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

export class LazyLoadErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null, 
      retryCount: 0 
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { 
      hasError: true, 
      error,
      errorInfo: null,
      retryCount: 0
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('LazyLoadErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Log the error to Sentry or other error tracking service
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack
          }
        }
      });
    }
  }

  private handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));
    
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  private isLazyLoadError(error: Error): boolean {
    return error.message.includes('Failed to fetch dynamically imported module') ||
           error.message.includes('Loading chunk') ||
           error.message.includes('Loading CSS chunk');
  }

  public render() {
    if (this.state.hasError && this.state.error) {
      // Check if this is a lazy loading error
      const isLazyError = this.isLazyLoadError(this.state.error);
      
      if (isLazyError) {
        return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Page Loading Error
                </h3>
                
                <p className="text-sm text-gray-500 mb-6">
                  We're having trouble loading this page. This might be due to a network issue or a temporary problem with our servers.
                </p>
                
                <div className="space-y-3">
                  {this.props.retryable !== false && this.state.retryCount < 3 && (
                    <button
                      onClick={this.handleRetry}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Try Again
                    </button>
                  )}
                  
                  <Link
                    to="/"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Home className="h-4 w-4" />
                    Go to Dashboard
                  </Link>
                  
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Refresh Page
                  </button>
                </div>

                {this.state.retryCount >= 3 && (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                    <p className="text-xs text-yellow-800">
                      Multiple retry attempts failed. Please check your internet connection or try again later.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }

      // For non-lazy loading errors, show a generic error boundary
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Something went wrong
              </h3>
              
              <p className="text-sm text-gray-500 mb-6">
                An unexpected error occurred. Please try refreshing the page.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh Page
                </button>
                
                <Link
                  to="/"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Home className="h-4 w-4" />
                  Go to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}