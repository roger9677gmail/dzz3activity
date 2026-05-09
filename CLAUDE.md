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
3. **跨日**重新從 `01` 起算（`v260509.05` → `v260510.01`）。
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
| `members` | id, name, email (UNIQUE NOT NULL), phone, password, role (legacy), `is_admin` TINYINT, `admin_permissions` JSON, location_id (FK→locations), address |
| `events` | id, name, start_date, end_date, registration_deadline, status, banner_color |
| `event_items` | event_id, name, price, max_quantity, requires_name, requires_content, sort_order |
| `registrations` | event_id, member_id, total_amount, payment_status, receipt_number, receipt_title, payment_date, notes |
| `registration_items` | registration_id, event_item_id, quantity, names (JSON), contents (JSON), subtotal |
| `locations` | id, name (UNIQUE), sort_order, active — 道場主檔 (admin 可管理) |
| `password_reset_codes` | member_id, code_hash, expires_at, used_at, attempts |

### 後台權限模型

- 統一的登入入口：`/login`、`/api/auth/login`。後台不再有獨立登入頁。
- session cookie 統一為 `temple_session`，內含 `is_admin` 與 `permissions` 陣列，middleware 不需要每次查 DB。
- 任何 `is_admin=1` 的師兄姐都可以從 `/profile`「進入後台」。
- 細權限存在 `members.admin_permissions` JSON 陣列。`['*']` 代表全部權限；其餘可組合：
  - `events:manage`、`registrations:manage`、`members:manage`、`locations:manage`
  - `admins:manage`（含指派/撤銷管理員與權限）
  - `reports:view`、`notifications:send`
- API：用 `withPermission('xxx:yyy', handler)` 或 `withAdminAuth(handler)` 包裝。
- UI：`AdminSidebar` 依當前 session 的 `permissions` 過濾選單；無權的頁面會 server-side redirect 回 `/admin`。
- 撤銷管理員不會刪除師兄姐帳號，只是 `is_admin=0` 並清空 `admin_permissions`，報名紀錄全部保留。

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
