const CACHE_NAME = 'noet-v1';
const CACHE_ROUTES = [
  '/',
  '/archive',
  '/about',
  '/settings'
];

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/offline.html'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first strategy with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle API requests with network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache successful GET responses for safe endpoints
          if (
            response.status === 200 &&
            (url.pathname === '/api/posts' || 
             url.pathname === '/api/settings' ||
             url.pathname.match(/^\/api\/posts\/\d+$/))
          ) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Try to return cached API response
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // For offline posts request, return empty array
            if (url.pathname === '/api/posts') {
              return new Response(JSON.stringify([]), {
                headers: { 'Content-Type': 'application/json' }
              });
            }
            throw new Error('Network error and no cache available');
          });
        })
    );
    return;
  }

  // Handle navigation requests with cache first, then network
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/').then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).catch(() => {
          return caches.match('/offline.html') || new Response('Offline', { status: 503 });
        });
      })
    );
    return;
  }

  // Handle static assets with cache first strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(request).then((response) => {
        // Cache successful responses for static assets
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Return a basic offline response for failed requests
        if (request.destination === 'image') {
          return new Response('', { status: 200 });
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Handle background sync for posting when back online
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);
  // Could implement background sync for creating/updating posts when back online
});

// Handle push notifications (future enhancement)
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');
  // Could implement push notifications for new posts
});

console.log('[SW] Service Worker loaded');