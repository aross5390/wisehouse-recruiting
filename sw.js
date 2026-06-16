// Wise House Recruiting — Service Worker
const CACHE_NAME = 'wh-recruiting-v1';
const SHEET_URL_PATTERN = 'script.google.com';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/index.html',
  'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap'
];

// Install — cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('SW: Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.log('SW: Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — serve from cache when offline, network when online
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Always go network-first for Google Apps Script (live data)
  if (url.includes(SHEET_URL_PATTERN) || url.includes('googleapis.com/v1/messages') || url.includes('anthropic.com') || url.includes('zapier.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // If network fails for API calls, return empty success response
        return new Response(JSON.stringify({ success: false, error: 'Offline', candidates: [] }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // For everything else: network first, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline — serve from cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // For navigation requests, serve index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});
