/* sw.js 的自動化測試。
   用 macOS 內建的 JavaScriptCore（jsc）執行，不需要 node：
     python3 tools/check.py           ← 會自動跑這支
   或手動：
     /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tools/test_sw.js
   （要在專案根目錄執行，因為下面用相對路徑載入 sw.js）

   這裡自己補上瀏覽器才有的 self / fetch / caches / Request / Response / URL 樁，
   載入真正的 sw.js，再模擬各種請求檢查行為。 */

var ORIGIN = 'https://kfsa00-dot.github.io';
var DIR = ORIGIN + '/sa-hub/';

/* ---------- 樁 ---------- */
var handlers = {};
var self = {
  location: { origin: ORIGIN, pathname: '/sa-hub/sw.js' },
  addEventListener: function (type, fn) { handlers[type] = fn; },
  skipWaiting: function () { return Promise.resolve(); },
  clients: { claim: function () { return Promise.resolve(); } }
};

function URL(u) {
  var m = /^(https?:\/\/[^\/]+)(\/[^?#]*)?(\?[^#]*)?/.exec(u);
  if (!m) throw new Error('bad url ' + u);
  this.href = u; this.origin = m[1]; this.pathname = m[2] || '/'; this.search = m[3] || '';
}

function resolve(u) { return u.indexOf('./') === 0 ? DIR + u.slice(2) : u; }
function strip(u) { return u.replace(/\?.*$/, ''); }

function Request(u, init) {
  this.url = resolve(u); this.cache = (init && init.cache) || 'default';
  this.method = 'GET'; this.mode = 'cors';
}

function Res(status, opts) {
  opts = opts || {};
  this.status = status; this.ok = status >= 200 && status < 300;
  this.redirected = !!opts.redirected; this.url = opts.url || ''; this.body = opts.body || '';
}
Res.prototype.clone = function () {
  return new Res(this.status, { redirected: this.redirected, url: this.url, body: this.body });
};
var Response = {
  redirect: function (u, s) { return { kind: 'redirect', url: u, status: s }; },
  error: function () { return { kind: 'error' }; }
};

var addAllLog = [], putLog = [], fetchLog = [];
var caches = {
  _s: {},
  open: function (name) {
    var s = this._s; s[name] = s[name] || {}; var c = s[name];
    return Promise.resolve({
      addAll: function (reqs) {
        reqs.forEach(function (r) { addAllLog.push(r); c[r.url] = new Res(200, { body: 'precache:' + r.url }); });
        return Promise.resolve();
      },
      put: function (r, res) { c[resolve(r.url)] = res; putLog.push(resolve(r.url)); return Promise.resolve(); }
    });
  },
  keys: function () { return Promise.resolve(Object.keys(this._s)); },
  delete: function (n) { delete this._s[n]; return Promise.resolve(true); },
  match: function (r, opts) {
    var want = resolve(typeof r === 'string' ? r : r.url);
    var ig = opts && opts.ignoreSearch;
    for (var n in this._s) {
      var c = this._s[n];
      for (var k in c) {
        if (k === want || (ig && strip(k) === strip(want))) return Promise.resolve(c[k]);
      }
    }
    return Promise.resolve(undefined);
  }
};

var fetchImpl = function () { return Promise.reject(new Error('offline')); };
function fetch(u, init) {
  var url = typeof u === 'string' ? u : u.url;
  fetchLog.push({ url: url, cache: init && init.cache });
  return fetchImpl(url, init);
}

/* ---------- 載入真正的 sw.js ---------- */
load('sw.js');

/* ---------- 測試工具 ---------- */
var passed = 0, failed = [];
function ok(cond, name) { if (cond) passed++; else failed.push(name); }
function flush() {           // 讓 sw.js 裡「不等待」的 cache.put 跑完
  var p = Promise.resolve();
  for (var i = 0; i < 20; i++) p = p.then(function () {});
  return p;
}
function fire(url, mode) {
  var ev = {
    request: { url: url, method: 'GET', mode: mode || 'no-cors' },
    responded: null,
    respondWith: function (p) { this.responded = p; },
    waitUntil: function (p) { this.waited = p; }
  };
  handlers.fetch(ev);
  return ev;
}
function lifecycle(type) {
  var ev = { waited: null, waitUntil: function (p) { this.waited = p; } };
  handlers[type](ev);
  return ev.waited;
}
function online(map) {        // map: url → Res；沒列到的回 200
  fetchImpl = function (url) {
    return Promise.resolve(map && map[url] ? map[url] : new Res(200, { body: 'net:' + url }));
  };
}
function offline() { fetchImpl = function () { return Promise.reject(new Error('offline')); }; }

/* ---------- 測試 ---------- */
(async function () {
  // 路徑判斷
  ok(BASE === '/sa-hub/', 'BASE 應為 /sa-hub/');
  var table = [
    ['/sa-hub/', true], ['/sa-hub/index.html', true], ['/sa-hub/manifest.webmanifest', true],
    ['/sa-hub/qr.png', true], ['/sa-hub/icons/icon-192.png', true],
    ['/sa-hub/sport', false], ['/sa-hub/sport/', false], ['/sa-hub/xt', false],
    ['/sa-hub/xt/index.html', false], ['/sa-hub/icons', false], ['/sa-hub/icons/a/b.png', false],
    ['/sa-hub/README.md', false], ['/sa-hub/tools/check.py', false],
    ['/other/', false], ['/sa-hubx/', false]
  ];
  table.forEach(function (t) { ok(isPortalPath(t[0], BASE) === t[1], 'isPortalPath ' + t[0]); });

  // 子系統、轉址、外站：完全不攔截（回歸測試：/sa-hub/sport 曾變成錯誤頁）
  ok(fire(DIR + 'sport', 'navigate').responded === null, '/sa-hub/sport 導覽不應被攔截');
  ok(fire(DIR + 'xt', 'navigate').responded === null, '/sa-hub/xt 導覽不應被攔截');
  ok(fire(DIR + 'sport/', 'navigate').responded === null, '/sa-hub/sport/ 導覽不應被攔截');
  ok(fire(DIR + 'xt/crest.png').responded === null, 'xt 的圖片不應被攔截');
  ok(fire('https://script.google.com/a/x/exec', 'navigate').responded === null, '外站不應被攔截');

  // install：預先快取要繞過 HTTP 快取
  await lifecycle('install');
  ok(addAllLog.length === ASSETS.length, '應預先快取全部 ASSETS');
  ok(addAllLog.every(function (r) { return r.cache === 'no-cache'; }), '預先快取應使用 cache: no-cache');
  ok(!!caches._s[CACHE], '應建立 ' + CACHE);

  // 線上開首頁：走網路、用 no-cache、寫入快取
  online();
  fetchLog = []; putLog = [];
  var r = await fire(DIR, 'navigate').responded; await flush();
  ok(r && r.body === 'net:' + DIR, '線上開首頁應回傳網路版本');
  ok(fetchLog[0] && fetchLog[0].cache === 'no-cache', '導覽請求應使用 cache: no-cache');
  ok(putLog.indexOf(DIR) !== -1, '成功的回應應寫入快取');

  // 離線開首頁：回快取（剛剛寫入的網路版）
  offline();
  r = await fire(DIR, 'navigate').responded;
  ok(r && r.body === 'net:' + DIR, '離線開首頁應回傳快取');

  // 離線、網址帶查詢字串：仍要找得到
  r = await fire(DIR + '?utm_source=line', 'navigate').responded;
  ok(r && r.body === 'net:' + DIR, '離線且帶查詢字串時應忽略查詢字串找快取');

  // 404 不寫入快取
  online({}); var miss = DIR + 'icons/missing.png';
  online((function () { var m = {}; m[miss] = new Res(404); return m; })());
  putLog = [];
  r = await fire(miss).responded; await flush();
  ok(r && r.status === 404, '404 應原樣回傳');
  ok(putLog.indexOf(miss) === -1, '404 不應寫入快取');

  // 伺服器 5xx：頁面改用快取
  online((function () { var m = {}; m[DIR] = new Res(503); return m; })());
  r = await fire(DIR, 'navigate').responded;
  ok(r && r.body === 'net:' + DIR, '首頁 5xx 時應改用快取');

  // 導覽遇到已轉址的回應：轉成 redirect，不能直接回傳
  online((function () {
    var m = {}; m[DIR + 'index.html'] = new Res(200, { redirected: true, url: DIR }); return m;
  })());
  r = await fire(DIR + 'index.html', 'navigate').responded;
  ok(r && r.kind === 'redirect' && r.url === DIR, '已轉址的導覽回應應改用 Response.redirect');

  // 離線、非導覽、快取沒有：回 Response.error，不能拿首頁頂替
  offline();
  r = await fire(DIR + 'icons/not-cached.png').responded;
  ok(r && r.kind === 'error', '離線找不到的圖片應回 Response.error 而非首頁');

  // activate：只清自己的舊版本
  // 舊版本名稱刻意取一個不可能跟目前 VERSION 撞名的
  var OLD = 'sa-hub-v0-test';
  caches._s[OLD] = {}; caches._s['xt-launch-v1'] = {}; caches._s['sport-launch-v3'] = {};
  await lifecycle('activate');
  ok(!caches._s[OLD], 'activate 應刪除舊版本快取');
  ok(!!caches._s[CACHE], 'activate 應保留目前版本');
  ok(!!caches._s['xt-launch-v1'] && !!caches._s['sport-launch-v3'], 'activate 不應刪除子系統快取');

  print(failed.length ? 'RESULT: FAIL ' + passed + ' passed, ' + failed.length + ' failed' : 'RESULT: PASS ' + passed + ' passed');
  failed.forEach(function (f) { print('  ✗ ' + f); });
})().catch(function (e) { print('RESULT: ERROR ' + e); });
