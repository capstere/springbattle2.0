const CACHE_NAME = 'varkamp-cache-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/script.js',
  '/manifest.json',
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
  '/assets/images/arcimboldo-spring.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k!==CACHE_NAME).map(k=>caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(rsp => rsp || fetch(e.request))
      .catch(()=>new Response("Offline", { status:503, headers:{ 'Content-Type':'text/plain' } }))
  );
});
