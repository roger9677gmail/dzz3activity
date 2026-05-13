import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';
import { isValidType, normalizeOptions } from '@/lib/attendance';

export const GET = withPermission('attendance:manage', async (request, { params }) => {
  const eventId = parseInt(params.eventId);
  if (!eventId) return NextResponse.json({ error: '無效的活動 ID' }, { status: 400 });
  const questions = await db
    .prepare(
      `SELECT id, event_id, label, type, options, required, sort_order, active, created_at
         FROM event_attendance_questions
        WHERE event_id = ?
        ORDER BY sort_order, id`
    )
    .all(eventId);
  return NextResponse.json({ questions });
});

export const POST = withPermission('attendance:manage', async (request, { params }) => {
  try {
    const eventId = parseInt(params.eventId);
    if (!eventId) return NextResponse.json({ error: '無效的活動 ID' }, { status: 400 });
    const ev = await db.prepare('SELECT id FROM events WHERE id = ?').get(eventId);
    if (!ev) return NextResponse.json({ error: '活動不存在' }, { status: 404 });

    const body = await request.json();
    const label = String(body.label || '').trim();
    if (!label) return NextResponse.json({ error: '請填寫題目' }, { status: 400 });
    if (label.length > 200) return NextResponse.json({ error: '題目過長' }, { status: 400 });
    if (!isValidType(body.type)) return NextResponse.json({ error: '未知題型' }, { status: 400 });
    const opts = normalizeOptions(body.type, body.options);
    if (!opts.ok) return NextResponse.json({ error: opts.error }, { status: 400 });

    const sort = Number.isFinite(Number(body.sort_order)) ? parseInt(body.sort_order) : 0;
    const required = body.required ? 1 : 0;

    const r = await db
      .prepare(
        `INSERT INTO event_attendance_questions
           (event_id, label, type, options, required, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(eventId, label, body.type, JSON.stringify(opts.value), required, sort);
    return NextResponse.json({ success: true, id: r.lastInsertRowid });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: '伺服器錯誤' }, { status: 500 });
  }
});
