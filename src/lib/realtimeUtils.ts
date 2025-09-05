import { supabase, isRealtimeSupported } from './supabase';

/**
 * Safe wrapper for Supabase realtime subscriptions that handles browser compatibility
 * and provides fallback mechanisms for Safari 15.6.1 and other incompatible browsers
 */

export interface RealtimeSubscriptionOptions {
  channel: string;
  table: string;
  schema?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  onData: (payload: any) => void;
  onError?: (error: any) => void;
  onStatusChange?: (status: string) => void;
}

export interface SafeRealtimeSubscription {
  unsubscribe: () => void;
  isActive: boolean;
}

/**
 * Creates a safe realtime subscription that automatically handles browser compatibility
 * and provides graceful fallbacks for unsupported browsers
 */
export const createSafeRealtimeSubscription = (
  options: RealtimeSubscriptionOptions
): SafeRealtimeSubscription => {
  let subscription: any = null;
  let isActive = false;

  // Check if realtime is supported before attempting to create subscription
  if (!isRealtimeSupported()) {
    console.log(`Realtime not supported, skipping subscription for ${options.table}`);
    options.onStatusChange?.('unsupported');
    
    return {
      unsubscribe: () => {
        // No-op for unsupported browsers
      },
      isActive: false
    };
  }

  try {
    subscription = supabase
      .channel(options.channel)
      .on(
        'postgres_changes',
        {
          event: options.event || '*',
          schema: options.schema || 'public',
          table: options.table,
          ...(options.filter && { filter: options.filter })
        },
        (payload) => {
          try {
            options.onData(payload);
          } catch (error) {
            console.error(`Error handling realtime data for ${options.table}:`, error);
            options.onError?.(error);
          }
        }
      )
      .subscribe((status) => {
        console.log(`Realtime subscription status for ${options.table}:`, status);
        options.onStatusChange?.(status);
        
        if (status === 'SUBSCRIBED') {
          isActive = true;
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          isActive = false;
        }
      });

  } catch (error) {
    console.error(`Failed to create realtime subscription for ${options.table}:`, error);
    options.onError?.(error);
    
    return {
      unsubscribe: () => {
        // No-op for failed subscriptions
      },
      isActive: false
    };
  }

  return {
    unsubscribe: () => {
      if (subscription) {
        try {
          subscription.unsubscribe();
          isActive = false;
        } catch (error) {
          console.warn(`Error unsubscribing from ${options.table}:`, error);
        }
      }
    },
    isActive
  };
};

/**
 * Creates a safe realtime subscription with automatic retry logic
 * for better resilience in unstable network conditions
 */
export const createResilientRealtimeSubscription = (
  options: RealtimeSubscriptionOptions & {
    maxRetries?: number;
    retryDelay?: number;
  }
): SafeRealtimeSubscription => {
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 5000;
  let retryCount = 0;
  let currentSubscription: SafeRealtimeSubscription | null = null;
  let retryTimeout: NodeJS.Timeout | null = null;

  const createSubscription = (): SafeRealtimeSubscription => {
    return createSafeRealtimeSubscription({
      ...options,
      onStatusChange: (status) => {
        options.onStatusChange?.(status);
        
        // Handle connection failures with retry logic
        if ((status === 'CLOSED' || status === 'CHANNEL_ERROR') && retryCount < maxRetries) {
          retryCount++;
          console.log(`Realtime connection failed for ${options.table}, retrying (${retryCount}/${maxRetries}) in ${retryDelay}ms`);
          
          retryTimeout = setTimeout(() => {
            if (currentSubscription) {
              currentSubscription.unsubscribe();
            }
            currentSubscription = createSubscription();
          }, retryDelay);
        }
      },
      onError: (error) => {
        options.onError?.(error);
        
        // Reset retry count on successful recovery
        if (retryCount > 0) {
          console.log(`Realtime connection recovered for ${options.table}`);
          retryCount = 0;
        }
      }
    });
  };

  currentSubscription = createSubscription();

  return {
    unsubscribe: () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      if (currentSubscription) {
        currentSubscription.unsubscribe();
        currentSubscription = null;
      }
    },
    get isActive() {
      return currentSubscription?.isActive || false;
    }
  };
};

/**
 * Utility function to check if current browser has known WebSocket issues
 */
export const getBrowserCompatibilityInfo = () => {
  const userAgent = navigator.userAgent;
  const issues: string[] = [];

  if (userAgent.includes('Safari/') && userAgent.includes('Version/15.6.1')) {
    issues.push('Safari 15.6.1 has known WebSocket security policy issues');
  }

  if (!window.WebSocket) {
    issues.push('WebSocket not supported');
  }

  return {
    isSupported: isRealtimeSupported(),
    issues,
    userAgent,
    recommendation: issues.length > 0 
      ? 'Consider updating your browser for full functionality' 
      : 'Browser fully supports realtime features'
  };
};