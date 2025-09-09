import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { browserTracingIntegration } from '@sentry/react'
import { replayIntegration } from '@sentry/replay'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { PostHogProvider } from 'posthog-js/react'
import App from './App.tsx'
import './index.css'
import { supabase } from './lib/supabase.ts'

// Initialize Convex client
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL || 'https://notable-sloth-598.convex.cloud')

// Initialize Sentry in both development and production
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "https://a999c9b7652cf69f708de66b5f3acd54@o4509578673258496.ingest.us.sentry.io/4509580186157056",
  integrations: [
    browserTracingIntegration(),
    // Session Replay
    ...(import.meta.env.VITE_ENABLE_SENTRY_REPLAY === 'false'
      ? []
      : [
          replayIntegration({
            // Defaults: keep visible for debugging; adjust per privacy policy
            maskAllText:
              (import.meta.env.VITE_SENTRY_REPLAY_MASK_ALL_TEXT || 'false') === 'true',
            blockAllMedia:
              (import.meta.env.VITE_SENTRY_REPLAY_BLOCK_ALL_MEDIA || 'false') === 'true',
          }),
        ]),
  ],
  tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.2),
  // Session Replay sampling
  replaysSessionSampleRate: Number(
    import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE || (import.meta.env.DEV ? 1.0 : 0.1)
  ),
  replaysOnErrorSampleRate: Number(
    import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE || 1.0
  ),
  // Setting this option to true will send default PII data to Sentry.
  sendDefaultPii: (import.meta.env.VITE_SENTRY_SEND_DEFAULT_PII || 'true') === 'true',
  debug: import.meta.env.DEV,
  environment: import.meta.env.VITE_SENTRY_ENV || (import.meta.env.DEV ? 'development' : 'production'),
  release: import.meta.env.VITE_APP_RELEASE || '2.0',
});

// Set user context from Supabase authentication
const initializeUserContext = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
      })
    }
  } catch (error) {
    console.debug('Failed to set Sentry user context:', error)
  }
}

initializeUserContext()

<<<<<<< HEAD
// Register service worker for better chunk loading reliability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

=======
// ServiceWorker cleanup - Remove any previously registered service workers
const cleanupServiceWorkers = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      
      if (registrations.length > 0) {
        console.log('Found existing ServiceWorker registrations, cleaning up...', registrations.length)
        
        for (const registration of registrations) {
          try {
            const success = await registration.unregister()
            if (success) {
              console.log('Successfully unregistered ServiceWorker:', registration.scope)
            } else {
              console.warn('Failed to unregister ServiceWorker:', registration.scope)
            }
          } catch (error) {
            console.error('Error unregistering ServiceWorker:', registration.scope, error)
          }
        }
      }
    } catch (error) {
      console.error('Error during ServiceWorker cleanup:', error)
    }
  }
}

// Listen for messages from the cleanup service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'UNREGISTER_SW') {
      console.log('Received cleanup message from ServiceWorker:', event.data.message)
    }
  })
}

// Run cleanup
cleanupServiceWorkers()

>>>>>>> pr-11
// Suppress common browser extension errors to reduce console noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args) => {
  const message = args.join(' ');
  
  // Suppress common extension-related errors
  if (
    message.includes('FrameDoesNotExistError') ||
    message.includes('ERR_FILE_NOT_FOUND') ||
    message.includes('extensionState.js') ||
    message.includes('heuristicsRedefinitions.js') ||
    message.includes('utils.js') ||
    message.includes('THREE.WebGLRenderer: Context Lost') ||
    message.includes('Script error for: chrome-extension://') ||
    message.includes('Non-Error promise rejection captured') && message.includes('Frame')
  ) {
    // Log to debug console but don't show in main console
    console.debug('Suppressed extension error:', ...args);
    return;
  }
  
  // Allow all other errors through
  originalConsoleError.apply(console, args);
};

console.warn = (...args) => {
  const message = args.join(' ');
  
  // Suppress common extension-related warnings
  if (
    message.includes('FrameDoesNotExistError') ||
    message.includes('Failed to load resource: net::ERR_FILE_NOT_FOUND') ||
    message.includes('extensionState.js') ||
    message.includes('heuristicsRedefinitions.js') ||
    message.includes('utils.js')
  ) {
    console.debug('Suppressed extension warning:', ...args);
    return;
  }
  
  // Allow all other warnings through
  originalConsoleWarn.apply(console, args);
};

// Handle uncaught errors that might be from extensions
window.addEventListener('error', (event) => {
  if (
    event.error?.message?.includes('FrameDoesNotExistError') ||
    event.filename?.includes('chrome-extension://') ||
    event.filename?.includes('extensionState.js') ||
    event.filename?.includes('heuristicsRedefinitions.js') ||
    event.filename?.includes('utils.js')
  ) {
    console.debug('Suppressed uncaught extension error:', event.error);
    event.preventDefault();
    return false;
  }
});

// Handle unhandled promise rejections from extensions
window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason?.message?.includes('FrameDoesNotExistError') ||
    event.reason?.toString?.().includes('Frame') &&
    event.reason?.toString?.().includes('does not exist')
  ) {
    console.debug('Suppressed unhandled extension promise rejection:', event.reason);
    event.preventDefault();
    return false;
  }
});

// Sentry Error Boundary Fallback Function
const SentryFallback = ({ error, resetError }: { error: unknown; componentStack: string; eventId: string; resetError(): void; }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
      <div className="mb-4">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Something went wrong</h3>
      <p className="text-sm text-gray-500 mb-4">
        We've been notified about this error and will fix it soon.
      </p>
      <button
        onClick={resetError}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Try again
      </button>
    </div>
  </div>
);

// Wrap App component with Sentry Error Boundary and Convex Provider
const AppWithProviders = (
  <ConvexProvider client={convex}>
    <Sentry.ErrorBoundary fallback={SentryFallback} showDialog>
      <App />
    </Sentry.ErrorBoundary>
  </ConvexProvider>
);

// Add Sentry to window type for TypeScript
declare global {
  interface Window {
    Sentry: typeof Sentry;
  }
}

// Expose Sentry globally for browser console testing
if (typeof window !== "undefined") {
  window.Sentry = Sentry;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PostHogProvider
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
      options={{
        api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        defaults: '2025-05-24',
        capture_exceptions: true,
        debug: import.meta.env.DEV,
      }}
    >
      {AppWithProviders}
    </PostHogProvider>
  </React.StrictMode>,
)
