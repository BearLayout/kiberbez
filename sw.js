/* KIBERBEZ — service worker: офлайн-кеш статики */
const CACHE_NAME = 'kiberbez-v1.2';
const ASSETS = [
  './', './index.html', './manifest.json',
  './css/styles.css',
  './js/config.js', './js/app.js', './js/game.js',
  './logo.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // POST/PUT/DELETE и прочие методы не кешируем — пропускаем напрямую в сеть
  if (req.method !== 'GET') return;

  // Запросы к чужим доменам (Supabase, шрифты, CDN) — тоже мимо кеша
  if (!req.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
