import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { isSafari } from '../../lib/utils';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isWebSocketError: boolean;
}

class WebSocketErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isWebSocketError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a WebSocket-related error
    const isWebSocketError = 
      error.name === 'SecurityError' ||
      error.message.includes('insecure') ||
      error.message.includes('WebSocket') ||
      error.message.includes('realtime') ||
      error.stack?.includes('WebSocket') ||
      error.stack?.includes('RealtimeClient') ||
      error.stack?.includes('RealtimeChannel');

    return {
      hasError: true,
      error,
      isWebSocketError
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('WebSocketErrorBoundary caught an error:', error, errorInfo);
    
    // Log additional context for WebSocket errors
    if (this.state.isWebSocketError) {
      console.warn('WebSocket error details:', {
        browser: isSafari() ? 'Safari' : 'Other',
        userAgent: navigator.userAgent,
        error: error.message,
        stack: error.stack
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // For WebSocket errors, show a minimal error or just hide the component
      if (this.state.isWebSocketError) {
        if (this.props.fallback) {
          return this.props.fallback;
        }
        
        // Silent fallback for WebSocket errors - just render children without realtime features
        console.warn('WebSocket error caught, rendering without realtime features');
        return this.props.children;
      }
      
      // For other errors, show a proper error boundary
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="h-5 w-5" />
            <h3 className="font-medium">Something went wrong</h3>
          </div>
          <p className="text-sm text-red-700 mt-1">
            An error occurred while loading this component.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null, isWebSocketError: false })}
            className="mt-3 px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WebSocketErrorBoundary;