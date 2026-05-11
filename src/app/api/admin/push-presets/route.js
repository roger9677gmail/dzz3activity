import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';

export const GET = withPermission('notifications:send', async () => {
  const rows = await db
    .prepare('SELECT id, title, body, sort_order FROM push_presets ORDER BY sort_order, id')
    .all();
  return NextResponse.json({ presets: rows });
});

export const POST = withPermission('notifications:send', async (request) => {
  try {
    const { title, body, sort_order } = await request.json();
    const t = String(title || '').trim();
    const b = String(body || '').trim();
    if (!t) return NextResponse.json({ error: '標題必填' }, { status: 400 });
    if (t.length > 200) return NextResponse.json({ error: '標題過長 (最多 200 字)' }, { status: 400 });
    if (!b) return NextResponse.json({ error: '內容必填' }, { status: 400 });

    const [{ next_sort }] = (Number.isFinite(sort_order)
      ? [{ next_sort: sort_order }]
      : await db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM push_presets').all());
    const r = await db
      .prepare('INSERT INTO push_presets (title, body, sort_order) VALUES (?, ?, ?)')
      .run(t, b, next_sort);
    return NextResponse.json({ success: true, id: r.lastInsertRowid });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
