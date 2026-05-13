import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';

export const GET = withPermission('locations:manage', async () => {
  const locations = await db.prepare(
    'SELECT id, name, sort_order, active, created_at FROM locations ORDER BY sort_order, id'
  ).all();
  return NextResponse.json({ locations });
});

export const POST = withPermission('locations:manage', async (request) => {
  try {
    const { name, sort_order } = await request.json();
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return NextResponse.json({ error: '道場名稱必填' }, { status: 400 });
    }
    if (trimmed.length > 50) {
      return NextResponse.json({ error: '道場名稱過長 (最多 50 字)' }, { status: 400 });
    }
    const sort = Number.isFinite(sort_order) ? sort_order : 0;
    const result = await db
      .prepare('INSERT INTO locations (name, sort_order) VALUES (?, ?)')
      .run(trimmed, sort);
    // Auto-create mirror member group for this location so admins can target
    // announcements at it. UNIQUE(location_id) guards against accidental dups.
    try {
      await db
        .prepare('INSERT INTO member_groups (name, color, sort_order, location_id) VALUES (?, ?, ?, ?)')
        .run(trimmed, '#8B1A1A', sort, result.lastInsertRowid);
    } catch (err) {
      console.error('Failed to mirror location → group:', err);
    }
    return NextResponse.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' || /Duplicate entry/i.test(err.message || '')) {
      return NextResponse.json({ error: '此道場名稱已存在' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
