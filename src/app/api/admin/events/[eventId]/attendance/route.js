import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withPermission } from '@/lib/middleware';
import { parseOptions } from '@/lib/attendance';

export const GET = withPermission('attendance:manage', async (request, { params }) => {
  const eventId = parseInt(params.eventId);
  if (!eventId) return NextResponse.json({ error: '無效的活動 ID' }, { status: 400 });

  const event = await db.prepare('SELECT id, name, start_date FROM events WHERE id = ?').get(eventId);
  if (!event) return NextResponse.json({ error: '活動不存在' }, { status: 404 });

  const questions = (await db
    .prepare(
      `SELECT id, label, type, options, required, sort_order
         FROM event_attendance_questions
        WHERE event_id = ?
        ORDER BY sort_order, id`
    )
    .all(eventId))
    .map((q) => ({ ...q, options: parseOptions(q.type, q.options) }));

  const rows = await db
    .prepare(
      `SELECT a.id, a.event_id, a.member_id, a.attendee_name, a.attendee_relation,
              a.notes, a.created_at, a.updated_at,
              m.name AS member_name, m.phone AS member_phone, m.email AS member_email,
              l.name AS location_name
         FROM event_attendance a
         JOIN members m ON m.id = a.member_id
    LEFT JOIN locations l ON l.id = m.location_id
        WHERE a.event_id = ? AND m.is_disabled = 0
        ORDER BY m.name, (a.attendee_name IS NOT NULL), a.id`
    )
    .all(eventId);

  for (const r of rows) {
    const ans = await db
      .prepare('SELECT question_id, value FROM event_attendance_answers WHERE attendance_id = ?')
      .all(r.id);
    const map = {};
    for (const a of ans) {
      let v = a.value;
      if (typeof v === 'string') {
        try { v = JSON.parse(v); } catch {}
      }
      map[a.question_id] = v;
    }
    r.answers = map;
  }

  return NextResponse.json({ event, questions, attendances: rows });
});
