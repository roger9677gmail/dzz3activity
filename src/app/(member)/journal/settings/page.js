import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import JournalSettingsClient from './JournalSettingsClient';

export const dynamic = 'force-dynamic';

export default async function JournalSettingsPage() {
  const session = await getSession();
  const memberId = session.sub;

  const practices = await db
    .prepare(
      'SELECT id, name, type, unit_label, sort_order FROM practices WHERE active = 1 ORDER BY sort_order, id'
    )
    .all();

  const subs = await db
    .prepare(
      `SELECT practice_id, daily_target, active
         FROM member_practices
        WHERE member_id = ?`
    )
    .all(memberId);

  return <JournalSettingsClient practices={practices} subscriptions={subs} />;
}
