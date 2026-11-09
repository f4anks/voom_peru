const CACHE_NAME = 'voom-cache-v6'; // <--- Incrementado a v6
const urlsToCache = [
  './',
  './index.html',
  './selector.html',
  './manifest.json',
  './js/index.js',
  './js/mapa.js',
  './js/anuncios.js',
  './js/pasajero.js',
  './js/conductor.js',
  './js/admin.js',
  './pasajero.html',
  './conductor.html',
  './admin.html',
  './registro_cond.html',
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
            console.log('Eliminando caché antiguo:', cache);
            return caches.delete(cache); // Elimina cachés de versiones anteriores (v1, v2, v3, v4, v5)
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia Network First robusta (Busca red fresca primero, actualiza caché y si falla usa respaldo)
self.addEventListener('fetch', event => {
  // Ignorar peticiones que no sean GET (como llamadas a Supabase o API externas)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Si la red responde correctamente, clonamos la respuesta fresca y la guardamos en caché
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Si no hay red (offline), buscamos en el caché
        return caches.match(event.request);
      })
  );
});

// ==========================================
// NOTIFICACIONES PUSH EN SEGUNDO PLANO
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
