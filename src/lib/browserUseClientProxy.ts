// Proxy wrapper for BrowserUseClient that routes through Netlify function when needed
import { BrowserUseClient } from './browserUseClient';

export class BrowserUseClientProxy extends BrowserUseClient {
  private useNetlifyFunction: boolean;
  private originalApiKey: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.browser-use.com/api/v1') {
    // If no API key or using 'proxy', we'll use the Netlify function
    const shouldUseFunction = !apiKey || apiKey === '' || apiKey === 'proxy';
    super(shouldUseFunction ? 'dummy-key' : apiKey, baseUrl);
    
    this.useNetlifyFunction = shouldUseFunction;
    this.originalApiKey = apiKey;
    
    if (this.useNetlifyFunction) {
      console.log('BrowserUseClientProxy: Using Netlify function for API calls');
      this.interceptFetchCalls();
    } else {
      console.log('BrowserUseClientProxy: Using direct API calls with key');
    }
  }

  private interceptFetchCalls() {
    // Store the original fetch
    const originalFetch = window.fetch;
    
    // Override fetch to intercept browser-use API calls
    (window as any).fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
      
      // Check if this is a browser-use API call
      if (urlString.includes('api.browser-use.com')) {
        // Extract the endpoint
        const endpoint = urlString.replace('https://api.browser-use.com/api/v1', '').replace('https://api.browser-use.com/v1', '');
        
        // Parse body if it exists
        let body = undefined;
        if (init?.body) {
          try {
            body = JSON.parse(init.body as string);
          } catch {
            body = init.body;
          }
        }
        
        // Route through Netlify function
        return originalFetch('/.netlify/functions/browser-use-api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            method: init?.method || 'GET',
            endpoint: endpoint,
            body: body,
          }),
        });
      }
      
      // For all other requests, use original fetch
      return originalFetch(url, init);
    };
  }
}