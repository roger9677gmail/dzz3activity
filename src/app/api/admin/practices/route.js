import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';
import { isValidPracticeType } from '@/lib/practices';

export const GET = withPermission('practices:manage', async () => {
  const practices = await db
    .prepare(
      'SELECT id, name, type, unit_label, sort_order, active, created_at FROM practices ORDER BY sort_order, id'
    )
    .all();
  return NextResponse.json({ practices });
});

export const POST = withPermission('practices:manage', async (request) => {
  try {
    const { name, type, unit_label, sort_order, active } = await request.json();
    const trimmed = String(name || '').trim();
    if (!trimmed) return NextResponse.json({ error: '請填寫名稱' }, { status: 400 });
    if (trimmed.length > 100) return NextResponse.json({ error: '名稱過長' }, { status: 400 });
    if (!isValidPracticeType(type)) return NextResponse.json({ error: '類型必須為 count 或 duration' }, { status: 400 });
    const unit = String(unit_label || (type === 'duration' ? '分鐘' : '次')).trim().slice(0, 20);
    const sort = Number.isFinite(Number(sort_order)) ? parseInt(sort_order) : 0;
    const isActive = active === false || active === 0 ? 0 : 1;

    try {
      const r = await db
        .prepare('INSERT INTO practices (name, type, unit_label, sort_order, active) VALUES (?, ?, ?, ?, ?)')
        .run(trimmed, type, unit, sort, isActive);
      return NextResponse.json({ success: true, id: r.lastInsertRowid });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' || /Duplicate entry/i.test(err.message || '')) {
        return NextResponse.json({ error: '此功課名稱已存在' }, { status: 409 });
      }
      throw err;
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
