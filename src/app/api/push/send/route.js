import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';
import { broadcastPush } from '@/lib/push';

// Resolve which push_subscriptions to target based on the body shape:
//   { eventId }           → 該活動已報名者
//   { group_ids: [...] }  → 屬於任一指定群組的師兄姐
//   {}                    → 全體 (預設)
async function resolveSubscriptions({ eventId, groupIds }) {
  if (eventId) {
    return await db
      .prepare(
        `SELECT ps.* FROM push_subscriptions ps
           JOIN registrations r ON r.member_id = ps.member_id
           JOIN members m ON m.id = ps.member_id
          WHERE r.event_id = ? AND r.status != 'cancelled' AND m.is_disabled = 0
          GROUP BY ps.id`
      )
      .all(eventId);
  }
  if (Array.isArray(groupIds) && groupIds.length > 0) {
    const placeholders = groupIds.map(() => '?').join(',');
    return await db
      .prepare(
        `SELECT ps.* FROM push_subscriptions ps
           JOIN members m ON m.id = ps.member_id
           JOIN member_group_assignments mga ON mga.member_id = ps.member_id
          WHERE mga.group_id IN (${placeholders}) AND m.is_disabled = 0
          GROUP BY ps.id`
      )
      .all(...groupIds);
  }
  return await db
    .prepare(
      `SELECT ps.* FROM push_subscriptions ps
         JOIN members m ON m.id = ps.member_id
        WHERE m.is_disabled = 0`
    )
    .all();
}

export const POST = withPermission('notifications:send', async (request) => {
  try {
    const { title, body, url, eventId, group_ids } = await request.json();
    if (!title || !body) {
      return NextResponse.json({ error: '標題及內容為必填' }, { status: 400 });
    }
    const groupIds = Array.isArray(group_ids)
      ? group_ids.map((g) => parseInt(g)).filter((n) => Number.isInteger(n) && n > 0)
      : [];

    const subscriptions = await resolveSubscriptions({ eventId, groupIds });

    if (subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0, total: 0, message: '無訂閱者' });
    }

    const payload = {
      title,
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      url: url || '/events',
      tag: `admin-${Date.now()}`,
    };

    const results = await broadcastPush(subscriptions, payload);

    const expired = results.filter((r) => r.expired);
    for (const e of expired) {
      await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(e.endpoint);
    }

    const sent = results.filter((r) => r.success).length;
    return NextResponse.json({ success: true, sent, total: subscriptions.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
