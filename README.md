# 學務處查詢系統（行動版入口）

把學務處常用的幾個查詢系統集中成一個手機入口網頁，可「加入主畫面」當成 App 使用。

- 純靜態網站：只有原生 HTML / CSS / JavaScript，沒有 build tool、沒有 npm、沒有外部 CDN。
- 支援離線開啟（Service Worker 快取），深色模式自動跟隨系統。
- 可加「常用」（星號），記在瀏覽器 localStorage（key：`sa-hub-favorites`）。
- 首頁會視情況顯示「安裝到主畫面」提示，Android 可一鍵安裝。

## 檔案

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 主體，所有 CSS / JS 都在裡面。**要維護的資料也在這裡** |
| `manifest.webmanifest` | PWA 設定（名稱、圖示、顏色） |
| `sw.js` | Service Worker，network-first、失敗回落快取 |
| `icons/icon-192.png`、`icons/icon-512.png` | App 圖示（圓角、四角透明） |
| `icons/icon-maskable-512.png` | Android 用；系統會裁成圓形，內容已縮在安全區內 |
| `icons/apple-touch-icon.png` | iOS 用；**不透明**，否則加到主畫面四角會透出黑邊 |
| `qr.png` | 推廣用 QR code（含網址文字，可直接列印） |
| `tools/make_icons.py`、`tools/make_qr.py` | 重新產生上面那些圖的腳本，網站本身不會用到 |

---

## 1. 如何新增／修改查詢系統

**只需要改 `index.html` 最上方的 `SITES` 陣列**（檔案開頭 `<script>` 區塊，上面有完整註解）。

```js
const SITES = [
  { id: 'roster', name: '學生名冊查詢', category: '學生資料', note: '需登入校內 Google 帳號',
    url: 'https://.../exec' },
  // ↓ 新增就複製一組貼在這裡
  { id: 'health', name: '健康中心', category: '衛生保健', note: '',
    url: 'https://example.com/' },
];
```

欄位說明：

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `id` | ✅ | 英文小寫代號，不可重複。這是「常用」記錄用的識別碼，**改了會讓使用者已加的星號失效** |
| `name` | ✅ | 卡片上顯示的名稱 |
| `category` | ✅ | 分類名稱。同分類會歸成一區；打新名稱就自動出現新的一區，順序依第一次出現的先後 |
| `note` | | 卡片上的小字備註。不需要就留空字串 `''`，留空不會顯示 |
| `url` | ✅ | 點擊後開新分頁前往的網址 |

刪除項目就把整組 `{ ... }` 刪掉。改完存檔 → 推上 GitHub → 幾十秒後網站就更新。

> **⚠️ 每次改完 `SITES` 都要順手把 `sw.js` 最上面的 `const VERSION` 加一**（`'v3'` → `'v4'` → …），這是必做步驟，不是選配。
>
> 原因：Service Worker 雖然是 network-first，正常上網時會自動抓到新的 `index.html`，但手機只要有**一次**抓不到網路（校內 Wi-Fi 不穩、系統把請求掐掉），就會回退到快取裡那份**建立 VERSION 當下**的舊 HTML，而且在下次成功連線前會一直卡著舊清單。改 VERSION 會讓舊快取在 activate 時被整個刪掉，是唯一能強制汰換的方式。
>
> （2026-09-09 就踩過：新增了兩個系統但沒動 VERSION，手機上那兩筆看起來像「不見了」。）

---

## 2. 如何推到 GitHub 並啟用 Pages

### 第一次上傳

在專案資料夾裡執行：

```bash
git init
git add .
git commit -m "學務處查詢系統入口"
git branch -M main
git remote add origin https://github.com/<你的帳號>/<repo名稱>.git
git push -u origin main
```

（repo 要先在 GitHub 上按 **New repository** 建好，設為 **Public**；GitHub Pages 在免費方案只支援公開 repo。）

### 啟用 GitHub Pages

1. 打開 repo 頁面 → 上方 **Settings**
2. 左側選單 → **Pages**
3. **Source** 選 `Deploy from a branch`
4. **Branch** 選 `main`、資料夾選 `/ (root)` → **Save**
5. 等 1～2 分鐘，同一頁上方會出現網址：
   `https://<你的帳號>.github.io/<repo名稱>/`

網址結尾的斜線 `/` 要保留。

### 之後要更新

```bash
git add .
git commit -m "更新查詢系統清單"
git push
```

---

## 3. 手機如何「加入主畫面」

用手機瀏覽器打開上面那個 Pages 網址，然後：

**iPhone / iPad（必須用 Safari）**
1. 點畫面下方中間的「分享」鍵（方框加向上箭頭 ⬆️）
2. 往下捲，選 **加入主畫面**
3. 確認名稱（預設「學務查詢」）→ 右上角 **新增**

**Android（Chrome）**
1. 點右上角 **⋮** 選單
2. 選 **安裝應用程式**（或 **加到主畫面**）
3. 按 **安裝**

裝好後從主畫面點開，會是全螢幕、沒有網址列，跟 App 一樣。

---

## 4. 推廣與安裝

### QR code

`qr.png` 可以直接列印或貼進公告、LINE 群組，掃了就會開啟網站。網頁最下方也有「推廣用 QR code（可列印）」的連結。

換網址的話，改 `tools/make_qr.py` 最上面的 `URL` 再跑一次：

```bash
python3 tools/make_qr.py
```

（需要 `pip3 install --user segno pillow`。QR 用錯誤更正等級 H，列印後髒污或折到一角仍掃得到。）

### 網頁內建的安裝提示

- **Android Chrome**：瀏覽器判定符合 PWA 條件時會觸發 `beforeinstallprompt`，網頁攔下它，改成顯示「安裝到主畫面」卡片，按「安裝」就跳出系統安裝視窗。
- **iOS Safari**：Apple 沒有提供這個 API，只能顯示文字步驟「點下方分享鍵 → 選加入主畫面」。
- 已經安裝過（`display-mode: standalone`）就不再顯示。
- 使用者按「✕」關掉後不再出現，記錄在 localStorage 的 `sa-hub-install-dismissed`；要讓它重新出現就清掉這個 key。

### 換 App 圖示

改 `tools/make_icons.py` 最上面的 `TEXT_TOP` / `TEXT_BOTTOM`（目前是「光復」「學務」）或顏色，然後：

```bash
python3 tools/make_icons.py
```

四張圖會一次重產。**改完記得把 `sw.js` 的 `VERSION` 加一**，否則手機會繼續用舊快取裡的舊圖示。

---

## 常見問題

**點進去出現「你沒有存取權」？**
那幾個 Google Apps Script 系統只開放校內帳號。請在 Google 頁面右上角的頭像切換到 `@kfps.tp.edu.tw` 帳號，再重新整理。手機建議把校內帳號設為 Google 的預設帳號。

**星號（常用）會同步到別支手機嗎？**
不會。常用只存在該支手機的瀏覽器裡（localStorage），清除瀏覽資料會消失。

---

## 安全性

本專案不含任何帳號、密碼、金鑰或學生個資，只有各系統的公開網址；權限一律由各系統自己的 Google 登入控管。
