import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
