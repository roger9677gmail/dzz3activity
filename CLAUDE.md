# 大自在山活動報名系統 — 專案規約

> 本文件是 **本專案的強制規約**，任何新功能、修改、發版都必須遵守。
> Stack：Next.js 14 (App Router) + Cloud SQL (MySQL 8) on Cloud Run，部署透過 `cloudbuild.yaml`。

---

## 版號規則（必遵）

### 格式

```
v<YY>.<MM>.<DD>.<SS>
```

| 欄位 | 說明 | 範例 |
|---|---|---|
| `v`  | 固定字元，永遠是小寫 v | `v` |
| `YY` | 西元年後兩碼，0 補滿 | `26` |
| `MM` | 月份，0 補滿 | `01`–`12` |
| `DD` | 日期，0 補滿 | `01`–`31` |
| `SS` | 當日序號，從 `01` 開始，0 補滿 | `01`、`02`、… |

範例：`v26.05.08.01` 表示 2026 年 5 月 8 日當天的第 1 次發版。

### 規則

1. **每次改版必須更新版號**。即使只是小改 UI 字、改一行 bug，只要要部署上線就要 bump。
2. **同一天再次改版**，`SS` 加 1（`v26.05.08.01` → `v26.05.08.02`）。
3. **跨日**重新從 `01` 起算（`v26.05.08.05` → `v26.05.09.01`）。
4. **單一 source of truth**：版號定義在 `src/lib/version.js`，整個專案都從這裡 import，不要在其他地方寫死。
5. **登入頁底部必顯示版號**（會員 `/login` 與管理員 `/admin/login` 都要）。
6. 版號 bump 與功能修改 **同一個 commit**，避免漏更新。
7. Commit message 結尾建議帶上版號，例如：`feat: 新增 OOO 功能 (v26.05.08.02)`。

### 修改步驟

1. 編輯 `src/lib/version.js`，更新 `APP_VERSION`。
2. 確認登入頁底部版號正確（重新整理應該能看到）。
3. Commit + push + 觸發部署。

### 範例

```js
// src/lib/version.js
export const APP_NAME = '大自在山活動報名系統';
export const APP_SHORT_NAME = '大自在山活動';
export const APP_VERSION = 'v26.05.08.01';
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
- Cloud Build trigger：`dzz3activity-deploy`（push 到 master 自動 build → deploy）
- Migration 是 idempotent 的：可重複跑，已套用的 ALTER 會 skip。

### 主要資料表

| 表 | 重點欄位 |
|---|---|
| `members` | id, name, email (UNIQUE NOT NULL), phone, password, role (member/admin), location_id (FK→locations), address |
| `events` | id, name, start_date, end_date, registration_deadline, status, banner_color |
| `event_items` | event_id, name, price, max_quantity, requires_name, requires_content, sort_order |
| `registrations` | event_id, member_id, total_amount, payment_status, receipt_number, receipt_title, payment_date, notes |
| `registration_items` | registration_id, event_item_id, quantity, names (JSON), contents (JSON), subtotal |
| `locations` | id, name (UNIQUE), sort_order, active — 道場主檔 (admin 可管理) |
| `password_reset_codes` | member_id, code_hash, expires_at, used_at, attempts |

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
2. Cloud Shell 用 cloud-sql-proxy + `npm run migrate` 跑一次。
3. 同一份 commit 一起改後端 / 前端用到該欄位的程式碼。

---

## 開發 / 提交準則

- 所有變更用 feature branch（目前是 `claude/push-code-changes-gx68Z`），merge 回 master 後 trigger 部署（如果有設 trigger）或手動 `gcloud builds submit`。
- 寫 code 前先確認版號 bump 是否一起改。
- 本 CLAUDE.md 是規約來源；遇到衝突以本檔為準。
