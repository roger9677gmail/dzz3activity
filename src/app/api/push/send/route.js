import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';
import { broadcastPush } from '@/lib/push';

export const POST = withPermission('notifications:send', async (request) => {
  try {
    const { title, body, url, eventId } = await request.json();
    if (!title || !body) {
      return NextResponse.json({ error: '標題及內容為必填' }, { status: 400 });
    }

    let subscriptions;
    if (eventId) {
      // Only send to active members registered for this event
      subscriptions = await db.prepare(`
        SELECT ps.* FROM push_subscriptions ps
        JOIN registrations r ON r.member_id = ps.member_id
        JOIN members m ON m.id = ps.member_id
        WHERE r.event_id = ? AND r.status != 'cancelled' AND m.is_disabled = 0
      `).all(eventId);
    } else {
      subscriptions = await db.prepare(`
        SELECT ps.* FROM push_subscriptions ps
        JOIN members m ON m.id = ps.member_id
        WHERE m.is_disabled = 0
      `).all();
    }

    if (subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: '無訂閱者' });
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

    // Clean up expired subscriptions
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
