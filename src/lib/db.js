import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'temple.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;
if (process.env.NODE_ENV === 'production') {
  db = new Database(DB_PATH);
} else {
  if (!global.__db) {
    global.__db = new Database(DB_PATH);
  }
  db = global.__db;
}

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      phone       TEXT    NOT NULL UNIQUE,
      email       TEXT,
      password    TEXT    NOT NULL,
      role        TEXT    NOT NULL DEFAULT 'member',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      name                    TEXT    NOT NULL,
      description             TEXT,
      start_date              TEXT    NOT NULL,
      end_date                TEXT    NOT NULL,
      registration_deadline   TEXT    NOT NULL,
      location                TEXT,
      status                  TEXT    NOT NULL DEFAULT 'active',
      max_capacity            INTEGER,
      banner_color            TEXT    DEFAULT '#8B1A1A',
      created_at              TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at              TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS event_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name          TEXT    NOT NULL,
      description   TEXT,
      price         INTEGER NOT NULL DEFAULT 0,
      max_quantity  INTEGER DEFAULT 5,
      requires_name INTEGER NOT NULL DEFAULT 1,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id        INTEGER NOT NULL REFERENCES events(id),
      member_id       INTEGER NOT NULL REFERENCES members(id),
      status          TEXT    NOT NULL DEFAULT 'pending',
      total_amount    INTEGER NOT NULL DEFAULT 0,
      notes           TEXT,
      payment_status  TEXT    NOT NULL DEFAULT 'unpaid',
      receipt_number  TEXT,
      payment_date    TEXT,
      payment_notes   TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE(event_id, member_id)
    );

    CREATE TABLE IF NOT EXISTS registration_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_id INTEGER NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
      event_item_id   INTEGER NOT NULL REFERENCES event_items(id),
      quantity        INTEGER NOT NULL DEFAULT 1,
      names           TEXT,
      subtotal        INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id   INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      endpoint    TEXT    NOT NULL UNIQUE,
      p256dh      TEXT    NOT NULL,
      auth        TEXT    NOT NULL,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_registrations_member  ON registrations(member_id);
    CREATE INDEX IF NOT EXISTS idx_registrations_event   ON registrations(event_id);
    CREATE INDEX IF NOT EXISTS idx_registrations_status  ON registrations(status);
    CREATE INDEX IF NOT EXISTS idx_event_items_event     ON event_items(event_id);
    CREATE INDEX IF NOT EXISTS idx_push_member           ON push_subscriptions(member_id);
  `);
}

initDb();

export default db;
