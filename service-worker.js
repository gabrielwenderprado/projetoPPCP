const CACHE_NAME = 'dashboard-estoque-v3';
const APP_FILES = [
  './', './index.html', './assets/app.js', './assets/styles.css',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png',
  './data/explosao.json', './data/plano-mes.json', './data/programacao-modelos.json', './data/chaparias.json',
  './data/cabines.json', './data/pinos.json', './data/cilindros.json',
  './data/historico-estoque.json', './data/consumiveis.json'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request))
  );
});
