import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Detects if the current browser is Safari
 */
export function isSafari(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent;
  
  // Check for Safari but exclude Chrome-based browsers that also contain "Safari" in UA
  return /^((?!chrome|android).)*safari/i.test(userAgent);
}

/**
 * Checks if WebSocket is available and functional
 */
export function isWebSocketSupported(): boolean {
  return typeof WebSocket !== 'undefined';
}

/**
 * Safely creates a WebSocket connection with error handling
 */
export function createSafeWebSocketConnection(url: string): Promise<WebSocket | null> {
  return new Promise((resolve) => {
    try {
      if (!isWebSocketSupported()) {
        console.warn('WebSocket not supported in this environment');
        resolve(null);
        return;
      }

      const ws = new WebSocket(url);
      
      // Set a timeout for connection
      const timeout = setTimeout(() => {
        ws.close();
        console.warn('WebSocket connection timeout');
        resolve(null);
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        resolve(ws);
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        console.warn('WebSocket connection failed:', error);
        resolve(null);
      };

    } catch (error) {
      console.warn('Failed to create WebSocket:', error);
      resolve(null);
    }
  });
}

/**
 * Implements exponential backoff retry logic for failed operations
 */
export function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  return new Promise((resolve, reject) => {
    let retryCount = 0;

    const attemptOperation = async () => {
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        retryCount++;
        
        if (retryCount >= maxRetries) {
          reject(error);
          return;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), maxDelay);
        
        console.warn(`Operation failed, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries}):`, error);
        
        setTimeout(attemptOperation, delay);
      }
    };

    attemptOperation();
  });
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}  