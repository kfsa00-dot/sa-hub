/* 學務處查詢系統 Service Worker
   策略：network-first，網路失敗時回落到快取。
   ★ 只要改了 index.html 的內容（例如 SITES 清單），就把 VERSION 加一。
     否則手機只要有一次抓不到網路，就會回退到舊版本的快取並一直卡著。
     activate 時會自動清掉所有舊版本的快取。
     改完可跑 python3 tools/check.py，它會檢查這條規則。 */
const VERSION = 'v6';
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

// 這支 SW 所在的目錄，例如 '/sa-hub/'
const BASE = self.location.pathname.replace(/[^/]*$/, '');

/* 只有入口自己的檔案才由這支 SW 處理。
   同一個 repo 底下還有 xt/、sport/ 等子系統，它們有各自的 Service Worker；
   入口若去攔截，離線時會把入口首頁當成它們的頁面回傳，
   遇到轉址（例如少打結尾斜線的 /sa-hub/sport）也會變成錯誤頁。 */
function isPortalPath(pathname, base) {
  if (pathname.indexOf(base) !== 0) return false;
  const rest = pathname.slice(base.length);
  return rest === '' ||
         rest === 'index.html' ||
         rest === 'manifest.webmanifest' ||
         rest === 'qr.png' ||
         /^icons\/[^/]+$/.test(rest);
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      // cache: 'no-cache'：預先快取時一定向伺服器確認，
      // 不能從瀏覽器 HTTP 快取撿到改版前的舊 index.html
      .then(cache => cache.addAll(ASSETS.map(u => new Request(u, { cache: 'no-cache' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        // 只清自己的舊版本；xt-launch-*、sport-launch-* 等子系統的快取不能動
        keys.filter(k => k.startsWith('sa-hub-') && k !== CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function fromCache(req, isNav) {
  return caches.match(req, { ignoreSearch: isNav })
    .then(hit => hit || (isNav ? caches.match('./index.html') : undefined));
}

self.addEventListener('fetch', event => {
  const req = event.request;

  // 只處理本站、入口自己的 GET；外部查詢系統與子系統一律直接走網路
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!isPortalPath(url.pathname, BASE)) return;

  const isNav = req.mode === 'navigate';

  // 開啟頁面時一律向伺服器重新驗證（no-cache：內容沒變只回 304，省流量），
  // 避免拿到 GitHub Pages 那份 max-age 還沒過期的舊 HTML（清單就寫在 HTML 裡）
  const network = isNav ? fetch(req.url, { cache: 'no-cache' }) : fetch(req);

  event.respondWith(
    network
      .then(res => {
        // 導覽請求不能直接回傳「已轉址」的回應，否則瀏覽器會顯示錯誤頁
        if (isNav && res.redirected) return Response.redirect(res.url, 302);

        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
          return res;
        }
        // 404 等錯誤不寫進快取，免得蓋掉好的版本；
        // 伺服器暫時故障（5xx）時，頁面改用快取，至少還打得開
        if (isNav && res.status >= 500) {
          return fromCache(req, isNav).then(hit => hit || res);
        }
        return res;
      })
      .catch(() =>
        fromCache(req, isNav).then(hit => hit || Response.error())
      )
  );
});
