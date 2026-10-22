校園事件流程檢核系統（霸凌、性平、中輟、食物中毒等事件的法定期限檢核）。

- 單一檔案 `index.html`，React / Babel 由 unpkg CDN 載入（固定版本＋SRI 驗證）。
- 案件資料只存在使用者自己的瀏覽器 localStorage（key：`school_incidents`），不會上傳到 GitHub 或任何伺服器；換裝置或換瀏覽器請用頁面上的「匯出／匯入備份」。
- 原始開發資料夾：`code/校園事件流程檢核系統/`，改版後把 `index.html` 複製到這裡再推上 GitHub。
- 網址加 `?selftest` 可執行內建自我檢測。
