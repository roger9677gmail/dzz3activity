import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';

export const PUT = withPermission('groups:manage', async (request, { params }) => {
  try {
    const id = parseInt(params.id);
    if (!id) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
    const body = await request.json();
    const sets = [];
    const args = [];
    if (body.name !== undefined) {
      const t = String(body.name || '').trim();
      if (!t) return NextResponse.json({ error: '名稱不可為空' }, { status: 400 });
      if (t.length > 50) return NextResponse.json({ error: '名稱過長' }, { status: 400 });
      sets.push('name = ?'); args.push(t);
    }
    if (body.color !== undefined) {
      const c = body.color && /^#[0-9a-fA-F]{6}$/.test(body.color) ? body.color : '#8B1A1A';
      sets.push('color = ?'); args.push(c);
    }
    if (body.sort_order !== undefined) {
      sets.push('sort_order = ?'); args.push(parseInt(body.sort_order) || 0);
    }
    if (body.active !== undefined) {
      sets.push('active = ?'); args.push(body.active ? 1 : 0);
    }
    if (sets.length === 0) return NextResponse.json({ error: '沒有可更新的欄位' }, { status: 400 });
    args.push(id);
    try {
      await db.prepare(`UPDATE member_groups SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' || /Duplicate entry/i.test(err.message || '')) {
        return NextResponse.json({ error: '此群組名稱已存在' }, { status: 409 });
      }
      throw err;
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});

// Hard-delete a group; FK CASCADE cleans up member_group_assignments and
// announcement_groups.
export const DELETE = withPermission('groups:manage', async (request, { params }) => {
  const id = parseInt(params.id);
  if (!id) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
  // Refuse to delete the seeded "全體師兄姐" — it's the default broadcast target.
  const g = await db.prepare('SELECT id, name FROM member_groups WHERE id = ?').get(id);
  if (!g) return NextResponse.json({ error: '群組不存在' }, { status: 404 });
  if (g.name === '全體師兄姐') {
    return NextResponse.json({ error: '預設群組「全體師兄姐」無法刪除' }, { status: 400 });
  }
  await db.prepare('DELETE FROM member_groups WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
});
