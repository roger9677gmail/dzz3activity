import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';

export const GET = withPermission('groups:manage', async () => {
  const groups = await db
    .prepare(
      `SELECT g.id, g.name, g.color, g.sort_order, g.active, g.location_id, g.created_at,
              (SELECT COUNT(*) FROM member_group_assignments a
                 JOIN members m ON m.id = a.member_id
                WHERE a.group_id = g.id AND m.is_disabled = 0) AS member_count
         FROM member_groups g
        ORDER BY g.sort_order, g.id`
    )
    .all();
  return NextResponse.json({ groups });
});

export const POST = withPermission('groups:manage', async (request) => {
  try {
    const { name, color, sort_order, active } = await request.json();
    const trimmed = String(name || '').trim();
    if (!trimmed) return NextResponse.json({ error: '請填寫群組名稱' }, { status: 400 });
    if (trimmed.length > 50) return NextResponse.json({ error: '名稱過長' }, { status: 400 });
    const c = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#8B1A1A';
    const sort = Number.isFinite(Number(sort_order)) ? parseInt(sort_order) : 0;
    const isActive = active === false || active === 0 ? 0 : 1;
    try {
      const r = await db
        .prepare('INSERT INTO member_groups (name, color, sort_order, active) VALUES (?, ?, ?, ?)')
        .run(trimmed, c, sort, isActive);
      return NextResponse.json({ success: true, id: r.lastInsertRowid });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' || /Duplicate entry/i.test(err.message || '')) {
        return NextResponse.json({ error: '此群組名稱已存在' }, { status: 409 });
      }
      throw err;
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
