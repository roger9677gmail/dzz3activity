import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';

export const PUT = withPermission('notifications:send', async (request, { params }) => {
  try {
    const id = parseInt(params.id);
    if (!id) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
    const body = await request.json();
    const sets = [];
    const args = [];
    if (body.title !== undefined) {
      const t = String(body.title || '').trim();
      if (!t) return NextResponse.json({ error: '標題不可為空' }, { status: 400 });
      if (t.length > 200) return NextResponse.json({ error: '標題過長' }, { status: 400 });
      sets.push('title = ?'); args.push(t);
    }
    if (body.body !== undefined) {
      const b = String(body.body || '').trim();
      if (!b) return NextResponse.json({ error: '內容不可為空' }, { status: 400 });
      sets.push('body = ?'); args.push(b);
    }
    if (Number.isFinite(body.sort_order)) {
      sets.push('sort_order = ?'); args.push(body.sort_order);
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: '沒有可更新的欄位' }, { status: 400 });
    }
    args.push(id);
    await db.prepare(`UPDATE push_presets SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});

export const DELETE = withPermission('notifications:send', async (request, { params }) => {
  const id = parseInt(params.id);
  if (!id) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
  await db.prepare('DELETE FROM push_presets WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
});
