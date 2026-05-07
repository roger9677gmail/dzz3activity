import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';

export const POST = withAuth(async (request) => {
  try {
    const { endpoint, p256dh, auth } = await request.json();
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: '訂閱資料不完整' }, { status: 400 });
    }

    await db.prepare(`
      INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        member_id=VALUES(member_id),
        p256dh=VALUES(p256dh),
        auth=VALUES(auth),
        updated_at=NOW()
    `).run(request.session.sub, endpoint, p256dh, auth);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
