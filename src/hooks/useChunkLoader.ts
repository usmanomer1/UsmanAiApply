import { useState, useCallback } from 'react';

interface ChunkLoadState {
  isLoading: boolean;
  error: Error | null;
  retryCount: number;
}

interface UseChunkLoaderReturn {
  loadChunk: (chunkName: string, loader: () => Promise<any>) => Promise<any>;
  clearError: () => void;
  state: ChunkLoadState;
}

/**
 * Hook for managing chunk loading with retry logic and error handling
 */
export function useChunkLoader(): UseChunkLoaderReturn {
  const [state, setState] = useState<ChunkLoadState>({
    isLoading: false,
    error: null,
    retryCount: 0
  });

  const loadChunk = useCallback(async (chunkName: string, loader: () => Promise<any>) => {
    const maxRetries = 3;
    let attempt = 0;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    while (attempt < maxRetries) {
      try {
        const result = await loader();
        setState(prev => ({ ...prev, isLoading: false, error: null, retryCount: 0 }));
        return result;
      } catch (error) {
        attempt++;
        console.error(`Failed to load chunk ${chunkName} (attempt ${attempt}/${maxRetries}):`, error);
        
        setState(prev => ({ ...prev, retryCount: attempt }));
        
        if (attempt >= maxRetries) {
          const finalError = new Error(`Failed to load ${chunkName} after ${maxRetries} attempts: ${error}`);
          setState(prev => ({ ...prev, isLoading: false, error: finalError }));
          throw finalError;
        }
        
        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null, retryCount: 0 }));
  }, []);

  return {
    loadChunk,
    clearError,
    state
  };
}

/**
 * Test function to verify chunk loading behavior
 */
export async function testChunkLoading() {
  console.log('🧪 Testing chunk loading behavior...');
  
  const tests = [
    {
      name: 'MacOSDashboard',
      loader: () => import('../components/MacOSDashboard')
    },
    {
      name: 'JobSearchConvex', 
      loader: () => import('../components/JobSearchConvex')
    },
    {
      name: 'ProfilePage',
      loader: () => import('../components/ProfilePage')
    },
    {
      name: 'ApplicationsPage',
      loader: () => import('../components/applications/ApplicationsPage')
    }
  ];

  const results = [];

  for (const test of tests) {
    try {
      console.log(`Testing ${test.name}...`);
      const startTime = performance.now();
      await test.loader();
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);
      
      results.push({
        name: test.name,
        status: 'success',
        loadTime: `${loadTime}ms`
      });
      
      console.log(`✅ ${test.name} loaded successfully in ${loadTime}ms`);
    } catch (error) {
      results.push({
        name: test.name,
        status: 'failed',
        error: error.message
      });
      
      console.error(`❌ ${test.name} failed to load:`, error);
    }
  }

  console.log('\n📊 Test Results:');
  console.table(results);
  
  const successCount = results.filter(r => r.status === 'success').length;
  const totalCount = results.length;
  
  console.log(`\n🎯 Success Rate: ${successCount}/${totalCount} (${Math.round(successCount/totalCount*100)}%)`);
  
  return results;
}