// Service Worker for handling dynamic import failures and caching
const CACHE_NAME = 'jobotic-v1';
const DYNAMIC_CACHE = 'jobotic-dynamic-v1';

// Files to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  // Add other critical assets here
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - handle requests with network-first strategy for JS chunks
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle JavaScript chunks (especially dynamic imports)
  if (url.pathname.includes('/assets/') && url.pathname.endsWith('.js')) {
    event.respondWith(
      handleDynamicImport(request)
    );
    return;
  }

  // Handle other requests with cache-first strategy
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          // Return cached version if available
          if (response) {
            return response;
          }
          
          // Otherwise fetch from network and cache
          return fetch(request).then((response) => {
            // Don't cache non-success responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response before caching
            const responseToCache = response.clone();
            
            caches.open(DYNAMIC_CACHE)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return response;
          });
        })
        .catch(() => {
          // Return a fallback for navigation requests when offline
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        })
    );
  }
});

// Enhanced handler for dynamic imports with retry logic
async function handleDynamicImport(request) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to fetch dynamic import (attempt ${attempt}/${maxRetries}):`, request.url);
      
      // Try to fetch from network first
      const response = await fetch(request);
      
      if (response.ok) {
        // Cache successful responses
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, response.clone());
        console.log('Successfully fetched and cached:', request.url);
        return response;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Fetch attempt ${attempt} failed:`, error);
      lastError = error;
      
      // Try cache if network fails
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        console.log('Returning cached version:', request.url);
        return cachedResponse;
      }
      
      // Wait before retrying (except on last attempt)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All attempts failed
  console.error(`Failed to fetch after ${maxRetries} attempts:`, request.url);
  
  // Return a custom error response that the client can handle
  return new Response(
    JSON.stringify({
      error: 'CHUNK_LOAD_FAILED',
      message: `Failed to load ${request.url} after ${maxRetries} attempts`,
      url: request.url,
      lastError: lastError.message
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(DYNAMIC_CACHE).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});