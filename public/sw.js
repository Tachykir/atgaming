/* AT Gaming — service worker
 * - powłoka aplikacji (HTML/CSS/JS/ikony) w cache, strona startuje szybko i działa przy słabym zasięgu,
 * - HTML: najpierw sieć (zawsze świeża wersja), przy braku sieci — kopia z cache lub strona offline,
 * - JS/CSS: najpierw sieć (po wdrożeniu od razu nowy kod zgodny z serwerem), cache tylko awaryjnie,
 * - obrazki/ikony: kopia z cache od razu + odświeżenie w tle,
 * - API, socket.io i logowanie nigdy nie idą przez cache. */
const VERSION = 'atg-v1';
const SHELL = [
  '/', '/offline.html', '/manifest.webmanifest', '/css/casino.css',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png',
  '/js/casino-core.js', '/js/casino-slotkit.js', '/js/pwa.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const BYPASS = /^\/(api|socket\.io|auth|admin)(\/|$)/;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || BYPASS.test(url.pathname)) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      if (res.ok && url.pathname === '/') { const copy = res.clone(); caches.open(VERSION).then(c => c.put('/', copy)); }
      return res;
    }).catch(async () => (await caches.match(req)) || (await caches.match('/')) || caches.match('/offline.html')));
    return;
  }

  if (/\.(js|css|webmanifest)$/.test(url.pathname)) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req)));
    return;
  }

  if (/\.(png|jpg|jpeg|webp|svg|gif|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
