import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';

export const POST = withAuth(async (request) => {
  try {
    const { endpoint } = await request.json();
    if (!endpoint) return NextResponse.json({ error: '缺少 endpoint' }, { status: 400 });
    await db.prepare(
      'DELETE FROM push_subscriptions WHERE endpoint = ? AND member_id = ?'
    ).run(endpoint, request.session.sub);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
