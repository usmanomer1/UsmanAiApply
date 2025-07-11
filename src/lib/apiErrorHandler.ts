import toast from 'react-hot-toast';

interface ApiError extends Error {
  status?: number;
  details?: any;
  requestId?: string;
  retryAfter?: string;
}

export const handleApiError = (error: ApiError) => {
  console.error('API Error:', {
    message: error.message,
    status: error.status,
    requestId: error.requestId,
    details: error.details
  });

  // Handle rate limiting
  if (error.status === 429) {
    const retryTime = error.retryAfter || '60';
    toast.error(`Too many requests. Please wait ${retryTime} seconds before trying again.`, {
      duration: 5000,
      icon: '⏱️'
    });
    return;
  }

  // Handle authentication errors
  if (error.status === 401) {
    toast.error('Authentication failed. Please check your API key.', {
      duration: 5000,
      icon: '🔐'
    });
    return;
  }

  // Handle validation errors
  if (error.status === 400 && error.details?.details) {
    const validationErrors = Object.entries(error.details.details)
      .map(([field, errors]) => `${field}: ${(errors as string[]).join(', ')}`)
      .join('\n');
    
    toast.error(`Validation error:\n${validationErrors}`, {
      duration: 5000,
      style: { whiteSpace: 'pre-line' }
    });
    return;
  }

  // Handle server errors
  if (error.status && error.status >= 500) {
    toast.error('Server error. Please try again later.', {
      duration: 5000,
      icon: '🚨'
    });
    
    // Log request ID for debugging
    if (error.requestId) {
      console.log(`Request ID for debugging: ${error.requestId}`);
    }
    return;
  }

  // Default error handling
  toast.error(error.message || 'An unexpected error occurred', {
    duration: 4000
  });
};

// Retry logic for rate-limited requests
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on non-retryable errors
      if (error.status && error.status !== 429 && error.status < 500) {
        throw error;
      }
      
      // Wait before retrying
      const delay = initialDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};