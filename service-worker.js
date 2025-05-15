// service-worker.js

// Unikt namn för din cache. Uppdatera versionen om du vill tvinga en ny install.
const CACHE_NAME = 'varkamp-cache-v5';

// Lista alla resurser du vill cacha vid installation
const URLS_TO_CACHE = [
  '/',                     // rot (nödvändigt för offline-navigering)
  '/index.html',           // startsidan
  '/css/styles.css',       // din styling
  '/js/script.js',         // all logik
  '/manifest.json',        // PWA-manifest
  '/assets/data/puzzles.json',
  '/assets/icons/play.svg',
  '/assets/icons/spring.svg',
  '/assets/icons/fight.svg',
  '/assets/icons/help.svg',
  '/assets/icons/icon-512.png',
  '/assets/audio/correct.mp3',
  '/assets/audio/wrong.mp3',
  '/assets/audio/finish.mp3',
  '/assets/audio/p3-chorus-rev.mp3',
  '/assets/audio/sos-morse.mp3',
  '/assets/images/stego.png',
  '/assets/images/arcimboldo-spring-thumb.jpg',
  '/assets/images/arcimboldo-spring.jpg'
];

// INSTALL: cachar allt och tar direkt över som aktiv SW
self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
  );
  // Aktivera den här SW direkt utan att vänta på sidladdning
  self.skipWaiting();
});

// ACTIVATE: rensa gamla caches och ta kontroll över klienterna
self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => 
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)  // behåll bara den nuvarande cachen
            .map(key => caches.delete(key))     // radera äldre caches
        )
      )
      .then(() => self.clients.claim())        // ta kontroll över alla sidor
  );
});

// FETCH: cache-first strategi med nätverks-fallback
self.addEventListener('fetch', event => {
  const req = event.request;

  // För navigeringsförfrågningar offline: servera index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // För övriga requests: slå upp i cache, annars hämta nätverk
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        return cached;
      }
      return fetch(req)
        .then(networkResponse => {
          // (Valfritt) cacha nya resurser dynamiskt
          // return caches.open(CACHE_NAME).then(cache => {
          //   cache.put(req, networkResponse.clone());
          //   return networkResponse;
          // });
          return networkResponse;
        });
    })
    .catch(() => {
      // Offline-fallback för text-begäran
      if (req.headers.get('accept')?.includes('text/html')) {
        return caches.match('/index.html');
      }
      // Annars ett enkelt textmeddelande
      return new Response("Offline – ingen anslutning", {
        status: 503,
        statusText: "Service Unavailable",
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
    })
  );
});