#!/usr/bin/env node
/**
 * Bootstrap or add an admin user.
 * Usage:
 *   DB_HOST=... DB_USER=... DB_PASSWORD=... DB_NAME=... \
 *     node scripts/create-admin.js <email> "<name>" <password> [phone]
 *
 * If the email already exists, the user's role/password/name are updated.
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

const [, , email, name, password, phone] = process.argv;

if (!email || !name || !password) {
  console.error('Usage: node scripts/create-admin.js <email> "<name>" <password> [phone]');
  process.exit(1);
}
if (password.length < 6) {
  console.error('Password must be at least 6 characters.');
  process.exit(1);
}

(async () => {
  const conn = await mysql.createConnection(config);
  try {
    const hash = bcrypt.hashSync(password, 10);
    const [existing] = await conn.query('SELECT id FROM members WHERE email = ?', [email]);
    if (existing.length > 0) {
      await conn.query(
        'UPDATE members SET name = ?, password = ?, role = ?, phone = ? WHERE email = ?',
        [name, hash, 'admin', phone || null, email]
      );
      console.log(`✅ 已更新既有帳號為管理員: ${email}`);
    } else {
      await conn.query(
        'INSERT INTO members (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)',
        [name, email, phone || null, hash, 'admin']
      );
      console.log(`✅ 管理員建立: ${email}`);
    }
  } finally {
    await conn.end();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
