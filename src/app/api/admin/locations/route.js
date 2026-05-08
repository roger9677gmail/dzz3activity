import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAdminAuth } from '@/lib/middleware';

export const GET = withAdminAuth(async () => {
  const locations = await db.prepare(
    'SELECT id, name, sort_order, active, created_at FROM locations ORDER BY sort_order, id'
  ).all();
  return NextResponse.json({ locations });
});

export const POST = withAdminAuth(async (request) => {
  try {
    const { name, sort_order } = await request.json();
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return NextResponse.json({ error: '道場名稱必填' }, { status: 400 });
    }
    if (trimmed.length > 50) {
      return NextResponse.json({ error: '道場名稱過長 (最多 50 字)' }, { status: 400 });
    }
    const result = await db
      .prepare('INSERT INTO locations (name, sort_order) VALUES (?, ?)')
      .run(trimmed, Number.isFinite(sort_order) ? sort_order : 0);
    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' || /Duplicate entry/i.test(err.message || '')) {
      return NextResponse.json({ error: '此道場名稱已存在' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
