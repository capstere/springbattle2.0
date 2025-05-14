const CACHE_NAME = 'varkamp-cache-v5';
const URLS_TO_CACHE = [
  '',                 // Roten (index.html)
  'index.html',
  'css/styles.css?v=4',
  'js/script.js?v=4',
  'manifest.json',
  'assets/data/puzzles.json',
  'assets/icons/play.svg',
  'assets/icons/spring.svg',
  'assets/icons/fight.svg',
  'assets/icons/help.svg',
  'assets/icons/icon-512.png',
  'assets/audio/correct.mp3',
  'assets/audio/wrong.mp3',
  'assets/audio/finish.mp3',
  'assets/audio/p3-chorus-rev.mp3',
  'assets/audio/sos-morse.mp3',
  'assets/images/stego.png',
  'assets/images/arcimboldo-spring-thumb.jpg',
  'assets/images/arcimboldo-spring.jpg'
];

// Install: cachea alla resurser
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

// Activate: rensa gamla caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: försök hämta från cache, annars nätet
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
      .catch(() =>
        new Response('Offline – ingen anslutning', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        })
      )
  );
});