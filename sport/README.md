運動專長檢核系統的主畫面捷徑（跳板頁），做法同 `../xt/`（巡堂觀課）。

- 網址：https://kfsa00-dot.github.io/sa-hub/sport/
- GAS 網頁跑在 Google 的 iframe 裡，直接把系統網址加到主畫面抓不到圖示；從這一頁加到主畫面才會有「四項運動」圖示。
- 在瀏覽器開：停在這頁並教人加到主畫面；從主畫面開（standalone）：自動轉到系統。
- 「開啟系統」先到 Google 帳戶選擇頁（`AccountChooser?hd=kfps.tp.edu.tw&continue=系統網址`）：只列學校帳號、可「使用其他帳戶」登入，選好自動進系統。
  原因：瀏覽器只登入個人 Gmail 時，直接開系統網址會被 Google 擋（系統只開放學校網域）。另有小連結可直接開系統。
- 換系統網址只改 index.html 的 `APP_URL`；改任何檔都要把 sw.js 的 `VERSION` 加一。
- 圖示由 `運動專長檢核/素材/icon-2.svg` 轉出：apple-touch-icon 180、icon 192／512 滿版方形，maskable 512 圖案縮 68% 放進安全區。
