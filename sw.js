/**
 * sw.js - Service Worker do Mamma Mia Control
 * Cache básico para funcionamento offline e instalação como PWA
 */

const CACHE_NAME = 'mamma-mia-control-v3';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/src/main.js',
  '/src/data.js',
  '/src/chart-setup.js',
  '/src/integration.js',
  '/logo-mamma-mia.jpg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

// Instalação: cacheia os arquivos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Algumas assets não puderam ser cacheadas:', err);
      });
    })
  );
  self.skipWaiting();
});

// Ativação: limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: estratégia "network first, fallback to cache"
// Garante que o usuário sempre veja dados atualizados quando online,
// mas o app continua abrindo mesmo offline (com a última versão salva)
self.addEventListener('fetch', (event) => {
  // Não intercepta chamadas para Google Sheets / APIs externas (CSV dinâmico)
  if (event.request.url.includes('docs.google.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Atualiza o cache com a versão mais recente
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Sem internet: tenta servir do cache
        return caches.match(event.request);
      })
  );
});
