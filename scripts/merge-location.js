#!/usr/bin/env node
/**
 * One-off helper to merge two locations: re-points every member from a
 * "source" 道場 to a "target" 道場 and then deletes the source.
 *
 * Usage (preview, no writes):
 *   bash scripts/db-proxy.sh node scripts/merge-location.js \
 *     --from "靜心禪苑(新竹)" --to "靜心禪苑"
 *
 * Usage (commit):
 *   bash scripts/db-proxy.sh node scripts/merge-location.js \
 *     --from "靜心禪苑(新竹)" --to "靜心禪苑" --confirm
 *
 * What it does inside a single transaction:
 *   1. UPDATE members SET location_id = <to.id> WHERE location_id = <from.id>
 *   2. INSERT IGNORE member_group_assignments for the new mirror group
 *      (so members instantly belong to the new 道場 mirror group)
 *   3. DELETE FROM locations WHERE id = <from.id>
 *      → FK CASCADE drops the old mirror member_group + any stale assignments
 *
 * Members keep their existing non-mirror group tags untouched.
 */
const mysql = require('mysql2/promise');

function parseArgs(argv) {
  const args = { confirm: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--confirm') args.confirm = true;
    else if (a === '--from') args.from = argv[++i];
    else if (a === '--to') args.to = argv[++i];
  }
  return args;
}

(async () => {
  const args = parseArgs(process.argv);
  if (!args.from || !args.to) {
    console.error('Usage: --from "<source name>" --to "<target name>" [--confirm]');
    process.exit(1);
  }
  if (args.from === args.to) {
    console.error('--from and --to must differ');
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
    console.error('Missing DB env vars: DB_USER, DB_NAME, DB_PASSWORD, and DB_HOST or DB_SOCKET_PATH.');
    process.exit(1);
  }

  const conn = await mysql.createConnection(config);
  try {
    const [fromRows] = await conn.query('SELECT id, name FROM locations WHERE name = ?', [args.from]);
    const [toRows]   = await conn.query('SELECT id, name FROM locations WHERE name = ?', [args.to]);
    if (fromRows.length === 0) { console.error(`找不到來源道場「${args.from}」`); process.exit(1); }
    if (toRows.length === 0)   { console.error(`找不到目標道場「${args.to}」`); process.exit(1); }
    const fromId = fromRows[0].id;
    const toId = toRows[0].id;
    console.log(`Source: ${args.from} (id=${fromId})`);
    console.log(`Target: ${args.to}   (id=${toId})`);

    const [[{ count: memberCount }]] = await conn.query(
      'SELECT COUNT(*) AS count FROM members WHERE location_id = ?', [fromId]
    );
    console.log(`Members under source: ${memberCount}`);

    // Show mirror group situation
    const [fromGroup] = await conn.query(
      'SELECT id, name FROM member_groups WHERE location_id = ?', [fromId]
    );
    const [toGroup] = await conn.query(
      'SELECT id, name FROM member_groups WHERE location_id = ?', [toId]
    );
    if (fromGroup[0]) console.log(`Source mirror group: ${fromGroup[0].name} (id=${fromGroup[0].id}) — will be deleted via CASCADE`);
    if (toGroup[0])   console.log(`Target mirror group: ${toGroup[0].name} (id=${toGroup[0].id})`);

    if (!args.confirm) {
      console.log('\n(dry-run — pass --confirm to apply)');
      return;
    }

    await conn.beginTransaction();
    try {
      const [u] = await conn.query(
        'UPDATE members SET location_id = ? WHERE location_id = ?', [toId, fromId]
      );
      console.log(`✓ Members re-pointed: ${u.affectedRows}`);

      if (toGroup[0]) {
        const [r] = await conn.query(
          `INSERT IGNORE INTO member_group_assignments (member_id, group_id)
             SELECT id, ? FROM members WHERE location_id = ?`,
          [toGroup[0].id, toId]
        );
        console.log(`✓ Mirror-group assignments inserted: ${r.affectedRows}`);
      }

      const [d] = await conn.query('DELETE FROM locations WHERE id = ?', [fromId]);
      console.log(`✓ Source location deleted: ${d.affectedRows} row(s) (FK CASCADE cleans old mirror + assignments)`);

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
