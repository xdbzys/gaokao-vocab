// Self-destructing Service Worker
// This SW unregisters itself and clears all caches to fix path issues
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.registration.unregister(),
      caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  // Pass through all requests without caching
  event.respondWith(fetch(event.request));
});
