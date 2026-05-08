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
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(32),
  email       VARCHAR(255) NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(20)  NOT NULL DEFAULT 'member',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
