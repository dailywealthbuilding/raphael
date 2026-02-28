// Raphael AI — Service Worker v3
// Enables offline mode, caching, and PWA features

const CACHE_NAME = 'raphael-v3-cache';
const OFFLINE_URL = '/raphael/raphael.html';

// Files to cache immediately on install
const PRECACHE_URLS = [
  '/raphael/raphael.html',
  '/raphael/manifest.json',
  '/raphael/icon-192.png',
  '/raphael/icon-512.png',
];

// Install — cache core files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        // Don't fail install if some files don't exist yet
        console.log('Cache install warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch — network first, cache fallback
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go network-first for API calls (Groq, OpenRouter, weather, crypto)
  const isApiCall = [
    'api.groq.com',
    'openrouter.ai',
    'api.anthropic.com',
    'api.duckduckgo.com',
    'api.openmeteo',
    'open-meteo.com',
    'api.coingecko.com',
    'en.wikipedia.org',
    'api.pexels.com',
    'pixabay.com',
    'image.pollinations.ai',
    'tavily.com',
    'geocoding-api',
  ].some(domain => url.hostname.includes(domain) || url.host.includes(domain));

  if (isApiCall) {
    // Pure network for API calls — no caching
    return;
  }

  // For app files — cache first, network fallback
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;

        return fetch(event.request).then(response => {
          // Cache successful responses for app files
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          // Offline fallback — return cached main app
          if (event.request.destination === 'document') {
            return caches.match(OFFLINE_URL);
          }
        });
      })
    );
  }
});

// Background sync for when connection returns
self.addEventListener('sync', event => {
  if (event.tag === 'raphael-sync') {
    console.log('Raphael: background sync triggered');
  }
});

// Push notifications (future use)
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title = data.title || 'Raphael AI';
  const options = {
    body: data.body || 'New message from Raphael',
    icon: '/raphael/icon-192.png',
    badge: '/raphael/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'raphael-notification',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
