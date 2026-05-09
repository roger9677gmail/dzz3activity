import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import db from '@/lib/db';
import NotificationsClient from './NotificationsClient';

export const dynamic = 'force-dynamic';

export default async function AdminNotificationsPage() {
  const session = await getSession(true);
  if (!session) redirect('/admin/login');

  const events = await db.prepare(`
    SELECT e.id, e.name,
      (SELECT COUNT(DISTINCT ps.member_id)
       FROM push_subscriptions ps
       JOIN registrations r ON r.member_id = ps.member_id
       WHERE r.event_id = e.id AND r.status != 'cancelled') AS sub_count
    FROM events e
    WHERE e.status = 'active'
    ORDER BY e.start_date
  `).all();
  const subCount = (await db.prepare('SELECT COUNT(*) as count FROM push_subscriptions').get()).count;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">推播通知</h1>
      <p className="text-sm text-gray-500 mb-6">目前有 {subCount} 位師兄姐開啟推播通知</p>
      <NotificationsClient events={events} subCount={subCount} />
    </div>
  );
}
