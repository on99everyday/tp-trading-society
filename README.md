# TP Trading Society

XAUUSD 課程（教學短片區、學園測驗區、VIP群 復盤交流區）。

`/` 是課程 SPA。登入後首頁有三個入口，和 [shadow-lotus-zippy-king.grok.me](https://shadow-lotus-zippy-king.grok.me) 同一產品表面。舊的靜態頁已移到 `archive/static-xauusd/`，不再作為網站入口。

GitHub 上的 `on99everyday/shadow-lotus-zippy-king` 在這個環境讀不到（倉庫不存在或 token 沒有權限）。畫面、測驗題和流程是從該站已上線的 TanStack Start 套件還原的。測驗題沒有另外新增。Grok OAuth、better-auth 和資料庫沒有帶上；會員狀態、短片、頻道和觀看紀錄存在瀏覽器 `localStorage`（鍵名 `xauusd-course-spa`），所以 Vercel 正式環境不用額外秘密也能開啟三個區域。

## 示範登入

沿用舊靜態站的帳號。名稱就是登入名稱。

| 名稱 | 密碼 | 可以看到 |
| --- | --- | --- |
| `demo` | `demo1234` | 學員。已開通基礎會員與 VIP，可進短片、測驗、復盤區 |
| `admin` | `admin123` | 管理員。三個區域加後台 |
| `student01` | `xau2024` | 未付費學員，會被帶到收費頁 |
| `student02` | `gold888` | 同上 |
| `student03` | `trade666` | 同上 |
| `student04` | `fx2024` | 同上 |
| `student05` | `xau8888` | 同上 |

新註冊的密碼至少 8 位。收費頁的「支付」在示範環境不會扣款，按下即開通。Google / X 登入需要 Grok OAuth，這裡未接上。

## 本機

```bash
npm install
npm run dev
```

正式建置：

```bash
npm run build
npm run preview
```

Vercel 使用 Vite（`vercel.json`：`framework: vite`，輸出 `dist`）。不需要環境變數。

若以後改回 Grok 那套 TanStack Start + better-auth，才需要資料庫連線與 `BETTER_AUTH_SECRET` 一類的秘密。目前這份示範版沒有這些變數。
