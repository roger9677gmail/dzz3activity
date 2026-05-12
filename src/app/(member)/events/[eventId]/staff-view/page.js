import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import { isStaffOrAdmin } from '@/lib/staff-access';
import { parseOptions, formatAnswer } from '@/lib/attendance';
import { safeParseJSON } from '@/lib/utils';
import StaffViewClient from './StaffViewClient';

export const dynamic = 'force-dynamic';

export default async function StaffViewPage({ params, searchParams }) {
  const session = await getSession();
  const eventId = parseInt(params.eventId);
  if (!eventId) notFound();
  const event = await db.prepare('SELECT id, name, banner_color FROM events WHERE id = ?').get(eventId);
  if (!event) notFound();

  if (!(await isStaffOrAdmin(session, eventId))) {
    // Not staff → bounce back to the event page (no leak).
    redirect(`/events/${eventId}`);
  }

  const type = searchParams.type === 'attendance' ? 'attendance' : 'qf';

  let qfRows = null;
  let attendanceRows = null;
  let attendanceQuestions = null;

  if (type === 'qf') {
    const regs = await db
      .prepare(
        `SELECT r.id, r.payment_status, r.created_at,
                m.name AS member_name, m.phone AS member_phone, m.address AS member_address,
                l.name AS location_name
           FROM registrations r
           JOIN members m ON m.id = r.member_id
      LEFT JOIN locations l ON l.id = m.location_id
          WHERE r.event_id = ? AND r.status != 'cancelled' AND m.is_disabled = 0
          ORDER BY m.name, r.id`
      )
      .all(eventId);
    if (regs.length > 0) {
      const ids = regs.map((r) => r.id);
      const placeholders = ids.map(() => '?').join(',');
      const items = await db
        .prepare(
          `SELECT ri.registration_id, ri.quantity, ri.names, ri.contents, ri.is_gift,
                  ei.name AS item_name
             FROM registration_items ri
             JOIN event_items ei ON ei.id = ri.event_item_id
            WHERE ri.registration_id IN (${placeholders})
            ORDER BY ri.registration_id, ri.is_gift, ri.id`
        )
        .all(...ids);
      const byReg = new Map();
      for (const it of items) {
        if (!byReg.has(it.registration_id)) byReg.set(it.registration_id, []);
        byReg.get(it.registration_id).push({
          ...it,
          names_arr: safeParseJSON(it.names),
          contents_arr: safeParseJSON(it.contents),
        });
      }
      for (const r of regs) r.items = byReg.get(r.id) || [];
    }
    qfRows = regs;
  } else {
    attendanceQuestions = (await db
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
        r.answers_pretty = attendanceQuestions.map((q) => ({
          label: q.label,
          text: formatAnswer(q, (byAtt.get(r.id) || {})[q.id]),
        }));
      }
    }
    attendanceRows = rows;
  }

  return (
    <StaffViewClient
      event={event}
      type={type}
      qfRows={qfRows}
      attendanceRows={attendanceRows}
      attendanceQuestions={attendanceQuestions}
    />
  );
}
