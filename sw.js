/* KIBERBEZ — service worker: офлайн-кеш статики */
const CACHE_NAME = 'kiberbez-v1';
const ASSETS = [
  './', './index.html', './manifest.json',
  './css/styles.css',
  './js/config.js', './js/app.js', './js/game.js',
  './logo.png', './bear-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Supabase и CDN никогда не кешируем — только живые данные
  if (url.hostname.includes('supabase') || url.hostname.includes('unpkg') ||
      url.hostname.includes('jsdelivr')) return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => hit))
  );
});
