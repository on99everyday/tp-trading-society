# TP Trading Society

網站標題是 TP Trading Society。課程仍是 XAUUSD（教學短片區、學園測驗區、VIP群 復盤交流區）。

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
| `locked01` | `locked123` | 未付費學員，已封控。後台「登入封控」會顯示「解除封控」 |

`locked01` 的種子資料含一筆異常地區提示（8 秒內由「廣東 · 廣州」改為「北京 · 北京」）。要在全新種子上測試，請清除瀏覽器 `localStorage` 鍵 `xauusd-course-spa`，或用尚未開過這個站的瀏覽器。已有舊資料的瀏覽器會沿用原本的會員與提示，不會自動補上這筆。

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

Vercel 使用 Vite（`vercel.json`：`framework: vite`，輸出 `dist`）。沒有設定即時通訊時，課程、測驗和本機頻道仍然可以開啟。

## VIP 即時通訊

覆盤區在設定 Supabase 後，會變成跨裝置的即時聊天。VIP 學員（`vip` 未過期）、工作人員和管理員都可以發訊息。工作人員可以把一則訊息標成公告，它會留在同一個聊天室，並在**這部瀏覽器**通知其他 VIP。未設定時，頁面會說明尚未設定，並保留原本只存在這部瀏覽器、只供工作人員發佈的頻道。

登入仍是示範帳號，不使用 Supabase Auth。免費 Supabase 專案即可，不用付費方案。

### 1. 建立 Supabase 專案

1. 到 [supabase.com](https://supabase.com) 建立一個專案。
2. 打開 SQL Editor，貼上並執行 `supabase/migrations/20261105120000_vip_chat.sql`。
3. 這份 SQL 會建立 `vip_channels`、`vip_messages`，加入預設頻道「復盤交流」，並把兩張表放進 `supabase_realtime`。
4. 在 Project Settings → API 複製 Project URL 和 `anon` `public` key。不要把 `service_role` key 放到前端。

因為登入還在瀏覽器，SQL 允許 anon key 讀取和新增訊息。網站只在 `profile.vip` 為真時顯示聊天室，但持有 anon key 的人仍可以直接呼叫 API。不要在訊息裡放秘密。日後改為伺服器登入時再收緊政策。

### 2. Vercel 環境變數

在 Vercel 專案的 Settings → Environment Variables 加入：

| 名稱 | 值 |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase Project URL，例如 `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase `anon` `public` key |

Production 要設定。若有 Preview 部署，Preview 也要同一組。儲存後重新部署。本機把 `.env.example` 複製成 `.env`，填同一組名稱，再執行 `npm run dev`。

沒有這兩個變數時，頁面顯示：「即時通訊尚未設定」，其餘頁面照常運作。

### 會籍標示

後台「權限設定」的帳號表會顯示「基礎」「VIP」「未付費」。VIP 學員若有到期日，會顯示「至 YYYY-MM-DD」或「已於 YYYY-MM-DD 到期」。工作人員和管理員一律顯示 VIP。有「調換人員角色」權限的帳號（預設是管理員）可以調整學員的基礎 / VIP 和到期日。

```bash
npm test
```

若以後改回 Grok 那套 TanStack Start + better-auth，才需要資料庫連線與 `BETTER_AUTH_SECRET` 一類的秘密。目前示範登入沒有這些變數。
