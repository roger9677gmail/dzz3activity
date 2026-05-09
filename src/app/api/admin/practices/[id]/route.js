import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';
import { isValidPracticeType } from '@/lib/practices';

export const PUT = withPermission('practices:manage', async (request, { params }) => {
  try {
    const id = parseInt(params.id);
    if (!id) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
    const body = await request.json();
    const sets = [];
    const args = [];

    if (body.name !== undefined) {
      const trimmed = String(body.name || '').trim();
      if (!trimmed) return NextResponse.json({ error: '名稱不可為空' }, { status: 400 });
      if (trimmed.length > 100) return NextResponse.json({ error: '名稱過長' }, { status: 400 });
      sets.push('name = ?');
      args.push(trimmed);
    }
    if (body.type !== undefined) {
      if (!isValidPracticeType(body.type)) {
        return NextResponse.json({ error: '類型必須為 count 或 duration' }, { status: 400 });
      }
      sets.push('type = ?');
      args.push(body.type);
    }
    if (body.unit_label !== undefined) {
      sets.push('unit_label = ?');
      args.push(String(body.unit_label || '').trim().slice(0, 20) || '次');
    }
    if (body.sort_order !== undefined) {
      sets.push('sort_order = ?');
      args.push(parseInt(body.sort_order) || 0);
    }
    if (body.active !== undefined) {
      sets.push('active = ?');
      args.push(body.active ? 1 : 0);
    }

    if (sets.length === 0) return NextResponse.json({ error: '沒有可更新的欄位' }, { status: 400 });
    args.push(id);

    try {
      await db.prepare(`UPDATE practices SET ${sets.join(', ')} WHERE id = ?`).run(...args);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' || /Duplicate entry/i.test(err.message || '')) {
        return NextResponse.json({ error: '此功課名稱已存在' }, { status: 409 });
      }
      throw err;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});

export const DELETE = withPermission('practices:manage', async (request, { params }) => {
  const id = parseInt(params.id);
  if (!id) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
  // Hard-delete cascades to member_practices and practice_logs via FK ON DELETE CASCADE.
  await db.prepare('DELETE FROM practices WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
});
