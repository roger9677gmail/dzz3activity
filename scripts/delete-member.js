#!/usr/bin/env node
/**
 * One-off helper to hard-delete a 師兄姐 account and ALL related data.
 *
 * 99% of the time the right action is "停用" (is_disabled=1), which keeps
 * history intact. Use this script only when the data really must be wiped.
 *
 * Usage (preview by name):
 *   bash scripts/db-proxy.sh node scripts/delete-member.js --name "莊經理"
 *
 * If multiple members share that name, the script lists them and asks
 * you to re-run with --id <member_id>.
 *
 * Commit:
 *   bash scripts/db-proxy.sh node scripts/delete-member.js --id 42 --confirm
 *
 * What gets deleted (single transaction):
 *   1. registrations WHERE member_id = ?
 *        → CASCADE: registration_items
 *   2. members WHERE id = ?
 *        → CASCADE: member_group_assignments, member_practices, practice_logs,
 *                   practice_notes, event_attendance (+answers via CASCADE),
 *                   password_reset_codes, push_subscriptions
 *
 * Refuses if the target is an admin (is_admin=1) — revoke admin first.
 */
const mysql = require('mysql2/promise');

function parseArgs(argv) {
  const args = { confirm: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--confirm') args.confirm = true;
    else if (a === '--name') args.name = argv[++i];
    else if (a === '--email') args.email = String(argv[++i] || '').trim().toLowerCase();
    else if (a === '--id') args.id = parseInt(argv[++i]);
  }
  return args;
}

(async () => {
  const args = parseArgs(process.argv);
  if (!args.name && !args.id && !args.email) {
    console.error('Usage: --email "<email>"  OR  --name "<name>"  OR  --id <member_id>  [--confirm]');
    process.exit(1);
  }

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
  if (!config.user || !config.database) {
    console.error('Missing DB env vars.');
    process.exit(1);
  }

  const conn = await mysql.createConnection(config);
  try {
    let target;
    if (args.id) {
      const [rows] = await conn.query(
        'SELECT id, name, email, phone, is_admin, is_disabled FROM members WHERE id = ?',
        [args.id]
      );
      if (rows.length === 0) { console.error(`找不到師兄姐 id=${args.id}`); process.exit(1); }
      target = rows[0];
    } else if (args.email) {
      const [rows] = await conn.query(
        'SELECT id, name, email, phone, is_admin, is_disabled FROM members WHERE LOWER(email) = ?',
        [args.email]
      );
      if (rows.length === 0) { console.error(`找不到 email「${args.email}」的師兄姐`); process.exit(1); }
      target = rows[0];
    } else {
      const [rows] = await conn.query(
        'SELECT id, name, email, phone, is_admin, is_disabled FROM members WHERE name = ?',
        [args.name]
      );
      if (rows.length === 0) { console.error(`找不到名稱「${args.name}」的師兄姐`); process.exit(1); }
      if (rows.length > 1) {
        console.error(`有 ${rows.length} 位師兄姐叫「${args.name}」，請用 --id 指定：`);
        for (const r of rows) {
          console.error(`  id=${r.id}  ${r.email || '(no email)'}${r.phone ? ' '+r.phone : ''}`);
        }
        process.exit(1);
      }
      target = rows[0];
    }

    console.log(`Target: id=${target.id}  name=${target.name}`);
    console.log(`  email=${target.email || '-'}  phone=${target.phone || '-'}`);
    console.log(`  is_admin=${target.is_admin}  is_disabled=${target.is_disabled}`);

    if (target.is_admin) {
      console.error('\n❌ 此帳號目前是管理員，請先到 /admin/admins 撤銷後台權限再刪除。');
      process.exit(1);
    }

    // Related counts (informational)
    const tables = [
      ['registrations', 'member_id'],
      ['event_attendance', 'member_id'],
      ['member_group_assignments', 'member_id'],
      ['member_practices', 'member_id'],
      ['practice_logs', 'member_id'],
      ['practice_notes', 'member_id'],
      ['password_reset_codes', 'member_id'],
      ['push_subscriptions', 'member_id'],
    ];
    console.log('\nRelated rows:');
    for (const [tbl, col] of tables) {
      try {
        const [[{ count }]] = await conn.query(
          `SELECT COUNT(*) AS count FROM ${tbl} WHERE ${col} = ?`, [target.id]
        );
        console.log(`  ${tbl}: ${count}`);
      } catch (err) {
        console.log(`  ${tbl}: (skipped — ${err.code || err.message})`);
      }
    }

    if (!args.confirm) {
      console.log('\n(dry-run — pass --confirm to actually delete)');
      return;
    }

    await conn.beginTransaction();
    try {
      const [r1] = await conn.query('DELETE FROM registrations WHERE member_id = ?', [target.id]);
      console.log(`\n✓ Deleted ${r1.affectedRows} registration(s) (registration_items CASCADE)`);

      const [r2] = await conn.query('DELETE FROM members WHERE id = ?', [target.id]);
      console.log(`✓ Deleted ${r2.affectedRows} member row (all CASCADE FKs auto-clean)`);

      await conn.commit();
      console.log('\nDone.');
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  } finally {
    await conn.end();
  }
})().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
