// Service worker: hra funguje offline.
// Stratégia: najprv sieť (aby sa hneď prejavili nové verzie), pri výpadku cache.
const CACHE = 'artikel-jackpot-v5';
const FILES = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'js/words.js',
  'js/engine.js',
  'js/store.js',
  'js/audio.js',
  'js/ui.js',
  'fonts/fonts.css',
  'fonts/fraunces-latin.woff2',
  'fonts/fraunces-latin-ext.woff2',
  'fonts/limelight-latin.woff2',
  'fonts/limelight-latin-ext.woff2',
  'fonts/outfit-latin.woff2',
  'fonts/outfit-latin-ext.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html')))
  );
});
