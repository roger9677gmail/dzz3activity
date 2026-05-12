import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { isStaffOrAdmin } from '@/lib/staff-access';
import { parseOptions, formatAnswer } from '@/lib/attendance';
import { safeParseJSON } from '@/lib/utils';

// Staff-only view of 活動報名 (event_attendance) for a single event.
// No 金額 dimension here, so same shape as admin attendance listing.
export const GET = withAuth(async (request, { params }) => {
  const eventId = parseInt(params.eventId);
  if (!eventId) return NextResponse.json({ error: '無效的活動 ID' }, { status: 400 });

  if (!(await isStaffOrAdmin(request.session, eventId))) {
    return NextResponse.json({ error: '無權限' }, { status: 403 });
  }

  const event = await db.prepare('SELECT id, name FROM events WHERE id = ?').get(eventId);
  if (!event) return NextResponse.json({ error: '活動不存在' }, { status: 404 });

  const questions = (await db
    .prepare(
      `SELECT id, label, type, options, sort_order
         FROM event_attendance_questions
        WHERE event_id = ? AND active = 1
        ORDER BY sort_order, id`
    )
    .all(eventId))
    .map((q) => ({ ...q, options: parseOptions(q.type, q.options) }));

  const rows = await db
    .prepare(
      `SELECT a.id, a.attendee_name, a.attendee_relation, a.notes, a.created_at,
              m.name AS member_name, m.phone AS member_phone,
              l.name AS location_name
         FROM event_attendance a
         JOIN members m ON m.id = a.member_id
    LEFT JOIN locations l ON l.id = m.location_id
        WHERE a.event_id = ? AND m.is_disabled = 0
        ORDER BY m.name, (a.attendee_name IS NOT NULL), a.id`
    )
    .all(eventId);

  for (const r of rows) r.answers_pretty = [];
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const allAns = await db
      .prepare(
        `SELECT attendance_id, question_id, value
           FROM event_attendance_answers
          WHERE attendance_id IN (${placeholders})`
      )
      .all(...ids);
    const byAtt = new Map();
    for (const a of allAns) {
      if (!byAtt.has(a.attendance_id)) byAtt.set(a.attendance_id, {});
      byAtt.get(a.attendance_id)[a.question_id] = safeParseJSON(a.value, {});
    }
    for (const r of rows) {
      r.answers_pretty = questions.map((q) => ({
        label: q.label,
        text: formatAnswer(q, (byAtt.get(r.id) || {})[q.id]),
      }));
    }
  }

  return NextResponse.json({ event, questions, attendances: rows });
});
