import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';

// GET → my subscribed practices joined with practice catalogue.
export const GET = withAuth(async (request) => {
  const memberId = request.session.sub;
  const rows = await db
    .prepare(
      `SELECT p.id, p.name, p.type, p.unit_label, p.sort_order,
              mp.daily_target, mp.active
         FROM practices p
         JOIN member_practices mp ON mp.practice_id = p.id
        WHERE mp.member_id = ? AND p.active = 1 AND mp.active = 1
        ORDER BY p.sort_order, p.id`
    )
    .all(memberId);
  return NextResponse.json({ practices: rows });
});

// PUT body: { subscriptions: [{ practice_id, daily_target|null }, ...] }
// Replaces the member's full subscription list (idempotent).
export const PUT = withAuth(async (request) => {
  const memberId = request.session.sub;
  try {
    const { subscriptions } = await request.json();
    if (!Array.isArray(subscriptions)) {
      return NextResponse.json({ error: 'subscriptions 必須為陣列' }, { status: 400 });
    }

    // Validate practice ids exist + active.
    const ids = subscriptions
      .map((s) => parseInt(s?.practice_id))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      const valid = await db
        .prepare(`SELECT id FROM practices WHERE active = 1 AND id IN (${placeholders})`)
        .all(...ids);
      const validSet = new Set(valid.map((v) => v.id));
      for (const id of ids) {
        if (!validSet.has(id)) {
          return NextResponse.json({ error: `功課 #${id} 不存在或已停用` }, { status: 400 });
        }
      }
    }

    // Soft-deactivate all existing rows, then upsert the new set.
    await db.prepare('UPDATE member_practices SET active = 0 WHERE member_id = ?').run(memberId);
    for (const sub of subscriptions) {
      const practiceId = parseInt(sub.practice_id);
      const target = sub.daily_target == null || sub.daily_target === ''
        ? null
        : Math.max(0, parseInt(sub.daily_target) || 0);
      await db
        .prepare(
          `INSERT INTO member_practices (member_id, practice_id, daily_target, active)
             VALUES (?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE daily_target = VALUES(daily_target), active = 1`
        )
        .run(memberId, practiceId, target);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
