const CACHE_NAME = 'voom-cache-v2'; // Al cambiar v1 a v2 se borra la caché vieja del teléfono automáticamente
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './js/pasajero.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Instalación y activación inmediata
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache); // Elimina mapas y scripts antiguos
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia Network First (Prioriza siempre descargar de GitHub antes de consultar caché local)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
