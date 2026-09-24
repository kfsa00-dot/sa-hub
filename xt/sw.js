/* 巡堂觀課 主畫面捷徑 Service Worker
   只快取這個跳板頁本身；巡堂系統本體（script.google.com）一律走網路，不快取。
   改版時把 VERSION 加一，activate 會自動清掉舊快取。 */
const VERSION = 'v1';
const CACHE = 'xt-launch-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './crest.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('xt-launch-') && k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;   // 巡堂系統不攔
  event.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
