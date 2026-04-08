import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';

export const POST = withAuth(async (request) => {
  try {
    const { endpoint, p256dh, auth } = await request.json();
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: '訂閱資料不完整' }, { status: 400 });
    }

    db.prepare(`
      INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET
        member_id=excluded.member_id,
        p256dh=excluded.p256dh,
        auth=excluded.auth,
        updated_at=datetime('now','localtime')
    `).run(request.session.sub, endpoint, p256dh, auth);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
