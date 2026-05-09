import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import { todayDateString, daysAgoDateString, RANKING_PERIOD_DAYS } from '@/lib/practices';
import JournalClient from './JournalClient';

export const dynamic = 'force-dynamic';

export default async function JournalPage({ searchParams }) {
  const session = await getSession();
  const memberId = session.sub;
  const tab = searchParams?.tab || 'today';
  const dateParam = searchParams?.date;

  const today = todayDateString();
  const date = dateParam || today;

  // Subscribed practices (joined with catalogue).
  const subscriptions = await db
    .prepare(
      `SELECT p.id, p.name, p.type, p.unit_label, p.sort_order,
              mp.daily_target
         FROM practices p
         JOIN member_practices mp ON mp.practice_id = p.id
        WHERE mp.member_id = ? AND p.active = 1 AND mp.active = 1
        ORDER BY p.sort_order, p.id`
    )
    .all(memberId);

  // Logs for the visible date.
  const dayLogs = await db
    .prepare('SELECT practice_id, value FROM practice_logs WHERE member_id = ? AND log_date = ?')
    .all(memberId, date);

  // Logs for the last 90 days, for heatmap.
  const from = daysAgoDateString(RANKING_PERIOD_DAYS - 1);
  const rangeLogs = await db
    .prepare(
      `SELECT practice_id, DATE_FORMAT(log_date, '%Y-%m-%d') AS log_date, value
         FROM practice_logs
        WHERE member_id = ? AND log_date BETWEEN ? AND ?
        ORDER BY log_date`
    )
    .all(memberId, from, today);

  // Notes for the visible date.
  const dayNotes = await db
    .prepare(
      `SELECT id, DATE_FORMAT(log_date, '%Y-%m-%d') AS log_date, content, is_public, created_at
         FROM practice_notes
        WHERE member_id = ? AND log_date = ?
        ORDER BY created_at DESC`
    )
    .all(memberId, date);

  return (
    <JournalClient
      session={{ sub: Number(memberId), name: session.name }}
      subscriptions={subscriptions}
      dayLogs={dayLogs}
      rangeLogs={rangeLogs}
      dayNotes={dayNotes}
      today={today}
      date={date}
      tab={tab}
    />
  );
}
