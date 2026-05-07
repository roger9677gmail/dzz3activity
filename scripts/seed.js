#!/usr/bin/env node
/**
 * Seed initial data for a fresh MySQL database.
 * Assumes scripts/migrate.js has already created the schema.
 *   DB_HOST=... DB_USER=... DB_PASSWORD=... DB_NAME=... node scripts/seed.js
 */
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const config = process.env.DB_SOCKET_PATH
  ? {
      socketPath: process.env.DB_SOCKET_PATH,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    }
  : {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    };

async function ensureMember(conn, name, phone, password, role) {
  const [rows] = await conn.query('SELECT id FROM members WHERE phone = ?', [phone]);
  if (rows.length > 0) return null;
  const hash = bcrypt.hashSync(password, 10);
  await conn.query(
    'INSERT INTO members (name, phone, password, role) VALUES (?, ?, ?, ?)',
    [name, phone, hash, role]
  );
  return phone;
}

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

(async () => {
  if (!config.user || !config.database) {
    console.error('Missing DB env vars: DB_USER, DB_NAME, DB_PASSWORD, and DB_HOST or DB_SOCKET_PATH.');
    process.exit(1);
  }
  const conn = await mysql.createConnection(config);
  try {
    if (await ensureMember(conn, '管理員', '0900000000', 'admin1234', 'admin')) {
      console.log('✅ 管理員帳號建立: 0900000000 / admin1234');
    } else {
      console.log('ℹ️  管理員帳號已存在');
    }

    const demoMembers = [
      { name: '王師兄', phone: '0911111111' },
      { name: '李師姐', phone: '0922222222' },
      { name: '張師兄', phone: '0933333333' },
      { name: '陳師姐', phone: '0944444444' },
      { name: '林師兄', phone: '0955555555' },
    ];
    for (const m of demoMembers) {
      if (await ensureMember(conn, m.name, m.phone, 'member123', 'member')) {
        console.log(`✅ 師兄姐帳號: ${m.name} / ${m.phone} / member123`);
      }
    }

    for (const ev of events) {
      const [exRows] = await conn.query('SELECT id FROM events WHERE name = ?', [ev.name]);
      if (exRows.length > 0) {
        console.log(`ℹ️  活動已存在: ${ev.name}`);
        continue;
      }
      const [r] = await conn.query(
        `INSERT INTO events (name, description, start_date, end_date, registration_deadline, location, status, banner_color)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
        [ev.name, ev.description, ev.start_date, ev.end_date, ev.registration_deadline, ev.location, ev.banner_color]
      );
      const eventId = r.insertId;
      for (const [i, item] of ev.items.entries()) {
        await conn.query(
          `INSERT INTO event_items (event_id, name, description, price, max_quantity, requires_name, sort_order)
           VALUES (?, ?, ?, ?, 5, ?, ?)`,
          [eventId, item.name, item.description, item.price, item.requires_name ? 1 : 0, i]
        );
      }
      console.log(`✅ 法會活動建立: ${ev.name}`);
    }

    console.log('\n🎉 初始化完成！');
  } finally {
    await conn.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
