#!/usr/bin/env node
/**
 * Run once against a fresh Cloud SQL MySQL 8 instance:
 *   DB_HOST=... DB_USER=... DB_PASSWORD=... DB_NAME=... node scripts/migrate.js
 * Or via the Cloud SQL Auth Proxy / socket path.
 */
const mysql = require('mysql2/promise');

const config = process.env.DB_SOCKET_PATH
  ? {
      socketPath: process.env.DB_SOCKET_PATH,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true,
    }
  : {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true,
    };

const SCHEMA = `
CREATE TABLE IF NOT EXISTS members (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name               VARCHAR(100) NOT NULL,
  phone              VARCHAR(32),
  email              VARCHAR(255) NOT NULL,
  password           VARCHAR(255) NOT NULL,
  role               VARCHAR(20)  NOT NULL DEFAULT 'member',
  is_admin           TINYINT(1)   NOT NULL DEFAULT 0,
  admin_permissions  JSON         NULL,
  is_disabled        TINYINT(1)   NOT NULL DEFAULT 0,
  receipt_title      VARCHAR(100) NULL,
  avatar             MEDIUMTEXT,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_members_email (email),
  UNIQUE KEY uk_members_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS events (
  id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name                    VARCHAR(255) NOT NULL,
  description             TEXT,
  start_date              DATE         NOT NULL,
  end_date                DATE         NOT NULL,
  registration_deadline   DATE         NOT NULL,
  location                VARCHAR(255),
  status                  VARCHAR(20)  NOT NULL DEFAULT 'active',
  banner_color            VARCHAR(20)  DEFAULT '#8B1A1A',
  created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_items (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id         INT UNSIGNED NOT NULL,
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  price            INT          NOT NULL DEFAULT 0,
  allow_custom_price TINYINT(1) NOT NULL DEFAULT 0,
  requires_name    TINYINT(1)   NOT NULL DEFAULT 1,
  requires_content TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order       INT          NOT NULL DEFAULT 0,
  gift_event_item_id INT UNSIGNED NULL,
  gift_quantity      INT          NOT NULL DEFAULT 0,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_items_event (event_id),
  INDEX idx_event_items_gift  (gift_event_item_id),
  CONSTRAINT fk_event_items_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_event_items_gift  FOREIGN KEY (gift_event_item_id) REFERENCES event_items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS registrations (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id        INT UNSIGNED NOT NULL,
  member_id       INT UNSIGNED NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
  total_amount    INT          NOT NULL DEFAULT 0,
  notes           TEXT,
  payment_status  VARCHAR(20)  NOT NULL DEFAULT 'unpaid',
  receipt_number  VARCHAR(50),
  payment_date    DATE,
  payment_notes   TEXT,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_event_member (event_id, member_id),
  INDEX idx_reg_member (member_id),
  INDEX idx_reg_event  (event_id),
  INDEX idx_reg_status (status),
  CONSTRAINT fk_reg_event  FOREIGN KEY (event_id)  REFERENCES events(id),
  CONSTRAINT fk_reg_member FOREIGN KEY (member_id) REFERENCES members(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS registration_items (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  registration_id INT UNSIGNED NOT NULL,
  event_item_id   INT UNSIGNED NOT NULL,
  quantity        INT          NOT NULL DEFAULT 1,
  names           TEXT,
  contents        TEXT,
  subtotal        INT          NOT NULL DEFAULT 0,
  is_gift         TINYINT(1)   NOT NULL DEFAULT 0,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_regitem_registration (registration_id),
  CONSTRAINT fk_regitem_registration FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
  CONSTRAINT fk_regitem_eventitem    FOREIGN KEY (event_item_id)   REFERENCES event_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS password_reset_codes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id   INT UNSIGNED NOT NULL,
  code_hash   VARCHAR(255) NOT NULL,
  expires_at  DATETIME     NOT NULL,
  used_at     DATETIME,
  attempts    INT          NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prc_member (member_id),
  INDEX idx_prc_expires (expires_at),
  CONSTRAINT fk_prc_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS locations (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL UNIQUE,
  sort_order  INT          NOT NULL DEFAULT 0,
  active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id   INT UNSIGNED NOT NULL,
  endpoint    VARCHAR(500) NOT NULL UNIQUE,
  p256dh      VARCHAR(255) NOT NULL,
  auth        VARCHAR(255) NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_push_member (member_id),
  CONSTRAINT fk_push_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS email_verifications (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  code_hash   VARCHAR(255) NOT NULL,
  expires_at  DATETIME     NOT NULL,
  used_at     DATETIME,
  attempts    INT          NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ev_email (email),
  INDEX idx_ev_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS practices (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  type        VARCHAR(20)  NOT NULL DEFAULT 'count',
  unit_label  VARCHAR(20)  NOT NULL DEFAULT '次',
  sort_order  INT          NOT NULL DEFAULT 0,
  active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS member_practices (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id     INT UNSIGNED NOT NULL,
  practice_id   INT UNSIGNED NOT NULL,
  daily_target  INT NULL,
  active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_member_practice (member_id, practice_id),
  INDEX idx_mp_member (member_id),
  CONSTRAINT fk_mp_member   FOREIGN KEY (member_id)   REFERENCES members(id)   ON DELETE CASCADE,
  CONSTRAINT fk_mp_practice FOREIGN KEY (practice_id) REFERENCES practices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS practice_logs (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id   INT UNSIGNED NOT NULL,
  practice_id INT UNSIGNED NOT NULL,
  log_date    DATE NOT NULL,
  value       INT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_log_unique (member_id, practice_id, log_date),
  INDEX idx_log_member_date (member_id, log_date),
  INDEX idx_log_practice_date (practice_id, log_date),
  CONSTRAINT fk_log_member   FOREIGN KEY (member_id)   REFERENCES members(id)   ON DELETE CASCADE,
  CONSTRAINT fk_log_practice FOREIGN KEY (practice_id) REFERENCES practices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS practice_notes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id   INT UNSIGNED NOT NULL,
  log_date    DATE NOT NULL,
  content     TEXT NOT NULL,
  is_public   TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_note_member (member_id, log_date),
  INDEX idx_note_public (is_public, created_at),
  CONSTRAINT fk_note_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS member_groups (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50) NOT NULL UNIQUE,
  color       VARCHAR(20) NOT NULL DEFAULT '#8B1A1A',
  sort_order  INT NOT NULL DEFAULT 0,
  active      TINYINT(1) NOT NULL DEFAULT 1,
  location_id INT UNSIGNED NULL UNIQUE,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mg_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS member_group_assignments (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  member_id   INT UNSIGNED NOT NULL,
  group_id    INT UNSIGNED NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_member_group (member_id, group_id),
  INDEX idx_mga_member (member_id),
  INDEX idx_mga_group (group_id),
  CONSTRAINT fk_mga_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  CONSTRAINT fk_mga_group  FOREIGN KEY (group_id)  REFERENCES member_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS announcements (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title           VARCHAR(200) NOT NULL,
  content         TEXT,
  image           MEDIUMTEXT NULL,
  link_url        VARCHAR(500) NULL,
  attachment_url  VARCHAR(500) NULL,
  attachment_name VARCHAR(255) NULL,
  pinned          TINYINT(1) NOT NULL DEFAULT 0,
  starts_at       DATETIME NULL,
  ends_at         DATETIME NULL,
  created_by      INT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ann_visibility (pinned, created_at),
  INDEX idx_ann_window (starts_at, ends_at),
  CONSTRAINT fk_ann_creator FOREIGN KEY (created_by) REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS announcement_groups (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  announcement_id INT UNSIGNED NOT NULL,
  group_id        INT UNSIGNED NOT NULL,
  UNIQUE KEY uk_ann_group (announcement_id, group_id),
  INDEX idx_ag_ann (announcement_id),
  INDEX idx_ag_group (group_id),
  CONSTRAINT fk_ag_ann   FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  CONSTRAINT fk_ag_group FOREIGN KEY (group_id)        REFERENCES member_groups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_attendance_questions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id    INT UNSIGNED NOT NULL,
  label       VARCHAR(200) NOT NULL,
  type        VARCHAR(20)  NOT NULL,
  options     JSON         NULL,
  required    TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order  INT          NOT NULL DEFAULT 0,
  active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_eaq_event (event_id, sort_order),
  CONSTRAINT fk_eaq_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_attendance (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id           INT UNSIGNED NOT NULL,
  member_id          INT UNSIGNED NOT NULL,
  attendee_name      VARCHAR(100) NULL,
  attendee_relation  VARCHAR(20)  NULL,
  notes              TEXT NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ea_event (event_id),
  INDEX idx_ea_member (member_id),
  INDEX idx_ea_event_member (event_id, member_id),
  CONSTRAINT fk_ea_event  FOREIGN KEY (event_id)  REFERENCES events(id)  ON DELETE CASCADE,
  CONSTRAINT fk_ea_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_attendance_answers (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attendance_id   INT UNSIGNED NOT NULL,
  question_id     INT UNSIGNED NOT NULL,
  value           JSON NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_eaa_attendance_question (attendance_id, question_id),
  INDEX idx_eaa_attendance (attendance_id),
  INDEX idx_eaa_question (question_id),
  CONSTRAINT fk_eaa_attendance FOREIGN KEY (attendance_id) REFERENCES event_attendance(id)           ON DELETE CASCADE,
  CONSTRAINT fk_eaa_question   FOREIGN KEY (question_id)   REFERENCES event_attendance_questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

(async () => {
  if (!config.user || !config.database) {
    console.error('Missing DB env vars: DB_USER, DB_NAME, DB_PASSWORD, and DB_HOST or DB_SOCKET_PATH.');
    process.exit(1);
  }
  const conn = await mysql.createConnection(config);
  try {
    await conn.query(SCHEMA);
    console.log('✅ Schema applied to database:', config.database);

    // Idempotent ALTER TABLE upgrades for existing databases.
    // Each statement is wrapped in try/catch so already-applied changes don't fail the run.
    const ALTERS = [
      ["ADD event_items.requires_content",
        "ALTER TABLE event_items ADD COLUMN requires_content TINYINT(1) NOT NULL DEFAULT 0 AFTER requires_name"],
      ["ADD registration_items.contents",
        "ALTER TABLE registration_items ADD COLUMN contents TEXT AFTER names"],
      ["ADD event_items.gift_event_item_id",
        "ALTER TABLE event_items ADD COLUMN gift_event_item_id INT UNSIGNED NULL AFTER sort_order"],
      ["ADD event_items.gift_quantity",
        "ALTER TABLE event_items ADD COLUMN gift_quantity INT NOT NULL DEFAULT 0 AFTER gift_event_item_id"],
      ["ADD registration_items.is_gift",
        "ALTER TABLE registration_items ADD COLUMN is_gift TINYINT(1) NOT NULL DEFAULT 0 AFTER subtotal"],
      ["ADD event_items.allow_custom_price",
        "ALTER TABLE event_items ADD COLUMN allow_custom_price TINYINT(1) NOT NULL DEFAULT 0 AFTER price"],
      ["ADD members.avatar",
        "ALTER TABLE members ADD COLUMN avatar MEDIUMTEXT AFTER role"],
      ["ADD members.is_admin",
        "ALTER TABLE members ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER role"],
      ["ADD members.admin_permissions",
        "ALTER TABLE members ADD COLUMN admin_permissions JSON NULL AFTER is_admin"],
      ["ADD members.is_disabled",
        "ALTER TABLE members ADD COLUMN is_disabled TINYINT(1) NOT NULL DEFAULT 0 AFTER admin_permissions"],
      ["ADD members.receipt_title",
        "ALTER TABLE members ADD COLUMN receipt_title VARCHAR(100) NULL AFTER is_disabled"],
    ];
    for (const [label, sql] of ALTERS) {
      try {
        await conn.query(sql);
        console.log('✅ Applied:', label);
      } catch (err) {
        if (err && (err.code === 'ER_DUP_FIELDNAME' || /Duplicate column name/i.test(err.message || ''))) {
          console.log('ℹ️  Skipped (already applied):', label);
        } else {
          throw err;
        }
      }
    }

    // Backfill is_admin / admin_permissions from legacy role column.
    // Anyone whose role='admin' becomes a full admin with wildcard permissions.
    try {
      const [r] = await conn.query(
        `UPDATE members
            SET is_admin = 1,
                admin_permissions = JSON_ARRAY('*')
          WHERE role = 'admin'
            AND (is_admin = 0 OR admin_permissions IS NULL)`
      );
      if (r.affectedRows > 0) {
        console.log(`✅ Backfilled is_admin/permissions for ${r.affectedRows} legacy admin(s)`);
      } else {
        console.log('ℹ️  No legacy admins to backfill');
      }
    } catch (err) {
      console.log('ℹ️  Skipped admin backfill -', err.code || err.message);
    }

    // Idempotent FK / index for the self-referencing gift target.
    try {
      await conn.query(`
        ALTER TABLE event_items
        ADD CONSTRAINT fk_event_items_gift
        FOREIGN KEY (gift_event_item_id) REFERENCES event_items(id) ON DELETE SET NULL
      `);
      console.log('✅ Applied: FK event_items.gift_event_item_id → event_items.id');
    } catch (err) {
      if (err && (err.code === 'ER_FK_DUP_NAME' || err.code === 'ER_DUP_KEYNAME' || /Duplicate (?:foreign key|key)/i.test(err.message || ''))) {
        console.log('ℹ️  Skipped (FK exists): fk_event_items_gift');
      } else {
        console.log('ℹ️  Skipped (likely exists): fk_event_items_gift -', err.code || err.message);
      }
    }

    // Email-as-login migration for existing databases.
    // - Purge members without email (test data per project decision).
    // - Make email NOT NULL + UNIQUE, allow phone NULL, drop old phone-NOT-NULL constraint.
    console.log('— Email-as-login migration —');

    // 1) Cascade-delete registrations of email-less members so FK doesn't block.
    const [delItems] = await conn.query(`
      DELETE ri FROM registration_items ri
      JOIN registrations r ON r.id = ri.registration_id
      JOIN members m ON m.id = r.member_id
      WHERE m.email IS NULL OR m.email = ''
    `);
    const [delRegs] = await conn.query(`
      DELETE r FROM registrations r
      JOIN members m ON m.id = r.member_id
      WHERE m.email IS NULL OR m.email = ''
    `);
    const [delPush] = await conn.query(`
      DELETE p FROM push_subscriptions p
      JOIN members m ON m.id = p.member_id
      WHERE m.email IS NULL OR m.email = ''
    `);
    const [delMembers] = await conn.query(`DELETE FROM members WHERE email IS NULL OR email = ''`);
    console.log(`🧹 Purged email-less data: members=${delMembers.affectedRows}, registrations=${delRegs.affectedRows}, registration_items=${delItems.affectedRows}, push_subscriptions=${delPush.affectedRows}`);

    // 2) Email column → NOT NULL + UNIQUE
    const COL_ALTERS = [
      ["members.email NOT NULL", "ALTER TABLE members MODIFY COLUMN email VARCHAR(255) NOT NULL"],
      ["members.phone NULLABLE", "ALTER TABLE members MODIFY COLUMN phone VARCHAR(32) NULL"],
    ];
    for (const [label, sql] of COL_ALTERS) {
      try {
        await conn.query(sql);
        console.log('✅ Applied:', label);
      } catch (err) {
        console.log('ℹ️  Skipped (likely already applied):', label, '-', err.code || err.message);
      }
    }

    // 3) Add UNIQUE indexes (idempotent — catch dup-key errors)
    const INDEX_ADDS = [
      ["UNIQUE email", "ALTER TABLE members ADD UNIQUE KEY uk_members_email (email)"],
    ];
    for (const [label, sql] of INDEX_ADDS) {
      try {
        await conn.query(sql);
        console.log('✅ Applied:', label);
      } catch (err) {
        if (err && (err.code === 'ER_DUP_KEYNAME' || /Duplicate key name/i.test(err.message || ''))) {
          console.log('ℹ️  Skipped (index exists):', label);
        } else {
          throw err;
        }
      }
    }

    // Locations + receipt_title + member.address/location_id (idempotent)
    console.log('— Locations & contact info migration —');
    const LOC_ALTERS = [
      ["ADD members.location_id",
        "ALTER TABLE members ADD COLUMN location_id INT UNSIGNED AFTER phone"],
      ["ADD members.address",
        "ALTER TABLE members ADD COLUMN address VARCHAR(255) AFTER location_id"],
      ["ADD registrations.receipt_title",
        "ALTER TABLE registrations ADD COLUMN receipt_title VARCHAR(100) AFTER receipt_number"],
    ];
    for (const [label, sql] of LOC_ALTERS) {
      try {
        await conn.query(sql);
        console.log('✅ Applied:', label);
      } catch (err) {
        if (err && (err.code === 'ER_DUP_FIELDNAME' || /Duplicate column name/i.test(err.message || ''))) {
          console.log('ℹ️  Skipped (already applied):', label);
        } else {
          throw err;
        }
      }
    }

    // FK: members.location_id → locations.id (idempotent — catch dup constraint)
    try {
      await conn.query(`
        ALTER TABLE members
        ADD CONSTRAINT fk_members_location
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
      `);
      console.log('✅ Applied: FK members.location_id → locations.id');
    } catch (err) {
      if (err && (err.code === 'ER_FK_DUP_NAME' || err.code === 'ER_DUP_KEYNAME' || /Duplicate (?:foreign key|key)/i.test(err.message || ''))) {
        console.log('ℹ️  Skipped (FK exists): fk_members_location');
      } else {
        console.log('ℹ️  Skipped (likely exists): fk_members_location -', err.code || err.message);
      }
    }

    // Seed default locations (idempotent — UNIQUE on name protects).
    const DEFAULT_LOCATIONS = [
      ['明心禪苑(永和)', 1],
      ['靜心禪苑(新竹)', 2],
      ['台中禪林', 3],
    ];
    for (const [name, sort] of DEFAULT_LOCATIONS) {
      const [r] = await conn.query(
        `INSERT IGNORE INTO locations (name, sort_order) VALUES (?, ?)`,
        [name, sort]
      );
      if (r.affectedRows > 0) {
        console.log(`✅ Seeded location: ${name}`);
      } else {
        console.log(`ℹ️  Location exists: ${name}`);
      }
    }

    // Mirror-group integration: each `locations` row gets a corresponding
    // `member_groups` row (location_id NOT NULL), so admins can target
    // announcements at a 道場 via the same group system.
    console.log('— Locations ↔ groups mirror —');
    try {
      await conn.query('ALTER TABLE member_groups ADD COLUMN location_id INT UNSIGNED NULL AFTER active');
      console.log('✅ Applied: ADD member_groups.location_id');
    } catch (err) {
      if (err && (err.code === 'ER_DUP_FIELDNAME' || /Duplicate column name/i.test(err.message || ''))) {
        console.log('ℹ️  Skipped (already applied): ADD member_groups.location_id');
      } else {
        throw err;
      }
    }
    try {
      await conn.query('ALTER TABLE member_groups ADD UNIQUE KEY uk_mg_location (location_id)');
      console.log('✅ Applied: UNIQUE member_groups.location_id');
    } catch (err) {
      if (err && (err.code === 'ER_DUP_KEYNAME' || /Duplicate key name/i.test(err.message || ''))) {
        console.log('ℹ️  Skipped (index exists): uk_mg_location');
      } else {
        throw err;
      }
    }
    try {
      await conn.query(
        'ALTER TABLE member_groups ADD CONSTRAINT fk_mg_location ' +
        'FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE'
      );
      console.log('✅ Applied: FK member_groups.location_id → locations.id');
    } catch (err) {
      if (err && (err.code === 'ER_FK_DUP_NAME' || err.code === 'ER_DUP_KEYNAME' || /Duplicate (?:foreign key|key)/i.test(err.message || ''))) {
        console.log('ℹ️  Skipped (FK exists): fk_mg_location');
      } else {
        console.log('ℹ️  Skipped (likely exists): fk_mg_location -', err.code || err.message);
      }
    }
    // Seed mirror group for each existing location (idempotent — UNIQUE on
    // location_id protects).
    try {
      const [r] = await conn.query(`
        INSERT IGNORE INTO member_groups (name, color, sort_order, location_id)
        SELECT l.name, '#8B1A1A', l.sort_order, l.id
          FROM locations l
         WHERE NOT EXISTS (SELECT 1 FROM member_groups g WHERE g.location_id = l.id)
      `);
      console.log(`✅ Mirror groups created: ${r.affectedRows}`);
    } catch (err) {
      console.log('ℹ️  Skipped mirror-group seed -', err.code || err.message);
    }
    // Backfill assignments: every member with a location → mirror group.
    try {
      const [r] = await conn.query(`
        INSERT IGNORE INTO member_group_assignments (member_id, group_id)
        SELECT m.id, g.id
          FROM members m
          JOIN member_groups g ON g.location_id = m.location_id
         WHERE m.location_id IS NOT NULL
      `);
      console.log(`✅ Mirror assignments backfilled: ${r.affectedRows}`);
    } catch (err) {
      console.log('ℹ️  Skipped mirror-assignment backfill -', err.code || err.message);
    }

    // Seed default member group "全體師兄姐" and backfill assignments for all
    // existing members so admins always have a sane "broadcast to everyone"
    // target when authoring announcements.
    console.log('— Member groups seed —');
    try {
      const [rs] = await conn.query(
        `INSERT IGNORE INTO member_groups (name, sort_order, color) VALUES (?, ?, ?)`,
        ['全體師兄姐', 0, '#8B1A1A']
      );
      if (rs.affectedRows > 0) console.log('✅ Seeded group: 全體師兄姐');
      else console.log('ℹ️  Group exists: 全體師兄姐');
    } catch (err) {
      console.log('ℹ️  Skipped group seed -', err.code || err.message);
    }
    try {
      const [r] = await conn.query(`
        INSERT IGNORE INTO member_group_assignments (member_id, group_id)
        SELECT m.id, g.id
          FROM members m
          JOIN member_groups g ON g.name = '全體師兄姐'
      `);
      console.log(`✅ Assigned ${r.affectedRows} member(s) to 全體師兄姐`);
    } catch (err) {
      console.log('ℹ️  Skipped group backfill -', err.code || err.message);
    }

    // Attendance: multi-attendee support (本人 + 親友)
    console.log('— Attendance multi-attendee migration —');
    try {
      await conn.query('ALTER TABLE event_attendance ADD COLUMN attendee_name VARCHAR(100) NULL AFTER member_id');
      console.log('✅ Applied: ADD event_attendance.attendee_name');
    } catch (err) {
      if (err && (err.code === 'ER_DUP_FIELDNAME' || /Duplicate column name/i.test(err.message || ''))) {
        console.log('ℹ️  Skipped (already applied): ADD event_attendance.attendee_name');
      } else { throw err; }
    }
    try {
      await conn.query('ALTER TABLE event_attendance ADD COLUMN attendee_relation VARCHAR(20) NULL AFTER attendee_name');
      console.log('✅ Applied: ADD event_attendance.attendee_relation');
    } catch (err) {
      if (err && (err.code === 'ER_DUP_FIELDNAME' || /Duplicate column name/i.test(err.message || ''))) {
        console.log('ℹ️  Skipped (already applied): ADD event_attendance.attendee_relation');
      } else { throw err; }
    }
    try {
      await conn.query('ALTER TABLE event_attendance DROP INDEX uk_ea_event_member');
      console.log('✅ Applied: DROP UNIQUE uk_ea_event_member (one row per attendee now)');
    } catch (err) {
      if (err && (err.code === 'ER_CANT_DROP_FIELD_OR_KEY' || /check that .* exists/i.test(err.message || ''))) {
        console.log('ℹ️  Skipped (index already dropped): uk_ea_event_member');
      } else {
        console.log('ℹ️  Skipped UNIQUE drop -', err.code || err.message);
      }
    }
    try {
      await conn.query('ALTER TABLE event_attendance ADD INDEX idx_ea_event_member (event_id, member_id)');
      console.log('✅ Applied: ADD INDEX idx_ea_event_member');
    } catch (err) {
      if (err && (err.code === 'ER_DUP_KEYNAME' || /Duplicate key name/i.test(err.message || ''))) {
        console.log('ℹ️  Skipped (index exists): idx_ea_event_member');
      } else {
        console.log('ℹ️  Skipped INDEX add -', err.code || err.message);
      }
    }

    // Drop deprecated columns (idempotent — catch ER_CANT_DROP_FIELD_OR_KEY when already dropped).
    console.log('— Dropping deprecated columns —');
    const DROPS = [
      ["events.max_capacity",  "ALTER TABLE events DROP COLUMN max_capacity"],
      ["event_items.max_quantity", "ALTER TABLE event_items DROP COLUMN max_quantity"],
    ];
    for (const [label, sql] of DROPS) {
      try {
        await conn.query(sql);
        console.log('✅ Dropped:', label);
      } catch (err) {
        if (err && (err.code === 'ER_CANT_DROP_FIELD_OR_KEY' || /check that column.*exists/i.test(err.message || ''))) {
          console.log('ℹ️  Skipped (already dropped):', label);
        } else {
          throw err;
        }
      }
    }
  } finally {
    await conn.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
