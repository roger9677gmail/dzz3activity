import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import { parseOptions } from '@/lib/attendance';
import AttendanceFormClient from './AttendanceFormClient';

export const dynamic = 'force-dynamic';

export default async function MemberAttendancePage({ params }) {
  const session = await getSession();
  const memberId = session.sub;
  const eventId = parseInt(params.eventId);
  const event = await db
    .prepare('SELECT id, name, start_date, end_date, registration_deadline, location, banner_color FROM events WHERE id = ?')
    .get(eventId);
  if (!event) notFound();

  const questions = (await db
    .prepare(
      `SELECT id, label, type, options, required, sort_order
         FROM event_attendance_questions
        WHERE event_id = ? AND active = 1
        ORDER BY sort_order, id`
    )
    .all(eventId))
    .map((q) => ({ ...q, options: parseOptions(q.type, q.options) }));

  const attendance = await db
    .prepare('SELECT id, notes FROM event_attendance WHERE event_id = ? AND member_id = ?')
    .get(eventId, memberId);
  const initialAnswers = {};
  if (attendance) {
    const rows = await db
      .prepare('SELECT question_id, value FROM event_attendance_answers WHERE attendance_id = ?')
      .all(attendance.id);
    for (const r of rows) {
      let v = r.value;
      if (typeof v === 'string') {
        try { v = JSON.parse(v); } catch {}
      }
      initialAnswers[r.question_id] = v;
    }
  }

  return (
    <AttendanceFormClient
      event={event}
      questions={questions}
      attendance={attendance}
      initialAnswers={initialAnswers}
      initialNotes={attendance?.notes || ''}
    />
  );
}
