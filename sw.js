/* 學務處查詢系統 Service Worker
   策略：network-first，網路失敗時回落到快取。
   ★ 只要改了 index.html 的內容（例如 SITES 清單），就把 VERSION 加一。
     否則手機只要有一次抓不到網路，就會回退到舊版本的快取並一直卡著。
     activate 時會自動清掉所有舊版本的快取。 */
const VERSION = 'v4';
const CACHE = 'sa-hub-' + VERSION;

// app shell：相對路徑，才能在 GitHub Pages 子路徑下正常運作
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('sa-hub-') && k !== CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // 只處理本站的 GET；外部查詢系統一律直接走網路
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  // 開啟頁面時強制略過瀏覽器的 HTTP 快取，避免拿到 GitHub Pages
  // 那份 max-age 還沒過期的舊 HTML（清單就是寫在 HTML 裡）
  const fromNetwork = req.mode === 'navigate'
    ? fetch(req.url, { cache: 'no-store' })
    : fetch(req);

  event.respondWith(
    fromNetwork
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit => hit || caches.match('./index.html'))
      )
  );
});
