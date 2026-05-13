# 大自在山活動報名系統 — 專案規約

> 本文件是 **本專案的強制規約**，任何新功能、修改、發版都必須遵守。
> Stack：Next.js 14 (App Router) + Cloud SQL (MySQL 8) on Cloud Run，部署透過 `cloudbuild.yaml`。

---

## 版號規則（必遵）

### 格式

```
v<YYMMDD>.<SS>
```

| 欄位 | 說明 | 範例 |
|---|---|---|
| `v`     | 固定字元，永遠是小寫 v                      | `v` |
| `YYMMDD`| 年月日各 2 碼（年取後兩碼，月日 0 補滿） | `260509` 表示 2026/05/09 |
| `SS`    | 當日序號，從 `01` 開始，0 補滿            | `01`、`02`、… |

範例：`v260509.01` 表示 2026 年 5 月 9 日當天的第 1 次發版。

### 規則

1. **每次改版必須更新版號**。即使只是小改 UI 字、改一行 bug，只要要部署上線就要 bump。
2. **同一天再次改版**，`SS` 加 1（`v260509.01` → `v260509.02`）。
3. **跨日**重新從 `01` 起算（`v260509.05` → `v260510.01`）。⚠️ 一定要看當天日期、不要沿用前一天的 YYMMDD。
   - ❌ 錯誤：今天 5/11，繼續用 `v260509.17`
   - ✅ 正確：今天 5/11，改用 `v260511.01`
4. **單一 source of truth**：版號定義在 `src/lib/version.js`，整個專案都從這裡 import，不要在其他地方寫死。
5. **登入頁底部必顯示版號**（會員 `/login` 與管理員 `/admin/login` 都要）；個人資料頁「關於本系統」也會顯示。
6. 版號 bump 與功能修改 **同一個 commit**，避免漏更新。
7. Commit message 結尾建議帶上版號，例如：`feat: 新增 OOO 功能 (v260509.02)`。
8. 舊格式 `v<YY>.<MM>.<DD>.<SS>`（如 `v26.05.08.26`）已淘汰，新版只接受 `v<YYMMDD>.<SS>`。

### 修改步驟

1. 編輯 `src/lib/version.js`，更新 `APP_VERSION`。
2. 確認登入頁底部版號正確（重新整理應該能看到）。
3. Commit + push + 觸發部署。

### 範例

```js
// src/lib/version.js
export const APP_NAME = '大自在山活動報名系統';
export const APP_SHORT_NAME = '大自在山活動';
export const APP_VERSION = 'v260509.01';
```

---

## 命名 / 文案

- 系統正式名稱：**大自在山活動報名系統**（從 `APP_NAME` import，不要寫死）。
- 簡稱（PWA short_name）：**大自在山活動**（從 `APP_SHORT_NAME` import）。
- 不再使用「佛堂法會」相關字眼。

---

## 資料庫 / 部署備忘

- Cloud SQL instance：`dzz3hc:asia-east1:dzz3`
- DB name：`dzz3activity`
- DB user：`dbadmin`（密碼存在 Secret Manager `db-password`）
- Cloud Run service：`dzz3activity`（asia-east1）
- SMTP（Gmail）寄件帳號透過 `_SMTP_USER` / `_SMTP_FROM` substitution、密碼在 Secret Manager `smtp-password`
- Web Push VAPID：公鑰 `vapid-public`、私鑰 `vapid-private`（兩個都在 Secret Manager；公鑰在 build 階段 `--build-arg` 烤進 client bundle，並同時注入 runtime env）
- Cloud Build trigger：`dzz3activity-deploy`（push 到 master 自動 build → deploy）
- Migration 是 idempotent 的：可重複跑，已套用的 ALTER 會 skip。

### Secret Manager 一次性設定（VAPID）

第一次部署或 VAPID 還沒設過時：

```bash
# 1) 產生一組新的 VAPID key pair
npm run gen-vapid
# 會印出 NEXT_PUBLIC_VAPID_PUBLIC_KEY=... 與 VAPID_PRIVATE_KEY=...

# 2) 寫進 Secret Manager（用 printf 避免尾端換行）
printf '%s' '<貼上公鑰>'  | gcloud secrets create vapid-public  --data-file=-
printf '%s' '<貼上私鑰>' | gcloud secrets create vapid-private --data-file=-

# 3) 授權 Cloud Build SA 與 Cloud Run runtime SA 取用
PROJECT_NUM=$(gcloud projects describe "$(gcloud config get-value project)" --format='value(projectNumber)')
for SA in "$PROJECT_NUM@cloudbuild.gserviceaccount.com" "$PROJECT_NUM-compute@developer.gserviceaccount.com"; do
  for SECRET in vapid-public vapid-private; do
    gcloud secrets add-iam-policy-binding "$SECRET" \
      --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor
  done
done
```

之後每次 `gcloud builds submit` / push 到 master 觸發的 deploy 都會自動把 VAPID 帶入，client bundle 與 server runtime 都拿得到，不需要再手動設。

### 主要資料表

| 表 | 重點欄位 |
|---|---|
| `members` | id, name, email (UNIQUE NOT NULL), phone, password, role (legacy), `is_admin` TINYINT, `admin_permissions` JSON, `is_disabled` TINYINT, location_id (FK→locations), address |
| `events` | id, name, start_date, end_date, registration_deadline, status, banner_color |
| `event_items` | event_id, name, price, max_quantity, requires_name, requires_content, sort_order |
| `registrations` | event_id, member_id, total_amount, payment_status, receipt_number, receipt_title, payment_date, notes |
| `registration_items` | registration_id, event_item_id, quantity, names (JSON), contents (JSON), subtotal |
| `locations` | id, name (UNIQUE), sort_order, active — 道場主檔 (admin 可管理) |
| `password_reset_codes` | member_id, code_hash, expires_at, used_at, attempts |
| `practices` | id, name (UNIQUE), type (count\|duration), unit_label, sort_order, active — 功課主檔 |
| `member_practices` | member_id, practice_id (UNIQUE pair), daily_target, active — 師兄姐訂閱 |
| `practice_logs` | member_id, practice_id, log_date, value (UNIQUE 三聯) — 每日紀錄；count 為次數、duration 為分鐘 |
| `practice_notes` | member_id, log_date, content, is_public — 修行筆記 |
| `member_groups` | id, name (UNIQUE), color, sort_order, active, `location_id` (UNIQUE NULL, FK→locations) — 群組主檔；預設「全體師兄姐」自動套到所有師兄姐；`location_id` 非 NULL 為道場鏡射群組（依 locations 自動同步） |
| `member_group_assignments` | member_id, group_id (UNIQUE pair) — 師兄姐 ↔ 群組 |
| `announcements` | id, title, content, image (data:URL), link_url, attachment_url, pinned, starts_at, ends_at, created_by |
| `announcement_groups` | announcement_id, group_id (UNIQUE pair) — 公告 ↔ 目標群組 |
| `event_attendance_questions` | event_id, label, type, options JSON, required, sort_order — 活動登記題目，type: text\|choice\|multi_date\|count\|checkbox |
| `event_attendance` | event_id, member_id, `attendee_name` (NULL=本人，NOT NULL=親友姓名), `attendee_relation`, notes — 一筆=一個人；本人每場至多 1 筆 (app 層約束)，親友可多筆 |
| `event_attendance_answers` | attendance_id, question_id (UNIQUE pair), value JSON — 每題回覆 |

### 後台權限模型

- 統一的登入入口：`/login`、`/api/auth/login`。後台不再有獨立登入頁。
- session cookie 統一為 `temple_session`，內含 `is_admin` 與 `permissions` 陣列，middleware 不需要每次查 DB。
- 任何 `is_admin=1` 的師兄姐都可以從 `/profile`「進入後台」。
- 細權限存在 `members.admin_permissions` JSON 陣列。`['*']` 代表全部權限；其餘可組合：
  - `events:manage`、`registrations:manage`、`members:manage`、`locations:manage`
  - `members:delete`（**永久刪除師兄姐帳號+全部相關資料**，高風險、與 `members:manage` 獨立授權）
  - `members:impersonate`（模擬師兄姐身分檢視 / 代為操作，唯讀 / 可寫兩種模式，可寫會留 audit log）
  - `admins:manage`（含指派/撤銷管理員與權限）
  - `reports:view`、`notifications:send`、`practices:manage`
  - `announcements:manage`、`groups:manage`
  - `attendance:manage`（每場活動的「活動登記表」題目設計 + 已登記名單 + Excel 匯出）
- API：用 `withPermission('xxx:yyy', handler)` 或 `withAdminAuth(handler)` 包裝。
- UI：`AdminSidebar` 依當前 session 的 `permissions` 過濾選單；無權的頁面會 server-side redirect 回 `/admin`。
- 撤銷管理員不會刪除師兄姐帳號，只是 `is_admin=0` 並清空 `admin_permissions`，報名紀錄全部保留。
- **刪除師兄姐帳號**（`DELETE /api/admin/members/[id]`，需 `members:delete`）為硬刪：移除 `members` 列（同時帶走 avatar）、`registrations` + `registration_items`、`practice_logs`、`practice_notes`、`member_practices`、`push_subscriptions`、`password_reset_codes`、以該 email 為 key 的 `email_verifications` 與 `login_attempts`。不可刪自己；管理員必須先撤銷管理員權限才能刪。前端有「輸入 Email 確認」二次防呆。

### 修行日誌

- `/journal` 是師兄姐底部 nav 的第三項（取代舊「活動提醒」）。tab：今日 / 過去 / 大眾分享 / 排名。`/journal/settings` 訂閱常修功課與每日目標。
- 「法會活動推播通知」開關搬到 `/profile`。
- 功課主檔由 `practices:manage` 管理員在 `/admin/practices` 維護；type=count 存次數、type=duration 存分鐘。
- 排名指標：近 90 天 `SUM(value)` per member；可切「全體 / 同道場」。
- `practice_notes.is_public=1` 才會出現在大眾分享 feed (`/api/notes/public`)，作者可隨時切換私人/公開。

### 道場 ↔ 群組鏡射

- 每個 `locations` 自動掛一個對應的 `member_groups` (`location_id` 指向 locations.id)，admin 只在 `/admin/locations` 維護道場
- 師兄姐 `members.location_id` 變動時，`src/lib/group-sync.js` 的 `syncMirrorGroup(memberId)` 會把舊鏡射 group assignment 移除、加上新道場的鏡射 — 在 register / `/api/auth/me` PUT / `/api/admin/members/[id]` PATCH 都會呼叫
- `/admin/groups` 看得到鏡射群組（前綴 🏯 + 「道場鏡射」標籤），但無法改名、停用、刪、手動加減成員；color 與 sort_order 仍可改
- `/admin/announcements` 群組選單一個 list；鏡射群組排在前面 + 🏯 前綴
- 刪除 location 時 FK CASCADE 連帶清掉鏡射群組與其 assignments；不會刪到師兄姐本身

### 公告訊息 + 群組標籤

- 底部 nav 第二項是「公告訊息」(`/announcements`)，已取代舊「報名紀錄」。報名歷史改在「法會活動」卡片內就地顯示。
- 群組主檔 `/admin/groups`（需 `groups:manage`）。預設 `全體師兄姐` 群組由 migration seed、所有新註冊師兄姐自動加入，無法刪除。
- 公告主檔 `/admin/announcements`（需 `announcements:manage`）：
  - 圖片內嵌 data:URL（client 端 resize 至 1280px / JPEG 0.85），跟 avatar 同模式
  - 外部連結 / 附件連結為純 URL（沒有實體上傳）
  - `pinned=1` 在師兄姐端釘最上
  - `starts_at` / `ends_at` 控制可見區間；NULL 等於開放
  - 必須選至少一個目標群組
- `/api/announcements` (GET) 自動依師兄姐所屬群組過濾，置頂 → 新→舊排序。

### 活動登記表（與報名祈福並存）

同一個 event 下，「報名祈福（付費功德主/蓮位）」與「活動登記（交通/住宿/用餐等）」是兩個獨立子模組，師兄姐可只填其一或兩者皆填。

- Admin 設計題目：`/admin/events/[eventId]/attendance` → 題目設計分頁，支援五種題型：
  - `text` 單行文字 / `choice` 單選（可加自訂文字欄位，例：車號）/ `multi_date` 多選清單（每行一個選項，可填日期或自訂文字；type 名沿用 multi_date 為向後相容）/ `count` 數字 / `checkbox` 是否參加
- Admin 看名單：同頁的「已登記名單」分頁；按右上「📄 匯出 Excel」拿到完整表格（`multi_date` 自動展開為一日一欄、勾選為 1）
- 師兄姐填表：`/events/[eventId]/attendance`；event 詳情頁有題目時會出現「📋 活動登記」入口
- 同一師兄姐可登記「本人 + N 位親友」：本人 attendee_name=NULL（每場至多 1 筆），親友 attendee_name+relation 必填、可多筆。各自獨立填寫所有題目，互不影響
- API：`GET /api/me/attendance/[eventId]` 回 `{entries:[...]}`；`POST` 新增；`PUT /api/me/attendance/[eventId]/[attendanceId]` 更新；`DELETE` 刪除（含本人取消登記）
- Admin 名單與 Excel 一列＝一個人，含「登記對象 / 關係」兩欄

### 報表 (Excel 匯出)

`/api/reports?format=xlsx`（admin only）：
- 用 `exceljs` 產出 .xlsx
- 11 欄：報名日期、功德主(陽上)、超度內容、金額、項目、收據編號、收據抬頭、連絡人、電話、地址、道場
- **Fan-out 邏輯**：每個 `registration_item` 依 `quantity` 展開成多列，金額 = `subtotal / quantity`（單價）
- 對齊既有 EXCEL「中元普渡法會」格式，可直接接續使用

### 部署指令範本

```bash
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_CLOUDSQL_INSTANCE=dzz3hc:asia-east1:dzz3,SHORT_SHA=$(git rev-parse --short HEAD),_SMTP_USER=roger9677@gmail.com,_SMTP_FROM='大自在山活動報名系統 <roger9677@gmail.com>'
```

### Schema 變更流程

1. 編輯 `scripts/migrate.js`：
   - 在 `SCHEMA` 區塊加入新欄位（給乾淨 DB 用）。
   - 在執行區段加上 try/catch 包的 `ALTER TABLE`（給既有 DB idempotent 升級）。
2. Cloud Shell / 本機跑：`npm run db:migrate`（細節見下節）。
3. 同一份 commit 一起改後端 / 前端用到該欄位的程式碼。

### 本地連線 / 跑 migration（Cloud Shell 或本機）

第一次先做：

```bash
gcloud auth login
gcloud auth application-default login
```

⚠️ **ADC token 會過期**（Cloud Shell 每次重開、本機約 1 小時）。如果跑 `npm run db:migrate` 看到「could not find default credentials」或「invalid_grant」之類錯誤，重跑這條再來：

```bash
gcloud auth application-default login
```

確認當前帳號在專案內擁有：

- `roles/cloudsql.client`（連線 Cloud SQL）
- `roles/secretmanager.secretAccessor`（取 `db-password`）

之後用 `scripts/db-proxy.sh` 一鍵起 proxy + 執行命令，結束時自動清掉 proxy：

```bash
npm run db:migrate   # 起 proxy → 跑 migrate → 結束時關 proxy
npm run db:seed      # 同上但跑 seed
npm run db:shell     # 開 mysql 互動 shell（需 mysql client）
npm run db:proxy     # 只起 proxy 並等待，Ctrl-C 結束
```

腳本會自動：

1. 檢查 `gcloud auth list` 有 active 帳號、ADC 檔存在。
2. 若 PATH 沒有 `cloud-sql-proxy`，下載 v2 到 `~/.local/bin/`。
3. 從 Secret Manager 取 `db-password`（或用呼叫端先 export 的 `DB_PASSWORD`）。
4. 確認本地 port 沒被佔用，避免之前那種 silent ETIMEDOUT。
5. 等 proxy ready 才執行命令、退出時自動 kill proxy。

可用 env 覆寫：`CLOUDSQL_INSTANCE`、`DB_NAME`、`DB_USER`、`DB_PORT`、`DB_PASSWORD_SECRET`、`DB_PASSWORD`、`CLOUD_SQL_PROXY`。

---

## 開發 / 提交準則

- 所有變更用 feature branch（目前是 `claude/push-code-changes-gx68Z`），merge 回 master 後 trigger 部署（如果有設 trigger）或手動 `gcloud builds submit`。
- 寫 code 前先確認版號 bump 是否一起改。
- 本 CLAUDE.md 是規約來源；遇到衝突以本檔為準。
