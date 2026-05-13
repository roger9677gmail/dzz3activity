import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';
import { isValidType, normalizeOptions } from '@/lib/attendance';

export const PUT = withPermission('attendance:manage', async (request, { params }) => {
  try {
    const eventId = parseInt(params.eventId);
    const qid = parseInt(params.qid);
    if (!eventId || !qid) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
    const cur = await db
      .prepare('SELECT id, type, options FROM event_attendance_questions WHERE id = ? AND event_id = ?')
      .get(qid, eventId);
    if (!cur) return NextResponse.json({ error: '題目不存在' }, { status: 404 });

    const body = await request.json();
    const sets = [];
    const args = [];

    if (body.label !== undefined) {
      const v = String(body.label || '').trim();
      if (!v) return NextResponse.json({ error: '題目不可為空' }, { status: 400 });
      if (v.length > 200) return NextResponse.json({ error: '題目過長' }, { status: 400 });
      sets.push('label = ?'); args.push(v);
    }
    if (body.type !== undefined && body.type !== cur.type) {
      if (!isValidType(body.type)) return NextResponse.json({ error: '未知題型' }, { status: 400 });
      sets.push('type = ?'); args.push(body.type);
    }
    const effType = body.type !== undefined ? body.type : cur.type;
    if (body.options !== undefined) {
      const opts = normalizeOptions(effType, body.options);
      if (!opts.ok) return NextResponse.json({ error: opts.error }, { status: 400 });
      sets.push('options = ?'); args.push(JSON.stringify(opts.value));
    }
    if (body.required !== undefined) {
      sets.push('required = ?'); args.push(body.required ? 1 : 0);
    }
    if (body.sort_order !== undefined) {
      sets.push('sort_order = ?'); args.push(parseInt(body.sort_order) || 0);
    }
    if (body.active !== undefined) {
      sets.push('active = ?'); args.push(body.active ? 1 : 0);
    }
    if (sets.length === 0) return NextResponse.json({ error: '沒有可更新的欄位' }, { status: 400 });
    args.push(qid);
    await db
      .prepare(`UPDATE event_attendance_questions SET ${sets.join(', ')} WHERE id = ?`)
      .run(...args);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});

export const DELETE = withPermission('attendance:manage', async (request, { params }) => {
  const eventId = parseInt(params.eventId);
  const qid = parseInt(params.qid);
  if (!eventId || !qid) return NextResponse.json({ error: '無效的 ID' }, { status: 400 });
  // FK CASCADE on answers
  await db
    .prepare('DELETE FROM event_attendance_questions WHERE id = ? AND event_id = ?')
    .run(qid, eventId);
  return NextResponse.json({ success: true });
});
