運動專長檢核系統的主畫面捷徑（跳板頁），做法同 `../xt/`（巡堂觀課）。

- 網址：https://kfsa00-dot.github.io/sa-hub/sport/
- GAS 網頁跑在 Google 的 iframe 裡，直接把系統網址加到主畫面抓不到圖示；從這一頁加到主畫面才會有「四項運動」圖示。
- 在瀏覽器開：停在這頁並教人加到主畫面；從主畫面開（standalone）：自動轉到系統網址。
- 換系統網址只改 index.html 的 `APP_URL`；改任何檔都要把 sw.js 的 `VERSION` 加一。
- 圖示由 `運動專長檢核/素材/icon-2.svg` 轉出：apple-touch-icon 180、icon 192／512 滿版方形，maskable 512 圖案縮 68% 放進安全區。
