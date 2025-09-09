// Cleanup ServiceWorker - This file exists solely to unregister the previous ServiceWorker
// Once browsers fetch this file, it will immediately unregister itself

console.log('Cleanup ServiceWorker: Starting unregistration process');

// Unregister this service worker immediately
self.addEventListener('install', function(event) {
  console.log('Cleanup ServiceWorker: Install event - proceeding to unregister');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('Cleanup ServiceWorker: Activate event - unregistering all service workers');
  
  event.waitUntil(
    // Get all client windows
    self.clients.matchAll({ type: 'window' }).then(function(clients) {
      // For each client, try to unregister the service worker
      clients.forEach(function(client) {
        client.postMessage({
          type: 'UNREGISTER_SW',
          message: 'Service Worker cleanup initiated'
        });
      });
      
      // Unregister this service worker
      return self.registration.unregister().then(function() {
        console.log('Cleanup ServiceWorker: Successfully unregistered');
        return self.clients.claim();
      }).catch(function(error) {
        console.log('Cleanup ServiceWorker: Error during unregistration:', error);
      });
    })
  );
});

// Handle any fetch events during the cleanup process
self.addEventListener('fetch', function(event) {
  // During cleanup, just pass through all requests to the network
  event.respondWith(fetch(event.request));
});

console.log('Cleanup ServiceWorker: Cleanup script loaded');