import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';

export const PUT = withPermission('locations:manage', async (request, { params }) => {
  try {
    const id = parseInt(params.id);
    if (!id) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });

    const { name, sort_order, active } = await request.json();
    const sets = [];
    const args = [];
    if (typeof name === 'string') {
      const trimmed = name.trim();
      if (!trimmed) return NextResponse.json({ error: '道場名稱不可為空' }, { status: 400 });
      if (trimmed.length > 50) return NextResponse.json({ error: '道場名稱過長' }, { status: 400 });
      sets.push('name = ?');
      args.push(trimmed);
    }
    if (Number.isFinite(sort_order)) {
      sets.push('sort_order = ?');
      args.push(sort_order);
    }
    if (active !== undefined) {
      sets.push('active = ?');
      args.push(active ? 1 : 0);
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: '沒有可更新的欄位' }, { status: 400 });
    }
    args.push(id);
    await db.prepare(`UPDATE locations SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: '此道場名稱已存在' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});

export const DELETE = withPermission('locations:manage', async (request, { params }) => {
  const id = parseInt(params.id);
  if (!id) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });

  // Refuse to delete if any member is using it (preserves data integrity).
  const inUse = await db.prepare('SELECT COUNT(*) AS c FROM members WHERE location_id = ?').get(id);
  if ((inUse?.c || 0) > 0) {
    return NextResponse.json({ error: `仍有 ${inUse.c} 位師兄姐屬於此道場，請先轉移後再刪除`, count: inUse.c }, { status: 400 });
  }
  await db.prepare('DELETE FROM locations WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
});
