const CACHE_NAME = 'voom-cache-v3'; // Incrementado a v3 para refrescar caché con soporte push
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

// ==========================================
// SOPORTE DE NOTIFICACIONES PUSH EN SEGUNDO PLANO
// ==========================================

self.addEventListener('push', function(event) {
  let data = { title: 'Voom', body: 'Tienes un nuevo comunicado' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || './pasajero.html'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Voom - Comunicado Oficial', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.includes('pasajero.html') || client.url.includes('conductor.html')) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
