// service-worker.js

const CACHE_NAME = 'varkamp-cache-v1';
const URLS_TO_CACHE = [
  '/',                   // Roten
  '/index.html',
  '/css/styles.css',
  '/js/script.js',
  '/manifest.json',
  '/assets/data/puzzles.json',         // Gåtor + statiska sidor
  '/assets/icons/play.svg',
  '/assets/icons/spring.svg',
  '/assets/icons/fight.svg',
  '/assets/icons/help.svg',
  '/assets/audio/correct.mp3',
  '/assets/audio/wrong.mp3',
  '/assets/audio/finish.mp3',
  '/assets/audio/p3-chorus-rev.mp3',
  '/assets/audio/sos-morse.mp3',
  '/assets/images/stego.png',
  '/assets/images/arcimboldo-spring-thumb.jpg',
  '/assets/images/arcimboldo-spring.jpg',
  '/assets/images/icon-512.png'        // Startsides-ikon
];

// När service worker installeras: cacha allt
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

// När ny version aktiveras: rensa gamla caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// På fetch: försök från cache, annars nätet, annars offline-meddelande
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
      .catch(() => new Response("Offline – ingen anslutning", {
        status: 503,
        statusText: "Service Unavailable",
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      }))
  );
});