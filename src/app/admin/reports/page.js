import { redirect } from 'next/navigation';
import { getSession, hasPermission } from '@/lib/auth';
import db from '@/lib/db';
import { safeParseJSON, formatMoney, getPaymentStatusLabel } from '@/lib/utils';
import { parseOptions, formatAnswer } from '@/lib/attendance';
import ReportsClient from './ReportsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function AdminReportsPage({ searchParams }) {
  const session = await getSession();
  if (!hasPermission(session, 'reports:view')) redirect('/admin');

  const eventId = searchParams.event_id ? parseInt(searchParams.event_id) : null;
  const type = searchParams.type === 'attendance' ? 'attendance' : 'qf'; // default 祈福
  const groupIds = (searchParams.group_ids || '')
    .split(',').map((s) => parseInt(s)).filter((n) => Number.isInteger(n) && n > 0);

  const events = await db
    .prepare(
      `SELECT id, name, start_date, end_date FROM events ORDER BY start_date DESC`
    )
    .all();

  // Mirror groups first, then regular tag groups; same convention as
  // /admin/announcements selector.
  const groups = await db
    .prepare(
      `SELECT id, name, color, location_id
         FROM member_groups
        WHERE active = 1
        ORDER BY (location_id IS NULL), sort_order, id`
    )
    .all();

  let qfRows = null;
  let attendanceRows = null;
  let attendanceQuestions = null;

  if (eventId && type === 'qf') {
    qfRows = await loadQfRows(eventId, groupIds);
  }
  if (eventId && type === 'attendance') {
    const r = await loadAttendanceRows(eventId, groupIds);
    attendanceRows = r.rows;
    attendanceQuestions = r.questions;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">報名查詢</h1>
      <ReportsClient
        events={events}
        groups={groups}
        eventId={eventId}
        type={type}
        groupIds={groupIds}
        qfRows={qfRows}
        attendanceRows={attendanceRows}
        attendanceQuestions={attendanceQuestions}
      />
    </div>
  );
}

async function loadQfRows(eventId, groupIds) {
  let sql = `
    SELECT r.id, r.created_at, r.payment_status, r.status,
           r.total_amount, r.receipt_number, r.notes,
           m.id AS member_id, m.name AS member_name, m.phone AS member_phone,
           l.name AS location_name
      FROM registrations r
      JOIN members m ON m.id = r.member_id
 LEFT JOIN locations l ON l.id = m.location_id
     WHERE r.event_id = ? AND m.is_disabled = 0 AND r.status != 'cancelled'`;
  const args = [eventId];
  if (groupIds.length > 0) {
    const placeholders = groupIds.map(() => '?').join(',');
    sql += ` AND EXISTS (SELECT 1 FROM member_group_assignments mga
                          WHERE mga.member_id = m.id AND mga.group_id IN (${placeholders}))`;
    args.push(...groupIds);
  }
  sql += ' ORDER BY m.name, r.id';
  const regs = await db.prepare(sql).all(...args);

  if (regs.length === 0) return [];

  const regIds = regs.map((r) => r.id);
  const placeholders = regIds.map(() => '?').join(',');
  const items = await db
    .prepare(
      `SELECT ri.registration_id, ri.quantity, ri.names, ri.contents, ri.subtotal,
              ri.is_gift, ri.receipt_title, ri.receipt_number, ei.name AS item_name
         FROM registration_items ri
         JOIN event_items ei ON ei.id = ri.event_item_id
        WHERE ri.registration_id IN (${placeholders})
        ORDER BY ri.registration_id, ri.is_gift, ri.id`
    )
    .all(...regIds);
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
  return regs;
}

async function loadAttendanceRows(eventId, groupIds) {
  const questions = (await db
    .prepare(
      `SELECT id, label, type, options, sort_order
         FROM event_attendance_questions
        WHERE event_id = ? AND active = 1
        ORDER BY sort_order, id`
    )
    .all(eventId))
    .map((q) => ({ ...q, options: parseOptions(q.type, q.options) }));

  let sql = `SELECT a.id, a.attendee_name, a.attendee_relation, a.notes, a.created_at,
                    m.id AS member_id, m.name AS member_name, m.phone AS member_phone,
                    l.name AS location_name
               FROM event_attendance a
               JOIN members m ON m.id = a.member_id
          LEFT JOIN locations l ON l.id = m.location_id
              WHERE a.event_id = ? AND m.is_disabled = 0`;
  const args = [eventId];
  if (groupIds.length > 0) {
    const placeholders = groupIds.map(() => '?').join(',');
    sql += ` AND EXISTS (SELECT 1 FROM member_group_assignments mga
                          WHERE mga.member_id = m.id AND mga.group_id IN (${placeholders}))`;
    args.push(...groupIds);
  }
  sql += ' ORDER BY m.name, (a.attendee_name IS NOT NULL), a.id';
  const rows = await db.prepare(sql).all(...args);

  if (rows.length === 0) return { rows: [], questions };

  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const ans = await db
    .prepare(`SELECT attendance_id, question_id, value FROM event_attendance_answers WHERE attendance_id IN (${placeholders})`)
    .all(...ids);
  const byAtt = new Map();
  for (const a of ans) {
    if (!byAtt.has(a.attendance_id)) byAtt.set(a.attendance_id, {});
    byAtt.get(a.attendance_id)[a.question_id] = safeParseJSON(a.value, {});
  }
  for (const r of rows) {
    r.answers_pretty = questions.map((q) => ({
      label: q.label,
      text: formatAnswer(q, (byAtt.get(r.id) || {})[q.id]),
    })).filter((x) => x.text);
  }

  return { rows, questions };
}

