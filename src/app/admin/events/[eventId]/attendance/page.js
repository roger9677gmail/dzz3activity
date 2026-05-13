import { redirect, notFound } from 'next/navigation';
import { getSession, hasPermission } from '@/lib/auth';
import db from '@/lib/db';
import Link from 'next/link';
import { parseOptions } from '@/lib/attendance';
import { safeParseJSON } from '@/lib/utils';
import AttendanceAdminClient from './AttendanceAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminEventAttendancePage({ params }) {
  const session = await getSession();
  if (!hasPermission(session, 'attendance:manage')) redirect('/admin');

  const eventId = parseInt(params.eventId);
  const event = await db.prepare('SELECT id, name, start_date FROM events WHERE id = ?').get(eventId);
  if (!event) notFound();

  const questions = (await db
    .prepare(
      `SELECT id, label, type, options, required, sort_order, active
         FROM event_attendance_questions
        WHERE event_id = ?
        ORDER BY sort_order, id`
    )
    .all(eventId))
    .map((q) => ({ ...q, options: parseOptions(q.type, q.options) }));

  const attendances = await db
    .prepare(
      `SELECT a.id, a.member_id, a.attendee_name, a.attendee_relation,
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
  for (const r of attendances) r.answers = {};
  if (attendances.length > 0) {
    const ids = attendances.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const allAns = await db
      .prepare(
        `SELECT attendance_id, question_id, value
           FROM event_attendance_answers
          WHERE attendance_id IN (${placeholders})`
      )
      .all(...ids);
    const byAtt = new Map(attendances.map((r) => [r.id, r]));
    for (const a of allAns) {
      const r = byAtt.get(a.attendance_id);
      if (r) r.answers[a.question_id] = safeParseJSON(a.value, {});
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div>
          <Link href={`/admin/events/${eventId}`} className="text-xs text-gray-500 hover:text-temple-red">← 回活動編輯</Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">{event.name} ・ 活動登記</h1>
        </div>
        <a
          href={`/api/admin/events/${eventId}/attendance/export`}
          className="btn-secondary text-sm whitespace-nowrap"
        >📄 匯出 Excel</a>
      </div>
      <AttendanceAdminClient
        eventId={eventId}
        initialQuestions={questions}
        attendances={attendances}
      />
    </div>
  );
}
