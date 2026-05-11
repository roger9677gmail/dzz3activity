import { redirect } from 'next/navigation';
import { getSession, hasPermission } from '@/lib/auth';
import db from '@/lib/db';
import NotificationsClient from './NotificationsClient';

export const dynamic = 'force-dynamic';

export default async function AdminNotificationsPage() {
  const session = await getSession();
  if (!hasPermission(session, 'notifications:send')) redirect('/admin');

  const events = await db.prepare(`
    SELECT e.id, e.name,
      (SELECT COUNT(DISTINCT ps.member_id)
       FROM push_subscriptions ps
       JOIN registrations r ON r.member_id = ps.member_id
       JOIN members m ON m.id = ps.member_id
       WHERE r.event_id = e.id AND r.status != 'cancelled' AND m.is_disabled = 0) AS sub_count
    FROM events e
    WHERE e.status = 'active'
    ORDER BY e.start_date
  `).all();
  const subCount = (await db.prepare(`
    SELECT COUNT(*) as count FROM push_subscriptions ps
    JOIN members m ON m.id = ps.member_id
    WHERE m.is_disabled = 0
  `).get()).count;

  const groups = await db
    .prepare(
      `SELECT g.id, g.name, g.color, g.location_id,
              (SELECT COUNT(DISTINCT ps.member_id)
                 FROM push_subscriptions ps
                 JOIN members m ON m.id = ps.member_id
                 JOIN member_group_assignments mga ON mga.member_id = ps.member_id
                WHERE mga.group_id = g.id AND m.is_disabled = 0) AS sub_count
         FROM member_groups g
        WHERE g.active = 1
        ORDER BY (g.location_id IS NULL), g.sort_order, g.id`
    )
    .all();

  const presets = await db
    .prepare('SELECT id, title, body, sort_order FROM push_presets ORDER BY sort_order, id')
    .all();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">推播通知</h1>
      <p className="text-sm text-gray-500 mb-6">目前有 {subCount} 位師兄姐開啟推播通知</p>
      <NotificationsClient
        events={events}
        groups={groups}
        subCount={subCount}
        initialPresets={presets}
      />
    </div>
  );
}
