// Service worker: guarda los archivos de la app para que abra sin internet.
// Cuando cambies algún archivo, sube el número de VERSION para que el teléfono baje lo nuevo.
const VERSION = 'rifas-v3';
const ARCHIVOS = [
  './', './index.html', './styles.css', './app.js', './imagen.js', './db-local.js', './inicio-local.js',
  './vendor/pouchdb.min.js', './manifest.webmanifest',
  './iconos/icono-192.png', './iconos/icono-512.png', './iconos/apple-touch-icon.png', './iconos/favicon.png'
];

self.addEventListener('install', e => {
  // cache:'reload' obliga a bajar la versión nueva del servidor, sin usar la copia vieja del navegador.
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Archivos de la app: primero la copia guardada (abre al instante y sin internet)
// y en segundo plano se actualiza la copia. Lo de otros sitios (la sincronización) no se toca.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const guardado = await cache.match(e.request, { ignoreSearch: true });
    const red = fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) cache.put(e.request, r.clone()); return r; }).catch(() => null);
    return guardado || (await red) || cache.match('./index.html');
  }));
});
