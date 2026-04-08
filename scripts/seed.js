const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'temple.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create schema
db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, email TEXT,
    password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, description TEXT, start_date TEXT NOT NULL,
    end_date TEXT NOT NULL, registration_deadline TEXT NOT NULL,
    location TEXT, status TEXT NOT NULL DEFAULT 'active',
    max_capacity INTEGER, banner_color TEXT DEFAULT '#8B1A1A',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE IF NOT EXISTS event_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL, description TEXT, price INTEGER NOT NULL DEFAULT 0,
    max_quantity INTEGER DEFAULT 5, requires_name INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id),
    member_id INTEGER NOT NULL REFERENCES members(id),
    status TEXT NOT NULL DEFAULT 'pending', total_amount INTEGER NOT NULL DEFAULT 0,
    notes TEXT, payment_status TEXT NOT NULL DEFAULT 'unpaid',
    receipt_number TEXT, payment_date TEXT, payment_notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE(event_id, member_id)
  );
  CREATE TABLE IF NOT EXISTS registration_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_id INTEGER NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    event_item_id INTEGER NOT NULL REFERENCES event_items(id),
    quantity INTEGER NOT NULL DEFAULT 1, names TEXT, subtotal INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_reg_member ON registrations(member_id);
  CREATE INDEX IF NOT EXISTS idx_reg_event ON registrations(event_id);
  CREATE INDEX IF NOT EXISTS idx_event_items_event ON event_items(event_id);
`);

console.log('✅ 資料庫結構建立完成');

// Create admin account
const adminHash = bcrypt.hashSync('admin1234', 10);
const existing = db.prepare("SELECT id FROM members WHERE phone = '0900000000'").get();
if (!existing) {
  db.prepare("INSERT INTO members (name, phone, password, role) VALUES (?, ?, ?, 'admin')")
    .run('管理員', '0900000000', adminHash);
  console.log('✅ 管理員帳號建立: 電話 0900000000 / 密碼 admin1234');
} else {
  console.log('ℹ️  管理員帳號已存在');
}

// Create demo member accounts
const members = [
  { name: '王師兄', phone: '0911111111' },
  { name: '李師姐', phone: '0922222222' },
  { name: '張師兄', phone: '0933333333' },
  { name: '陳師姐', phone: '0944444444' },
  { name: '林師兄', phone: '0955555555' },
];

const memberHash = bcrypt.hashSync('member123', 10);
for (const m of members) {
  const ex = db.prepare('SELECT id FROM members WHERE phone = ?').get(m.phone);
  if (!ex) {
    db.prepare("INSERT INTO members (name, phone, password, role) VALUES (?, ?, ?, 'member')")
      .run(m.name, m.phone, memberHash);
    console.log(`✅ 師兄姐帳號: ${m.name} / ${m.phone} / 密碼: member123`);
  }
}

// Create 4 predefined events
const events = [
  {
    name: '中元普渡法會',
    description: '每年農曆七月舉辦的中元普渡法會，超薦歷代祖先及眾生，廣結善緣。',
    start_date: '2026-08-05',
    end_date: '2026-08-07',
    registration_deadline: '2026-07-28',
    location: '本堂大殿',
    banner_color: '#8B1A1A',
    items: [
      { name: '超渡牌位', description: '超渡歷代祖先', price: 500, requires_name: true },
      { name: '光明燈', description: '點燃光明燈，祈求平安', price: 600, requires_name: true },
      { name: '消災牌位', description: '消災解厄', price: 300, requires_name: true },
      { name: '普渡供品', description: '普渡供品一份', price: 200, requires_name: false },
    ],
  },
  {
    name: '新春祈福法會',
    description: '新年伊始，祈求新的一年闔家平安、事業順遂、身體健康。',
    start_date: '2027-02-06',
    end_date: '2027-02-07',
    registration_deadline: '2027-01-25',
    location: '本堂大殿',
    banner_color: '#C4962A',
    items: [
      { name: '光明燈', description: '新春光明燈，照亮全年', price: 600, requires_name: true },
      { name: '祈福牌位', description: '祈求新年諸事順遂', price: 300, requires_name: true },
      { name: '春聯', description: '開光春聯一份', price: 150, requires_name: false },
      { name: '祈福袋', description: '手工縫製祈福袋', price: 200, requires_name: false },
    ],
  },
  {
    name: '祖師誕辰法會',
    description: '恭逢祖師誕辰，舉辦法會慶典，感恩祖師庇佑，廣施善緣。',
    start_date: '2026-10-20',
    end_date: '2026-10-20',
    registration_deadline: '2026-10-12',
    location: '本堂大殿',
    banner_color: '#1A4A8B',
    items: [
      { name: '光明燈', description: '祖師誕辰光明燈', price: 600, requires_name: true },
      { name: '消災祈福牌位', description: '消災祈福', price: 400, requires_name: true },
      { name: '供品一份', description: '供奉祖師聖誕', price: 350, requires_name: false },
    ],
  },
  {
    name: '考生祈福法會',
    description: '為即將參加升學考試的學子祈福，願文昌帝君庇佑金榜題名。',
    start_date: '2026-06-05',
    end_date: '2026-06-05',
    registration_deadline: '2026-05-28',
    location: '本堂文昌殿',
    banner_color: '#1A6B2A',
    items: [
      { name: '考生祈福護身符', description: '開光護身符一只', price: 300, requires_name: true },
      { name: '文昌祈福牌位', description: '文昌帝君加持', price: 400, requires_name: true },
      { name: '開智慧燈', description: '點燈啟智，金榜題名', price: 500, requires_name: true },
    ],
  },
];

for (const ev of events) {
  const ex = db.prepare('SELECT id FROM events WHERE name = ?').get(ev.name);
  if (!ex) {
    const r = db.prepare(`
      INSERT INTO events (name, description, start_date, end_date, registration_deadline, location, status, banner_color)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(ev.name, ev.description, ev.start_date, ev.end_date, ev.registration_deadline, ev.location, ev.banner_color);

    for (const [i, item] of ev.items.entries()) {
      db.prepare(`
        INSERT INTO event_items (event_id, name, description, price, max_quantity, requires_name, sort_order)
        VALUES (?, ?, ?, ?, 5, ?, ?)
      `).run(r.lastInsertRowid, item.name, item.description, item.price, item.requires_name ? 1 : 0, i);
    }
    console.log(`✅ 法會活動建立: ${ev.name}`);
  } else {
    console.log(`ℹ️  活動已存在: ${ev.name}`);
  }
}

console.log('\n🎉 初始化完成！');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('管理員登入：');
console.log('  電話: 0900000000');
console.log('  密碼: admin1234');
console.log('  入口: http://localhost:3000/admin/login');
console.log('');
console.log('師兄姐登入（示範帳號）：');
console.log('  電話: 0911111111 ~ 0955555555');
console.log('  密碼: member123');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

db.close();
